import { Text } from '@/components/ui/AppText';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  useSharedValue,
  type SharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeDonutChartBlock, type HomeChartMode } from '../../components/HomeDonutChartBlock';
import { HomeNetWorthPage } from '../../components/HomeNetWorthPage';
import { ScreenTitle } from '../../components/settings-ui';
import { TransactionListItem } from '../../components/TransactionListItem';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { AppDonutChart } from '../../components/ui/AppDonutChart';
import { AppIcon } from '../../components/ui/AppIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { getCompactScrollableBottomPadding } from '../../components/ui/safeBottom';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SegmentedPillSwitch } from '../../components/ui/SegmentedPillSwitch';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { ASSET_BG, ASSET_TONE } from '../../lib/assetVisuals';
import {
  formatDate,
  getDateRange,
  toLocalDayEndISO,
  toLocalDayStartISO
} from '../../lib/dateUtils';
import { formatCurrency, getLoanSummary, getTotalBalance } from '../../lib/derived';
import { CARD_PADDING, SCREEN_GUTTER, SPACING, TYPE , FONT_WEIGHT} from '../../lib/design';
import { getFixedDepositSummary } from '../../lib/fixed-deposits';
import {
  BUTTON_TOKENS,
  HOME_LAYOUT,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_SURFACE,
  HOME_TEXT,
  SCREEN_HEADER
} from '../../lib/layoutTokens';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../../lib/settings-shared';
import { registerTabReset } from '../../lib/tabResetRegistry';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { getCashflowSnapshot } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';
import { getCategoryDisplayIcon } from '../../lib/category-utils';
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
function HeroCardAurora({ palette }: { palette: AppThemePalette }) {
  const brand = palette.brand;
  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      width="100%"
      height="100%"
      viewBox="0 0 400 230"
      preserveAspectRatio="none"
    >
      <Defs>
        {/* Top-right blob */}
        <RadialGradient id="aur1" cx="88%" cy="15%" r="55%" fx="88%" fy="15%">
          <Stop offset="0%" stopColor={brand} stopOpacity={palette.isDark ? 0.22 : 0.14} />
          <Stop offset="100%" stopColor={brand} stopOpacity={0} />
        </RadialGradient>
        {/* Bottom-left blob */}
        <RadialGradient id="aur2" cx="8%" cy="88%" r="42%" fx="8%" fy="88%">
          <Stop offset="0%" stopColor={brand} stopOpacity={palette.isDark ? 0.14 : 0.09} />
          <Stop offset="100%" stopColor={brand} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={400} height={230} fill="url(#aur1)" />
      <Rect x={0} y={0} width={400} height={230} fill="url(#aur2)" />
    </Svg>
  );
}

const ACCOUNT_TYPE_SORT_ORDER: Record<AccountType, number> = {
  savings: 0,
  cash: 1,
  wallet: 2,
  investment: 3,
  credit: 4,
  other: 5,
};
const NW_HERO_PROGRESS_LABEL_GAP = 8;

export default function HomeScreen() {
  return <HomeScreenContent />;
}

