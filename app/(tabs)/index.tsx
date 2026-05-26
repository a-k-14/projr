import { Text } from '@/components/ui/AppText';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  FadeInRight,
  FadeOutRight,
  LinearTransition,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenTitle } from '../../components/settings-ui';
import { TransactionListItem } from '../../components/TransactionListItem';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppSwitch } from '../../components/ui/AppSwitch';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { getCompactScrollableBottomPadding } from '../../components/ui/safeBottom';
import { SegmentedPillSwitch } from '../../components/ui/SegmentedPillSwitch';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { ASSET_BG, ASSET_TONE } from '../../lib/assetVisuals';
import { getCategoryDisplayIcon } from '../../lib/category-utils';
import {
  formatDate,
  getDateRange,
  getRelativeDateLabel,
  toLocalDateKey,
  toLocalDayEndISO,
  toLocalDayStartISO
} from '../../lib/dateUtils';
import { DEPOSIT_VISUAL } from '../../lib/depositVisuals';
import { formatCurrency, getLoanSummary, getLoanTransactionKind, getTotalBalance, getTransactionCashflowImpact } from '../../lib/derived';
import { CARD_PADDING, FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { getFixedDepositSummary } from '../../lib/fixed-deposits';
import {
  BUTTON_TOKENS,
  HELP_TEXTS,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_SURFACE,
  HOME_TEXT,
  getNetWorthChangeTheme
} from '../../lib/layoutTokens';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../../lib/settings-shared';
import { registerTabReset } from '../../lib/tabResetRegistry';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { getCashflowSnapshot } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useAssetsStore } from '../../stores/useAssetsStore';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useFixedDepositsStore } from '../../stores/useFixedDepositsStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';
import type {
  Account,
  AccountType,
  CashflowSummary,
  Category,
  LoanStatus,
  LoanWithSummary,
  PeriodType,
  Transaction
} from '../../types';

function getGreeting() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sun, 6 = Sat
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
  if (day === 0 || day === 6) return `Happy ${dayName}`;
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

type HomePeriodType = 'today' | PeriodType;

const PERIODS: HomePeriodType[] = ['today', 'week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<HomePeriodType, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom'
};

export default function HomeScreen() {
  return <HomeScreenContent />;
}

function HomeScreenContent() {
  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const categories = useCategoriesStore((s) => s.categories);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);
  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);
  const settingsYearStart = useUIStore((s) => s.settings.yearStart);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const homeExcludedAccountIds = useUIStore((s) => s.settings.homeExcludedAccountIds);
  const updateSettings = useUIStore((s) => s.updateSettings);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [showBalanceVisibilitySheet, setShowBalanceVisibilitySheet] = useState(false);

  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const accountScrollRef = useRef<any>(null);
  const pageScrollTopRef = useRef<(() => void) | null>(null);

  const orderedAccounts = useMemo(
    () => accounts.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt.localeCompare(b.createdAt)),
    [accounts],
  );

  const verticalScrolls = useSharedValue<number[]>([0]);
  const indicatorY = useSharedValue(0);

  const [period, setPeriod] = useState<HomePeriodType>('today');
  const [homeFullResetNonce, setHomeFullResetNonce] = useState(0);

  const [customRangeFrom, setCustomRangeFrom] = useState(() => toLocalDayStartISO(new Date()));
  const [customRangeTo, setCustomRangeTo] = useState(() => toLocalDayEndISO(new Date()));
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const [customRangeOpen, setCustomRangeOpen] = useState(false);

  useEffect(() => {
    return registerTabReset('index', ({ mode, animated }) => {
      if (mode === 'full') {
        pageScrollTopRef.current?.();
        accountScrollRef.current?.scrollTo({ x: 0, animated });
        setPeriod('today');
        setHomeFullResetNonce((n) => n + 1);
      }
    });
  }, [setPeriod, setHomeFullResetNonce]);



  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);

  const trackedTotalBalance = useMemo(() => getTotalBalance(accounts), [accounts]);
  const includedAccountIds = useMemo(() => new Set(homeExcludedAccountIds), [homeExcludedAccountIds]);
  const includedAccounts = useMemo(
    () => accounts.filter((account) => !includedAccountIds.has(account.id)),
    [accounts, includedAccountIds],
  );
  const includedHomeBalance = useMemo(() => getTotalBalance(includedAccounts), [includedAccounts]);

  const loanSummary = useMemo(() => getLoanSummary(loans), [loans]);
  const depositsList = useFixedDepositsStore((s) => s.deposits);
  const depositSummary = useMemo(() => getFixedDepositSummary(depositsList), [depositsList]);
  const assetsValue = useAssetsStore((s) => s.totalValue);
  const netWorth = trackedTotalBalance + loanSummary.net + depositSummary.activeInvestedValue + assetsValue;

  const accountsLoaded = useAccountsStore((s) => s.isLoaded);
  const depositsLoaded = useFixedDepositsStore((s) => s.isLoaded);
  const assetsLoaded = useAssetsStore((s) => s.isLoaded);
  const allLoaded = accountsLoaded && loansLoaded && depositsLoaded && assetsLoaded;

  // Retain last non-zero NW so a transient reload cycle never flashes 0 on the chip
  const lastNonZeroNWRef = useRef(netWorth);
  if (netWorth !== 0) lastNonZeroNWRef.current = netWorth;
  const stableNetWorth = allLoaded ? netWorth : (netWorth !== 0 ? netWorth : lastNonZeroNWRef.current);
  const budgetSummary = useMemo(() => {
    const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
    const spentPercent = totalBudgeted > 0
      ? Math.max(0, Math.round((totalSpent / totalBudgeted) * 100))
      : 0;

    return { spentPercent };
  }, [budgets]);

  useEffect(() => {
    const now = new Date();
    loadBudgets(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString()).catch(() => undefined);
  }, [loadBudgets]);

  const handleCustomRangeDone = useCallback(() => {
    const fromDate = customDraftFrom <= customDraftTo ? customDraftFrom : customDraftTo;
    const toDate = customDraftTo >= customDraftFrom ? customDraftTo : customDraftFrom;
    setCustomDraftFrom(fromDate);
    setCustomDraftTo(toDate);
    setCustomRangeFrom(toLocalDayStartISO(fromDate));
    setCustomRangeTo(toLocalDayEndISO(toDate));
    setPeriod('custom');
    setCustomRangeOpen(false);
  }, [customDraftFrom, customDraftTo]);

  const toggleHomeAccountInclusion = useCallback((accountId: string, included: boolean) => {
    const next = new Set(homeExcludedAccountIds);
    if (included) {
      next.delete(accountId);
    } else {
      next.add(accountId);
    }
    updateSettings({ homeExcludedAccountIds: Array.from(next) }, 'home-balance-visibility').catch(() => undefined);
  }, [homeExcludedAccountIds, updateSettings]);

  const resetHomeAccountInclusion = useCallback(() => {
    updateSettings({ homeExcludedAccountIds: [] }, 'home-balance-visibility-reset').catch(() => undefined);
  }, [updateSettings]);

  const openDatePicker = useCallback(
    (stage: 'from' | 'to') => {
      const value = stage === 'from' ? customDraftFrom : customDraftTo;
      const minDate = stage === 'to' ? customDraftFrom : undefined;
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        display: 'calendar',
        minimumDate: minDate,
        onChange: (_event, selected) => {
          if (!selected) return;
          if (stage === 'from') {
            setCustomDraftFrom(selected);
            if (selected > customDraftTo) {
              setCustomDraftTo(selected);
            }
          } else {
            setCustomDraftTo(selected < customDraftFrom ? customDraftFrom : selected);
          }
        }
      });
    },
    [customDraftFrom, customDraftTo],
  );

  const displaySymbol = showCurrencySymbol ? currencySymbol : '';
  const activeDepositCount = depositSummary.deposits.filter((d: any) => d.status === 'active').length;
  const depositMeta = activeDepositCount === 0
    ? 'No active deposits'
    : `${activeDepositCount} Active · ${formatNetWorthStripValue(depositSummary.activeInvestedValue, displaySymbol)}`;
  const loanMeta = loanSummary.youLent === 0 && loanSummary.youOwe === 0
    ? 'No loans'
    : `${loanSummary.net >= 0 ? 'Net Lent' : 'Net Owed'} · ${formatNetWorthStripValue(Math.abs(loanSummary.net), displaySymbol)}`;
  const budgetMeta = budgets.length === 0
    ? 'Not set'
    : budgetSummary.spentPercent > 100
      ? `Overspent · ${budgetSummary.spentPercent}%`
      : `Spent · ${budgetSummary.spentPercent}%`;

  const moreCards = [
    {
      id: 'Deposits',
      label: 'Deposits',
      icon: DEPOSIT_VISUAL.icon,
      route: '/deposits',
      meta: depositMeta,
      tone: DEPOSIT_VISUAL.tone,
      bg: DEPOSIT_VISUAL.bg,
    },
    {
      id: 'Loans',
      label: 'Loans',
      icon: 'hand-coins',
      route: '/loans',
      meta: loanMeta,
      tone: '#4F6B7A',
      bg: '#E8F0F3',
    },
    {
      id: 'Budgets',
      label: 'Budgets',
      icon: 'pie-chart',
      route: '/budget',
      meta: budgetMeta,
      tone: '#5A56A3',
      bg: '#F0EFFA',
    },
    {
      id: 'Assets',
      label: 'Assets',
      icon: 'gem',
      route: '/assets',
      meta: 'Track other assets',
      tone: ASSET_TONE,
      bg: ASSET_BG,
    },
  ] as const;

  const middleContent = (
    <View style={{ marginTop: 0, marginBottom: 20 }}>
      <TouchableOpacity
        onPress={() => router.push('/accounts')}
        delayPressIn={0}
        activeOpacity={0.72}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 0, paddingVertical: 2 }}
      >
        <Text appWeight="medium" style={{ fontSize: HOME_TEXT.subhead, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>Accounts</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, color: palette.brand, fontWeight: BUTTON_TOKENS.text.labelWeight }}>All</Text>
          <AppIcon name="chevron-right" size={13} color={palette.brand} strokeWidth={2} />
        </View>
      </TouchableOpacity>
      <ScrollView ref={accountScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: SCREEN_GUTTER }}>
        {orderedAccounts.map((acc) => {
          const amountLabel = hideAmounts ? '••••' : (showCurrencySymbol ? formatCurrency(Math.abs(acc.balance), currencySymbol) : formatCurrency(Math.abs(acc.balance), ''));
          const cardWidth = Math.min(206, Math.max(172, 142 + Math.min(amountLabel.length, 14) * 3));
          return (
            <AccountCarouselCard
              key={acc.id}
              acc={acc}
              palette={palette}
              amountLabel={amountLabel}
              cardWidth={cardWidth}
              hideAmounts={hideAmounts}
            />
          );
        })}
        <AccountCarouselAddCard palette={palette} />
      </ScrollView>

      <View style={{ marginTop: 20, marginBottom: 12 }}>
        <Text appWeight="medium" style={{ fontSize: 17, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>More</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {moreCards.map((feature) => (
          <MoreShortcutCard key={feature.id} feature={feature} palette={palette} />
        ))}
      </View>

    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      <ScreenTitle
        title={getGreeting()}
        palette={palette}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity
              onPress={() => router.push('/notes' as any)}
              style={{ padding: 6 }}
              activeOpacity={0.7}
              delayPressIn={0}
            >
              <AppIcon name="list-todo" size={20} color={palette.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setHideAmounts((v) => !v)}
              style={{ padding: 6 }}
              activeOpacity={0.7}
              delayPressIn={0}
            >
              <AppIcon name={hideAmounts ? 'eye-closed' : 'eye'} size={20} color={palette.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        }
      />
      <HomeAccountPage
        pageHeight={1000}
        accountId="all"
        accountName="All"
        accountTypeLabel=""
        settingsYearStart={settingsYearStart}
        currencySymbol={showCurrencySymbol ? currencySymbol : ''}
        customRange={{ from: new Date(customRangeFrom), to: new Date(customRangeTo) }}
        onOpenCustomRange={() => {
          setCustomDraftFrom(new Date(customRangeFrom));
          setCustomDraftTo(new Date(customRangeTo));
          setCustomRangeOpen(true);
        }}
        totalBalance={includedHomeBalance}
        onRefresh={refreshAccounts}
        isSelected={true}
        pageIndex={0}
        verticalScrolls={verticalScrolls}
        indicatorY={indicatorY}
        period={period}
        onPeriodChange={setPeriod}
        registerScrollTop={(_, fn) => { pageScrollTopRef.current = fn; }}
        isPageReady={true}
        fullResetNonce={homeFullResetNonce}
        accountsById={accountsById}
        categoriesById={categoriesById}
        loansById={loansById}
        getCategoryFullDisplayName={getCategoryFullDisplayName}
        loansLoaded={loansLoaded}
        loadLoans={loadLoans}
        onOpenNetWorth={() => router.push('/net-worth')}
        onOpenBalanceVisibility={() => setShowBalanceVisibilitySheet(true)}
        homeExcludedCount={homeExcludedAccountIds.length}
        homeTotalCount={accounts.length}
        netWorth={stableNetWorth}
        middleContent={middleContent}

        hideAmounts={hideAmounts}
      />

      <Modal
        visible={customRangeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomRangeOpen(false)}
      >
        <Pressable
          onPress={() => setCustomRangeOpen(false)}
          style={{ flex: 1, backgroundColor: palette.scrim, justifyContent: 'center', padding: 20 }}
        >
          <Pressable
            onPress={() => { }}
            style={{ backgroundColor: palette.card, borderRadius: HOME_RADIUS.large, padding: HOME_SPACE.xxl, borderWidth: 1, borderColor: palette.divider }}
          >
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: palette.text, marginBottom: 8 }}>
              Custom range
            </Text>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginBottom: 16 }}>
              Pick the from and to dates for this range.
            </Text>
            <View style={{ gap: HOME_SPACE.md, marginBottom: HOME_SPACE.lg }}>
              <TouchableOpacity delayPressIn={0} onPress={() => openDatePicker('from')} style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.inputBg, borderRadius: HOME_RADIUS.card, paddingHorizontal: HOME_SPACE.lg, paddingVertical: 12 }}>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>From</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  {formatDate(customDraftFrom.toISOString())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0} onPress={() => openDatePicker('to')} style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.inputBg, borderRadius: HOME_RADIUS.card, paddingHorizontal: HOME_SPACE.lg, paddingVertical: 12 }}>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  {formatDate(customDraftTo.toISOString())}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md, marginTop: HOME_SPACE.lg }}>
              <View style={{ flex: 1 }}>
                <TextButton label="Cancel" onPress={() => setCustomRangeOpen(false)} palette={palette} tone="default" style={{ minHeight: 48, borderRadius: HOME_RADIUS.tab, backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border }} />
              </View>
              <View style={{ flex: 1 }}>
                <FilledButton label="Done" onPress={handleCustomRangeDone} palette={palette} tone="brand" style={{ borderRadius: HOME_RADIUS.tab }} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {showBalanceVisibilitySheet ? (
        <BalanceVisibilitySheet
          accounts={accounts}
          excludedAccountIds={homeExcludedAccountIds}
          includedTotal={includedHomeBalance}
          trackedTotal={trackedTotalBalance}
          currencySymbol={showCurrencySymbol ? currencySymbol : ''}
          palette={palette}
          onToggleAccount={toggleHomeAccountInclusion}
          onReset={resetHomeAccountInclusion}
          onClose={() => setShowBalanceVisibilitySheet(false)}
        />
      ) : null}


    </View>
  );
}

