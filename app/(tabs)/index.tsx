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
import PagerView from 'react-native-pager-view';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useEvent,
  useHandler,
  useSharedValue,
  type SharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeDonutChartBlock, type HomeChartMode } from '../../components/HomeDonutChartBlock';
import { ScreenTitle } from '../../components/settings-ui';
import { TransactionListItem } from '../../components/TransactionListItem';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { AppDonutChart } from '../../components/ui/AppDonutChart';
import { AppIcon } from '../../components/ui/AppIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { SegmentedPillSwitch } from '../../components/ui/SegmentedPillSwitch';
import { formatAccountDisplayName } from '../../lib/account-utils';
import {
  formatDate,
  getDateRange,
  toLocalDayEndISO,
  toLocalDayStartISO
} from '../../lib/dateUtils';
import { formatCurrency, getLoanSummary, getTotalBalance } from '../../lib/derived';
import { CARD_PADDING, SCREEN_GUTTER, SPACING, TYPE } from '../../lib/design';
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
import { getCashflowSnapshot, getCashflowSummary } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
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

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export function usePageScrollHandler(handlers: any, dependencies?: any[]) {
  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies);
  const subscribeForEvents = ['onPageScroll'];

  return useEvent(
    (event: any) => {
      'worklet';
      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith('onPageScroll')) {
        onPageScroll(event, context);
      }
    },
    subscribeForEvents,
    doDependenciesDiffer
  );
}

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

type HomePageUiState = {
  period: HomePeriodType;
  chartMode: HomeChartMode;
  selectedChartCategoryId: string | null;
};

const defaultHomePageUiState: HomePageUiState = {
  period: 'today',
  chartMode: 'expense',
  selectedChartCategoryId: null,
};

type HomePeriodType = 'today' | PeriodType;

const PERIODS: HomePeriodType[] = ['today', 'week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<HomePeriodType, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom'
};
const ACCOUNT_TYPE_SORT_ORDER: Record<AccountType, number> = {
  savings: 0,
  cash: 1,
  wallet: 2,
  investment: 3,
  credit: 4,
  other: 5,
};
const NW_ACCOUNT_COLORS = [
  '#00A7A5',
  '#F2B84B',
  '#4E8EF7',
  '#EF476F',
  '#8B5CF6',
  '#2DCB73',
  '#FF8A4C',
  '#38BDF8',
  '#B565D9',
  '#7C8A9E',
] as const;
const NW_ASSET_LIGHT = '#0D9488';
const NW_ASSET_DARK = '#00FAD9';
const NW_HERO_PROGRESS_LABEL_GAP = 8;
// Set false to restore the previous behavior where the indicator stays visible
// during horizontal swipes, even when the current page is vertically scrolled.
const HIDE_SCROLLED_INDICATOR_DURING_SWIPE = true;

type AccountTab = {
  id: string | 'all' | 'add' | 'net-worth';
  name: string;
};

