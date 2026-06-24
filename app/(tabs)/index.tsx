import { Text } from '@/components/ui/AppText';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
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
  runOnJS,
  type SharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LedgerAccountHero, LedgerCashflowCard } from '../../components/account-detail/LedgerVariant';
import { PulseAccountHero, PulseCashflowBar, PulseQuickActions } from '../../components/account-detail/PulseVariant';
import { ActivityPeriodHeader } from '../../components/activity/ActivityPeriodHeader';
import { CategoryIconBadge } from '../../components/activity/ActivityUI';
import { PeriodFilterSheet } from '../../components/activity/PeriodFilterSheet';
import { DateGroupedTransactionList, EmptyTransactions } from '../../components/DateGroupedTransactionList';
import { CardSection, ScreenTitle } from '../../components/settings-ui';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { AppChevron } from '../../components/ui/AppChevron';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppSwitch } from '../../components/ui/AppSwitch';
import { AnimatedText } from '../../components/ui/AppText';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { PressableScale } from '../../components/ui/PressableScale';
import { getCompactScrollableBottomPadding } from '../../components/ui/safeBottom';
import { SegmentedPillSwitch } from '../../components/ui/SegmentedPillSwitch';
import { SweepOverlay } from '../../components/ui/SweepOverlay';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { getActivityDrilldownTransactions } from '../../lib/activityCashflow';
import { ASSET_BG, ASSET_TONE } from '../../lib/assetVisuals';
import {
  APP_LOCALE,
  formatDate,
  toLocalDayEndISO,
  toLocalDayStartISO,
  toLocalMonthStartISO
} from '../../lib/dateUtils';
import { DEPOSIT_VISUAL } from '../../lib/depositVisuals';
import { formatCurrency, formatSignedCurrency, getCashflowFromList, getLoanSummary, getTotalBalance, getTransactionCashflowImpact } from '../../lib/derived';
import { CARD_PADDING, FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { getFixedDepositSummary } from '../../lib/fixed-deposits';
import {
  BUTTON_TOKENS,
  HELP_TEXTS,
  HOME_LAYOUT,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_SURFACE,
  HOME_TEXT,
  getNetWorthChangeTheme,
  getTxTypeConfig
} from '../../lib/layoutTokens';
import { safePush } from '../../lib/safePush';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../../lib/settings-shared';
import { registerTabReset } from '../../lib/tabResetRegistry';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { prefetchAccountTrend } from '../../lib/trendCache';
import { useDateFilter } from '../../lib/useDateFilter';
import { useSweep } from '../../lib/useSweep';
import { useTransactionPress } from '../../lib/useTransactionPress';
import { getCashflowSnapshotFromTransactions } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useAssetsStore } from '../../stores/useAssetsStore';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useDesignLabStore, type AccountDetailVariant } from '../../stores/useDesignLabStore';
import { useFixedDepositsStore } from '../../stores/useFixedDepositsStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
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

// ── Helpers for category-grouped view in account screen ──────────────────
function signedCurrency(value: number, sym: string) {
  const abs = Math.abs(value);
  const formatted = formatCurrency(abs, sym);
  return value < 0 ? `-${formatted}` : formatted;
}
function familyAwareCurrency(familyKey: HierarchyFamily, total: number, sym: string) {
  if (familyKey === 'in' || familyKey === 'out') {
    const naturalValue = familyKey === 'out' ? -total : total;
    const prefix = naturalValue < 0 ? '-' : '';
    return `${prefix}${formatCurrency(Math.abs(total), sym)}`;
  }
  return signedCurrency(total, sym);
}

type HomePeriodType = 'today' | PeriodType;
type HierarchyFamily = 'in' | 'out' | 'loan' | 'deposit' | 'transfer';
type CategoryDrilldown = { parentKey: string; parentLabel: string; subKey: string; subLabel: string; compactLabel?: boolean };
type AccountViewMode = 'date' | 'category';

const PERIODS: HomePeriodType[] = ['today', 'week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<HomePeriodType, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom'
};