function MoreShortcutCard({
  feature,
  palette,
}: {
  feature: {
    label: string;
    icon: string;
    route: string;
    meta: string;
    tone: string;
    bg?: string;
  };
  palette: AppThemePalette;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => router.push(feature.route as any)}
      onPressIn={() => { scale.value = withTiming(0.96, { duration: 100 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 150 }); }}
      style={{ width: '48.2%' }}
    >
      <Animated.View
        style={[animStyle, {
          height: 124,
          padding: 16,
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderColor: palette.borderSoft,
          backgroundColor: palette.surface,
          justifyContent: 'space-between',
        }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: feature.bg ?? `${feature.tone}18`,
            }}
          >
            <AppIcon name={feature.icon} size={18} color={feature.tone} strokeWidth={1.8} />
          </View>
          <AppIcon name="arrow-up-right" size={16} color={palette.textSoft} strokeWidth={1.8} />
        </View>

        <View>
          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodyLarge, fontWeight: FONT_WEIGHT.medium, color: palette.text }}>
            {feature.label}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.regular, color: palette.textMuted, marginTop: 2 }}>
            {feature.meta}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}


// Tick chart geometry — computed once at module load from screen width + known padding
// chain (SCREEN_GUTTER each side + 14dp wallet-hero padding each side). Having these
// as constants instead of useState+onLayout means the bar renders at the correct
// width on the very first frame, with no "75% then snap to 100%" flash.
const TICK_W = 2.3;
const TICK_GAP = 4;
const TICK_CONTAINER_W = Math.max(80, Dimensions.get('window').width - 2 * SCREEN_GUTTER - 2 * 14);
const TICK_TOTAL = Math.floor((TICK_CONTAINER_W + TICK_GAP) / (TICK_W + TICK_GAP));
const TICK_CONTENT_W = TICK_TOTAL * (TICK_W + TICK_GAP) - TICK_GAP;
const TICK_REMAINDER = TICK_CONTAINER_W - TICK_CONTENT_W;