type AccountCardItem = {
  id: string | 'all';
  name: string;
  accountTypeLabel: string;
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

  const [netWorthSheetVisible, setNetWorthSheetVisible] = useState(false);
  const netWorthSheetVerticalScrolls = useSharedValue<number[]>([0]);
  const netWorthSheetIndicatorY = useSharedValue(0);

  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
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
      icon: 'badge-percent',
      route: '/deposits',
      meta: depositMeta,
      tone: palette.brand,
    },
    {
      id: 'Loans',
      label: 'Loans',
      icon: 'hand-coins',
      route: '/loans',
      meta: loanMeta,
      tone: loanSummary.net < 0 ? palette.negative : palette.positive,
    },
    {
      id: 'Budgets',
      label: 'Budgets',
      icon: 'pie-chart',
      route: '/budget',
      meta: budgetMeta,
      tone: '#4F46E5',
      bg: '#F0F2FF',
    },
  ] as const;

  const middleContent = (
    <View style={{ marginTop: 4, marginBottom: HOME_SPACE.xl }}>
      <TouchableOpacity
        onPress={() => router.push('/accounts')}
        delayPressIn={0}
        activeOpacity={0.72}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 16, paddingVertical: 2 }}
      >
        <Text appWeight="medium" style={{ fontSize: 18, fontWeight: '600', color: palette.text }}>Accounts</Text>
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
                borderRadius: 22,
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
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: typeMeta.bg ?? `${typeColor}18`,
                    }}
                  >
                    <AppIcon name={typeMeta.icon} size={18} color={typeColor} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '500', color: palette.text }}>{formatAccountDisplayName(acc.name, acc.accountNumber)}</Text>
                  </View>
                </View>
                <View style={{ marginTop: 16 }}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 16, fontWeight: '500', color: acc.balance < 0 ? palette.negative : palette.text }}>
                    {amountLabel}
                  </Text>
                  {totalBalance !== 0 && !hideAmounts && (
                    <Text style={{ fontSize: 11.5, color: palette.textMuted, marginTop: 2 }}>
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
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>Add Account</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ marginTop: 24, marginBottom: 12 }}>
        <Text appWeight="medium" style={{ fontSize: 17, fontWeight: '600', color: palette.text }}>More</Text>
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
        onOpenNetWorth={() => setNetWorthSheetVisible(true)}
        netWorth={netWorth}
        middleContent={middleContent}
        onOpenChartExpanded={(transactions, mode, range, resetTrigger) => {
          setExpandedChartState({ transactions, mode, resetTrigger });
          setBottomSheetVisible(true);
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
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, marginBottom: 8 }}>
              Custom range
            </Text>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginBottom: 16 }}>
              Pick the from and to dates for this range.
            </Text>
            <View style={{ gap: HOME_SPACE.md, marginBottom: HOME_SPACE.lg }}>
              <TouchableOpacity delayPressIn={0} onPress={() => openDatePicker('from')} style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.inputBg, borderRadius: HOME_RADIUS.card, paddingHorizontal: HOME_SPACE.lg, paddingVertical: 12 }}>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>From</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
                  {formatDate(customDraftFrom.toISOString())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0} onPress={() => openDatePicker('to')} style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.inputBg, borderRadius: HOME_RADIUS.card, paddingHorizontal: HOME_SPACE.lg, paddingVertical: 12 }}>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
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
            setBottomSheetVisible(false);
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

      {netWorthSheetVisible ? (
        <BottomSheet
          title="Net Worth"
          palette={palette}
          backgroundColor={palette.background}
          disableShadow
          onClose={() => setNetWorthSheetVisible(false)}
          maxHeightRatio={0.80}
          fixedHeightRatio={0.80}
          hasNavBar
          scrollEnabled={false}
        >
          <View style={{ flex: 1, backgroundColor: palette.background }}>
            <HomeNetWorthPage
              pageHeight={800}
              palette={palette}
              currencySymbol={showCurrencySymbol ? currencySymbol : ''}
              accounts={orderedAccounts}
              loanSummary={loanSummary}
              netWorth={netWorth}
              pageIndex={0}
              verticalScrolls={netWorthSheetVerticalScrolls}
              indicatorY={netWorthSheetIndicatorY}
              isSelected={false}
              compactTop
              hideTitle
              onOpenAccount={(accountId) => {
                setNetWorthSheetVisible(false);
                router.push(`/account/${accountId}`);
              }}
            />
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
          borderRadius: 22,
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
          <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: palette.text }}>
            {feature.label}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '400', color: palette.textMuted, marginTop: 2 }}>
            {feature.meta}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function TodayCashflowStrip({
  cashflow,
  sym,
  palette,
  onPressCategory,
}: {
  cashflow: CashflowSummary;
  sym: string;
  palette: AppThemePalette;
  onPressCategory: (category: 'in' | 'out' | 'net') => void;
}) {
  const items = [
    { key: 'in' as const, label: 'Income', color: palette.text },
    { key: 'out' as const, label: 'Expense', color: palette.text },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        borderColor: palette.divider,
        backgroundColor: palette.card,
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {items.map((item, index) => (
        <TouchableOpacity
          key={item.key}
          delayPressIn={0}
          activeOpacity={0.75}
          onPress={() => onPressCategory(item.key)}
          style={{
            flex: 1,
            paddingVertical: 9,
            paddingHorizontal: 14,
            borderLeftWidth: index === 0 ? 0 : 1,
            borderLeftColor: palette.divider,
          }}
        >
          <Text style={{ fontSize: 12, color: palette.textMuted, fontWeight: '400', marginBottom: 3 }}>
            {item.label}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 14.5, fontWeight: '500', color: cashflow[item.key] === 0 ? palette.textMuted : item.color }}>
            {cashflow[item.key] === 0 ? '—' : formatCurrency(Math.abs(cashflow[item.key]), sym)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CashflowToggleCard({
  isCashflow,
  onToggleCashflow,
  cardPeriod,
  onCardPeriodChange,
  inExpSummary,
  cashflow,
  sym,
  palette,
  onPressIn,
  onPressOut,
  hideAmounts,
}: {
  isCashflow: boolean;
  onToggleCashflow: (v: boolean) => void;
  cardPeriod: 'today' | 'month';
  onCardPeriodChange: (p: 'today' | 'month') => void;
  inExpSummary: { income: number; expense: number };
  cashflow: { in: number; out: number; net: number };
  sym: string;
  palette: AppThemePalette;
  onPressIn: () => void;
  onPressOut: () => void;
  hideAmounts?: boolean;
}) {
  const leftLabel = isCashflow ? 'Inflow' : 'Income';
  const rightLabel = isCashflow ? 'Outflow' : 'Expense';
  const leftAmount = isCashflow ? cashflow.in : inExpSummary.income;
  const rightAmount = isCashflow ? cashflow.out : inExpSummary.expense;

  const glassBg = palette.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)';
  const labelColor = palette.textMuted;
  const valueColor = palette.text;

  return (
    <View style={{
      borderRadius: 18,
      backgroundColor: glassBg,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text, textTransform: 'capitalize' }}>
          {cardPeriod === 'today' ? 'Today' : 'This Month'}
        </Text>
        <TouchableOpacity
          delayPressIn={0}
          onPress={() => onCardPeriodChange(cardPeriod === 'today' ? 'month' : 'today')}
          style={{ paddingHorizontal: 8, paddingVertical: 2 }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: palette.brand }}>
            {cardPeriod === 'today' ? 'Switch to Month' : 'Switch to Today'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity delayPressIn={0} activeOpacity={0.75} onPress={onPressIn} style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: labelColor, fontWeight: '500', marginBottom: 4 }}>{leftLabel}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 17, fontWeight: '700', color: valueColor }}>
            {hideAmounts ? '••••' : formatCurrency(leftAmount, sym)}
          </Text>
        </TouchableOpacity>

        <View style={{ width: 1, backgroundColor: palette.divider, height: '100%', opacity: 0.5 }} />

        <TouchableOpacity delayPressIn={0} activeOpacity={0.75} onPress={onPressOut} style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: labelColor, fontWeight: '500', marginBottom: 4 }}>{rightLabel}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 17, fontWeight: '700', color: valueColor }}>
            {hideAmounts ? '••••' : formatCurrency(rightAmount, sym)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HomeAccountViewToggle({
  mode,
  palette,
  onChange,
}: {
  mode: 'swipe' | 'list';
  palette: AppThemePalette;
  onChange: (mode: 'swipe' | 'list') => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#F0F3F9',
        borderRadius: 14,
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {([
        { key: 'swipe', icon: 'gallery-thumbnails' },
        { key: 'list', icon: 'list' },
      ] as const).map((item) => {
        const selected = mode === item.key;
        return (
          <TouchableOpacity
            delayPressIn={0}
            key={item.key}
            activeOpacity={0.8}
            onPress={() => {
              onChange(item.key);
            }}
            style={{
              width: 44,
              height: 34,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? palette.surface : 'transparent',
            }}
          >
            <AppIcon name={item.icon}
              size={18}
              color={selected ? '#1F2A44' : '#8C94AF'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const NW_BALANCE_BY_OPTIONS = [
  { key: 'type', label: 'Type' },
  { key: 'account', label: 'Account' },
] as const;

function NetWorthBalanceByToggle({
  mode,
  onChange,
}: {
  mode: 'account' | 'type';
  onChange: (mode: 'account' | 'type') => void;
}) {
  return (
    <SegmentedPillSwitch
      options={NW_BALANCE_BY_OPTIONS}
      value={mode}
      onChange={(key: string) => onChange(key as 'account' | 'type')}
      backgroundColor="#EEF2F8"
      pillColor="#FFFFFF"
      borderColor="#DFE5EF"
      activeTextColor="#1F2A44"
      inactiveTextColor="#7C8498"
      height={HOME_LAYOUT.periodHeight}
      radius={HOME_RADIUS.tab + 3}
      fontSize={HOME_TEXT.caption}
      itemMinWidth={62}
      style={{ alignSelf: 'flex-start', minWidth: 144 }}
    />
  );
}

function NetWorthRingMarker({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2.5,
        borderColor: color,
        backgroundColor: 'transparent',
      }}
    />
  );
}

function NetWorthDonut({
  mode,
  groups,
  accounts,
  accountColorsById,
  palette,
  currencySymbol,
  selectedType,
  onSelectType,
  selectedAccountId,
  onSelectAccount,
}: {
  mode: 'account' | 'type';
  groups: Array<{ type: AccountType; accounts: Account[]; balance: number }>;
  accounts: Account[];
  accountColorsById: Map<string, string>;
  palette: AppThemePalette;
  currencySymbol: string;
  selectedType: AccountType | null;
  onSelectType: (type: AccountType | null) => void;
  selectedAccountId: string | null;
  onSelectAccount: (id: string | null) => void;
}) {
  const size = 292;
  const chartItems = mode === 'type'
    ? groups.map((group) => ({
      id: group.type,
      label: getAccountTypeLabel(group.type),
      amount: Math.abs(group.balance),
      value: group.balance,
      color: ACCOUNT_TYPE_META[group.type].color,
    }))
    : accounts.map((account) => ({
      id: account.id,
      label: formatAccountDisplayName(account.name, account.accountNumber),
      amount: Math.abs(account.balance),
      value: account.balance,
      color: accountColorsById.get(account.id) ?? NW_ACCOUNT_COLORS[0],
    }));
  const slices = chartItems.filter((item) => item.amount > 0);
  const total = slices.reduce((sum, item) => sum + item.amount, 0) || 1;
  const selectedId = mode === 'type' ? selectedType : selectedAccountId;
  const selectedItem = selectedId ? slices.find((item) => item.id === selectedId) ?? null : null;
  const selectedAmount = selectedItem ? selectedItem.amount : total;
  const selectedValue = selectedItem ? selectedItem.value : total;
  const selectedPercent = selectedItem ? Math.round((selectedItem.amount / total) * 100) : 100;
  const donutSlices = slices.map((item) => ({
    id: item.id,
    percent: item.amount / total,
    color: item.color,
  }));

  return (
    <View style={{ height: 284, alignItems: 'center', justifyContent: 'center', marginTop: -12, marginBottom: -16 }}>
      <AppDonutChart
        slices={donutSlices}
        size={size}
        selectedId={selectedId}
        onSelect={(id) => {
          if (mode === 'type') {
            onSelectType(selectedType === id ? null : id as AccountType);
            return;
          }
          onSelectAccount(selectedAccountId === id ? null : id);
        }}
        bgHex={palette.card}
      />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: (!selectedItem && mode === 'account') ? -4 : 0 }] }}>
        {selectedItem ? (
          <View style={{ minHeight: 28, marginBottom: 4, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: selectedItem.color }} />
          </View>
        ) : null}
        <Text numberOfLines={2} style={{ maxWidth: 112, fontSize: 13, fontWeight: '700', textAlign: 'center', color: palette.text }}>
          {selectedItem ? selectedItem.label : mode === 'type' ? 'All Types' : 'All'}
        </Text>
        <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: 18, fontWeight: '800', color: palette.text, marginTop: 4, textAlign: 'center' }}>
          {selectedAmount === 0 ? '—' : `${selectedValue < 0 ? '-' : ''}${formatCurrency(Math.abs(selectedValue), currencySymbol)}`}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 2, color: palette.textMuted }}>
          {selectedPercent}% of Total
        </Text>
      </View>
    </View>
  );
}