function HomeScreenContent() {
  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const categories = useCategoriesStore((s) => s.categories);
  const loadCategories = useCategoriesStore((s) => s.load);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);
  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);
  const settingsYearStart = useUIStore((s) => s.settings.yearStart);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const [hideAmounts, setHideAmounts] = useState(false);

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
  const [chartMode, setChartMode] = useState<HomeChartMode>('expense');
  const [selectedChartCategoryId, setSelectedChartCategoryId] = useState<string | null>(null);

  useEffect(() => {
    return registerTabReset('index', ({ mode, animated }) => {
      if (mode === 'full') {
        pageScrollTopRef.current?.();
        accountScrollRef.current?.scrollTo({ x: 0, animated });
      }
      setPeriod('today');
    });
  }, [setPeriod]);

  const [customRangeFrom, setCustomRangeFrom] = useState(() => toLocalDayStartISO(new Date()));
  const [customRangeTo, setCustomRangeTo] = useState(() => toLocalDayEndISO(new Date()));
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const [customRangeOpen, setCustomRangeOpen] = useState(false);

  const [expandedChartState, setExpandedChartState] = useState<{
    transactions: Transaction[];
    mode: HomeChartMode;
    resetTrigger: number;
  } | null>(null);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);

  const totalBalance = useMemo(() => getTotalBalance(accounts), [accounts]);
  const loanSummary = useMemo(() => getLoanSummary(loans), [loans]);
  const depositSummary = useMemo(() => getFixedDepositSummary(), []);
  const netWorth = totalBalance + loanSummary.net + depositSummary.activeMaturityValue;
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
    : `${activeDepositCount} Active · ${formatNetWorthStripValue(depositSummary.activeMaturityValue, displaySymbol)}`;
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
      icon: 'vault',
      route: '/deposits',
      meta: depositMeta,
      tone: '#A23B72',
      bg: '#FCE7F3',
    },
    {
      id: 'Loans',
      label: 'Loans',
      icon: 'hand-coins',
      route: '/loans',
      meta: loanMeta,
      tone: '#0369A1',
    },
    {
      id: 'Budgets',
      label: 'Budgets',
      icon: 'pie-chart',
      route: '/budget',
      meta: budgetMeta,
      tone: '#4338CA',
      bg: '#F0F2FF',
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
    <View style={{ marginTop: 0, marginBottom: 30 }}>
      <TouchableOpacity
        onPress={() => router.push('/accounts')}
        delayPressIn={0}
        activeOpacity={0.72}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, marginTop: 8, paddingVertical: 2 }}
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
          const typeMeta = ACCOUNT_TYPE_META[acc.type];
          const typeColor = typeMeta.color;
          const pct = totalBalance !== 0 ? Math.round(Math.abs(acc.balance) / Math.abs(totalBalance) * 100) : 0;
          return (
            <TouchableOpacity
              key={acc.id}
              onPress={() => router.push(`/account/${acc.id}`)}
              activeOpacity={0.78}
              style={{
                width: cardWidth,
                backgroundColor: palette.surface,
                borderRadius: HOME_RADIUS.card,
                borderWidth: 1,
                borderColor: palette.borderSoft,
                overflow: 'hidden',
              }}
            >
              <View style={{ paddingHorizontal: 14, paddingVertical: 14, minHeight: 116, justifyContent: 'space-between' }}>
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
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.medium, color: acc.balance < 0 ? palette.negative : palette.text }}>
                    {amountLabel}
                  </Text>
                  {totalBalance !== 0 && !hideAmounts && (
                    <Text style={{ fontSize: HOME_TEXT.metaTiny, color: palette.textMuted, marginTop: 2 }}>
                      {pct}% of Total
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => router.push('/settings/account-form')}
          style={{
            width: 140,
            padding: 16,
            backgroundColor: palette.surface,
            borderRadius: HOME_RADIUS.card,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: palette.borderSoft,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <AppIcon name="plus-circle" size={22} color={palette.text} />
          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>Add Account</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ marginTop: 30, marginBottom: 14 }}>
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
          <TouchableOpacity
            onPress={() => setHideAmounts((v) => !v)}
            style={{ padding: 6 }}
            activeOpacity={0.7}
            delayPressIn={0}
          >
            <AppIcon name={hideAmounts ? 'eye-closed' : 'eye'} size={20} color={palette.textMuted} strokeWidth={1.8} />
          </TouchableOpacity>
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
        totalBalance={totalBalance}
        onRefresh={refreshAccounts}
        isSelected={true}
        pageIndex={0}
        verticalScrolls={verticalScrolls}
        indicatorY={indicatorY}
        period={period}
        onPeriodChange={setPeriod}
        chartMode={chartMode}
        onChartModeChange={setChartMode}
        selectedChartCategoryId={selectedChartCategoryId}
        onChartCategorySelect={setSelectedChartCategoryId}
        registerScrollTop={(_, fn) => { pageScrollTopRef.current = fn; }}
        isPageReady={true}
        accountsById={accountsById}
        categoriesById={categoriesById}
        loansById={loansById}
        getCategoryFullDisplayName={getCategoryFullDisplayName}
        loansLoaded={loansLoaded}
        loadLoans={loadLoans}
        onOpenNetWorth={() => router.push('/net-worth')}
        netWorth={netWorth}
        middleContent={middleContent}
        onOpenChartExpanded={(transactions, mode, range, resetTrigger) => {
          setExpandedChartState({ transactions, mode, resetTrigger });
        }}
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

      {expandedChartState ? (
        <BottomSheet
          title="Category Breakdown"
          palette={palette}
          backgroundColor={palette.background}
          disableShadow
          onClose={() => {
            setExpandedChartState(null);
          }}
          maxHeightRatio={0.80}
          fixedHeightRatio={0.80}
          hasNavBar
        >
          <View style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 0, backgroundColor: palette.background }}>
            <View style={{ backgroundColor: palette.card, borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, overflow: 'hidden' }}>
              <HomeDonutChartBlock
                transactions={expandedChartState.transactions}
                categoriesById={categoriesById}
                sym={showCurrencySymbol ? currencySymbol : ''}
                listPalette={palette}
                getCategoryFullDisplayName={getCategoryFullDisplayName}
                theme={{ brand: palette.brand, card: palette.card, surface: '#EEF2F8', inputBg: '#FFFFFF', progressTrack: '#DDE4F0', border: '#DFE5EF', text: palette.text, muted: '#7C8498', textMuted: palette.textMuted, accent: palette.brand, positive: palette.positive, negative: palette.negative }}
                expanded
                initialMode={expandedChartState.mode}
                resetTrigger={expandedChartState.resetTrigger}
                accountsById={accountsById}
                loansById={loansById}
              />
            </View>
          </View>
        </BottomSheet>
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
  return (
    <TouchableOpacity
      delayPressIn={0}
      onPress={() => router.push(feature.route as any)}
      activeOpacity={0.78}
      style={{ width: '48.2%' }}
    >
      <View
        style={{
          height: 124,
          padding: 16,
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderColor: palette.borderSoft,
          backgroundColor: palette.surface,
          justifyContent: 'space-between',
        }}
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
      </View>
    </TouchableOpacity>
  );
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
  children,
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
  children?: React.ReactNode;
  heroMetricPeriod?: 'today' | 'month';
  onHeroMetricPeriodChange?: (p: 'today' | 'month') => void;
}) {
  const isAll = accountName === 'All';
  const isAccountHero = heroMode && !isAll;
  const isHomeHero = heroMode && isAll;
  // Account hero = dark card → white text. Home hero = white card → dark palette text.
  const heroText = isAccountHero ? '#FFFFFF' : palette.text;
  const heroMutedText = isAccountHero ? 'rgba(255,255,255,0.75)' : palette.textMuted;
  const heroSoftText = isAccountHero ? 'rgba(255,255,255,0.52)' : palette.textMuted;
  const netWorthStripBg = heroMode ? 'rgba(255,255,255,0.085)' : palette.isDark ? '#080C14' : '#E8EDF8';
  const netWorthStripBorder = heroMode ? 'rgba(255,255,255,0.18)' : palette.isDark ? palette.divider : '#D8E0F0';
  const heroMetricStripBg = isHomeHero
    ? (palette.isDark ? 'rgba(255,255,255,0.07)' : palette.inputBg)
    : 'rgba(255,255,255,0.06)';
  const heroMetricDivider = isHomeHero
    ? (palette.isDark ? 'rgba(255,255,255,0.10)' : palette.divider)
    : 'rgba(255,255,255,0.10)';

  const balanceFormatted = hideAmounts ? null : `${balance < 0 ? '-' : ''}${formatCurrency(Math.abs(balance), currencySymbol)}`;
  const dotIdx = balanceFormatted ? balanceFormatted.lastIndexOf('.') : -1;
  const balanceInt = hideAmounts ? '••••' : (dotIdx >= 0 ? balanceFormatted!.slice(0, dotIdx) : balanceFormatted ?? '');
  const balanceDec = hideAmounts ? '' : (dotIdx >= 0 ? balanceFormatted!.slice(dotIdx) : '');
  const balanceColor = heroMode ? heroText : balance < 0 ? palette.negative : palette.text;
  const heroBalanceDigitCount = balanceInt.replace(currencySymbol, '').replace(/[^0-9]/g, '').length;
  const heroBalanceFontSize = heroBalanceDigitCount >= 9 ? 21 : heroBalanceDigitCount >= 7 ? 23 : heroBalanceDigitCount >= 5 ? 25 : 28;
  const heroBalanceLineHeight = heroBalanceFontSize + 16;
  const heroCurrencyFontSize = Math.max(15, heroBalanceFontSize - 8);
  const heroDecimalFontSize = Math.max(14, heroBalanceFontSize - 9);
  const nwChangeTone = !netWorthChange ? 'neutral' : netWorthChange > 0 ? 'positive' : 'negative';
  const nwChangeBg = nwChangeTone === 'positive'
    ? 'rgba(190,242,100,0.90)'
    : nwChangeTone === 'negative'
      ? 'rgba(253,164,175,0.90)'
      : 'rgba(226,232,240,0.80)';
  const nwChangeInk = '#111827';
  const isCashflow = !!isCashflowView;
  const metricLeftLabel = isCashflow ? 'Inflow' : 'Income';
  const metricRightLabel = isCashflow ? 'Outflow' : 'Expense';
  const metricLeftAmount = isCashflow ? (cashflowSummary?.in ?? 0) : (incomeExpense?.income ?? 0);
  const metricRightAmount = isCashflow ? (cashflowSummary?.out ?? 0) : (incomeExpense?.expense ?? 0);
  const periodOptions = PERIODS.map((item) => ({ key: item, label: PERIOD_LABELS[item] }));

  const content = (
    <View
      style={{
        backgroundColor: isHomeHero && !palette.isDark ? '#FFFFFF' : 'transparent',
        borderColor: isHomeHero
          ? (palette.isDark ? palette.border : '#E2E7F4')
          : heroMode ? 'rgba(255,255,255,0.10)'
          : palette.isDark ? palette.borderSoft : '#D0D8EE',
        borderWidth: 1,
        borderRadius: heroMode ? 28 : 22,
        overflow: 'hidden',
        ...(isHomeHero && !palette.isDark ? {
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
          isHomeHero
            ? (palette.isDark ? ['#16192A', '#1A1E30'] : ['#FFFFFF', '#FFFFFF'])
            : heroMode
              ? ['#23304A', '#1E293B', '#24324F']
              : palette.isDark ? ['#0F172A', '#1E293B'] : ['#E8EFFC', '#F8FAFF']
        }
        locations={heroMode ? (isHomeHero ? [0, 1] : [0, 0.5, 1]) : undefined}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      {null}

      <View style={{ paddingHorizontal: heroMode ? 18 : CARD_PADDING, paddingTop: heroMode ? 16 : 20, paddingBottom: heroMode ? 14 : 22 }}>
        {/* Top Section */}
        {isAccountHero ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 20 }}>
            {accountType && (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', width: 52, height: 52, borderRadius: HOME_RADIUS.cardSm, alignItems: 'center', justifyContent: 'center' }}>
                <AppIcon 
                  name={ACCOUNT_TYPE_META[accountType]?.icon ?? 'wallet'} 
                  size={28} 
                  color="rgba(255,255,255,0.7)" 
                  strokeWidth={2} 
                />
              </View>
            )}
            <View style={{ alignItems: 'flex-end', flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.metaSmall, fontWeight: FONT_WEIGHT.semibold, color: heroMutedText, letterSpacing: 0.4, marginBottom: -1 }}>
                {accountName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                {currencySymbol && (
                  <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.medium, color: heroMutedText, marginRight: 3 }}>{currencySymbol}</Text>
                )}
                <Text style={{ fontSize: 24, fontWeight: FONT_WEIGHT.semibold, color: heroText }}>
                  {balanceInt.startsWith(currencySymbol || '') ? balanceInt.slice((currencySymbol || '').length) : balanceInt}
                </Text>
                {balanceDec && (
                  <Text style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.medium, color: heroSoftText }}>{balanceDec}</Text>
                )}
              </View>
            </View>
          </View>
        ) : heroMode ? (
          /* Home hero: aurora bg, label top-left + NW top-right, big balance, no icon */
          <View style={{ marginBottom: 14 }}>
            {/* Row 1: label (left) + NW tappable (right) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.metaTiny, fontWeight: FONT_WEIGHT.bold, color: palette.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                All Accounts
              </Text>
              {onOpenNetWorth && typeof netWorth === 'number' ? (
                <TouchableOpacity
                  delayPressIn={0}
                  activeOpacity={0.75}
                  onPress={onOpenNetWorth}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: palette.brand, fontFamily: 'monospace' }}>
                    {hideAmounts ? 'NW ••••' : `NW ${formatNetWorthStripValue(netWorth, currencySymbol)}`}
                  </Text>
                  {netWorthChange !== undefined && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: nwChangeBg, borderRadius: HOME_RADIUS.full, paddingHorizontal: 6, paddingVertical: 2 }}>
                      {nwChangeTone !== 'neutral' && (
                        <AppIcon name={nwChangeTone === 'positive' ? 'trending-up' : 'trending-down'} size={9} color={nwChangeInk} strokeWidth={2.5} />
                      )}
                      <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.bold, color: nwChangeInk }}>
                        {nwChangeTone === 'neutral' ? '—' : `${Math.abs(netWorthChange).toFixed(1)}%`}
                      </Text>
                    </View>
                  )}
                  <AppIcon name="chevron-right" size={12} color={palette.textSoft} strokeWidth={2} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Row 2: big balance number */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              {currencySymbol ? (
                <Text appWeight="medium" style={{ fontSize: heroCurrencyFontSize, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, marginRight: 4 }}>
                  {currencySymbol}
                </Text>
              ) : null}
              <Text
                appWeight="medium"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ fontSize: heroBalanceFontSize, lineHeight: heroBalanceLineHeight, fontWeight: FONT_WEIGHT.bold, color: palette.text, letterSpacing: -0.5, flexShrink: 1 }}
              >
                {currencySymbol && balanceInt.startsWith(currencySymbol) ? balanceInt.slice(currencySymbol.length) : balanceInt}
              </Text>
              {balanceDec ? (
                <Text appWeight="medium" style={{ fontSize: heroDecimalFontSize, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: -0.2 }}>
                  {balanceDec}
                </Text>
              ) : null}
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

        {/* Period Section */}
        {isAccountHero && period && onPeriodChange ? (
          <View style={{ marginTop: 8, gap: 12 }}>
            <SegmentedPillSwitch
              options={periodOptions}
              value={period}
              onChange={(key) => {
                const nextPeriod = key as HomePeriodType;
                if (nextPeriod === 'custom') {
                  onOpenCustomRange?.();
                  return;
                }
                onPeriodChange(nextPeriod);
              }}
              backgroundColor="rgba(255,255,255,0.065)"
              pillColor="rgba(255,255,255,0.16)"
              borderColor="rgba(255,255,255,0.14)"
              activeTextColor={heroText}
              inactiveTextColor={heroMutedText}
              height={32}
              radius={14}
              fontSize={10.5}
              itemMinWidth={54}
              style={{ alignSelf: 'stretch' }}
            />
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={0.78}
                onPress={() => onToggleCashflowView?.(!isCashflowView)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.semibold, color: heroMutedText }}>
                  Cashflow
                </Text>
                <View
                  style={{
                    width: 38,
                    height: 22,
                    borderRadius: HOME_RADIUS.full,
                    padding: 2,
                    backgroundColor: isCashflowView ? 'rgba(156,255,106,0.34)' : 'rgba(255,255,255,0.12)',
                    borderWidth: 1,
                    borderColor: isCashflowView ? 'rgba(156,255,106,0.46)' : 'rgba(255,255,255,0.16)',
                    alignItems: isCashflowView ? 'flex-end' : 'flex-start',
                  }}
                >
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: isCashflowView ? '#9CFF6A' : 'rgba(255,255,255,0.86)' }} />
                </View>
              </TouchableOpacity>

              {from && to && (
                <Animated.View layout={LinearTransition.springify().damping(30).stiffness(200).mass(0.8)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text appWeight="medium" numberOfLines={1} style={{ fontSize: 9.5, fontWeight: FONT_WEIGHT.semibold, color: heroSoftText, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {formatDate(from)}
                  </Text>
                  {period !== 'today' && (
                    <Animated.View 
                      entering={FadeInRight.duration(200)} 
                      exiting={FadeOutRight.duration(200)} 
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Text appWeight="medium" numberOfLines={1} style={{ fontSize: 9.5, fontWeight: FONT_WEIGHT.semibold, color: heroSoftText, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        {` - ${formatDate(to)}`}
                      </Text>
                    </Animated.View>
                  )}
                </Animated.View>
              )}
            </View>
          </View>
        ) : null}

        {heroMode && incomeExpense ? (
          <View
            style={{
              borderRadius: HOME_RADIUS.cardSm,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: isHomeHero
                ? (palette.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)')
                : 'transparent',
              backgroundColor: heroMetricStripBg,
            }}
          >
            {/* Strip header: period toggle + cashflow switch (home only) */}
            {isHomeHero && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 }}>
                {/* Today / Month pills */}
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {(['today', 'month'] as const).map((p) => {
                    const active = (heroMetricPeriod ?? 'today') === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        delayPressIn={0}
                        activeOpacity={0.75}
                        onPress={() => onHeroMetricPeriodChange?.(p)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                          borderRadius: 20,
                          backgroundColor: active
                            ? (isHomeHero ? palette.brand : 'rgba(255,255,255,0.18)')
                            : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: HOME_TEXT.metaSmall, fontWeight: active ? '600' : '400', color: active ? (isHomeHero ? '#FFFFFF' : '#FFFFFF') : heroSoftText }}>
                          {p === 'today' ? 'Today' : 'Month'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* Cashflow toggle */}
                <TouchableOpacity
                  delayPressIn={0}
                  activeOpacity={0.78}
                  onPress={() => onToggleCashflowView?.(!isCashflowView)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
                >
                  <Text style={{ fontSize: HOME_TEXT.metaTiny, fontWeight: FONT_WEIGHT.medium, color: isCashflow ? (isHomeHero ? palette.brand : heroMutedText) : heroSoftText }}>
                    Cashflow
                  </Text>
                  <View style={{
                    width: 36, height: 20, borderRadius: HOME_RADIUS.small, padding: 2,
                    backgroundColor: isCashflow
                      ? (isHomeHero ? palette.brand : 'rgba(156,255,106,0.32)')
                      : (isHomeHero ? palette.inputBg : 'rgba(255,255,255,0.10)'),
                    borderWidth: 1,
                    borderColor: isCashflow
                      ? (isHomeHero ? palette.brand : 'rgba(156,255,106,0.44)')
                      : (isHomeHero ? palette.borderSoft : 'rgba(255,255,255,0.14)'),
                    alignItems: isCashflow ? 'flex-end' : 'flex-start',
                  }}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: isCashflow ? '#FFFFFF' : (isHomeHero ? palette.textSoft : 'rgba(255,255,255,0.85)') }} />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Divider */}
            {isHomeHero && <View style={{ height: 1, backgroundColor: heroMetricDivider }} />}

            {/* Income | Expense halves */}
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={0.76}
                disabled={!onPressMetricIn}
                onPress={onPressMetricIn}
                style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 10 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <AppIcon name="arrow-down-left" size={11} color={heroSoftText} strokeWidth={2} />
                  <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: heroSoftText, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                    {metricLeftLabel}
                  </Text>
                </View>
                <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: metricLeftAmount === 0 ? heroSoftText : heroText, letterSpacing: -0.2 }}>
                  {hideAmounts ? '••••' : metricLeftAmount === 0 ? '—' : formatCurrency(metricLeftAmount, currencySymbol)}
                </Text>
              </TouchableOpacity>

              <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: heroMetricDivider }} />

              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={0.76}
                disabled={!onPressMetricOut}
                onPress={onPressMetricOut}
                style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'flex-end' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: heroSoftText, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                    {metricRightLabel}
                  </Text>
                  <AppIcon name="arrow-up-right" size={11} color={heroSoftText} strokeWidth={2} />
                </View>
                <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: metricRightAmount === 0 ? heroSoftText : heroText, letterSpacing: -0.2 }}>
                  {hideAmounts ? '••••' : metricRightAmount === 0 ? '—' : formatCurrency(metricRightAmount, currencySymbol)}
                </Text>
              </TouchableOpacity>
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
                minHeight: heroMode ? 36 : 42,
                marginTop: heroMode ? (incomeExpense ? 8 : 15) : 18,
                borderRadius: heroMode ? 15 : 16,
                borderWidth: 1,
                borderColor: netWorthStripBorder,
                paddingHorizontal: heroMode ? 12 : 12,
                paddingVertical: heroMode ? 5 : 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: heroMode ? 8 : 8,
                backgroundColor: netWorthStripBg,
                shadowColor: heroMode ? '#FFFFFF' : '#000000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: heroMode ? 0.08 : 0,
                shadowRadius: heroMode ? 10 : 0,
              }}
            >
              <Text style={{ fontSize: heroMode ? 11 : 12, fontWeight: heroMode ? '600' : '800', color: heroMode ? heroMutedText : heroMutedText, letterSpacing: heroMode ? 0.45 : 0.1, textTransform: heroMode ? 'uppercase' : 'none' }}>
                Net Worth
              </Text>
              <Text appWeight="medium" numberOfLines={1} style={{ fontSize: heroMode ? 14 : 14, fontWeight: heroMode ? '500' : '900', color: heroText, flexShrink: 1 }}>
                {hideAmounts ? '••••' : formatNetWorthStripValue(netWorth ?? 0, currencySymbol)}
              </Text>
              <View style={{ flex: 1 }} />
              {netWorthChange !== undefined && heroMode ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: nwChangeBg, borderRadius: HOME_RADIUS.full, paddingHorizontal: 7, paddingVertical: 3 }}>
                  {nwChangeTone === 'neutral' ? null : (
                    <AppIcon name={nwChangeTone === 'positive' ? 'trending-up' : 'trending-down'} size={11} color={nwChangeInk} strokeWidth={2.4} />
                  )}
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.semibold, color: nwChangeInk }}>
                    {nwChangeTone === 'neutral' ? '-' : `${Math.abs(netWorthChange).toFixed(1)}%`}
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
                      color={netWorthChange > 0 ? palette.positive : palette.negative}
                      strokeWidth={2.5}
                    />
                  )}
                  <Text style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.bold, color: netWorthChange === 0 ? palette.textMuted : netWorthChange > 0 ? palette.positive : palette.negative }}>
                    {Math.abs(netWorthChange).toFixed(1)}%
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
    <TouchableOpacity delayPressIn={0} activeOpacity={0.78} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
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
  return `${sign}${currencySymbol}${compact}${unit.suffix}`;
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
  chartMode,
  onChartModeChange,
  selectedChartCategoryId,
  onChartCategorySelect,
  registerScrollTop,
  onOpenChartExpanded,
  onOpenNetWorth,
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
  chartMode: HomeChartMode;
  onChartModeChange: (m: HomeChartMode) => void;
  selectedChartCategoryId: string | null;
  onChartCategorySelect: (id: string | null) => void;
  registerScrollTop: (id: string, fn: (() => void) | null) => void;
  onOpenChartExpanded?: (transactions: Transaction[], mode: HomeChartMode, range: { period: HomePeriodType; from: string; to: string }, resetTrigger: number) => void;
  onOpenNetWorth?: () => void;
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
}) {
  const { palette } = useAppTheme();
  const accountInsets = useSafeAreaInsets();
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [periodTransactions, setPeriodTransactions] = useState<Transaction[]>([]);
  const [periodDataRangeKey, setPeriodDataRangeKey] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [, setChartResetNonce] = useState(0);
  const [cashflowIsCashflow, setCashflowIsCashflow] = useState(false);
  const isScreenFocused = useIsFocused();
  const loadRequestIdRef = useRef(0);
  const todayDataCacheRef = useRef<{
    cashflow: CashflowSummary;
    periodTransactions: Transaction[];
    transactions: Transaction[];
  } | null>(null);

  const mainScrollRef = useAnimatedRef<Animated.ScrollView>();
  const recentScrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    setCashflow({ in: 0, out: 0, net: 0 });
    setPeriodTransactions([]);
    setPeriodDataRangeKey(null);
    setTransactions([]);
    todayDataCacheRef.current = null;
  }, [accountId]);

  const loadRangeData = useCallback(async (rangeFrom: string, rangeTo: string) => {
    if (!isPageReady) return;
    const requestId = ++loadRequestIdRef.current;
    const requestRangeKey = `${rangeFrom}:${rangeTo}`;
    setPeriodDataRangeKey(null);
    const accountFilter = accountId === 'all' ? undefined : accountId;
    const [periodSnapshot, recentTransactions, periodScopedTransactions] = await Promise.all([
      getCashflowSnapshot(accountId, rangeFrom, rangeTo),
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
      recentScrollRef.current?.scrollTo({ y: 0, animated: true });
      const arr = verticalScrolls.value.slice();
      arr[pageIndex] = 0;
      verticalScrolls.value = arr;
    });
    return () => registerScrollTop(accountId, null);
  }, [accountId, mainScrollRef, pageIndex, registerScrollTop, verticalScrolls]);

  // Reset chart nonce when category selection is cleared (e.g. parent reset)
  useEffect(() => {
    if (selectedChartCategoryId === null) {
      setChartResetNonce((n) => n + 1);
    }
  }, [selectedChartCategoryId]);

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
  const displayedCashflow = hasCurrentPeriodData ? cashflow : { in: 0, out: 0, net: 0 };
  const displayedPeriodTransactions = hasCurrentPeriodData ? periodTransactions : [];

  // Income/expense (excludes transfers & loans); cashflow = all in/out
  const incExpSummary = useMemo(() => {
    let income = 0, expense = 0;
    displayedPeriodTransactions.forEach((tx) => {
      if (tx.transferPairId || tx.type === 'loan') return;
      if (tx.type === 'in') income += tx.amount;
      if (tx.type === 'out') expense += tx.amount;
    });
    return { income, expense };
  }, [displayedPeriodTransactions]);
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
    router.push({
      pathname: '/modals/add-transaction',
      params: { editId: tx.id }
    });
  }, []);

  return (
    <View style={{ flex: 1, height: pageHeight }}>
      <Animated.ScrollView
        ref={mainScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: contentBottomPadding ?? getCompactScrollableBottomPadding(accountInsets) }}
        onScroll={verticalScrollHandler}
        scrollEventThrottle={1}
        showsVerticalScrollIndicator={false}
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
            netWorth={accountId === 'all' ? netWorth : undefined}
            netWorthChange={(() => {
              if (accountId !== 'all' || !netWorth) return undefined;
              const netChange = displayedCashflow.net;
              const nwAtStart = netWorth - netChange;
              return Math.abs(nwAtStart) > 0 ? (netChange / Math.abs(nwAtStart)) * 100 : 0;
            })()}
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
            style={{ height: accountId === 'all' ? 18 : 26 }}
          />
        </View>

        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 0 }}>


          {middleContent}

          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: HOME_RADIUS.card,
              borderWidth: 1,
              borderColor: palette.border,
              paddingTop: HOME_SURFACE.cardPaddingY,
              paddingBottom: 4,
              marginBottom: HOME_SPACE.pageBottom,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: HOME_SPACE.sm,
                paddingHorizontal: CARD_PADDING
              }}
            >
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>Recent</Text>
              <TouchableOpacity delayPressIn={0}
                onPress={() =>
                  router.navigate({
                    pathname: '/(tabs)/activity',
                    params: {
                      source: 'home-view-all',
                      accountId: accountId === 'all' ? 'all' : accountId,
                      ts: String(Date.now())
                    }
                  })
                }
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2, paddingLeft: 4 }}
              >
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, color: palette.brand, fontWeight: BUTTON_TOKENS.text.labelWeight }}>All</Text>
                <AppIcon name="chevron-right" size={13} color={palette.brand} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <ScrollView
              ref={recentScrollRef}
              style={{ maxHeight: HOME_SURFACE.listMaxHeight }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: HOME_SURFACE.cardPaddingBottom }}
            >
              {transactions.length === 0 ? (
                <Text style={{ color: palette.textSoft, fontSize: HOME_TEXT.bodySmall, textAlign: 'center', paddingVertical: 16 }}>
                  No transactions yet
                </Text>
              ) : (
                transactions.map((transaction, index) => {
                  const accountName = accountsById.get(transaction.accountId);
                  const linkedAccountName = transaction.linkedAccountId ? accountsById.get(transaction.linkedAccountId) : undefined;
                  const loan = transaction.loanId ? loansById.get(transaction.loanId) : undefined;
                  return (
                    <TransactionListItem
                      key={transaction.id}
                      tx={transaction}
                      sym={currencySymbol}
                      palette={palette}
                      isLast={index === transactions.length - 1}
                      categoryName={transaction.categoryId ? getCategoryFullDisplayName(transaction.categoryId, ' › ') : undefined}
                      categoryIcon={getCategoryDisplayIcon(categoriesById, transaction.categoryId)}
                      accountName={accountName}
                      linkedAccountName={linkedAccountName}
                      loanPersonName={loan?.personName}
                      loanDirection={loan?.direction}
                      showAmountSign={false}
                      onPress={handleTransactionPress}
                    />
                  );
                })
              )}
            </ScrollView>
          </View>


          {__DEV__ && (
            <View style={{ alignItems: 'center', marginTop: 2 }}>
              <TouchableOpacity delayPressIn={0} onPress={() => router.push('/chart-prototype')}>
                <Text
                  appWeight="medium"
                  style={{
                    fontSize: HOME_TEXT.bodySmall,
                    color: palette.brand,
                    fontWeight: BUTTON_TOKENS.text.labelWeight,
                  }}
                >
                  Open Chart Prototype
                </Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0} onPress={() => router.push('/net-worth-prototype')} style={{ marginTop: 10 }}>
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
            </View>
          )}

          {accountId === 'all' && (
            <View style={{ width: '100%', alignItems: 'center', marginBottom: -70 }}>
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