function AccountSummaryCard({
  accountName,
  accountTypeLabel,
  balance,
  currencySymbol,
  palette,
  onPress,
  onLayout,
  onOpenNetWorth,
  onOpenBalanceVisibility,
  homeExcludedCount = 0,
  homeTotalCount = 0,
  netWorth,
  netWorthChange,
  incomeExpense,
  cashflowSummary,
  period,
  onPeriodChange,
  onOpenCustomRange,
  isCashflowView,
  onToggleCashflowView,
  onPressMetricIn,
  onPressMetricOut,
  hideAmounts,
  heroMode = false,
  accountType,
  from,
  to,
  heroMetricPeriod,
  onHeroMetricPeriodChange,
}: {
  accountName: string;
  accountTypeLabel: string;
  balance: number;
  currencySymbol: string;
  palette: AppThemePalette;
  onPress?: () => void;
  onLayout?: (height: number) => void;
  onOpenNetWorth?: () => void;
  onOpenBalanceVisibility?: () => void;
  homeExcludedCount?: number;
  homeTotalCount?: number;
  netWorth?: number;
  netWorthChange?: number;
  incomeExpense?: { income: number; expense: number };
  cashflowSummary?: CashflowSummary;
  period?: HomePeriodType;
  onPeriodChange?: (p: HomePeriodType) => void;
  onOpenCustomRange?: () => void;
  isCashflowView?: boolean;
  onToggleCashflowView?: (value: boolean) => void;
  onPressMetricIn?: () => void;
  onPressMetricOut?: () => void;
  hideAmounts?: boolean;
  heroMode?: boolean;
  accountType?: AccountType;
  from?: string;
  to?: string;
  heroMetricPeriod?: 'today' | 'month';
  onHeroMetricPeriodChange?: (p: 'today' | 'month') => void;
}) {
  const isAll = accountName === 'All';
  const isAccountHero = heroMode && !isAll;
  const isHomeHero = heroMode && isAll;
  const isWalletHero = isAccountHero;
  // Home hero is white in light mode; account heroes stay coloured
  const isLightHeroCard = isHomeHero && !palette.isDark;
  const typeMeta = accountType ? ACCOUNT_TYPE_META[accountType] : undefined;
  const typeColor = typeMeta?.color ?? palette.brand;
  // Derive gradient from the icon color — lighter tint → icon color (always in sync with META)
  const accountHeroDarkGradient: [string, string] = useMemo(() => {
    if (!accountType || !typeColor.startsWith('#') || typeColor.length < 7) return ['#16192A', '#1A1E30'];
    const r = parseInt(typeColor.slice(1, 3), 16);
    const g = parseInt(typeColor.slice(3, 5), 16);
    const b = parseInt(typeColor.slice(5, 7), 16);
    // top: full type color; bottom: darkened ~30% toward black for depth
    const darkFactor = 0.68;
    const dr = Math.round(r * darkFactor);
    const dg = Math.round(g * darkFactor);
    const db = Math.round(b * darkFactor);
    const darker = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
    return [typeColor, darker];
  }, [accountType, typeColor]);
  // Home hero gradient: brand color → darkened, same depth treatment as account heroes
  const homeHeroGradient: [string, string] = palette.isDark ? ['#1A1E30', '#16192A'] : ['#1B2F47', '#2F4A6B'];
  // heroText / heroMutedText / heroSoftText: white on dark cards, palette on white cards
  const heroText = isLightHeroCard ? palette.text : (heroMode ? '#FFFFFF' : palette.text);
  const heroMutedText = isLightHeroCard ? palette.textMuted : (heroMode ? 'rgba(255,255,255,0.75)' : palette.textMuted);
  const heroSoftText = isLightHeroCard ? palette.textMuted : (heroMode ? 'rgba(255,255,255,0.52)' : palette.textMuted);
  const netWorthStripBg = isLightHeroCard
    ? palette.inputBg
    : heroMode ? 'rgba(255,255,255,0.085)' : palette.isDark ? '#080C14' : '#E8EDF8';
  const netWorthStripBorder = isLightHeroCard
    ? palette.borderSoft
    : heroMode ? 'rgba(255,255,255,0.18)' : palette.isDark ? palette.divider : '#D8E0F0';
  const heroMetricStripBg = isLightHeroCard
    ? palette.inputBg
    : isAccountHero
      ? 'rgba(255,255,255,0.15)'
      : heroMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.06)';
  const balanceFormatted = hideAmounts ? null : `${balance < 0 ? '-' : ''}${formatCurrency(Math.abs(balance), currencySymbol)}`;
  const dotIdx = balanceFormatted ? balanceFormatted.lastIndexOf('.') : -1;
  const balanceInt = hideAmounts ? '••••' : (dotIdx >= 0 ? balanceFormatted!.slice(0, dotIdx) : balanceFormatted ?? '');
  const balanceDec = hideAmounts ? '' : (dotIdx >= 0 ? balanceFormatted!.slice(dotIdx) : '');
  const balanceColor = heroMode ? heroText : balance < 0 ? palette.numberNegative : palette.text;
  const heroBalanceDigitCount = balanceInt.replace(currencySymbol, '').replace(/[^0-9]/g, '').length;
  const heroBalanceFontSize = heroBalanceDigitCount >= 9 ? 21 : heroBalanceDigitCount >= 7 ? 23 : heroBalanceDigitCount >= 5 ? 25 : 28;
  const heroBalanceLineHeight = heroBalanceFontSize + 16;
  const heroCurrencyFontSize = Math.max(15, heroBalanceFontSize - 8);
  const heroDecimalFontSize = Math.max(14, heroBalanceFontSize - 9);
  const { tone: nwChangeTone, bg: nwChangeBg, ink: nwChangeInk } = getNetWorthChangeTheme(netWorthChange);
  const isCashflow = !!isCashflowView;
  const metricLeftLabel = isCashflow ? 'Inflow' : 'Income';
  const metricRightLabel = isCashflow ? 'Outflow' : 'Expense';
  const metricLeftAmount = isCashflow ? (cashflowSummary?.in ?? 0) : (incomeExpense?.income ?? 0);
  const metricRightAmount = isCashflow ? (cashflowSummary?.out ?? 0) : (incomeExpense?.expense ?? 0);
  const periodOptions = PERIODS.map((item) => ({ key: item, label: PERIOD_LABELS[item] }));

  // Tick data — drives the speedometer sweep animation
  const tickIn = isCashflow ? (cashflowSummary?.in ?? 0) : (incomeExpense?.income ?? 0);
  const tickOut = isCashflow ? (cashflowSummary?.out ?? 0) : (incomeExpense?.expense ?? 0);
  const totalTick = tickIn + tickOut;
  const incomeFraction = totalTick > 0 ? tickIn / totalTick : 0.5;
  const animatedIncomeFraction = useSharedValue(incomeFraction);
  const tickActivityProgress = useSharedValue(totalTick > 0 ? 1 : 0);

  const prevTotalTickRef = React.useRef(totalTick);

  React.useEffect(() => {
    if (totalTick > 0) {
      if (prevTotalTickRef.current === 0) {
        animatedIncomeFraction.value = incomeFraction;
      } else {
        animatedIncomeFraction.value = withSpring(incomeFraction, { damping: 26, stiffness: 180, mass: 0.9, overshootClamping: true });
      }
    }
    // When totalTick drops to 0, leave the fraction unchanged so both bars collapse
    // proportionally as progress animates to 0 — prevents red appearing mid-transition.
    tickActivityProgress.value = withTiming(totalTick > 0 ? 1 : 0, { duration: 250 });
    prevTotalTickRef.current = totalTick;
  }, [tickIn, tickOut, incomeFraction, totalTick]);
  const incomeTickOverlayStyle = useAnimatedStyle(() => {
    const progress = tickActivityProgress.value;
    const fraction = animatedIncomeFraction.value;
    const greenTicksCount = Math.round(fraction * TICK_TOTAL);
    const currentGreenTicks = greenTicksCount * progress;
    const width = currentGreenTicks > 0
      ? currentGreenTicks * TICK_W + (currentGreenTicks - 1) * TICK_GAP
      : 0;
    return {
      width: Math.max(0, width),
    };
  });
  const expenseTickOverlayStyle = useAnimatedStyle(() => {
    const progress = tickActivityProgress.value;
    const fraction = animatedIncomeFraction.value;
    const greenTicksCount = Math.round(fraction * TICK_TOTAL);
    const redTicksCount = TICK_TOTAL - greenTicksCount;
    const currentRedTicks = redTicksCount * progress;
    const width = currentRedTicks > 0
      ? currentRedTicks * TICK_W + (currentRedTicks - 1) * TICK_GAP
      : 0;
    // right + width emit from one worklet → atomic, no JS-thread frame lag
    return {
      width: Math.max(0, width),
      right: TICK_REMAINDER,
    };
  });

  const cardScale = useSharedValue(1);
  const cardScaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const handleCardPressIn = () => { cardScale.value = withSpring(0.972, { damping: 22, stiffness: 380, mass: 0.8 }); };
  const handleCardPressOut = () => { cardScale.value = withSpring(1, { damping: 18, stiffness: 220, mass: 0.8 }); };

  const cashflowNoteProgress = useSharedValue(isCashflowView ? 1 : 0);
  React.useEffect(() => {
    cashflowNoteProgress.value = withTiming(isCashflowView ? 1 : 0, { duration: 220 });
  }, [isCashflowView]);
  const CASHFLOW_NOTE_H = 30;
  const cashflowNoteStyle = useAnimatedStyle(() => ({
    height: cashflowNoteProgress.value * CASHFLOW_NOTE_H,
    opacity: cashflowNoteProgress.value,
    overflow: 'hidden',
  }));

  // NW chip sweep animation — fires when netWorth genuinely updates (non-zero → new value)
  const nwSweepX = useSharedValue(-80);
  const prevNWRef = React.useRef<number | undefined>(netWorth);
  React.useEffect(() => {
    if (netWorth !== undefined && netWorth !== 0 && netWorth !== prevNWRef.current) {
      prevNWRef.current = netWorth;
      nwSweepX.value = -80;
      nwSweepX.value = withTiming(320, { duration: 1100 });
    }
  }, [netWorth, nwSweepX]);
  const nwSweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nwSweepX.value }],
  }));

  const content = (
    <View
      style={{
        backgroundColor: isHomeHero ? homeHeroGradient[0] : 'transparent',
        borderColor: isHomeHero ? 'transparent' : heroMode
          ? ((isLightHeroCard && !isHomeHero) ? '#E2E7F4' : 'rgba(255,255,255,0.10)')
          : palette.isDark ? palette.borderSoft : '#D0D8EE',
        borderWidth: isHomeHero ? 0 : 1,
        borderRadius: HOME_RADIUS.card,
        overflow: 'hidden',
        ...((isAccountHero || isHomeHero) && !palette.isDark ? {
          elevation: 6,
          shadowColor: '#94A3B8',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.13,
          shadowRadius: 10,
        } : {}),
      }}
      onLayout={onLayout ? (event) => onLayout(event.nativeEvent.layout.height) : undefined}
    >
      <LinearGradient
        colors={
          isWalletHero
            ? [accountHeroDarkGradient[0], accountHeroDarkGradient[1], palette.card, palette.card]
            : isHomeHero
              ? [homeHeroGradient[0], homeHeroGradient[1]]
              : palette.isDark ? ['#0F172A', '#1E293B'] : ['#E8EFFC', '#F8FAFF']
        }
        locations={isWalletHero ? [0, 0.44, 0.44, 1] : undefined}
        start={{ x: 0, y: 0 }}
        end={isWalletHero ? { x: 0, y: 1 } : { x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />


      <View style={{ paddingHorizontal: heroMode ? 14 : CARD_PADDING, paddingTop: heroMode ? 14 : 20, paddingBottom: (isWalletHero || isHomeHero) ? 0 : heroMode ? 12 : 22 }}>
        {/* Top Section */}
        {isAccountHero ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            {/* Col 1: icon — uses account type color, same as carousel */}
            {accountType && (
              <View style={{
                backgroundColor: isLightHeroCard ? (typeMeta?.bg ?? `${typeColor}18`) : heroMetricStripBg,
                width: 42, height: 42,
                borderRadius: HOME_RADIUS.chip,
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <AppIcon
                  name={typeMeta?.icon ?? 'wallet'}
                  size={20}
                  color={isLightHeroCard ? typeColor : 'rgba(255,255,255,0.90)'}
                  strokeWidth={1.9}
                />
              </View>
            )}
            {/* Col 2: name row 1, balance row 2 */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.metaSmall, fontWeight: FONT_WEIGHT.semibold, color: heroMutedText, letterSpacing: 0.4 }}>
                  {accountName}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                {currencySymbol && (
                  <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.medium, color: heroMutedText, marginRight: 3 }}>{currencySymbol}</Text>
                )}
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.heroCardValue, fontWeight: FONT_WEIGHT.medium, color: heroText }}>
                  {balanceInt.startsWith(currencySymbol || '') ? balanceInt.slice((currencySymbol || '').length) : balanceInt}
                </Text>
                {balanceDec && (
                  <Text style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.medium, color: heroSoftText }}>{balanceDec}</Text>
                )}
              </View>
            </View>
          </View>
        ) : heroMode ? (
          /* Home hero: dark gradient top, label + NW chip + big balance */
          <View style={{ marginBottom: 8 }}>
            {/* Row 1: label (left) + NW tappable (right) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.metaTiny, fontWeight: FONT_WEIGHT.semibold, color: 'rgba(255,255,255,0.72)', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {homeExcludedCount > 0 ? `${homeTotalCount - homeExcludedCount} of ${homeTotalCount} Accounts` : 'All Accounts'}
              </Text>
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={onOpenNetWorth && typeof netWorth === 'number' ? 0.75 : 1}
                disabled={!(onOpenNetWorth && typeof netWorth === 'number')}
                onPress={onOpenNetWorth}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: onOpenNetWorth && typeof netWorth === 'number' ? 1 : 0 }}
              >
                <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: 'rgba(255,255,255,0.88)', fontFamily: 'monospace' }}>
                  {hideAmounts ? 'NW ••••' : `NW ${formatNetWorthStripValue(netWorth ?? 0, currencySymbol)}`}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: nwChangeBg, borderRadius: HOME_RADIUS.full, paddingHorizontal: 7, paddingVertical: 3, minWidth: 36, justifyContent: 'center', opacity: netWorthChange !== undefined ? 1 : 0, overflow: 'hidden' }}>
                  {nwChangeTone !== 'neutral' && (
                    <AppIcon name={nwChangeTone === 'positive' ? 'trending-up' : 'trending-down'} size={10} color={nwChangeInk} strokeWidth={2.4} />
                  )}
                  <Text style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.bold, color: nwChangeInk, fontFamily: 'monospace' }}>
                    {nwChangeTone === 'neutral' ? '—' : formatNetWorthStripValue(Math.abs(netWorthChange ?? 0), currencySymbol)}
                  </Text>
                  <Animated.View
                    pointerEvents="none"
                    style={[nwSweepStyle, { position: 'absolute', top: -3, bottom: -3, width: 40, left: 0 }]}
                  >
                    <LinearGradient
                      colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ flex: 1 }}
                    />
                  </Animated.View>
                </View>
                <AppIcon name="chevron-right" size={12} color='rgba(255,255,255,0.40)' strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Row 2: big balance number */}
            <TouchableOpacity
              delayPressIn={0}
              activeOpacity={onOpenBalanceVisibility ? 0.78 : 1}
              disabled={!onOpenBalanceVisibility}
              onPress={onOpenBalanceVisibility}
              style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline' }}
            >
              {currencySymbol ? (
                <Text appWeight="medium" style={{ fontSize: heroCurrencyFontSize, fontWeight: FONT_WEIGHT.medium, color: 'rgba(255,255,255,0.65)', marginRight: 4 }}>
                  {currencySymbol}
                </Text>
              ) : null}
              <Text
                appWeight="medium"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ fontSize: heroBalanceFontSize, lineHeight: heroBalanceLineHeight, fontWeight: FONT_WEIGHT.medium, color: '#FFFFFF', letterSpacing: -0.5, flexShrink: 1 }}
              >
                {currencySymbol && balanceInt.startsWith(currencySymbol) ? balanceInt.slice(currencySymbol.length) : balanceInt}
              </Text>
              {balanceDec ? (
                <Text appWeight="medium" style={{ fontSize: heroDecimalFontSize, fontWeight: FONT_WEIGHT.medium, color: 'rgba(255,255,255,0.65)', letterSpacing: -0.2 }}>
                  {balanceDec}
                </Text>
              ) : null}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {!isAll && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.7)', padding: 4, borderRadius: HOME_RADIUS.xs }}>
                    <AppIcon name={ACCOUNT_TYPE_META[accountTypeLabel as AccountType]?.icon ?? 'wallet'} size={12} color={palette.brand} />
                  </View>
                )}
                <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.8, textTransform: 'uppercase', color: heroMutedText }}>
                  {isAll ? 'Balance · All Accounts' : accountName}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'nowrap', gap: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexShrink: 1, minWidth: 0 }}>
                <Text
                  appWeight="medium"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ fontSize: HOME_TEXT.subhead, fontWeight: FONT_WEIGHT.bold, color: balanceColor, letterSpacing: -0.6, flexShrink: 1 }}
                >
                  {balanceInt}
                </Text>
                {balanceDec ? (
                  <Text
                    appWeight="medium"
                    style={{ fontSize: 17, fontWeight: FONT_WEIGHT.bold, color: heroSoftText, letterSpacing: -0.2, marginBottom: 3 }}
                  >
                    {balanceDec}
                  </Text>
                ) : null}
              </View>
            </View>
          </>
        )}

        {/* ── Wallet Hero: two-tone card — flat bottom section with tick chart ── */}
        {isWalletHero && (() => {
          const walletCardBg = palette.isDark ? '#1A1F2E' : palette.card;
          return (
            <View style={{ marginHorizontal: -14, marginBottom: -12 }}>
              <View style={{ backgroundColor: walletCardBg, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
                {/* Period pills */}
                {period && onPeriodChange && (
                  <SegmentedPillSwitch
                    options={periodOptions}
                    value={period}
                    onChange={(key) => {
                      const nextPeriod = key as HomePeriodType;
                      if (nextPeriod === 'custom') { onOpenCustomRange?.(); return; }
                      onPeriodChange(nextPeriod);
                    }}
                    backgroundColor={palette.isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F8'}
                    pillColor={palette.isDark ? palette.surface : '#FFFFFF'}
                    borderColor={palette.isDark ? 'transparent' : '#DFE5EF'}
                    activeTextColor={palette.text}
                    inactiveTextColor={palette.textMuted}
                    height={32}
                    radius={14}
                    fontSize={10.5}
                    itemMinWidth={54}
                    style={{ alignSelf: 'stretch' }}
                  />
                )}
                {/* Cashflow toggle + date */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => onToggleCashflowView?.(!isCashflowView)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
                  >
                    <Text style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted }}>
                      Cashflow
                    </Text>
                    <AppSwitch
                      value={!!isCashflowView}
                      onValueChange={(val) => onToggleCashflowView?.(val)}
                      palette={palette}
                      width={36}
                      height={20}
                      thumbSize={14}
                    />
                  </TouchableOpacity>
                  {from && to && (
                    <Animated.View layout={LinearTransition.springify().damping(30).stiffness(200).mass(0.8)} style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, justifyContent: 'flex-end' }}>
                      <Text style={{ fontSize: 10.5, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        {formatDate(from)}
                      </Text>
                      {period !== 'today' && (
                        <Animated.View entering={FadeInRight.duration(200)} exiting={FadeOutRight.duration(200)}>
                          <Text style={{ fontSize: 10.5, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            {` – ${formatDate(to)}`}
                          </Text>
                        </Animated.View>
                      )}
                    </Animated.View>
                  )}
                </View>
                {/* Tick chart — speedometer sweep: overlays animate width from each edge.
                    Container width is a module-level constant → grey row paints at full
                    width on the first frame, no onLayout race. */}
                <View style={{ flexDirection: 'row', gap: TICK_GAP, marginBottom: 6, width: TICK_CONTAINER_W }}>
                  {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                    <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }} />
                  ))}
                  <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: 12, overflow: 'hidden' }, incomeTickOverlayStyle]}>
                    <View style={{ flexDirection: 'row', gap: TICK_GAP, width: TICK_CONTENT_W }}>
                      {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                        <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: '#0D9488' }} />
                      ))}
                    </View>
                  </Animated.View>
                  <Animated.View style={[{ position: 'absolute', top: 0, height: 12, overflow: 'hidden' }, expenseTickOverlayStyle]}>
                    <View style={{ position: 'absolute', right: 0, flexDirection: 'row', gap: TICK_GAP, width: TICK_CONTENT_W }}>
                      {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                        <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: '#F87171' }} />
                      ))}
                    </View>
                  </Animated.View>
                </View>
                {/* Income / Expense values */}
                {(() => {
                  const leftSplit = splitTickAmount(metricLeftAmount);
                  const rightSplit = splitTickAmount(metricRightAmount);
                  const leftIsZero = metricLeftAmount === 0;
                  const rightIsZero = metricRightAmount === 0;
                  return (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 8 }}>
                      <TouchableOpacity delayPressIn={0} activeOpacity={0.75} onPress={onPressMetricIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <AppIcon name="arrow-down-left" size={15} color={leftIsZero ? palette.textMuted : palette.positive} strokeWidth={2.2} />
                        <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.semibold, color: leftIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }}>
                          {hideAmounts ? '••••' : leftIsZero ? '—' : (
                            <Text>{leftSplit.int}{leftSplit.dec ? <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{leftSplit.dec}</Text> : null}</Text>
                          )}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity delayPressIn={0} activeOpacity={0.75} onPress={onPressMetricOut} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.semibold, color: rightIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }}>
                          {hideAmounts ? '••••' : rightIsZero ? '—' : (
                            <Text>{rightSplit.int}{rightSplit.dec ? <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{rightSplit.dec}</Text> : null}</Text>
                          )}
                        </Text>
                        <AppIcon name="arrow-up-right" size={15} color={rightIsZero ? palette.textMuted : palette.negative} strokeWidth={2.2} />
                      </TouchableOpacity>
                    </View>
                  );
                })()}
                {/* Cashflow note — expands when toggle is on */}
                <Animated.View style={cashflowNoteStyle}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 8 }}>
                    <AppIcon name="info" size={11} color={palette.textMuted} strokeWidth={1.8} />
                    <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, letterSpacing: 0.1 }}>
                      {HELP_TEXTS.cashflowNote}
                    </Text>
                  </View>
                </Animated.View>
              </View>
            </View>
          );
        })()}

        {/* ── Home Hero metric strip — flat white bottom section, mirrors wallet card layout ── */}
        {isHomeHero && incomeExpense ? (
          <View style={{ marginHorizontal: -14, marginBottom: 0 }}>
            <View style={{ backgroundColor: palette.isDark ? '#1A1F2E' : palette.card, paddingTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8 }}>
                {/* Period pills */}
                <SegmentedPillSwitch
                  options={[
                    { key: 'today', label: 'Today' },
                    { key: 'month', label: 'Month' }
                  ]}
                  value={heroMetricPeriod ?? 'today'}
                  onChange={(key) => onHeroMetricPeriodChange?.(key as 'today' | 'month')}
                  backgroundColor={palette.isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F8'}
                  pillColor={palette.isDark ? palette.surface : '#FFFFFF'}
                  borderColor={palette.isDark ? 'transparent' : '#DFE5EF'}
                  activeTextColor={palette.text}
                  inactiveTextColor={palette.textMuted}
                  height={32}
                  radius={14}
                  fontSize={10.5}
                  itemMinWidth={54}
                  style={{ width: 114 }}
                />
                {/* Cashflow toggle */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => onToggleCashflowView?.(!isCashflowView)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
                >
                  <Text style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted }}>
                    Cashflow
                  </Text>
                  <AppSwitch
                    value={!!isCashflowView}
                    onValueChange={(val) => onToggleCashflowView?.(val)}
                    palette={palette}
                    width={36}
                    height={20}
                    thumbSize={14}
                  />
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.08)' : palette.divider }} />

              {/* Income | Expense halves */}
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  delayPressIn={0}
                  activeOpacity={0.76}
                  disabled={!onPressMetricIn}
                  onPress={onPressMetricIn}
                  style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 15 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                    <AppIcon name="arrow-down-left" size={14} color={palette.textMuted} strokeWidth={2} />
                    <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      {metricLeftLabel}
                    </Text>
                  </View>
                  <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: metricLeftAmount === 0 ? palette.textMuted : palette.text, letterSpacing: -0.2 }}>
                    {hideAmounts ? '••••' : metricLeftAmount === 0 ? '—' : formatCurrency(metricLeftAmount, currencySymbol)}
                  </Text>
                </TouchableOpacity>

                <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: palette.isDark ? 'rgba(255,255,255,0.08)' : palette.divider }} />

                <TouchableOpacity
                  delayPressIn={0}
                  activeOpacity={0.76}
                  disabled={!onPressMetricOut}
                  onPress={onPressMetricOut}
                  style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 15, alignItems: 'flex-end' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                    <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      {metricRightLabel}
                    </Text>
                    <AppIcon name="arrow-up-right" size={14} color={palette.textMuted} strokeWidth={2} />
                  </View>
                  <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: metricRightAmount === 0 ? palette.textMuted : palette.text, letterSpacing: -0.2 }}>
                    {hideAmounts ? '••••' : metricRightAmount === 0 ? '—' : formatCurrency(metricRightAmount, currencySymbol)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Cashflow note — expands when toggle is on */}
              <Animated.View style={cashflowNoteStyle}>
                <View style={{ height: 1, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.08)' : palette.divider }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 6, paddingBottom: 6, paddingHorizontal: 14 }}>
                  <AppIcon name="info" size={11} color={palette.textMuted} strokeWidth={1.8} />
                  <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, letterSpacing: 0.1 }}>
                    {HELP_TEXTS.cashflowNote}
                  </Text>
                </View>
              </Animated.View>

            </View>
          </View>
        ) : null}
        {onOpenNetWorth && !heroMode ? (
          <>
            <TouchableOpacity
              delayPressIn={0}
              activeOpacity={0.78}
              onPress={onOpenNetWorth}
              style={{
                width: heroMode ? '100%' : undefined,
                minHeight: heroMode ? 42 : 42,
                marginTop: heroMode ? (incomeExpense ? 8 : 15) : 18,
                borderRadius: heroMode ? 15 : 16,
                borderWidth: 1,
                borderColor: netWorthStripBorder,
                paddingHorizontal: heroMode ? 12 : 12,
                paddingVertical: heroMode ? 8 : 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: heroMode ? 8 : 8,
                backgroundColor: netWorthStripBg,
                shadowColor: heroMode && !isLightHeroCard ? '#FFFFFF' : '#000000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: heroMode && !isLightHeroCard ? 0.08 : 0,
                shadowRadius: heroMode && !isLightHeroCard ? 10 : 0,
              }}
            >
              <Text style={{ fontSize: heroMode ? 11 : 12, fontWeight: heroMode ? '600' : '800', color: heroMode ? heroMutedText : heroMutedText, letterSpacing: heroMode ? 0.45 : 0.1, textTransform: heroMode ? 'uppercase' : 'none' }}>
                Net Worth
              </Text>
              <Text appWeight="medium" numberOfLines={1} style={{ fontSize: heroMode ? 14 : 14, fontWeight: heroMode ? '700' : '900', color: heroText, flexShrink: 1 }}>
                {hideAmounts ? '••••' : formatNetWorthStripValue(netWorth ?? 0, currencySymbol)}
              </Text>
              <View style={{ flex: 1 }} />
              {netWorthChange !== undefined && heroMode ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: nwChangeBg, borderRadius: HOME_RADIUS.full, paddingHorizontal: 7, paddingVertical: 3 }}>
                  {nwChangeTone === 'neutral' ? null : (
                    <AppIcon name={nwChangeTone === 'positive' ? 'trending-up' : 'trending-down'} size={11} color={nwChangeInk} strokeWidth={2.4} />
                  )}
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.semibold, color: nwChangeInk, fontFamily: 'monospace' }}>
                    {nwChangeTone === 'neutral' ? '-' : formatNetWorthStripValue(Math.abs(netWorthChange), currencySymbol)}
                  </Text>
                </View>
              ) : null}
              {netWorthChange !== undefined && !heroMode && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor: netWorthChange === 0
                    ? (palette.isDark ? 'rgba(255,255,255,0.08)' : '#E4E9F2')
                    : netWorthChange > 0
                      ? (palette.isDark ? 'rgba(34,197,94,0.12)' : 'rgba(22,163,74,0.10)')
                      : (palette.isDark ? 'rgba(239,68,68,0.12)' : 'rgba(220,38,38,0.10)'),
                  borderRadius: HOME_RADIUS.full,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                }}>
                  {netWorthChange !== 0 && (
                    <AppIcon
                      name={netWorthChange > 0 ? 'trending-up' : 'trending-down'}
                      size={11}
                      color={netWorthChange > 0 ? palette.numberPositive : palette.numberNegative}
                      strokeWidth={2.5}
                    />
                  )}
                  <Text style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.bold, color: netWorthChange === 0 ? palette.textMuted : netWorthChange > 0 ? palette.numberPositive : palette.numberNegative }}>
                    {netWorthChange === 0 ? '—' : formatNetWorthStripValue(Math.abs(netWorthChange), currencySymbol)}
                  </Text>
                </View>
              )}
              <AppIcon name="chevron-right" size={16} color={heroSoftText} strokeWidth={2.1} />
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} onPressIn={handleCardPressIn} onPressOut={handleCardPressOut}>
      <Animated.View style={cardScaleStyle}>
        {content}
      </Animated.View>
    </Pressable>
  );
}