function NetWorthTypeRows({
  groups,
  palette,
  currencySymbol,
}: {
  groups: Array<{ type: AccountType; accounts: Account[]; balance: number }>;
  palette: AppThemePalette;
  currencySymbol: string;
}) {
  const total = groups.reduce((sum, group) => sum + Math.abs(group.balance), 0) || 1;

  return (
    <>
      {groups.filter((group) => Math.abs(group.balance) > 0).map((group) => {
        const isNegative = group.balance < 0;
        return (
          <View
            key={group.type}
            style={{ minHeight: 76, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: palette.divider }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                <NetWorthRingMarker color={ACCOUNT_TYPE_META[group.type].color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text appWeight="medium" numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
                      {getAccountTypeLabel(group.type)}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted, marginTop: 3 }}>
                      {group.accounts.length} {group.accounts.length === 1 ? 'account' : 'accounts'} · {Math.round((Math.abs(group.balance) / total) * 100)}%
                    </Text>
                  </View>
                  <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: group.balance === 0 ? palette.textMuted : isNegative ? palette.negative : palette.text, textAlign: 'right' }}>
                    {group.balance === 0 ? '—' : `${isNegative ? '-' : ''}${formatCurrency(Math.abs(group.balance), currencySymbol)}`}
                  </Text>
                </View>
                <View style={{ height: 4, borderRadius: 999, overflow: 'hidden', backgroundColor: palette.inputBg, marginTop: 10 }}>
                  <View style={{ height: 4, borderRadius: 999, width: `${(Math.abs(group.balance) / total) * 100}%`, backgroundColor: ACCOUNT_TYPE_META[group.type].color }} />
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </>
  );
}
function HomeNetWorthPage({
  pageHeight,
  palette,
  currencySymbol,
  accounts,
  loanSummary,
  netWorth,
  pageIndex,
  verticalScrolls,
  indicatorY,
  isSelected,
  compactTop = false,
  hideTitle = false,
  onOpenAccount,
}: {
  pageHeight: number;
  palette: AppThemePalette;
  currencySymbol: string;
  accounts: Account[];
  loanSummary: { youLent: number; youOwe: number; net: number };
  netWorth: number;
  pageIndex: number;
  verticalScrolls: SharedValue<number[]>;
  indicatorY: SharedValue<number>;
  isSelected: boolean;
  compactTop?: boolean;
  hideTitle?: boolean;
  onOpenAccount: (accountId: string | 'all') => void;
}) {
  const [accountViewMode, setAccountViewMode] = useState<'account' | 'type'>('type');
  const [selectedType, setSelectedType] = useState<AccountType | null>(null);
  const [selectedChartAccountId, setSelectedChartAccountId] = useState<string | null>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const positiveAccountTotal = accounts.reduce((sum, account) => sum + Math.max(account.balance, 0), 0);
  const negativeAccountTotal = accounts.reduce((sum, account) => sum + Math.abs(Math.min(account.balance, 0)), 0);
  const assetTotal = positiveAccountTotal + loanSummary.youLent;
  const liabilityTotal = negativeAccountTotal + loanSummary.youOwe;
  const nwAssetColor = palette.isDark ? NW_ASSET_DARK : NW_ASSET_LIGHT;
  const nwLiabilityColor = palette.negative;
  const totalExposure = Math.max(assetTotal + liabilityTotal, 1);
  const assetShare = assetTotal / totalExposure;
  const liabilityShare = liabilityTotal / totalExposure;
  const sortedAccounts = useMemo(() => {
    return accounts.slice().sort((a, b) => {
      const balanceDiff = b.balance - a.balance;
      if (balanceDiff !== 0) return balanceDiff;
      return formatAccountDisplayName(a.name, a.accountNumber).localeCompare(
        formatAccountDisplayName(b.name, b.accountNumber),
        'en',
        { sensitivity: 'base' },
      );
    });
  }, [accounts]);
  const groupedAccounts = useMemo(() => {
    const groups = new Map<AccountType, Account[]>();
    sortedAccounts.forEach((account) => {
      const next = groups.get(account.type) ?? [];
      next.push(account);
      groups.set(account.type, next);
    });
    return Array.from(groups.entries())
      .map(([type, group]) => ({
        type,
        accounts: group,
        balance: group.reduce((sum, account) => sum + account.balance, 0),
      }))
      .sort((a, b) => ACCOUNT_TYPE_SORT_ORDER[a.type] - ACCOUNT_TYPE_SORT_ORDER[b.type]);
  }, [sortedAccounts]);
  const accountColorsById = useMemo(() => new Map(sortedAccounts.map((account, index) => [
    account.id,
    NW_ACCOUNT_COLORS[index % NW_ACCOUNT_COLORS.length],
  ])), [sortedAccounts]);
  const largestAccountBalance = Math.max(...accounts.map((account) => Math.abs(account.balance)), 1);
  const displayedAccounts = selectedType
    ? sortedAccounts.filter((account) => account.type === selectedType)
    : sortedAccounts;
  const assetPercent = Math.round(assetShare * 100);
  const liabilityPercent = Math.round(liabilityShare * 100);
  const dominantPosition = liabilityShare > assetShare
    ? { label: 'Liabilities', percent: liabilityPercent, color: nwLiabilityColor, share: liabilityShare }
    : { label: 'Assets', percent: assetPercent, color: nwAssetColor, share: assetShare };
  const positionRows = [
    {
      key: 'assets',
      label: 'Liquid assets',
      note: `${accounts.filter((account) => account.balance > 0).length} funded accounts`,
      value: positiveAccountTotal,
      color: nwAssetColor,
      icon: 'wallet',
    },
    {
      key: 'receivable',
      label: 'Receivables',
      note: 'Money you should receive',
      value: loanSummary.youLent,
      color: palette.brand,
      icon: 'arrow-down-left',
    },
    {
      key: 'liability',
      label: 'Liabilities',
      note: 'Borrowed and negative balances',
      value: liabilityTotal,
      color: nwLiabilityColor,
      icon: 'arrow-up-right',
    },
  ] as const;

  const verticalScrollHandler = useAnimatedScrollHandler((event) => {
    'worklet';
    const arr = verticalScrolls.value.slice();
    arr[pageIndex] = event.contentOffset.y;
    verticalScrolls.value = arr;
  });

  const renderAccountRow = (account: Account, isFirstInSection: boolean) => {
    const isNegative = account.balance < 0;
    const accountColor = accountColorsById.get(account.id) ?? NW_ACCOUNT_COLORS[0];
    const isSelected = selectedChartAccountId === account.id;
    return (
      <TouchableOpacity
        key={account.id}
        delayPressIn={0}
        activeOpacity={0.75}
        onPress={() => onOpenAccount(account.id)}
        style={{
          minHeight: 72,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: isFirstInSection ? 0 : 1,
          borderTopColor: palette.divider,
          opacity: selectedChartAccountId && !isSelected ? 0.48 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
            <NetWorthRingMarker color={accountColor} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text appWeight="medium" numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
                  {formatAccountDisplayName(account.name, account.accountNumber)}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted, marginTop: 3 }}>
                  {getAccountTypeLabel(account.type)}
                </Text>
              </View>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: account.balance === 0 ? palette.textMuted : isNegative ? palette.negative : palette.text, textAlign: 'right' }}>
                {account.balance === 0 ? '—' : `${isNegative ? '-' : ''}${formatCurrency(Math.abs(account.balance), currencySymbol)}`}
              </Text>
            </View>
            <View style={{ height: 4, borderRadius: 999, backgroundColor: palette.inputBg, overflow: 'hidden', marginTop: 10 }}>
              {account.balance !== 0 ? <View style={{ width: `${(Math.abs(account.balance) / largestAccountBalance) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: accountColor }} /> : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ flex: 1, height: pageHeight }}
      contentContainerStyle={{
        paddingHorizontal: SCREEN_GUTTER,
        paddingTop: 0,
        paddingBottom: HOME_LAYOUT.fabContentBottomPadding,
      }}
      onScroll={verticalScrollHandler}
      scrollEventThrottle={1}
      showsVerticalScrollIndicator={false}
    >
      {hideTitle ? null : (
        <View style={{ paddingTop: compactTop ? 0 : 8, paddingBottom: compactTop ? 8 : SPACING.md }}>
          <View style={{ paddingHorizontal: 14 - SCREEN_GUTTER }}>
            <Text style={{ fontSize: compactTop ? SCREEN_HEADER.titleSize : TYPE.title, fontWeight: compactTop ? SCREEN_HEADER.titleWeight : '400', color: palette.text, letterSpacing: 0 }}>
              Net Worth
            </Text>
          </View>
        </View>
      )}
      <View style={{ paddingTop: compactTop ? 12 : HOME_SURFACE.heroTop, borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.card, padding: CARD_PADDING, minHeight: 184, overflow: 'hidden', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: HOME_SPACE.lg }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
              Net Worth
            </Text>
            <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.heroValue + 2, lineHeight: 38, fontWeight: '800', color: netWorth < 0 ? palette.negative : palette.text, marginTop: HOME_SPACE.xs + 2 }}>
              {netWorth < 0 ? '-' : ''}{formatCurrency(Math.abs(netWorth), currencySymbol)}
            </Text>
          </View>
          <View style={{ width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFD' }}>
            <AppIcon name="landmark" size={22} color={palette.brand} />
          </View>
        </View>

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: NW_HERO_PROGRESS_LABEL_GAP }}>
            <View style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.10)' : '#E7ECF3', overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${dominantPosition.share * 100}%`, borderRadius: 999, backgroundColor: dominantPosition.color }} />
            </View>
            <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ minWidth: 60, fontSize: HOME_TEXT.caption, fontWeight: '800', color: dominantPosition.color, textAlign: 'right' }}>
              {dominantPosition.percent}% {dominantPosition.label}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Assets</Text>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.body, fontWeight: '800', color: nwAssetColor, marginTop: 5 }}>
                {formatCurrency(assetTotal, currencySymbol)}{assetPercent < 100 ? ` · ${assetPercent}%` : ''}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Liabilities</Text>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.body, fontWeight: '800', color: liabilityTotal > 0 ? nwLiabilityColor : palette.textMuted, marginTop: 5, textAlign: 'right' }}>
                {liabilityTotal > 0 ? `${formatCurrency(liabilityTotal, currencySymbol)} · ${liabilityPercent}%` : 'None'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View
        onLayout={(event) => {
          const newY = event.nativeEvent.layout.y;
          if (isSelected && newY > 0 && indicatorY.value !== newY) {
            indicatorY.value = newY;
          }
        }}
        style={{ height: 32 }}
      />

      <View style={{ gap: 10 }}>
        {positionRows.map((row) => (
          <View key={row.key} style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
              <AppIcon name={row.icon} size={16} color={row.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.text }}>
                {row.label}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 3 }}>
                {row.note}
              </Text>
            </View>
            <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: row.color, textAlign: 'right' }}>
              {formatCurrency(row.value, currencySymbol)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 16, borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.card, overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: 10, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <NetWorthBalanceByToggle
            mode={accountViewMode}
            onChange={(nextMode) => {
              setAccountViewMode(nextMode);
              setSelectedType(null);
              setSelectedChartAccountId(null);
            }}
          />
        </View>
        <NetWorthDonut
          mode={accountViewMode}
          groups={groupedAccounts}
          accounts={sortedAccounts}
          accountColorsById={accountColorsById}
          palette={palette}
          currencySymbol={currencySymbol}
          selectedType={selectedType}
          onSelectType={(type) => {
            setSelectedType(type);
            setSelectedChartAccountId(null);
          }}
          selectedAccountId={selectedChartAccountId}
          onSelectAccount={(accountId) => {
            setSelectedChartAccountId(accountId);
            setSelectedType(null);
          }}
        />
        <View style={{ height: 1, backgroundColor: palette.divider, marginTop: 8 }} />
        {accountViewMode === 'type'
          ? displayedAccounts.map((account, index) => renderAccountRow(account, index === 0))
          : (
            <NetWorthTypeRows
              groups={groupedAccounts}
              palette={palette}
              currencySymbol={currencySymbol}
            />
          )}
      </View>
    </Animated.ScrollView>
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
  hideAmounts,
  heroMode = false,
  children,
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
  hideAmounts?: boolean;
  heroMode?: boolean;
  children?: React.ReactNode;
}) {
  const isAll = accountName === 'All';
  const [scrubbedItem, setScrubbedItem] = useState<{ value: number; date?: string } | null>(null);
  const [scrubbedIndex, setScrubbedIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(Dimensions.get('window').width - SCREEN_GUTTER * 2);
  const chartAccent = palette.positive;
  const heroSurface = palette.isDark ? palette.surface : '#F0F4FC';
  const heroGlow = '#D9E6FF';
  const heroText = heroMode ? '#FFFFFF' : palette.text;
  const heroMutedText = heroMode ? 'rgba(255,255,255,0.82)' : palette.textMuted;
  const heroSoftText = heroMode ? 'rgba(255,255,255,0.66)' : palette.textSoft;
  const netWorthStripBg = heroMode ? 'rgba(255,255,255,0.085)' : palette.isDark ? '#080C14' : '#E8EDF8';
  const netWorthStripBorder = heroMode ? 'rgba(255,255,255,0.20)' : palette.isDark ? palette.divider : '#D8E0F0';
  const heroMetricStripBg = heroMode ? 'rgba(255,255,255,0.055)' : netWorthStripBg;
  const heroMetricDivider = heroMode ? 'rgba(255,255,255,0.12)' : palette.divider;

  const mockChartData = useMemo(() => {
    const base = Math.max(Math.abs(balance), 1);
    const multipliers = [0.91, 0.922, 0.918, 0.944, 0.936, 0.958, 0.951, 0.974, 0.966, 1];
    return multipliers.map((multiplier, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (multipliers.length - 1 - i));
      return {
        value: balance < 0 ? -base * multiplier : base * multiplier,
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      };
    });
  }, [balance]);

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
    ? 'rgba(190,242,100,0.92)'
    : nwChangeTone === 'negative'
      ? 'rgba(253,164,175,0.92)'
      : 'rgba(226,232,240,0.88)';
  const nwChangeInk = '#111827';

  const content = (
    <View
      style={{
        backgroundColor: 'transparent',
        borderColor: heroMode ? 'rgba(255,255,255,0.10)' : palette.isDark ? palette.borderSoft : '#D0D8EE',
        borderWidth: 1,
        borderRadius: heroMode ? 28 : 22,
        overflow: 'hidden',
      }}
      onLayout={onLayout ? (event) => onLayout(event.nativeEvent.layout.height) : undefined}
    >
      <LinearGradient
        colors={heroMode ? ['#23304A', '#1E293B', '#24324F'] : palette.isDark ? ['#0F172A', '#1E293B'] : ['#E8EFFC', '#F8FAFF']}
        locations={heroMode ? [0, 0.52, 1] : undefined}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View style={{ paddingHorizontal: heroMode ? 22 : CARD_PADDING, paddingTop: heroMode ? 20 : 20, paddingBottom: heroMode ? 18 : 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: heroMode ? 12 : 12, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!heroMode && !isAll && (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.7)', padding: 4, borderRadius: 6 }}>
                <AppIcon name={ACCOUNT_TYPE_META[accountTypeLabel as AccountType]?.icon ?? 'wallet'} size={12} color={palette.brand} />
              </View>
            )}
            <Text style={{ fontSize: heroMode ? 10 : HOME_TEXT.tiny, fontWeight: '400', letterSpacing: heroMode ? 0.75 : 0.8, textTransform: 'uppercase', color: heroMutedText }}>
              {isAll ? 'Balance · All Accounts' : accountName}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'nowrap', gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexShrink: 1, minWidth: 0 }}>
            {heroMode && currencySymbol ? (
              <Text appWeight="medium" style={{ fontSize: heroCurrencyFontSize, lineHeight: heroBalanceLineHeight - 6, fontWeight: '700', color: heroMutedText, marginRight: 5 }}>
                {currencySymbol}
              </Text>
            ) : null}
            <Text
              appWeight="medium"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ fontSize: heroMode ? heroBalanceFontSize : 18, lineHeight: heroMode ? heroBalanceLineHeight : undefined, fontWeight: heroMode ? '600' : '700', color: balanceColor, letterSpacing: heroMode ? -0.35 : -0.6, flexShrink: 1 }}
            >
              {heroMode && currencySymbol && balanceInt.startsWith(currencySymbol) ? balanceInt.slice(currencySymbol.length) : balanceInt}
            </Text>
            {balanceDec ? (
              <Text
                appWeight="medium"
                style={{ fontSize: heroMode ? heroDecimalFontSize : 17, fontWeight: '700', color: heroSoftText, letterSpacing: -0.2, marginBottom: heroMode ? 5 : 3 }}
              >
                {balanceDec}
              </Text>
            ) : null}
          </View>
          {heroMode && onOpenNetWorth && typeof netWorth === 'number' ? (
            <TouchableOpacity
              delayPressIn={0}
              activeOpacity={0.78}
              onPress={onOpenNetWorth}
              style={{
                minHeight: 34,
                maxWidth: 132,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.16)',
                backgroundColor: 'rgba(255,255,255,0.06)',
                paddingHorizontal: 10,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                flexShrink: 0,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '600', color: heroSoftText, letterSpacing: 0.35, textTransform: 'uppercase' }}>
                  NW
                </Text>
                <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 12.5, fontWeight: '600', color: heroText, marginTop: 1 }}>
                  {hideAmounts ? '••••' : formatNetWorthStripValue(netWorth, currencySymbol)}
                </Text>
              </View>
              <AppIcon name="arrow-up-right" size={14} color={heroMutedText} strokeWidth={2.1} />
            </TouchableOpacity>
          ) : null}
        </View>

        {heroMode && incomeExpense ? (
            <View
              style={{
                width: '100%',
                minHeight: 36,
                marginTop: 16,
                borderRadius: 15,
                borderWidth: 1,
                borderColor: netWorthStripBorder,
                backgroundColor: heroMetricStripBg,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <AppIcon name="arrow-down-left" size={13} color={heroSoftText} strokeWidth={1.9} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: heroSoftText, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      Income
                    </Text>
                    <Text appWeight="medium" numberOfLines={1} style={{ fontSize: 13, fontWeight: '500', color: heroText, marginTop: 2 }}>
                      {hideAmounts ? '••••' : formatCurrency(incomeExpense.income, currencySymbol)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ width: 1, height: 22, backgroundColor: heroMetricDivider, marginHorizontal: 12 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <AppIcon name="arrow-up-right" size={13} color={heroSoftText} strokeWidth={1.9} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: heroSoftText, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      Expense
                    </Text>
                    <Text appWeight="medium" numberOfLines={1} style={{ fontSize: 13, fontWeight: '500', color: heroText, marginTop: 2 }}>
                      {hideAmounts ? '••••' : formatCurrency(incomeExpense.expense, currencySymbol)}
                    </Text>
                  </View>
                </View>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: nwChangeBg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }}>
                  {nwChangeTone === 'neutral' ? null : (
                    <AppIcon name={nwChangeTone === 'positive' ? 'trending-up' : 'trending-down'} size={11} color={nwChangeInk} strokeWidth={2.4} />
                  )}
                  <Text appWeight="medium" style={{ fontSize: 11, fontWeight: '600', color: nwChangeInk }}>
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
                  borderRadius: 999,
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
                  <Text style={{ fontSize: 11, fontWeight: '700', color: netWorthChange === 0 ? palette.textMuted : netWorthChange > 0 ? palette.positive : palette.negative }}>
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

function formatSignedCurrency(value: number, currencySymbol: string) {
  return `${value < 0 ? '-' : ''}${formatCurrency(Math.abs(value), currencySymbol)}`;
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

function formatTodayMetricValue(key: 'in' | 'out' | 'net', value: number, currencySymbol: string) {
  if (value === 0) return '—';
  if (key === 'net') return formatCurrency(Math.abs(value), currencySymbol);
  return formatSignedCurrency(value, currencySymbol);
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

function HomeAccountsList({
  pageHeight,
  accounts,
  rawAccounts,
  currencySymbol,
  palette,
  onOpenAccount,
  onRefresh,
}: {
  pageHeight: number;
  accounts: AccountCardItem[];
  rawAccounts: Account[];
  currencySymbol: string;
  palette: AppThemePalette;
  onOpenAccount: (accountId: string | 'all') => void;
  onRefresh: () => Promise<void>;
}) {
  const [todaySummaries, setTodaySummaries] = useState<Record<string, CashflowSummary>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<HomePeriodType>('today');
  const [chartMode, setChartMode] = useState<HomeChartMode>('expense');
  const [selectedChartCategoryId, setSelectedChartCategoryId] = useState<string | null>(null);
  const [chartResetNonce, setChartResetNonce] = useState(0);
  const isScreenFocused = useIsFocused();

  const todayFrom = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
  }, []);
  const todayTo = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
  }, []);

  const loadListSummaries = useCallback(async () => {
    const entries = await Promise.all(
      accounts.map(async (account) => [
        account.id,
        await getCashflowSummary(account.id === 'all' ? 'all' : account.id, todayFrom, todayTo),
      ] as const),
    );
    setTodaySummaries(Object.fromEntries(entries));
  }, [accounts, todayFrom, todayTo]);

  useEffect(() => {
    if (!isScreenFocused) return;
    loadListSummaries().catch(() => undefined);
  }, [isScreenFocused, loadListSummaries]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    await loadListSummaries();
    setRefreshing(false);
  }, [loadListSummaries, onRefresh]);

  return (
    <ScrollView
      style={{ flex: 1, height: pageHeight }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: SCREEN_GUTTER,
        paddingTop: 54 + HOME_SURFACE.heroTop,
        paddingBottom: HOME_LAYOUT.fabContentBottomPadding,
        gap: HOME_SPACE.md,
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {accounts.map((account) => {
        const rawAcc = rawAccounts.find((item) => item.id === account.id);
        return (
          <CompactAccountListCard
            key={account.id}
            accountName={account.name}
            accountType={account.id === 'all' ? undefined : rawAcc?.type}
            balance={
              account.id === 'all'
                ? getTotalBalance(rawAccounts)
                : (rawAcc?.balance ?? 0)
            }
            todayCashflow={todaySummaries[account.id] ?? { in: 0, out: 0, net: 0 }}
            currencySymbol={currencySymbol}
            palette={palette}
            onPress={() => onOpenAccount(account.id === 'all' ? 'all' : account.id)}
          />
        );
      })}
      <TouchableOpacity
        delayPressIn={0}
        activeOpacity={0.82}
        onPress={() => router.push('/settings/account-form')}
        style={{
          minHeight: 86,
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: palette.borderSoft,
          backgroundColor: palette.surface,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <AppIcon name="plus-circle" size={22} color={palette.text} />
        <Text appWeight="medium" style={{ fontSize: HOME_TEXT.cardContent, color: palette.text }}>
          Add Account
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function CompactAccountListCard({
  accountName,
  accountType,
  balance,
  todayCashflow,
  currencySymbol,
  palette,
  onPress,
}: {
  accountName: string;
  accountType?: import('../../types').AccountType;
  balance: number;
  todayCashflow: CashflowSummary;
  currencySymbol: string;
  palette: AppThemePalette;
  onPress: () => void;
}) {
  const netColor = todayCashflow.net >= 0 ? palette.brand : palette.negative;
  const typeMeta = accountType ? ACCOUNT_TYPE_META[accountType] : null;

  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.divider,
        borderWidth: 1,
        borderRadius: HOME_RADIUS.card,
        paddingHorizontal: CARD_PADDING,
        paddingVertical: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {typeMeta ? (
            <View style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${typeMeta.color}18`,
              flexShrink: 0,
            }}>
              <AppIcon name={typeMeta.icon} size={16} color={typeMeta.color} strokeWidth={1.8} />
            </View>
          ) : (
            <View style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(31,42,68,0.06)',
              flexShrink: 0,
            }}>
              <AppIcon name="wallet" size={16} color={palette.textMuted} strokeWidth={1.8} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '600', color: palette.text }}>
              {accountName}
            </Text>
            <Text style={{ marginTop: 1, fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
              Current balance
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', maxWidth: '44%' }}>
          <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: '600', color: palette.text, textAlign: 'right' }}>
            {formatSignedCurrency(balance, currencySymbol)}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.divider, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ fontSize: HOME_TEXT.cardContent, color: palette.textMuted, fontWeight: '500' }}>
          Today's Net
        </Text>
        <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.cardContent, fontWeight: '600', color: netColor, textAlign: 'right' }}>
          {formatTodayMetricValue('net', todayCashflow.net, currencySymbol)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function PageDashIndicator({
  pageCount,
  palette,
  pageWidth,
  scrollX,
  settledPageIndex,
  verticalScrolls,
  indicatorY,
  gestureOpacity,
  hidden,
  hiddenPageIndexes = [],
}: {
  pageCount: number;
  palette: AppThemePalette;
  pageWidth: number;
  scrollX: SharedValue<number>;
  settledPageIndex: SharedValue<number>;
  verticalScrolls: SharedValue<number[]>;
  indicatorY: SharedValue<number>;
  gestureOpacity: SharedValue<number>;
  hidden?: boolean;
  hiddenPageIndexes?: number[];
}) {
  const safePageCount = Math.max(pageCount, 1);
  const dotCount = safePageCount;
  const inactiveWidth = 7;
  const activeWidth = 16;
  const dashHeight = 3;
  const gap = 8;
  const step = inactiveWidth + gap;
  const sidePad = (activeWidth - inactiveWidth) / 2;
  const trackWidth = inactiveWidth * dotCount + gap * (dotCount - 1) + sidePad * 2;

  const containerStyle = useAnimatedStyle(() => {
    const rawProgress = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const progress = Math.min(Math.max(rawProgress, 0), safePageCount - 1);
    const settledIndex = Math.min(Math.max(Math.round(settledPageIndex.value), 0), safePageCount - 1);
    const swipeEpsilon = 0.02;
    let anchorIndex = settledIndex;

    // During horizontal swipe, anchor Y to the destination page early so the
    // indicator does not appear to slide in vertically from the previous page.
    if (progress > settledIndex + swipeEpsilon) {
      anchorIndex = Math.min(Math.ceil(progress), safePageCount - 1);
    } else if (progress < settledIndex - swipeEpsilon) {
      anchorIndex = Math.max(Math.floor(progress), 0);
    }

    const currentScroll = verticalScrolls.value[anchorIndex] ?? 0;
    const y = indicatorY.value;
    const addIndex = safePageCount - 1;
    const addSwipeThreshold = Math.max(addIndex - 1 + 0.04, 0);
    const movingTowardAdd = settledIndex < addIndex && progress > addSwipeThreshold;
    const settledOnAdd = settledIndex === addIndex;
    const addPageOpacity = movingTowardAdd || settledOnAdd ? 0 : 1;
    const targetReady = (y > 0 && pageCount > 1) ? 1 : 0;
    const hideFlag = hidden ? 0 : 1;
    const swipeVisibility = HIDE_SCROLLED_INDICATOR_DURING_SWIPE ? gestureOpacity.value : 1;
    let hiddenPageOpacity = 1;
    hiddenPageIndexes.forEach((index) => {
      if (Math.abs(progress - index) < 0.96) hiddenPageOpacity = 0;
    });

    return {
      transform: [
        { translateY: y - currentScroll }
      ],
      opacity: hideFlag * targetReady * addPageOpacity * hiddenPageOpacity * swipeVisibility
    };
  }, [pageWidth, pageCount, hidden, hiddenPageIndexes]);

  const activeStyle = useAnimatedStyle(() => {
    const rawIndex = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const clampedIndex = Math.min(Math.max(rawIndex, 0), dotCount - 1);
    return {
      transform: [{ translateX: clampedIndex * step }],
    };
  }, [gap, pageWidth, dotCount, step]);

  if (pageCount <= 1) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          height: 32,
          justifyContent: 'center'
        },
        containerStyle
      ]}
    >
      <View style={{ width: trackWidth, height: 8, justifyContent: 'center', paddingHorizontal: sidePad }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
          {Array.from({ length: dotCount }).map((_, index) => (
            <View
              key={index}
              style={{
                width: inactiveWidth,
                height: dashHeight,
                borderRadius: HOME_RADIUS.full,
                backgroundColor: palette.textSecondary,
                opacity: palette.isDark ? 0.42 : 0.6,
              }}
            />
          ))}
        </View>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              width: activeWidth,
              height: dashHeight,
              borderRadius: HOME_RADIUS.full,
              backgroundColor: palette.listText,
              opacity: palette.isDark ? 0.68 : 0.82,
            },
            activeStyle,
          ]}
        />
      </View>
    </Animated.View>
  );
}

function AddAccountPage({
  pageHeight,
  palette,
}: {
  pageHeight: number;
  palette: AppThemePalette;
}) {
  return (
    <View
      style={{
        flex: 1,
        height: pageHeight,
        paddingHorizontal: SCREEN_GUTTER,
        paddingTop: 54 + HOME_SURFACE.heroTop,
        paddingBottom: HOME_LAYOUT.fabContentBottomPadding,
        justifyContent: 'center',
      }}
    >
      <TouchableOpacity
        delayPressIn={0}
        activeOpacity={0.84}
        onPress={() => router.push('/settings/account-form')}
        style={{
          minHeight: 180,
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: palette.borderSoft,
          backgroundColor: palette.surface,
          alignItems: 'center',
          justifyContent: 'center',
          padding: CARD_PADDING,
        }}
      >
        <AppIcon name="plus-circle" size={22} color={palette.text} />
        <Text appWeight="medium" style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, marginTop: 12 }}>
          Add Account
        </Text>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginTop: 6, textAlign: 'center' }}>
          Create a new account to track balances separately.
        </Text>
      </TouchableOpacity>
    </View>
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
}) {
  const { palette } = useAppTheme();
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [periodTransactions, setPeriodTransactions] = useState<Transaction[]>([]);
  const [periodDataRangeKey, setPeriodDataRangeKey] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [chartResetNonce, setChartResetNonce] = useState(0);
  const [cashflowIsCashflow, setCashflowIsCashflow] = useState(false);
  const [cashflowCardPeriod, setCashflowCardPeriod] = useState<'today' | 'month'>('today');
  const [cashflowCardTodaySummary, setCashflowCardTodaySummary] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [cashflowCardMonthSummary, setCashflowCardMonthSummary] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
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

  useEffect(() => {
    if (!isPageReady || !isScreenFocused) return;
    const now = new Date();
    const todayFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const todayTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
    const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
    const monthTo = now.toISOString();
    getCashflowSummary(accountId, todayFrom, todayTo).then(setCashflowCardTodaySummary).catch(() => undefined);
    getCashflowSummary(accountId, monthFrom, monthTo).then(setCashflowCardMonthSummary).catch(() => undefined);
  }, [accountId, isPageReady, isScreenFocused]);

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

  const chartTheme = useMemo(() => ({
    brand: palette.brand,
    card: palette.card,
    surface: '#EEF2F8',
    inputBg: '#FFFFFF',
    progressTrack: '#DDE4F0',
    border: '#DFE5EF',
    text: palette.text,
    muted: '#7C8498',
    textMuted: palette.textMuted,
    accent: palette.brand,
    positive: palette.positive,
    negative: palette.negative,
  }), [palette]);

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
          from,
          to,
          ts: String(Date.now())
        }
      });
    },
    [accountId, from, period, to],
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
        contentContainerStyle={{ flexGrow: 1, paddingBottom: HOME_LAYOUT.fabContentBottomPadding }}
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
            incomeExpense={incExpSummary}
            hideAmounts={hideAmounts}
            heroMode
          />
          <View
            onLayout={(event) => {
              const newY = event.nativeEvent.layout.y;
              if (isSelected && newY > 0 && indicatorY.value !== newY) {
                indicatorY.value = newY;
              }
            }}
            style={{ height: 20 }}
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
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '600', color: palette.text }}>Recent</Text>
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
                  const category = transaction.categoryId ? categoriesById.get(transaction.categoryId) : undefined;

                  return (
                    <TransactionListItem
                      key={transaction.id}
                      tx={transaction}
                      sym={currencySymbol}
                      palette={palette}
                      isLast={index === transactions.length - 1}
                      categoryName={transaction.categoryId ? getCategoryFullDisplayName(transaction.categoryId, ' › ') : undefined}
                      categoryIcon={category?.icon}
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

          {accountId === 'all' && (
            <View style={{ width: '100%', alignItems: 'center', marginBottom: -70 }}>
              <Text
                style={{
                  fontSize: 180,
                  fontWeight: '900',
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