/** Compact list/category toggle — same as the one in ActivityFilterBar */
function AccountViewModeToggle({ mode, palette, onChange }: { mode: AccountViewMode; palette: AppThemePalette; onChange: (m: AccountViewMode) => void }) {
  return (
    <View style={{ flexDirection: 'row', borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.states.activitySegmentedBg, overflow: 'hidden' }}>
      {([{ key: 'date' as const, icon: 'list' }, { key: 'category' as const, icon: 'layout-grid' }]).map((item) => {
        const selected = mode === item.key;
        return (
          <TouchableOpacity key={item.key} delayPressIn={0} activeOpacity={0.8} onPress={() => onChange(item.key)}
            style={{ width: 40, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? palette.surface : 'transparent' }}>
            <AppIcon name={item.icon} size={18} color={selected ? palette.brand : palette.iconTint} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  return <HomeScreenContent />;
}

function HomeScreenContent() {
  const nav = useNavigation();
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
  const hideAmounts = useUIStore((s) => s.settings.hideAmounts);
  const txMutationVersion = useTransactionsStore((s) => s.mutationVersion);
  const [showBalanceVisibilitySheet, setShowBalanceVisibilitySheet] = useState(false);

  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    refreshAccounts().catch(() => undefined);
  }, [txMutationVersion, refreshAccounts]);

  useEffect(() => {
    accounts.forEach(a => prefetchAccountTrend(a.id, txMutationVersion));
  }, [accounts, txMutationVersion]);
  const accountScrollRef = useRef<any>(null);
  const pageScrollTopRef = useRef<(() => void) | null>(null);

  const orderedAccounts = useMemo(
    () => accounts.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt.localeCompare(b.createdAt)),
    [accounts],
  );

  const verticalScrolls = useSharedValue<number[]>([0]);
  const indicatorY = useSharedValue(0);

  const dateFilter = useDateFilter({ initialPeriod: 'today' });
  const [homeFullResetNonce, setHomeFullResetNonce] = useState(0);

  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const [customRangeOpen, setCustomRangeOpen] = useState(false);

  useEffect(() => {
    return registerTabReset('index', ({ mode, animated }) => {
      if (mode === 'full') {
        pageScrollTopRef.current?.();
        accountScrollRef.current?.scrollTo({ x: 0, animated });
        dateFilter.setPeriod('today');
        setHomeFullResetNonce((n) => n + 1);
      }
    });
  }, [dateFilter, setHomeFullResetNonce]);



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
    loadBudgets(toLocalMonthStartISO(now.getFullYear(), now.getMonth())).catch(() => undefined);
  }, [loadBudgets]);

  const handleCustomRangeDone = useCallback(() => {
    const fromDate = customDraftFrom <= customDraftTo ? customDraftFrom : customDraftTo;
    const toDate = customDraftTo >= customDraftFrom ? customDraftTo : customDraftFrom;
    setCustomDraftFrom(fromDate);
    setCustomDraftTo(toDate);
    dateFilter.setCustomRange({
      from: toLocalDayStartISO(fromDate),
      to: toLocalDayEndISO(toDate)
    });
    dateFilter.setPeriod('custom');
    setCustomRangeOpen(false);
  }, [customDraftFrom, customDraftTo, dateFilter]);

  const toggleHomeAccountInclusion = useCallback((accountId: string, included: boolean) => {
    const next = new Set(homeExcludedAccountIds);
    if (included) {
      next.delete(accountId);
    } else {
      next.add(accountId);
    }
    updateSettings({ homeExcludedAccountIds: Array.from(next) }).catch(() => undefined);
  }, [homeExcludedAccountIds, updateSettings]);

  const resetHomeAccountInclusion = useCallback(() => {
    updateSettings({ homeExcludedAccountIds: [] }).catch(() => undefined);
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
    : `${activeDepositCount} Active · ${hideAmounts ? '•••' : formatNetWorthStripValue(depositSummary.activeInvestedValue, displaySymbol)}`;
  const loanMeta = loanSummary.youLent === 0 && loanSummary.youOwe === 0
    ? 'No loans'
    : `${loanSummary.net >= 0 ? 'Net Lent' : 'Net Owed'} · ${hideAmounts ? '•••' : formatNetWorthStripValue(Math.abs(loanSummary.net), displaySymbol)}`;
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
        onPress={() => safePush(nav, '/accounts')}
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
          const sign = acc.balance < 0 ? '-' : '';
          const baseLabel = showCurrencySymbol ? `${sign}${formatCurrency(Math.abs(acc.balance), currencySymbol)}` : `${sign}${formatCurrency(Math.abs(acc.balance), '')}`;
          const amountLabel = hideAmounts ? '••••' : baseLabel;
          const cardWidth = Math.min(206, Math.max(172, 142 + Math.min(baseLabel.length, 14) * 3));
          return (
            <AccountCarouselCard
              key={acc.id}
              acc={acc}
              palette={palette}
              amountLabel={amountLabel}
              cardWidth={cardWidth}
              hideAmounts={hideAmounts}
              nav={nav}
            />
          );
        })}
        <AccountCarouselAddCard palette={palette} nav={nav} />
      </ScrollView>

      <View style={{ marginTop: 20, marginBottom: 12 }}>
        <Text appWeight="medium" style={{ fontSize: 17, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>More</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {moreCards.map((feature) => (
          <MoreShortcutCard key={feature.id} feature={feature} palette={palette} nav={nav} />
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
              onPress={() => safePush(nav, '/notes' as any)}
              style={{ padding: 6 }}
              activeOpacity={0.7}
              delayPressIn={0}
            >
              <AppIcon name="list-todo" size={20} color={palette.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => updateSettings({ hideAmounts: !hideAmounts })}
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
        dateFilter={dateFilter}
        onOpenCustomRange={() => {
          setCustomDraftFrom(new Date(dateFilter.customRange?.from || Date.now()));
          setCustomDraftTo(new Date(dateFilter.customRange?.to || Date.now()));
          setCustomRangeOpen(true);
        }}
        totalBalance={includedHomeBalance}
        onRefresh={refreshAccounts}
        isSelected={true}
        pageIndex={0}
        verticalScrolls={verticalScrolls}
        indicatorY={indicatorY}
        registerScrollTop={(_, fn) => { pageScrollTopRef.current = fn; }}
        isPageReady={true}
        fullResetNonce={homeFullResetNonce}
        dataNonce={txMutationVersion}
        accountsById={accountsById}
        categoriesById={categoriesById}
        loansById={loansById}
        getCategoryFullDisplayName={getCategoryFullDisplayName}
        loansLoaded={loansLoaded}
        loadLoans={loadLoans}
        onOpenNetWorth={() => safePush(nav, '/net-worth')}
        onOpenBalanceVisibility={() => setShowBalanceVisibilitySheet(true)}
        homeExcludedCount={homeExcludedAccountIds.length}
        homeTotalCount={accounts.length}
        netWorth={stableNetWorth}
        middleContent={middleContent}
        nav={nav}
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
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md, marginTop: HOME_SPACE.lg, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <TextButton label="Cancel" onPress={() => setCustomRangeOpen(false)} palette={palette} tone="default" />
              </View>
              <View style={{ flex: 1 }}>
                <FilledButton label="Done" onPress={handleCustomRangeDone} palette={palette} tone="brand" style={{ borderRadius: 24, minHeight: 40 }} />
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
  nav,
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
  nav: any;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => safePush(nav, feature.route as any)}
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
const TICK_W = 2;
const TICK_GAP = 4;
const TICK_CONTAINER_W = Math.max(80, Dimensions.get('window').width - 2 * SCREEN_GUTTER - 2 * 14);
const TICK_TOTAL = Math.floor((TICK_CONTAINER_W + TICK_GAP) / (TICK_W + TICK_GAP));
const TICK_CONTENT_W = TICK_TOTAL * (TICK_W + TICK_GAP) - TICK_GAP;
const TICK_REMAINDER = TICK_CONTAINER_W - TICK_CONTENT_W;

// ── Metric spring: each number that actually changed springs up ──────────────
// A tx mutation bumps `tweenTrigger`, which arms the animation; the side whose
// amount changes after the DB reload springs. The arm survives that short gap
// (up to ~1.2s), then disarms once a change is acknowledged or the window lapses
// so unrelated period/cashflow toggles cannot borrow a stale arm.
const METRIC_ARM_WINDOW_MS = 1200;

function useMetricSprings(tweenTrigger: number, leftAmount: number, rightAmount: number) {
  const leftSpring = useSharedValue(0);
  const rightSpring = useSharedValue(0);
  const lastTweenTriggerRef = useRef(tweenTrigger);
  // 0 = disarmed; otherwise the timestamp the trigger last bumped.
  const armedStampRef = useRef(0);
  const lastLeftAmountRef = useRef(leftAmount);
  const lastRightAmountRef = useRef(rightAmount);

  useEffect(() => {
    if (tweenTrigger !== lastTweenTriggerRef.current) {
      lastTweenTriggerRef.current = tweenTrigger;
      armedStampRef.current = performance.now();
    }

    const leftChanged = leftAmount !== lastLeftAmountRef.current;
    const rightChanged = rightAmount !== lastRightAmountRef.current;
    lastLeftAmountRef.current = leftAmount;
    lastRightAmountRef.current = rightAmount;

    if (armedStampRef.current === 0) return;
    if (performance.now() - armedStampRef.current > METRIC_ARM_WINDOW_MS) {
      armedStampRef.current = 0;
      return;
    }

    const springUp = (sv: typeof leftSpring) => {
      sv.value = -4;
      sv.value = withSpring(0, { damping: 12, stiffness: 220, mass: 0.6 });
    };

    if (leftChanged) springUp(leftSpring);
    if (rightChanged) springUp(rightSpring);
    if (leftChanged || rightChanged) armedStampRef.current = 0; // consumed
  }, [tweenTrigger, leftAmount, rightAmount, leftSpring, rightSpring]);

  const leftSpringStyle = useAnimatedStyle(() => ({ transform: [{ translateY: leftSpring.value }] }));
  const rightSpringStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rightSpring.value }] }));

  return { leftSpringStyle, rightSpringStyle };
}