/** Truncate (not round) to 2 decimal places and split into integer + ".XX" strings for two-size rendering.
 *  `dec` is empty string when the fractional part is zero. */
function splitTickAmount(amount: number): { int: string; dec: string } {
  const truncated = Math.floor(amount * 100) / 100;
  const intPart = Math.floor(truncated);
  const cents = Math.round((truncated - intPart) * 100);
  return {
    int: intPart.toLocaleString('en-IN'),
    dec: cents > 0 ? '.' + String(cents).padStart(2, '0') : '',
  };
}

function formatNetWorthStripValue(value: number, currencySymbol: string) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const unit = abs >= 10000000
    ? { divisor: 10000000, suffix: ' Cr' }
    : abs >= 100000
      ? { divisor: 100000, suffix: ' L' }
      : abs >= 1000
        ? { divisor: 1000, suffix: ' K' }
        : null;

  if (!unit) return `${sign}${formatCurrency(abs, currencySymbol)}`;
  const compact = (abs / unit.divisor)
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
  return `${sign}${currencySymbol}${compact}${unit.suffix.trimStart()}`;
}

function getHomeDateRange(
  period: HomePeriodType,
  settingsYearStart: number,
  customRange?: { from: Date; to: Date },
) {
  if (period === 'today') {
    const now = new Date();
    return {
      from: toLocalDayStartISO(now),
      to: toLocalDayEndISO(now),
    };
  }

  return getDateRange(
    period,
    settingsYearStart,
    customRange ? customRange.from.toISOString() : undefined,
    customRange ? customRange.to.toISOString() : undefined,
  );
}

function BalanceVisibilitySheet({
  accounts,
  excludedAccountIds,
  includedTotal,
  trackedTotal,
  currencySymbol,
  palette,
  onToggleAccount,
  onReset,
  onClose,
}: {
  accounts: Account[];
  excludedAccountIds: string[];
  includedTotal: number;
  trackedTotal: number;
  currencySymbol: string;
  palette: AppThemePalette;
  onToggleAccount: (accountId: string, included: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const excludedSet = useMemo(() => new Set(excludedAccountIds), [excludedAccountIds]);
  const sortedAccounts = useMemo(
    () => accounts.slice().sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)),
    [accounts],
  );

  return (
    <BottomSheet
      title="Balance Visibility"
      palette={palette}
      onClose={onClose}
      hasNavBar
      backgroundColor={palette.background}
      maxHeightRatio={0.65}
      headerRight={
        <TouchableOpacity
          delayPressIn={0}
          onPress={onReset}
          hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
          style={{ marginRight: 4 }}
        >
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.brand }}>Reset</Text>
        </TouchableOpacity>
      }
    >
      <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: HOME_SPACE.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: HOME_SPACE.lg, marginBottom: HOME_SPACE.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: HOME_SPACE.xs }}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>Total</Text>
            <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodyLarge, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
              {signedBalance(trackedTotal, currencySymbol)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: HOME_SPACE.xs }}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>Selected</Text>
            <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodyLarge, fontWeight: FONT_WEIGHT.semibold, color: palette.brand }}>
              {signedBalance(includedTotal, currencySymbol)}
            </Text>
          </View>
        </View>
        <View style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.card, overflow: 'hidden' }}>
          {sortedAccounts.map((account, index) => {
            const included = !excludedSet.has(account.id);
            return (
              <BalanceAccountRow
                key={account.id}
                account={account}
                included={included}
                currencySymbol={currencySymbol}
                palette={palette}
                isLast={index === sortedAccounts.length - 1}
                onToggle={() => onToggleAccount(account.id, !included)}
              />
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

function BalanceAccountRow({
  account,
  included,
  currencySymbol,
  palette,
  isLast,
  onToggle,
}: {
  account: Account;
  included: boolean;
  currencySymbol: string;
  palette: AppThemePalette;
  isLast: boolean;
  onToggle: () => void;
}) {
  const typeMeta = ACCOUNT_TYPE_META[account.type];
  const balanceColor = account.balance < 0 ? palette.negative : palette.text;

  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.65}
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: HOME_SPACE.md,
        paddingHorizontal: HOME_SPACE.md,
        paddingVertical: 18,
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: palette.divider,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: HOME_RADIUS.chip,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: typeMeta.bg ?? `${typeMeta.color}18`,
        }}
      >
        <AppIcon name={typeMeta.icon} size={18} color={typeMeta.color} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: HOME_SPACE.sm }}>
          <Text appWeight="medium" numberOfLines={1} style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.text }}>
            {formatAccountDisplayName(account.name, account.accountNumber)}
          </Text>
          <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: balanceColor }}>
            {signedBalance(account.balance, currencySymbol)}
          </Text>
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: included ? palette.brand : 'transparent',
              borderWidth: included ? 0 : 1.5,
              borderColor: palette.borderSoft,
            }}
          >
            {included ? <AppIcon name="check" size={8} color="#fff" strokeWidth={2.5} /> : null}
          </View>
        </View>
        <Text style={{ marginTop: 2, fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
          {getAccountTypeLabel(account.type)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function signedBalance(value: number, currencySymbol: string) {
  return `${value < 0 ? '-' : ''}${formatCurrency(Math.abs(value), currencySymbol)}`;
}

export const HomeAccountPage = React.memo(function HomeAccountPage({
  pageHeight,
  accountId,
  accountName,
  accountTypeLabel,
  settingsYearStart,
  currencySymbol,
  customRange,
  onOpenCustomRange,
  totalBalance,
  onRefresh,
  isSelected,
  pageIndex,
  verticalScrolls,
  indicatorY,
  period,
  onPeriodChange,
  registerScrollTop,
  onOpenNetWorth,
  onOpenBalanceVisibility,
  homeExcludedCount,
  homeTotalCount,
  netWorth,
  isPageReady,
  middleContent,
  accountsById,
  categoriesById,
  loansById,
  getCategoryFullDisplayName,
  loansLoaded,
  loadLoans,
  hideAmounts,
  contentBottomPadding,
  onScrollBeginDrag,
  scrollEnabled = true,
  fullResetNonce = 0,
}: {
  pageHeight: number;
  accountId: string | 'all';
  accountName: string;
  accountTypeLabel: string;
  settingsYearStart: number;
  currencySymbol: string;
  customRange?: { from: Date; to: Date };
  onOpenCustomRange: (accountId: string) => void;
  totalBalance: number;
  onRefresh: () => Promise<void>;
  isSelected: boolean;
  pageIndex: number;
  verticalScrolls: SharedValue<number[]>;
  indicatorY: SharedValue<number>;
  period: HomePeriodType;
  onPeriodChange: (p: HomePeriodType) => void;
  registerScrollTop: (id: string, fn: (() => void) | null) => void;
  onOpenNetWorth?: () => void;
  onOpenBalanceVisibility?: () => void;
  homeExcludedCount?: number;
  homeTotalCount?: number;
  netWorth?: number;
  isPageReady: boolean;
  middleContent?: React.ReactNode;
  accountsById: Map<string, string>;
  categoriesById: Map<string, Category>;
  loansById: Map<string, LoanWithSummary>;
  getCategoryFullDisplayName: (categoryId: string, separator?: string) => string;
  loansLoaded: boolean;
  loadLoans: (filters?: { accountId?: string; status?: LoanStatus }) => Promise<void>;
  hideAmounts?: boolean;
  contentBottomPadding?: number;
  onScrollBeginDrag?: () => void;
  scrollEnabled?: boolean;
  fullResetNonce?: number;
}) {
  const { palette } = useAppTheme();
  const accountInsets = useSafeAreaInsets();
  const deposits = useFixedDepositsStore((s) => s.deposits);
  const depositsById = useMemo(() => new Map(deposits.map((d) => [d.id, d])), [deposits]);
  const tags = useCategoriesStore((s) => s.tags);
  const tagNamesById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [periodTransactions, setPeriodTransactions] = useState<Transaction[]>([]);
  const [periodDataRangeKey, setPeriodDataRangeKey] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cashflowIsCashflow, setCashflowIsCashflow] = useState(false);
  const isScreenFocused = useIsFocused();
  const loadRequestIdRef = useRef(0);
  const todayDataCacheRef = useRef<{
    cashflow: CashflowSummary;
    periodTransactions: Transaction[];
    transactions: Transaction[];
  } | null>(null);
  const lastNWChipValueRef = useRef<number | undefined>(undefined);

  const mainScrollRef = useAnimatedRef<Animated.ScrollView>();

  useEffect(() => {
    if (fullResetNonce > 0) {
      setCashflowIsCashflow(false);
    }
  }, [fullResetNonce]);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    setCashflow({ in: 0, out: 0, net: 0 });
    setPeriodTransactions([]);
    setPeriodDataRangeKey(null);
    setTransactions([]);
    todayDataCacheRef.current = null;
    lastNWChipValueRef.current = undefined;
  }, [accountId]);

  const loadRangeData = useCallback(async (rangeFrom: string, rangeTo: string) => {
    if (!isPageReady) return;
    const requestId = ++loadRequestIdRef.current;
    const requestRangeKey = `${rangeFrom}:${rangeTo}`;
    setPeriodDataRangeKey(null);
    const accountFilter = accountId === 'all' ? undefined : accountId;
    const [periodSnapshot, recentTransactions, periodScopedTransactions] = await Promise.all([
      getCashflowSnapshot(accountId, rangeFrom, rangeTo, { includeTransfers: true, includeLoans: true }),
      getTransactions({ accountId: accountFilter, limit: 10 }),
      getTransactions({ accountId: accountFilter, fromDate: rangeFrom, toDate: rangeTo }),
    ]);

    if (requestId !== loadRequestIdRef.current) return;

    const periodSummary = periodSnapshot.summary;

    setCashflow(periodSummary);
    setTransactions(recentTransactions);
    setPeriodTransactions(periodScopedTransactions);
    setPeriodDataRangeKey(requestRangeKey);

    const today = new Date();
    if (rangeFrom === toLocalDayStartISO(today) && rangeTo === toLocalDayEndISO(today)) {
      todayDataCacheRef.current = {
        cashflow: periodSummary,
        periodTransactions: periodScopedTransactions,
        transactions: recentTransactions,
      };
    }
  }, [accountId, isPageReady]);

  useEffect(() => {
    registerScrollTop(accountId, () => {
      mainScrollRef.current?.scrollTo({ y: 0, animated: true });
      const arr = verticalScrolls.value.slice();
      arr[pageIndex] = 0;
      verticalScrolls.value = arr;
    });
    return () => registerScrollTop(accountId, null);
  }, [accountId, mainScrollRef, pageIndex, registerScrollTop, verticalScrolls]);

  const verticalScrollHandler = useAnimatedScrollHandler((event) => {
    'worklet';
    const y = event.contentOffset.y;
    // Keep the latest vertical offset per page so the overlay indicator follows settled page scroll.
    const arr = verticalScrolls.value.slice();
    arr[pageIndex] = y;
    verticalScrolls.value = arr;
  });

  const { from, to } = getHomeDateRange(
    period,
    settingsYearStart,
    customRange,
  );
  const currentRangeKey = `${from}:${to}`;
  const hasCurrentPeriodData = periodDataRangeKey === currentRangeKey;
  // Keep last known values while a new period loads — avoids flash-to-zero on period change
  const displayedCashflow = cashflow;
  const displayedPeriodTransactions = periodTransactions;

  // Income/expense: only type in/out, excludes transfers, loans & deposits
  // Cashflow: includes transfers, deposits & loans movements
  const incExpSummary = useMemo(() => {
    let income = 0, expense = 0;
    displayedPeriodTransactions.forEach((tx) => {
      const impact = getTransactionCashflowImpact(tx, { includeLoans: false, includeDeposits: false });
      if (impact === 'in') income += tx.amount;
      else if (impact === 'out') expense += tx.amount;
    });
    return { income, expense };
  }, [displayedPeriodTransactions]);

  // NW chip delta: income - expenses + assets added in this period
  // Excludes loans, transfers, deposits (all NW-neutral). Asset additions have no
  // offsetting account transaction so they must be added separately.
  const periodAssets = useAssetsStore((s) => s.assets);
  const nwChipValue = useMemo(() => {
    if (!hasCurrentPeriodData && lastNWChipValueRef.current !== undefined) {
      return lastNWChipValueRef.current;
    }
    const assetAdditions = periodAssets
      .filter((a) => a.createdAt >= from && a.createdAt <= to)
      .reduce((sum, a) => sum + a.value, 0);
    const value = (incExpSummary.income - incExpSummary.expense) + assetAdditions;
    lastNWChipValueRef.current = value;
    return value;
  }, [periodAssets, from, to, incExpSummary, hasCurrentPeriodData]);
  const loadPageData = useCallback(async () => {
    await loadRangeData(from, to);
  }, [from, loadRangeData, to]);

  useEffect(() => {
    if (!isPageReady || !isScreenFocused) return;
    loadPageData();
  }, [isPageReady, isScreenFocused, loadPageData]);

  useEffect(() => {
    if (!isPageReady || !isScreenFocused || !isSelected || loansLoaded) return;
    loadLoans().catch(() => undefined);
  }, [isPageReady, isScreenFocused, isSelected, loadLoans, loansLoaded]);


  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    await loadPageData();
    setRefreshing(false);
  }, [loadPageData, onRefresh]);

  const openPeriodActivity = useCallback(
    (kind: 'in' | 'out' | 'net') => {
      router.push({
        pathname: '/(tabs)/activity',
        params: {
          source: period === 'today' ? 'home-today' : 'home-period',
          period: period === 'today' ? 'day' : period,
          accountId: accountId === 'all' ? 'all' : accountId,
          type: 'all',
          cashflowBucket: kind,
          cashflowMode: cashflowIsCashflow ? 'total' : 'incomeExpense',
          from,
          to,
          ts: String(Date.now())
        }
      });
    },
    [accountId, cashflowIsCashflow, from, period, to],
  );

  const handleTransactionPress = useCallback((tx: Transaction) => {
    if (tx.type === 'deposit' && tx.depositId) {
      router.push({ pathname: '/modals/add-transaction', params: { editDepositId: tx.depositId, closeDepositId: '' } });
      return;
    }
    if (tx.loanId) {
      const loan = loansById.get(tx.loanId);
      if (loan && getLoanTransactionKind(tx, loan.direction) === 'settlement') {
        router.push({ pathname: '/modals/loan-settlement', params: { editId: tx.id } });
        return;
      }
    }
    router.push({ pathname: '/modals/add-transaction', params: { editId: tx.id } });
  }, [loansById]);

  return (
    <View style={{ flex: 1, height: pageHeight }}>
      <Animated.ScrollView
        ref={mainScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: contentBottomPadding ?? getCompactScrollableBottomPadding(accountInsets) }}
        onScroll={verticalScrollHandler}
        onScrollBeginDrag={onScrollBeginDrag}
        scrollEventThrottle={1}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: HOME_SURFACE.heroTop, paddingBottom: HOME_SURFACE.heroBottom }}>
          <AccountSummaryCard
            accountName={accountId === 'all' ? 'All' : accountName}
            accountTypeLabel={accountTypeLabel}
            balance={totalBalance}
            currencySymbol={currencySymbol}
            palette={palette}
            onOpenNetWorth={accountId === 'all' ? onOpenNetWorth : undefined}
            onOpenBalanceVisibility={accountId === 'all' ? onOpenBalanceVisibility : undefined}
            homeExcludedCount={accountId === 'all' ? homeExcludedCount : undefined}
            homeTotalCount={accountId === 'all' ? homeTotalCount : undefined}
            netWorth={accountId === 'all' ? netWorth : undefined}
            netWorthChange={accountId === 'all' ? nwChipValue : undefined}
            incomeExpense={incExpSummary}
            cashflowSummary={displayedCashflow}
            period={accountId === 'all' ? undefined : period}
            onPeriodChange={accountId === 'all' ? undefined : onPeriodChange}
            onOpenCustomRange={accountId === 'all' ? undefined : () => onOpenCustomRange(accountId)}
            isCashflowView={cashflowIsCashflow}
            onToggleCashflowView={setCashflowIsCashflow}
            onPressMetricIn={() => openPeriodActivity('in')}
            onPressMetricOut={() => openPeriodActivity('out')}
            hideAmounts={hideAmounts}
            heroMode
            heroMetricPeriod={period === 'month' ? 'month' : 'today'}
            onHeroMetricPeriodChange={onPeriodChange}
            accountType={useAccountsStore.getState().accounts.find(a => a.id === accountId)?.type}
            from={from}
            to={to}
          />
          <View
            onLayout={(event) => {
              const newY = event.nativeEvent.layout.y;
              if (isSelected && newY > 0 && indicatorY.value !== newY) {
                indicatorY.value = newY;
              }
            }}
            style={{ height: accountId === 'all' ? 34 : 20 }}
          />
        </View>

        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 0 }}>


          {middleContent}

          {/* ── Recent transactions — date-grouped ── */}
          <View style={{ marginBottom: 4, marginTop: accountId === 'all' ? 24 : 34 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.subhead, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>Recent</Text>
              <TouchableOpacity
                delayPressIn={0}
                onPress={() => router.navigate({ pathname: '/(tabs)/activity', params: { source: 'home-view-all', accountId: accountId === 'all' ? 'all' : accountId, ts: String(Date.now()) } })}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2, paddingLeft: 4 }}
              >
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, color: palette.brand, fontWeight: BUTTON_TOKENS.text.labelWeight }}>All</Text>
                <AppIcon name="chevron-right" size={13} color={palette.brand} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            {transactions.length === 0 ? (
              <View style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }}>
                <Text style={{ color: palette.textSoft, fontSize: HOME_TEXT.bodySmall, textAlign: 'center', paddingVertical: 20 }}>
                  No transactions yet
                </Text>
              </View>
            ) : (
              (() => {
                const groups: { dateKey: string; items: typeof transactions }[] = [];
                for (const tx of transactions) {
                  const key = toLocalDateKey(tx.date);
                  const last = groups[groups.length - 1];
                  if (last?.dateKey === key) last.items.push(tx);
                  else groups.push({ dateKey: key, items: [tx] });
                }
                return (
                  <View style={{ gap: HOME_SPACE.sm + 4 }}>
                    {groups.map(({ dateKey, items }) => {
                      const { date, label } = getRelativeDateLabel(dateKey + 'T00:00:00');
                      return (
                        <View key={dateKey}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: HOME_SPACE.sm, paddingHorizontal: 2 }}>
                            <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>{date}</Text>
                            {label ? (
                              <>
                                <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginHorizontal: 5 }}>•</Text>
                                <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{label}</Text>
                              </>
                            ) : null}
                          </View>
                          <View style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' }}>
                            {items.map((transaction, index) => {
                              const accountName = accountsById.get(transaction.accountId);
                              const linkedAccountName = transaction.linkedAccountId ? accountsById.get(transaction.linkedAccountId) : undefined;
                              const loan = transaction.loanId ? loansById.get(transaction.loanId) : undefined;
                              const deposit = transaction.depositId ? depositsById.get(transaction.depositId) : undefined;
                              const tertiaryText = transaction.tags.length > 0
                                ? transaction.tags.map((id) => tagNamesById.get(id)).filter((v): v is string => !!v).join(' • ') || undefined
                                : undefined;
                              return (
                                <TransactionListItem
                                  key={transaction.id}
                                  tx={transaction}
                                  sym={currencySymbol}
                                  palette={palette}
                                  isLast={index === items.length - 1}
                                  categoryName={transaction.categoryId ? getCategoryFullDisplayName(transaction.categoryId, ' › ') : undefined}
                                  categoryIcon={getCategoryDisplayIcon(categoriesById, transaction.categoryId)}
                                  accountName={accountName}
                                  linkedAccountName={linkedAccountName}
                                  loanPersonName={loan?.personName}
                                  loanDirection={loan?.direction}
                                  depositName={deposit?.name}
                                  depositBankName={deposit?.bankName ?? undefined}
                                  tertiaryText={tertiaryText}
                                  showAmountSign={false}
                                  onPress={handleTransactionPress}
                                />
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })()
            )}
          </View>


          {__DEV__ && accountId === 'all' && (
            <View style={{ alignItems: 'center', marginTop: 2 }}>
              <TouchableOpacity delayPressIn={0} onPress={() => router.push('/net-worth-prototype')}>
                <Text
                  appWeight="medium"
                  style={{
                    fontSize: HOME_TEXT.bodySmall,
                    color: palette.brand,
                    fontWeight: BUTTON_TOKENS.text.labelWeight,
                  }}
                >
                  Open Net Worth Prototype
                </Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0} onPress={() => router.push('/palette-preview')} style={{ marginTop: 10 }}>
                <Text
                  appWeight="medium"
                  style={{
                    fontSize: HOME_TEXT.bodySmall,
                    color: palette.brand,
                    fontWeight: BUTTON_TOKENS.text.labelWeight,
                  }}
                >
                  Open Palette Preview
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {accountId === 'all' && (
            <View style={{ width: '100%', alignItems: 'center', marginBottom: -100 }}>
              <Text
                style={{
                  fontSize: 180,
                  fontWeight: FONT_WEIGHT.black,
                  color: palette.text,
                  opacity: 0.05,
                  textAlign: 'center',
                  lineHeight: 180,
                }}
              >
                reni
              </Text>
            </View>
          )}

        </View>
      </Animated.ScrollView>

    </View>
  );
});

function AccountCarouselCard({ acc, palette, amountLabel, cardWidth, hideAmounts }: any) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const typeMeta = ACCOUNT_TYPE_META[acc.type as AccountType];
  const typeColor = typeMeta.color;

  return (
    <Pressable
      onPress={() => router.push(`/account/${acc.id}`)}
      onPressIn={() => { scale.value = withTiming(0.96, { duration: 100 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 150 }); }}
    >
      <Animated.View
        style={[animStyle, {
          width: cardWidth,
          backgroundColor: palette.surface,
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderColor: palette.borderSoft,
          overflow: 'hidden',
        }]}
      >
        <View style={{ paddingHorizontal: 14, paddingVertical: 14, minHeight: 96, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: HOME_RADIUS.chip,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: typeMeta.bg ?? `${typeColor}18`,
              }}
            >
              <AppIcon name={typeMeta.icon} size={18} color={typeColor} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.text }}>{formatAccountDisplayName(acc.name, acc.accountNumber)}</Text>
            </View>
          </View>
          <View style={{ marginTop: 16 }}>
            {(() => {
              if (hideAmounts || !amountLabel.includes('.')) {
                return (
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.medium, color: acc.balance < 0 ? palette.negative : palette.text }}>
                    {amountLabel}
                  </Text>
                );
              }
              const dotIndex = amountLabel.lastIndexOf('.');
              const intPart = amountLabel.slice(0, dotIndex);
              const decPart = amountLabel.slice(dotIndex);
              return (
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.medium, color: acc.balance < 0 ? palette.negative : palette.text }}>
                  {intPart}<Text style={{ fontSize: HOME_TEXT.rowLabel - 4 }}>{decPart}</Text>
                </Text>
              );
            })()}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function AccountCarouselAddCard({ palette }: any) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => router.push('/settings/account-form')}
      onPressIn={() => { scale.value = withTiming(0.96, { duration: 100 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 150 }); }}
    >
      <Animated.View
        style={[animStyle, {
          width: 90,
          minHeight: 116,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: palette.isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.015)',
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: palette.borderSoft,
        }]}
      >
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <AppIcon name="plus" size={16} color={palette.textMuted} strokeWidth={2.5} />
        </View>
        <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>Add</Text>
      </Animated.View>
    </Pressable>
  );
}