// Wraps a metric number so it slides up when its value changes. Feed it a spring
// style from useMetricSprings; keeps the slide identical across hero + account cards.
function AnimatedMetricValue({
  style,
  children,
}: {
  // Animated style from useMetricSprings (translateY worklet).
  style: ReturnType<typeof useMetricSprings>['leftSpringStyle'];
  children: React.ReactNode;
}) {
  return <Animated.View style={style}>{children}</Animated.View>;
}

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
  dateFilter,
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
  tweenTrigger = 0,
  nav: _nav,
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
  dateFilter?: any;
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
  tweenTrigger?: number;
  nav: any;
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
  const isNegative = balance < 0;
  const realBalanceFormatted = formatCurrency(Math.abs(balance), currencySymbol);
  const realDotIdx = realBalanceFormatted.lastIndexOf('.');
  const realBalanceInt = realDotIdx >= 0 ? realBalanceFormatted.slice(0, realDotIdx) : realBalanceFormatted;
  const balanceFormatted = hideAmounts ? null : realBalanceFormatted;
  const dotIdx = balanceFormatted ? balanceFormatted.lastIndexOf('.') : -1;
  const balanceInt = hideAmounts ? '••••' : (dotIdx >= 0 ? balanceFormatted!.slice(0, dotIdx) : balanceFormatted ?? '');
  const balanceDec = hideAmounts ? '' : (dotIdx >= 0 ? balanceFormatted!.slice(dotIdx) : '');
  const balanceColor = heroMode ? heroText : balance < 0 ? palette.numberNegative : palette.text;
  const heroBalanceDigitCount = realBalanceInt.replace(currencySymbol, '').replace(/[^0-9]/g, '').length;
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

  // Slide-up acknowledgement for whichever metric just changed — shared by the
  // home hero strip and the per-account hero card. See useMetricSprings.
  const { leftSpringStyle, rightSpringStyle } = useMetricSprings(
    tweenTrigger,
    metricLeftAmount,
    metricRightAmount,
  );

  // Home-hero metric value with de-emphasised decimals — mirrors the big balance
  // and the per-account card so cents read smaller/muted instead of full size.
  const renderHeroMetricValue = (amount: number): React.ReactNode => {
    if (hideAmounts) return '••••';
    if (amount === 0) return '—';
    const sign = amount < 0 ? '-' : '';
    const formatted = formatCurrency(Math.abs(amount), currencySymbol);
    const dotIdx = formatted.lastIndexOf('.');
    if (dotIdx >= 0 && dotIdx > formatted.length - 4) {
      return (
        <Text>
          {sign}{formatted.slice(0, dotIdx)}
          <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>
            {formatted.slice(dotIdx)}
          </Text>
        </Text>
      );
    }
    return `${sign}${formatted}`;
  };

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

  const nwSweepStyle = useSweep(netWorth ?? 0, { duration: 1100, to: 320 });

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
                {isNegative && !hideAmounts && (
                  <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.medium, color: heroText, marginRight: 1 }}>-</Text>
                )}
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
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              {/* Tappable column: label + big balance — opens BalanceVisibilitySheet */}
              <PressableScale
                onPress={onOpenBalanceVisibility}
                disabled={!onOpenBalanceVisibility}
                style={{ flex: 1, alignSelf: 'stretch' }}
              >
                <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.metaTiny, fontWeight: FONT_WEIGHT.semibold, color: 'rgba(255,255,255,0.72)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 3 }}>
                  {homeExcludedCount > 0 ? `${homeTotalCount - homeExcludedCount} of ${homeTotalCount} Accounts` : 'All Accounts'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  {isNegative && !hideAmounts && (
                    <Text appWeight="medium" style={{ fontSize: heroCurrencyFontSize, fontWeight: FONT_WEIGHT.medium, color: 'rgba(255,255,255,0.65)', marginRight: 1 }}>
                      -
                    </Text>
                  )}
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
                </View>
              </PressableScale>

              {/* NW chip — independent tap target */}
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={onOpenNetWorth && typeof netWorth === 'number' ? 0.75 : 1}
                disabled={!(onOpenNetWorth && typeof netWorth === 'number')}
                onPress={onOpenNetWorth}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: onOpenNetWorth && typeof netWorth === 'number' ? 1 : 0 }}
              >
                <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: 'rgba(255,255,255,0.88)', fontFamily: 'monospace' }}>
                  {hideAmounts ? 'NW •••' : `NW ${formatNetWorthStripValue(netWorth ?? 0, currencySymbol)}`}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: nwChangeBg, borderRadius: HOME_RADIUS.full, paddingHorizontal: 7, paddingVertical: 3, minWidth: 36, justifyContent: 'center', opacity: netWorthChange !== undefined ? 1 : 0, overflow: 'hidden' }}>
                  {nwChangeTone !== 'neutral' && (
                    <AppIcon name={nwChangeTone === 'positive' ? 'trending-up' : 'trending-down'} size={10} color={nwChangeInk} strokeWidth={2.4} />
                  )}
                  <Text style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.bold, color: nwChangeInk, fontFamily: 'monospace' }}>
                    {nwChangeTone === 'neutral' ? '—' : formatNetWorthStripValue(Math.abs(netWorthChange ?? 0), currencySymbol)}
                  </Text>
                  <SweepOverlay style={nwSweepStyle} width={40} alpha={0.28} />
                </View>
                <AppIcon name="chevron-right" size={12} color='rgba(255,255,255,0.40)' strokeWidth={2} />
              </TouchableOpacity>
            </View>
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
                  {isNegative && !hideAmounts ? '-' : ''}{balanceInt}
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
                {dateFilter && (
                  <SegmentedPillSwitch
                    options={periodOptions}
                    value={dateFilter.period === 'today' ? 'day' : dateFilter.period}
                    onChange={(key) => {
                      const nextPeriod = key as HomePeriodType;
                      if (nextPeriod === 'custom') {
                        dateFilter.setPeriod('custom');
                        return;
                      }
                      dateFilter.setPeriod(nextPeriod);
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
                      <Text style={{ fontSize: 10.5, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: 0.2 }}>
                        {formatDate(from)}
                      </Text>
                      {dateFilter?.period !== 'today' && (
                        <Animated.View entering={FadeInRight.duration(200)} exiting={FadeOutRight.duration(200)}>
                          <Text style={{ fontSize: 10.5, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: 0.2 }}>
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
                        <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.chartIncome }} />
                      ))}
                    </View>
                  </Animated.View>
                  <Animated.View style={[{ position: 'absolute', top: 0, height: 12, overflow: 'hidden' }, expenseTickOverlayStyle]}>
                    <View style={{ position: 'absolute', right: 0, flexDirection: 'row', gap: TICK_GAP, width: TICK_CONTENT_W }}>
                      {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                        <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.chartExpense }} />
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
                  // Arrow icon + position already conveys the bucket (income vs expense).
                  // Only the unusual case (a negative value in that bucket) gets a leading '-'
                  // to flag that the day's net went the opposite direction.
                  const leftSign = metricLeftAmount < 0 ? '-' : '';
                  const rightSign = metricRightAmount < 0 ? '-' : '';
                  return (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 8 }}>
                      <TouchableOpacity delayPressIn={0} activeOpacity={0.75} onPress={onPressMetricIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <AppIcon name="arrow-down-left" size={15} color={leftIsZero ? palette.textMuted : palette.positive} strokeWidth={2.2} />
                        <View style={{ flexDirection: 'column' }}>
                          <AnimatedMetricValue style={leftSpringStyle}>
                            <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.semibold, color: leftIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }}>
                              {hideAmounts ? '••••' : leftIsZero ? '—' : (
                                <Text>{leftSign}{leftSplit.int}{leftSplit.dec ? <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{leftSplit.dec}</Text> : null}</Text>
                              )}
                            </Text>
                          </AnimatedMetricValue>
                          <Text style={{ fontSize: 11, color: heroMutedText, marginTop: 1, fontWeight: FONT_WEIGHT.medium }}>
                            {isCashflowView ? 'Inflow' : 'Income'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity delayPressIn={0} activeOpacity={0.75} onPress={onPressMetricOut} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                          <AnimatedMetricValue style={rightSpringStyle}>
                            <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.semibold, color: rightIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }}>
                              {hideAmounts ? '••••' : rightIsZero ? '—' : (
                                <Text>{rightSign}{rightSplit.int}{rightSplit.dec ? <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{rightSplit.dec}</Text> : null}</Text>
                              )}
                            </Text>
                          </AnimatedMetricValue>
                          <Text style={{ fontSize: 11, color: heroMutedText, marginTop: 1, fontWeight: FONT_WEIGHT.medium }}>
                            {isCashflowView ? 'Outflow' : 'Expense'}
                          </Text>
                        </View>
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
                  <AnimatedText
                    appWeight="medium"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      {
                        fontSize: HOME_TEXT.sectionTitle,
                        fontWeight: FONT_WEIGHT.semibold,
                        letterSpacing: -0.2,
                        color: metricLeftAmount === 0 ? palette.textMuted : palette.text,
                        marginBottom: 3,
                      },
                      leftSpringStyle,
                    ]}
                  >
                    {renderHeroMetricValue(metricLeftAmount)}
                  </AnimatedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <AppIcon name="arrow-down-left" size={14} color={palette.textMuted} strokeWidth={2} />
                    <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      {metricLeftLabel}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: palette.isDark ? 'rgba(255,255,255,0.08)' : palette.divider }} />

                <TouchableOpacity
                  delayPressIn={0}
                  activeOpacity={0.76}
                  disabled={!onPressMetricOut}
                  onPress={onPressMetricOut}
                  style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 15, alignItems: 'flex-end' }}
                >
                  <AnimatedText
                    appWeight="medium"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      {
                        fontSize: HOME_TEXT.sectionTitle,
                        fontWeight: FONT_WEIGHT.semibold,
                        letterSpacing: -0.2,
                        color: metricRightAmount === 0 ? palette.textMuted : palette.text,
                        marginBottom: 3,
                      },
                      rightSpringStyle,
                    ]}
                  >
                    {renderHeroMetricValue(metricRightAmount)}
                  </AnimatedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      {metricRightLabel}
                    </Text>
                    <AppIcon name="arrow-up-right" size={14} color={palette.textMuted} strokeWidth={2} />
                  </View>
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
                {hideAmounts ? '•••' : formatNetWorthStripValue(netWorth ?? 0, currencySymbol)}
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
  // Always operate on the magnitude — sign is applied by the caller so it can
  // pick its own convention (e.g. expense gets '-' for positive outflow, '+' for refund).
  const abs = Math.abs(amount);
  const truncated = Math.floor(abs * 100) / 100;
  const intPart = Math.floor(truncated);
  const cents = Math.round((truncated - intPart) * 100);
  return {
    int: intPart.toLocaleString(APP_LOCALE),
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

  totalBalance,
  onRefresh,
  isSelected,
  pageIndex,
  verticalScrolls,
  indicatorY,
  dateFilter,
  registerScrollTop,
  onOpenNetWorth,
  onOpenBalanceVisibility,
  homeExcludedCount,
  homeTotalCount,
  netWorth,
  isPageReady,
  middleContent,
  middleContentLedger,
  middleContentPulse,
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
  dataNonce = 0,
  nav,
  onInlineFilterChange,
  resetInlineFilterToken = 0,
  isDetailScreen = false,
  activePoint = null,
  onApplyCustomRange,
  onScrollYChange,
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
  dateFilter: ReturnType<typeof useDateFilter>;
  registerScrollTop: (id: string, fn: (() => void) | null) => void;
  onOpenNetWorth?: () => void;
  onOpenBalanceVisibility?: () => void;
  homeExcludedCount?: number;
  homeTotalCount?: number;
  netWorth?: number;
  isPageReady: boolean;
  middleContent?: React.ReactNode;
  /** Ledger-tuned chart node (Design Lab Phase 2). Used when the user has
   *  switched the account-detail screen to the Ledger variant. */
  middleContentLedger?: React.ReactNode;
  middleContentPulse?: React.ReactNode;
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
  dataNonce?: number;
  nav: any;
  onInlineFilterChange?: (filter: 'in' | 'out' | null) => void;
  resetInlineFilterToken?: number;
  isDetailScreen?: boolean;
  activePoint?: any;
  onApplyCustomRange?: (from: Date, to: Date) => void;
  onScrollYChange?: (y: number) => void;
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
  // Inline filter: tap inc/exp on hero → filter Activity list to those tx; reset clears it
  const [inlineFilter, setInlineFilter] = useState<'in' | 'out' | null>(null);
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  useEffect(() => {
    if (resetInlineFilterToken > 0) {
      setInlineFilter(null);
      dateFilter?.setOffset(0);
      setActivityViewMode('date');
      setCategoryDrilldown(null);
      setExpandedCategoryIds([]);
      dateFilter?.setPeriod('today');
      mainScrollRef.current?.scrollTo({ y: 0, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetInlineFilterToken]);
  // Activity view mode (list vs category grouped) — only used for individual account pages
  const [activityViewMode, setActivityViewMode] = useState<AccountViewMode>('date');
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const [categoryDrilldown, setCategoryDrilldown] = useState<CategoryDrilldown | null>(null);
  const isScreenFocused = useIsFocused();
  const loadRequestIdRef = useRef(0);

  // Design-lab variant — only meaningful on the account-detail screen. Read at
  // top level so the variant flip re-renders the screen.
  const designVariantRaw = useDesignLabStore((s) => s.accountDetailVariant);
  const designVariant = __DEV__ ? designVariantRaw : 'current';
  const activeVariant: AccountDetailVariant = isDetailScreen ? designVariant : 'current';
  const todayDataCacheRef = useRef<{
    cashflow: CashflowSummary;
    periodTransactions: Transaction[];
    transactions: Transaction[];
  } | null>(null);
  const lastNWChipValueRef = useRef<number | undefined>(undefined);
  // Y of the Activity section inside the inner padding View. We add the outer
  // hero block's height to it before scrolling.
  const activitySectionY = useRef(0);
  const lowerBlockOffsetY = useRef(0);

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
    const accountFilter = accountId === 'all' ? undefined : accountId;
    const [recentTransactions, periodScopedTransactions] = await Promise.all([
      getTransactions({ accountId: accountFilter, limit: 10 }),
      getTransactions({ accountId: accountFilter, fromDate: rangeFrom, toDate: rangeTo }),
    ]);

    if (requestId !== loadRequestIdRef.current) return;

    const periodSnapshot = getCashflowSnapshotFromTransactions(periodScopedTransactions, {
      includeTransfers: true,
      includeLoans: true,
    });
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
    if (onScrollYChange) {
      runOnJS(onScrollYChange)(y);
    }
  });

  const from = dateFilter?.from || '';
  const to = dateFilter?.to || '';
  const currentRangeKey = `${from}:${to}`;
  // Period label for the Activity section header: "Today", "Jun 2026", "1 Jun – 7 Jun", etc.
  const activityPeriodLabel = dateFilter?.label || 'Today';
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

  const accounts = useAccountsStore((s) => s.accounts);
  const account = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId]);
  const typeMeta = account ? ACCOUNT_TYPE_META[account.type as AccountType] : null;
  const typeColor = typeMeta?.color ?? palette.brand;

  const accountHeroDarkGradient: [string, string] = useMemo(() => {
    const accountType = account?.type;
    if (!accountType || !typeColor.startsWith('#') || typeColor.length < 7) return ['#16192A', '#1A1E30'];
    const r = parseInt(typeColor.slice(1, 3), 16);
    const g = parseInt(typeColor.slice(3, 5), 16);
    const b = parseInt(typeColor.slice(5, 7), 16);
    const darkFactor = 0.68;
    const dr = Math.round(r * darkFactor);
    const dg = Math.round(g * darkFactor);
    const db = Math.round(b * darkFactor);
    const darker = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
    return [typeColor, darker];
  }, [account?.type, typeColor]);

  const detailInflowColor = palette.positive;
  const detailOutflowColor = palette.negative;

  const isNegative = totalBalance < 0;
  const realBalanceFormatted = formatCurrency(Math.abs(totalBalance), currencySymbol);
  const balanceFormatted = hideAmounts ? null : realBalanceFormatted;
  const dotIdx = balanceFormatted ? balanceFormatted.lastIndexOf('.') : -1;
  const balanceInt = hideAmounts ? '••••' : (dotIdx >= 0 ? balanceFormatted!.slice(0, dotIdx) : balanceFormatted ?? '');
  const balanceDec = hideAmounts ? '' : (dotIdx >= 0 ? balanceFormatted!.slice(dotIdx) : '');

  // Tick data — drives the speedometer sweep animation in detail cards
  const metricLeftAmount = cashflowIsCashflow ? (displayedCashflow?.in ?? 0) : (incExpSummary?.income ?? 0);
  const metricRightAmount = cashflowIsCashflow ? (displayedCashflow?.out ?? 0) : (incExpSummary?.expense ?? 0);

  const tickIn = metricLeftAmount;
  const tickOut = metricRightAmount;
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
    tickActivityProgress.value = withTiming(totalTick > 0 ? 1 : 0, { duration: 250 });
    prevTotalTickRef.current = totalTick;
  }, [tickIn, tickOut, incomeFraction, totalTick]);

  const detailIncomeTickOverlayStyle = useAnimatedStyle(() => {
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

  const detailExpenseTickOverlayStyle = useAnimatedStyle(() => {
    const progress = tickActivityProgress.value;
    const fraction = animatedIncomeFraction.value;
    const greenTicksCount = Math.round(fraction * TICK_TOTAL);
    const redTicksCount = TICK_TOTAL - greenTicksCount;
    const currentRedTicks = redTicksCount * progress;
    const width = currentRedTicks > 0
      ? currentRedTicks * TICK_W + (currentRedTicks - 1) * TICK_GAP
      : 0;
    return {
      width: Math.max(0, width),
      right: 0,
    };
  });

  const { leftSpringStyle, rightSpringStyle } = useMetricSprings(
    dataNonce,
    metricLeftAmount,
    metricRightAmount
  );

  const detailCashflowNoteProgress = useSharedValue(cashflowIsCashflow ? 1 : 0);
  React.useEffect(() => {
    detailCashflowNoteProgress.value = withTiming(cashflowIsCashflow ? 1 : 0, { duration: 220 });
  }, [cashflowIsCashflow]);

  React.useEffect(() => {
    setInlineFilter(null);
    onInlineFilterChange?.(null);
  }, [cashflowIsCashflow, onInlineFilterChange]);

  const CASHFLOW_NOTE_H = 22;
  const detailCashflowNoteStyle = useAnimatedStyle(() => ({
    height: detailCashflowNoteProgress.value * CASHFLOW_NOTE_H,
    opacity: detailCashflowNoteProgress.value,
  }));

  // ── Category hierarchy for grouped view ──────────────────────────────────
  const categoryHierarchy = useMemo(() => {
    if (activityViewMode !== 'category' || accountId === 'all') return [];
    const parentMap = new Map<string, {
      parentKey: string; parentLabel: string; parentIcon?: string;
      parentSyntheticType?: HierarchyFamily; familyOrder: number; familyKey: HierarchyFamily;
      transactions: Transaction[];
      subMap: Map<string, { subKey: string; subLabel: string; transactions: Transaction[] }>;
    }>();

    const getFamilyKey = (tx: Transaction): HierarchyFamily => {
      if (tx.transferPairId) return 'transfer';
      if (tx.type === 'out') return 'out';
      if (tx.type === 'in') return 'in';
      if (tx.type === 'loan') return 'loan';
      if (tx.type === 'deposit') return 'deposit';
      return 'transfer';
    };
    const getFamilyOrder = (fk: HierarchyFamily) =>
      fk === 'in' ? 0 : fk === 'out' ? 1 : fk === 'transfer' ? 2 : fk === 'deposit' ? 3 : 4;

    const sourceTx = inlineFilter
      ? displayedPeriodTransactions.filter((tx) => !tx.transferPairId && tx.type === inlineFilter)
      : displayedPeriodTransactions;
    sourceTx.forEach((tx) => {
      const category = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
      const parent = category?.parentId ? categoriesById.get(category.parentId) : undefined;
      const familyKey = getFamilyKey(tx);
      const parentKey = parent ? parent.id : category ? category.id : tx.transferPairId ? 'type:transfer' : `type:${tx.type}`;
      const parentLabel = parent ? parent.name : category ? category.name : tx.transferPairId ? 'Transfer' : tx.type === 'transfer' ? 'Transfer' : tx.type === 'loan' ? 'Loan' : tx.type === 'deposit' ? 'Deposit' : 'Uncategorized';
      const parentIcon = parent ? parent.icon : category ? category.icon : undefined;
      const subKey = category?.id ?? (tx.transferPairId ? 'type:transfer' : `type:${tx.type}`);
      const subLabel = category ? category.name : tx.transferPairId ? 'Transfer' : tx.type === 'transfer' ? 'Transfer' : tx.type === 'loan' ? 'Loan' : tx.type === 'deposit' ? 'Deposit' : 'Uncategorized';

      if (!parentMap.has(parentKey)) {
        parentMap.set(parentKey, {
          parentKey, parentLabel, parentIcon,
          parentSyntheticType: parent || category ? undefined : familyKey,
          familyOrder: getFamilyOrder(familyKey), familyKey,
          transactions: [], subMap: new Map()
        });
      }
      const entry = parentMap.get(parentKey)!;
      entry.transactions.push(tx);
      if (!entry.subMap.has(subKey)) entry.subMap.set(subKey, { subKey, subLabel, transactions: [] });
      entry.subMap.get(subKey)!.transactions.push(tx);
    });

    return Array.from(parentMap.values())
      .map((entry) => ({
        parentKey: entry.parentKey, parentLabel: entry.parentLabel, parentIcon: entry.parentIcon,
        parentSyntheticType: entry.parentSyntheticType,
        total: getCashflowFromList(entry.transactions, true, true, true).net,
        transactions: entry.transactions,
        subcategories: Array.from(entry.subMap.values())
          .map((sub) => ({
            subKey: sub.subKey, subLabel: sub.subLabel,
            total: getCashflowFromList(sub.transactions, true, true, true).net,
            transactions: sub.transactions,
          }))
          .sort((a, b) => a.subLabel.localeCompare(b.subLabel, 'en', { sensitivity: 'base' })),
        familyOrder: entry.familyOrder, familyKey: entry.familyKey,
      }))
      .sort((a, b) => a.familyOrder !== b.familyOrder ? a.familyOrder - b.familyOrder : a.parentLabel.localeCompare(b.parentLabel, 'en', { sensitivity: 'base' }));
  }, [activityViewMode, accountId, displayedPeriodTransactions, categoriesById, inlineFilter]);

  const hierarchySections = useMemo(
    () =>
      ([
        { key: 'in', label: 'Income' }, { key: 'out', label: 'Expenses' },
        { key: 'transfer', label: 'Transfers' }, { key: 'deposit', label: 'Deposits' },
        { key: 'loan', label: 'Loans' },
      ] as const)
        .map((s) => ({ ...s, items: categoryHierarchy.filter((c) => c.familyKey === s.key) }))
        .filter((s) => s.items.length > 0),
    [categoryHierarchy],
  );

  const drilldownTransactions = useMemo(
    () => categoryDrilldown ? getActivityDrilldownTransactions(displayedPeriodTransactions, categoryDrilldown) : displayedPeriodTransactions,
    [categoryDrilldown, displayedPeriodTransactions],
  );

  const inlineFilteredTransactions = useMemo(() => {
    if (!inlineFilter) return displayedPeriodTransactions;
    return displayedPeriodTransactions.filter((tx) => {
      if (tx.transferPairId) return false;
      if (inlineFilter === 'in') return tx.type === 'in';
      if (inlineFilter === 'out') return tx.type === 'out';
      return true;
    });
  }, [inlineFilter, displayedPeriodTransactions]);

  const toggleCategoryExpansion = useCallback((id: string) => {
    setExpandedCategoryIds((prev) => prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]);
  }, []);

  const toggleSectionExpansion = useCallback((parentKeys: string[]) => {
    setExpandedCategoryIds((prev) => {
      const allExpanded = parentKeys.every((k) => prev.includes(k));
      return allExpanded ? prev.filter((k) => !parentKeys.includes(k)) : [...new Set([...prev, ...parentKeys])];
    });
  }, []);

  const activePointDateFormatted = useMemo(() => {
    if (!activePoint?.date) return '';
    const d = new Date(activePoint.date.includes('T') ? activePoint.date : activePoint.date + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${d.toLocaleDateString(APP_LOCALE, { month: 'short' })}`;
  }, [activePoint]);

  const activePointValFormatted = useMemo(() => {
    if (!activePoint) return '';
    return formatSignedCurrency(activePoint.val, currencySymbol, { zeroPlaceholder: null });
  }, [activePoint, currencySymbol]);

  const txTypeConfig = useMemo(() => getTxTypeConfig(palette), [palette]);

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
  }, [from, loadRangeData, to, dataNonce]);

  const lastLoadedNonceRef = useRef(dataNonce);
  const loadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isPageReady || !isScreenFocused) return;
    if (dataNonce !== lastLoadedNonceRef.current) {
      lastLoadedNonceRef.current = dataNonce;
      if (loadDebounceRef.current) clearTimeout(loadDebounceRef.current);
      // Mutation-driven: the modal transition is already complete by the time
      // mutationVersion bumps, so skip the InteractionManager wait.
      loadPageData();
    } else {
      // Keep a short debounce so rapid arrow taps coalesce without making a
      // deliberate period selection feel delayed.
      if (loadDebounceRef.current) clearTimeout(loadDebounceRef.current);
      loadDebounceRef.current = setTimeout(() => {
        loadPageData();
      }, 60);
    }
    return () => {
      if (loadDebounceRef.current) clearTimeout(loadDebounceRef.current);
    };
  }, [isPageReady, isScreenFocused, loadPageData, dataNonce]);

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
      if (accountId !== 'all') {
        // Individual account: filter the Activity list inline and scroll to it.
        const targetFilter = kind === 'in' || kind === 'out' ? kind : null;
        const newFilter = inlineFilter === targetFilter ? null : targetFilter;
        setInlineFilter(newFilter);
        setActivityViewMode('date');
        setCategoryDrilldown(null);
        onInlineFilterChange?.(newFilter);
        const targetY = lowerBlockOffsetY.current + activitySectionY.current - 10;
        if (newFilter !== null && targetY > 0) {
          mainScrollRef.current?.scrollTo({ y: targetY, animated: true });
        }
        return;
      }
      // Home "All" hero: navigate to filtered activity screen as before
      safePush(nav, {
        pathname: '/(tabs)/activity',
        params: {
          source: dateFilter?.period === 'today' ? 'home-today' : 'home-period',
          period: dateFilter?.period === 'today' ? 'day' : dateFilter?.period,
          accountId: 'all',
          returnTo: '/',
          cashflowBucket: cashflowIsCashflow ? kind : 'all',
          type: cashflowIsCashflow ? 'all' : kind,
          cashflowMode: cashflowIsCashflow ? 'total' : 'incomeExpense',
          from,
          to,
          ts: String(Date.now())
        }
      });
    },
    [accountId, inlineFilter, cashflowIsCashflow, from, dateFilter, to, nav, onInlineFilterChange],
  );

  const handleTransactionPress = useTransactionPress();

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
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: isDetailScreen ? 2 : HOME_SURFACE.heroTop, paddingBottom: isDetailScreen ? 0 : HOME_SURFACE.heroBottom }}>
          {isDetailScreen ? null : (
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
              dateFilter={accountId === 'all' ? undefined : dateFilter}
              isCashflowView={cashflowIsCashflow}
              onToggleCashflowView={setCashflowIsCashflow}
              onPressMetricIn={() => openPeriodActivity('in')}
              onPressMetricOut={() => openPeriodActivity('out')}
              hideAmounts={hideAmounts}
              heroMode
              heroMetricPeriod={dateFilter?.period === 'month' ? 'month' : 'today'}
              onHeroMetricPeriodChange={(next) => dateFilter?.setPeriod(next)}
              tweenTrigger={dataNonce}
              accountType={useAccountsStore.getState().accounts.find(a => a.id === accountId)?.type}
              from={from}
              to={to}
              nav={nav}
            />
          )}
          <View
            onLayout={(event) => {
              const newY = event.nativeEvent.layout.y;
              if (isSelected && newY > 0 && indicatorY.value !== newY) {
                indicatorY.value = newY;
              }
            }}
            style={{ height: isDetailScreen ? 0 : (accountId === 'all' ? 34 : 8) }}
          />
        </View>

        <View
          onLayout={(e) => { lowerBlockOffsetY.current = e.nativeEvent.layout.y; }}
          style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 0 }}
        >


          {isDetailScreen && activeVariant === 'current' ? (
            <View
              style={{
                backgroundColor: palette.card,
                borderRadius: HOME_RADIUS.card,
                borderWidth: 1,
                borderColor: palette.borderSoft,
                marginBottom: 32,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <View style={{ position: 'relative', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
                {/* Balance Row */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  {/* Col 1: Icon */}
                  <View style={{
                    backgroundColor: typeMeta?.bg ?? `${typeColor}18`,
                    width: 42, height: 42,
                    borderRadius: HOME_RADIUS.chip,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <AppIcon
                      name={typeMeta?.icon ?? 'wallet'}
                      size={20}
                      color={typeColor}
                      strokeWidth={1.9}
                    />
                  </View>
                  {/* Col 2: Type label & Balance values */}
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 10,
                      fontWeight: FONT_WEIGHT.heavy,
                      color: palette.textSecondary,
                      letterSpacing: 1.6,
                      textTransform: 'uppercase',
                      marginBottom: 2,
                    }}>
                      {accountTypeLabel}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      {isNegative && !hideAmounts && (
                        <Text style={{
                          fontSize: 24,
                          fontWeight: FONT_WEIGHT.regular,
                          color: palette.text,
                          marginRight: 2,
                        }}>−</Text>
                      )}
                      {currencySymbol && !hideAmounts && (
                        <Text style={{
                          fontSize: 16,
                          fontWeight: FONT_WEIGHT.regular,
                          color: palette.textSecondary,
                          marginRight: 4,
                        }}>
                          {currencySymbol}
                        </Text>
                      )}
                      <Text
                        adjustsFontSizeToFit
                        numberOfLines={1}
                        style={{
                          fontSize: 28,
                          fontWeight: FONT_WEIGHT.regular,
                          color: palette.text,
                          letterSpacing: -0.5,
                          fontVariant: ['tabular-nums'],
                          lineHeight: 34,
                        }}>
                        {currencySymbol && balanceInt.startsWith(currencySymbol) ? balanceInt.slice(currencySymbol.length) : balanceInt}
                      </Text>
                      {balanceDec && (
                        <Text style={{
                          fontSize: 15,
                          fontWeight: FONT_WEIGHT.regular,
                          color: palette.textSecondary,
                          fontVariant: ['tabular-nums'],
                        }}>
                          {balanceDec}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Active tooltip overlay block */}
                {activePoint && (() => {
                  const diff = activePoint.prev ? activePoint.val - activePoint.prev.val : 0;
                  const hasPrev = diff !== 0 && activePoint.prev;
                  let prevDateStr = '';
                  if (hasPrev) {
                    const prevD = new Date(activePoint.prev.date + 'T00:00:00');
                    prevDateStr = isNaN(prevD.getTime()) ? '' : `${prevD.getDate()} ${prevD.toLocaleDateString(APP_LOCALE, { month: 'short' })}`;
                  }
                  const isPositive = diff > 0;
                  const tooltipBg = palette.background;
                  const textMainColor = palette.text;
                  const textMutedColor = palette.textSecondary;
                  const dividerColor = palette.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';

                  return (
                    <View style={{
                      position: 'absolute',
                      top: 28,
                      alignSelf: 'center',
                      backgroundColor: tooltipBg,
                      borderRadius: 12,
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      zIndex: 100,
                      shadowColor: palette.isDark ? '#000000' : '#94A3B8',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: palette.isDark ? 0.3 : 0.15,
                      shadowRadius: 8,
                      elevation: 8,
                    }}>
                      {/* Column 1: Dates */}
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text style={{ fontSize: 11, color: textMutedColor, fontWeight: FONT_WEIGHT.semibold }}>
                          {activePointDateFormatted}
                        </Text>
                        {hasPrev && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 9.5, color: palette.textMuted, marginRight: 3 }}>vs</Text>
                            <Text style={{ fontSize: 10, color: textMutedColor, fontWeight: FONT_WEIGHT.medium }}>
                              {prevDateStr}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Divider */}
                      <View style={{ width: 1, height: hasPrev ? 26 : 14, backgroundColor: dividerColor }} />

                      {/* Column 2: Amounts */}
                      <View style={{ alignItems: 'flex-start', gap: 2 }}>
                        <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.semibold, color: textMainColor }}>
                          {activePointValFormatted}
                        </Text>
                        {hasPrev && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <AppIcon
                              name={isPositive ? 'trending-up' : 'trending-down'}
                              size={12}
                              color={isPositive ? palette.numberPositive : palette.numberNegative}
                              strokeWidth={2.5}
                            />
                            <Text style={{
                              fontSize: 10,
                              color: isPositive ? palette.numberPositive : palette.numberNegative,
                              fontWeight: FONT_WEIGHT.bold,
                            }}>
                              {formatSignedCurrency(Math.abs(diff), currencySymbol, { zeroPlaceholder: null })}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })()}

                {/* Chart Line container aligned with ticks */}
                <View style={{ marginHorizontal: -16, alignItems: 'center', marginBottom: 8, marginTop: 4, overflow: 'visible' }}>
                  <View style={{ width: TICK_CONTENT_W * 300 / 280, overflow: 'visible' }}>
                    {middleContent}
                  </View>
                </View>
              </View>
            </View>
          ) : isDetailScreen && activeVariant === 'pulse' ? (
            <>
              <PulseAccountHero
                accountTypeLabel={accountTypeLabel}
                accountType={useAccountsStore.getState().accounts.find(a => a.id === accountId)?.type}
                isNegative={isNegative}
                hideAmounts={!!hideAmounts}
                currencySymbol={currencySymbol}
                balanceInt={balanceInt}
                balanceDec={balanceDec}
                activePoint={activePoint}
                activePointDateFormatted={activePointDateFormatted}
                activePointValFormatted={activePointValFormatted}
                middleContent={middleContentPulse ?? middleContentLedger ?? middleContent}
                palette={palette}
              />
              <PulseQuickActions />
            </>
          ) : isDetailScreen && activeVariant === 'ledger' ? (
            <LedgerAccountHero
              accountTypeLabel={accountTypeLabel}
              isNegative={isNegative}
              hideAmounts={!!hideAmounts}
              currencySymbol={currencySymbol}
              balanceInt={balanceInt}
              balanceDec={balanceDec}
              activePoint={activePoint}
              activePointDateFormatted={activePointDateFormatted}
              activePointValFormatted={activePointValFormatted}
              middleContent={middleContentLedger ?? middleContent}
            />
          ) : (
            middleContent
          )}

          {isDetailScreen && activeVariant === 'current' && (
            <View
              style={{
                backgroundColor: palette.card,
                borderRadius: HOME_RADIUS.card,
                borderWidth: 1,
                borderColor: palette.borderSoft,
                paddingTop: 16,
                paddingBottom: 8,
                paddingHorizontal: 18,
                marginBottom: 24,
              }}
            >
              {/* Row 1: Period switcher aligned with ticks bar edges */}
              <View style={{ height: 28, width: TICK_CONTENT_W + 8, alignSelf: 'center', marginBottom: 0, marginTop: -4 }}>
                <ActivityPeriodHeader
                  period={dateFilter?.period === 'today' ? 'day' : dateFilter?.period as 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'}
                  periodLabel={
                    inlineFilter === 'in'
                      ? `${cashflowIsCashflow ? 'Inflow' : 'Income'} · ${activityPeriodLabel}`
                      : inlineFilter === 'out'
                      ? `${cashflowIsCashflow ? 'Outflow' : 'Expenses'} · ${activityPeriodLabel}`
                      : activityPeriodLabel
                  }
                  goPrev={() => dateFilter?.navigatePrevious()}
                  goNext={() => dateFilter?.navigateNext()}
                  canGoNext={dateFilter?.canNavigateNext}
                  setShowPeriodSheet={() => setShowPeriodSheet(true)}
                  palette={palette}
                  height={28}
                  noBackground={true}
                  showArrowBorders={true}
                />
              </View>

              {/* Row 3: Ticks and Values */}
              <View style={{ paddingBottom: 0 }}>
                {/* Speedometer sweep ticks */}
                <View style={{ flexDirection: 'row', gap: TICK_GAP, marginTop: 12, marginBottom: 10, width: TICK_CONTENT_W, alignSelf: 'center' }}>
                  {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                    <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }} />
                  ))}
                  <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: 12, overflow: 'hidden' }, detailIncomeTickOverlayStyle]}>
                    <View style={{ flexDirection: 'row', gap: TICK_GAP, width: TICK_CONTENT_W }}>
                      {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                        <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: detailInflowColor }} />
                      ))}
                    </View>
                  </Animated.View>
                  <Animated.View style={[{ position: 'absolute', top: 0, height: 12, overflow: 'hidden' }, detailExpenseTickOverlayStyle]}>
                    <View style={{ position: 'absolute', right: 0, flexDirection: 'row', gap: TICK_GAP, width: TICK_CONTENT_W }}>
                      {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                        <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: detailOutflowColor }} />
                      ))}
                    </View>
                  </Animated.View>
                </View>

                {/* Values (Income/Expense / Inflow/Outflow) */}
                {(() => {
                  const leftSplit = splitTickAmount(metricLeftAmount);
                  const rightSplit = splitTickAmount(metricRightAmount);
                  const leftIsZero = metricLeftAmount === 0;
                  const rightIsZero = metricRightAmount === 0;
                  const leftSign = metricLeftAmount < 0 ? '-' : '';
                  const rightSign = metricRightAmount < 0 ? '-' : '';
                  return (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 0, width: TICK_CONTENT_W, alignSelf: 'center' }}>
                      <TouchableOpacity
                        delayPressIn={0}
                        activeOpacity={0.75}
                        onPress={() => openPeriodActivity('in')}
                        style={{ flexDirection: 'column', gap: 2 }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <AppIcon
                            name="arrow-down-left"
                            size={14}
                            color={leftIsZero ? palette.textMuted : detailInflowColor}
                            strokeWidth={2.4}
                          />
                          <Text style={{ fontSize: 11, color: palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>
                            {cashflowIsCashflow ? 'Inflow' : 'Income'}
                          </Text>
                        </View>
                        <AnimatedMetricValue style={leftSpringStyle}>
                          <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.medium, color: leftIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }}>
                            {hideAmounts ? '••••' : leftIsZero ? '—' : (
                              <Text>{leftSign}{leftSplit.int}{leftSplit.dec ? <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.regular, color: palette.textMuted }}>{leftSplit.dec}</Text> : null}</Text>
                            )}
                          </Text>
                        </AnimatedMetricValue>
                      </TouchableOpacity>

                      <TouchableOpacity
                        delayPressIn={0}
                        activeOpacity={0.75}
                        onPress={() => openPeriodActivity('out')}
                        style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontSize: 11, color: palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>
                            {cashflowIsCashflow ? 'Outflow' : 'Expense'}
                          </Text>
                          <AppIcon
                            name="arrow-up-right"
                            size={14}
                            color={rightIsZero ? palette.textMuted : detailOutflowColor}
                            strokeWidth={2.4}
                          />
                        </View>
                        <AnimatedMetricValue style={rightSpringStyle}>
                          <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.medium, color: rightIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }}>
                            {hideAmounts ? '••••' : rightIsZero ? '—' : (
                              <Text>{rightSign}{rightSplit.int}{rightSplit.dec ? <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.regular, color: palette.textMuted }}>{rightSplit.dec}</Text> : null}</Text>
                            )}
                          </Text>
                        </AnimatedMetricValue>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                {/* Subtle dashed line above Cashflow Toggle */}
                <View
                  style={{
                    borderBottomWidth: 1,
                    borderColor: palette.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    borderStyle: 'dashed',
                    height: 1,
                    marginTop: 8,
                    marginHorizontal: -18,
                  }}
                />

                {/* Cashflow Toggle (Shifted below values with reduced size) */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8, marginBottom: 0 }}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setCashflowIsCashflow(!cashflowIsCashflow)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted }}>
                      Cashflow
                    </Text>
                    <AppSwitch
                      value={cashflowIsCashflow}
                      onValueChange={(val) => setCashflowIsCashflow(val)}
                      palette={palette}
                      width={30}
                      height={16}
                      thumbSize={10}
                      padding={3}
                    />
                  </TouchableOpacity>
                </View>

                {/* Cashflow info note */}
                <Animated.View style={detailCashflowNoteStyle}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 4 }}>
                    <AppIcon name="info" size={11} color={palette.textMuted} strokeWidth={1.8} />
                    <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, letterSpacing: 0.1 }}>
                      {HELP_TEXTS.cashflowNote}
                    </Text>
                  </View>
                </Animated.View>
              </View>
            </View>
          )}

          {isDetailScreen && activeVariant === 'pulse' && (
            <PulseCashflowBar
              palette={palette}
              dateFilter={dateFilter}
              activityPeriodLabel={activityPeriodLabel}
              inlineFilter={inlineFilter}
              setShowPeriodSheet={setShowPeriodSheet}
              cashflowIsCashflow={cashflowIsCashflow}
              setCashflowIsCashflow={setCashflowIsCashflow}
              hideAmounts={!!hideAmounts}
              currencySymbol={currencySymbol}
              metricLeftAmount={metricLeftAmount}
              metricRightAmount={metricRightAmount}
              animatedIncomeFraction={animatedIncomeFraction}
              tickActivityProgress={tickActivityProgress}
              openPeriodActivity={openPeriodActivity}
            />
          )}

          {isDetailScreen && activeVariant === 'ledger' && (
            <LedgerCashflowCard
              palette={palette}
              dateFilter={dateFilter}
              activityPeriodLabel={activityPeriodLabel}
              inlineFilter={inlineFilter}
              setShowPeriodSheet={setShowPeriodSheet}
              cashflowIsCashflow={cashflowIsCashflow}
              setCashflowIsCashflow={setCashflowIsCashflow}
              hideAmounts={!!hideAmounts}
              currencySymbol={currencySymbol}
              metricLeftAmount={metricLeftAmount}
              metricRightAmount={metricRightAmount}
              detailInflowColor={detailInflowColor}
              detailOutflowColor={detailOutflowColor}
              animatedIncomeFraction={animatedIncomeFraction}
              tickActivityProgress={tickActivityProgress}
              openPeriodActivity={openPeriodActivity}
            />
          )}

          {/* ── Activity — list or category-grouped ── */}
          <View
            onLayout={(e) => { activitySectionY.current = e.nativeEvent.layout.y; }}
            style={{
              marginBottom: 4,
              marginTop: accountId === 'all' ? 24 : (isDetailScreen ? 8 : 28),
              minHeight: isDetailScreen ? Dimensions.get('window').height - 100 : undefined
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: accountId === 'all' ? 8 : 16 }}>
              {categoryDrilldown ? (
                <TouchableOpacity delayPressIn={0} onPress={() => setCategoryDrilldown(null)} activeOpacity={0.75}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <AppIcon name="arrow-left" size={18} color={palette.text} strokeWidth={1.8} />
                  <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.subhead, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                    {categoryDrilldown.compactLabel ? categoryDrilldown.parentLabel : `${categoryDrilldown.parentLabel} › ${categoryDrilldown.subLabel}`}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.subhead, fontWeight: FONT_WEIGHT.medium, color: palette.text, flex: 1, marginRight: 8 }}>
                  {inlineFilter === 'in' ? 'Income' : inlineFilter === 'out' ? 'Expenses' : 'Activity'}
                </Text>
              )}
              {accountId !== 'all' && !categoryDrilldown && (
                <AccountViewModeToggle
                  mode={activityViewMode}
                  palette={palette}
                  onChange={(mode) => {
                    setActivityViewMode(mode);
                    setExpandedCategoryIds([]);
                    if (mode === 'date') setCategoryDrilldown(null);
                  }}
                />
              )}
            </View>

            {/* Date-grouped list view (default, or drilldown from category) */}
            {(activityViewMode === 'date' || categoryDrilldown) && (
              <DateGroupedTransactionList
                transactions={categoryDrilldown ? drilldownTransactions : inlineFilter ? inlineFilteredTransactions : (accountId === 'all' ? transactions : displayedPeriodTransactions)}
                palette={palette}
                sym={currencySymbol}
                categoriesById={categoriesById}
                accountsById={accountsById}
                loansById={loansById}
                depositsById={depositsById}
                tagNamesById={tagNamesById}
                getCategoryFullDisplayName={getCategoryFullDisplayName}
                onTransactionPress={handleTransactionPress}
                emptyText="No Transactions Yet"
                emptyStateTransparentDashed={activeVariant === 'pulse'}
              />
            )}

            {/* Category-grouped view (only for individual accounts, not drilldown) */}
            {activityViewMode === 'category' && !categoryDrilldown && accountId !== 'all' && (
              <View style={{ marginHorizontal: -SCREEN_GUTTER }}>
                {hierarchySections.map((section, sectionIndex) => (
                  <View key={section.key}>
                    {(() => {
                      const expandableParentKeys = section.items
                        .filter((c) => c.familyKey !== 'loan' && c.familyKey !== 'transfer' && c.familyKey !== 'deposit')
                        .map((c) => c.parentKey);
                      const allExpanded = expandableParentKeys.length > 0 && expandableParentKeys.every((k) => expandedCategoryIds.includes(k));
                      const headerStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: CARD_PADDING, paddingTop: sectionIndex === 0 ? 0 : 6, paddingBottom: 7 };
                      const headerContent = (
                        <>
                          <Text appWeight="medium" style={{ flex: 1, fontSize: HOME_TEXT.tiny + 1, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 0.8, textTransform: 'uppercase' as const, color: palette.text }}>
                            {section.label}
                          </Text>
                          {expandableParentKeys.length > 0 && (
                            <AppIcon name={allExpanded ? 'chevrons-up' : 'chevrons-down'} size={15} color={palette.text} strokeWidth={1.8} />
                          )}
                        </>
                      );
                      return expandableParentKeys.length > 0 ? (
                        <TouchableOpacity delayPressIn={0} onPress={() => toggleSectionExpansion(expandableParentKeys)} activeOpacity={0.72} style={headerStyle}>
                          {headerContent}
                        </TouchableOpacity>
                      ) : (
                        <View style={headerStyle}>{headerContent}</View>
                      );
                    })()}
                    <CardSection palette={palette}>
                      {section.items.map((category, categoryIndex) => {
                        const isExpanded = expandedCategoryIds.includes(category.parentKey);
                        const isDirectNavigation = category.familyKey === 'loan' || category.familyKey === 'transfer' || category.familyKey === 'deposit';
                        const isLastCategory = categoryIndex === section.items.length - 1;
                        const syntheticCfg = category.parentSyntheticType ? (txTypeConfig as any)[category.parentSyntheticType] : undefined;
                        return (
                          <View key={category.parentKey}>
                            <TouchableOpacity delayPressIn={0}
                              onPress={() => {
                                if (category.familyKey === 'loan') { setCategoryDrilldown({ parentKey: category.parentKey, parentLabel: 'Loans', subKey: 'type:loan', subLabel: 'Loans', compactLabel: true }); return; }
                                if (category.familyKey === 'transfer') { setCategoryDrilldown({ parentKey: category.parentKey, parentLabel: 'Transfers', subKey: 'type:transfer', subLabel: 'Transfers', compactLabel: true }); return; }
                                if (category.familyKey === 'deposit') { setCategoryDrilldown({ parentKey: category.parentKey, parentLabel: 'Deposits', subKey: 'type:deposit', subLabel: 'Deposits', compactLabel: true }); return; }
                                toggleCategoryExpansion(category.parentKey);
                              }}
                              activeOpacity={0.75}
                              style={{
                                flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                                paddingHorizontal: CARD_PADDING, minHeight: 70, backgroundColor: palette.card,
                                borderBottomWidth: isLastCategory && (!isExpanded || isDirectNavigation) ? 0 : 1,
                                borderBottomColor: palette.divider, gap: 12,
                              }}
                            >
                              <CategoryIconBadge
                                icon={category.parentSyntheticType === 'loan' ? 'credit-card' : syntheticCfg?.iconName || category.parentIcon}
                                palette={palette} iconColor={palette.brand}
                                size={HOME_LAYOUT.listIconSize} iconSize={HOME_LAYOUT.listIconInnerSize}
                                strokeWidth={HOME_LAYOUT.listIconStrokeWidth} noBackground
                              />
                              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.text, flex: 1 }} numberOfLines={1}>
                                {category.parentLabel}
                              </Text>
                              <Text style={{
                                fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, marginRight: 2,
                                color: category.familyKey === 'in' ? palette.numberPositive : category.familyKey === 'out' ? palette.numberNegative : category.total >= 0 ? palette.numberPositive : palette.numberNegative,
                              }}>
                                {familyAwareCurrency(category.familyKey, category.total, currencySymbol)}
                              </Text>
                              {isDirectNavigation ? (
                                <AppChevron direction="right" size={18} tone="secondary" palette={palette} />
                              ) : (
                                <AppChevron direction={isExpanded ? 'up' : 'down'} size={18} tone="secondary" palette={palette} />
                              )}
                            </TouchableOpacity>
                            {isExpanded && !isDirectNavigation && (
                              <View style={{ backgroundColor: palette.surface, borderBottomWidth: isLastCategory ? 0 : 1, borderBottomColor: palette.divider }}>
                                {category.subcategories.map((sub) => (
                                  <TouchableOpacity delayPressIn={0} key={sub.subKey}
                                    onPress={() => setCategoryDrilldown({ parentKey: category.parentKey, parentLabel: category.parentLabel, subKey: sub.subKey, subLabel: sub.subLabel })}
                                    activeOpacity={0.75}
                                    style={{
                                      flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                                      paddingLeft: CARD_PADDING + 52, paddingRight: CARD_PADDING,
                                      minHeight: 52, borderTopWidth: 1, borderTopColor: palette.divider, backgroundColor: palette.surface,
                                    }}
                                  >
                                    <Text numberOfLines={1} style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>
                                      {sub.subLabel}
                                    </Text>
                                    <Text style={{
                                      fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, marginRight: 10,
                                      color: category.familyKey === 'in' ? palette.numberPositive : category.familyKey === 'out' ? palette.numberNegative : sub.total >= 0 ? palette.numberPositive : palette.numberNegative,
                                    }}>
                                      {familyAwareCurrency(category.familyKey, sub.total, currencySymbol)}
                                    </Text>
                                    <AppChevron direction="right" size={16} tone="secondary" palette={palette} />
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </CardSection>
                  </View>
                ))}
                {hierarchySections.length === 0 && (
                  <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
                    <EmptyTransactions
                      palette={palette}
                      emptyText="No Transactions Yet"
                      isTransparentDashed={activeVariant === 'pulse'}
                    />
                  </View>
                )}
              </View>
            )}
          </View>


          {__DEV__ && accountId === 'all' && (
            <View style={{ alignItems: 'center', marginTop: 2 }}>
              <TouchableOpacity delayPressIn={0} onPress={() => safePush(nav, '/net-worth-prototype')}>
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
              <TouchableOpacity delayPressIn={0} onPress={() => safePush(nav, '/palette-preview')} style={{ marginTop: 10 }}>
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

      {showPeriodSheet && (
        <PeriodFilterSheet
          period={dateFilter?.period === 'today' ? 'day' : dateFilter?.period as 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'}
          periodOffset={dateFilter?.offset || 0}
          customFrom={dateFilter?.customRange?.from}
          customTo={dateFilter?.customRange?.to}
          yearStart={settingsYearStart}
          palette={palette}
          hasNavBar={!isDetailScreen}
          hideLast30={isDetailScreen}
          onSelectPeriod={(nextPeriod: string, nextOffset: number) => {
            const mappedPeriod = nextPeriod === 'day' ? 'today' : nextPeriod;
            // setPeriod first (it resets offset to 0 internally), then setOffset
            // so a non-zero offset (e.g. Yesterday = -1) isn't clobbered.
            dateFilter?.setPeriod(mappedPeriod as any);
            if (nextOffset !== 0) {
              dateFilter?.setOffset(nextOffset);
            }
            setShowPeriodSheet(false);
          }}
          onApplyCustom={(fromStr: string, toStr: string) => {
            if (onApplyCustomRange) {
              onApplyCustomRange(new Date(fromStr), new Date(toStr));
            }
            setShowPeriodSheet(false);
          }}
          onClose={() => setShowPeriodSheet(false)}
        />
      )}
    </View>
  );
});

function AccountCarouselCard({ acc, palette, amountLabel, cardWidth, hideAmounts, nav }: any) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const typeMeta = ACCOUNT_TYPE_META[acc.type as AccountType];
  const typeColor = typeMeta.color;

  return (
    <Pressable
      onPress={() => safePush(nav, `/account/${acc.id}`)}
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
        <View style={{ paddingHorizontal: 14, paddingVertical: 14, minHeight: 102, justifyContent: 'space-between' }}>
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

function AccountCarouselAddCard({ palette, nav }: any) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => safePush(nav, '/settings/account-form')}
      onPressIn={() => { scale.value = withTiming(0.96, { duration: 100 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 150 }); }}
    >
      <Animated.View
        style={[animStyle, {
          width: 86,
          height: 104,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'transparent',
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: `${palette.brand}50`,
        }]}
      >
        <AppIcon name="plus" size={20} color={palette.brand} strokeWidth={2.5} />
      </Animated.View>
    </Pressable>
  );
}
