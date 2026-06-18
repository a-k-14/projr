import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Modal, Pressable, RefreshControl, TouchableOpacity, View } from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabReset, registerTabReset } from '../../lib/tabResetRegistry';

import { Text } from '@/components/ui/AppText';
import { HeaderResetButton } from '../../components/ui/HeaderResetButton';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';

import { CategoryDonutChartBlock, type CategoryChartMode } from '../../components/CategoryDonutChartBlock';
import { SummaryCard } from '../../components/SummaryCard';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FilterMoreButton } from '../../components/ui/FilterMoreButton';
import { InsightsFiltersSheet, type RangePresetKey } from '../../components/insights/InsightsFiltersSheet';
import { PeriodSelector } from '../../components/ui/PeriodSelector';

import { DateGroupedTransactionSheetList } from '../../components/DateGroupedTransactionSheetList';
import { SheetScrollTopButton } from '../../components/ui/SheetScrollTopButton';
import { IncomeExpenseChart } from '../../components/insights/IncomeExpenseChart';
import { TrendLineChart } from '../../components/insights/TrendLineChart';
import { useDateFilter } from '../../lib/useDateFilter';
import { getAutoBucketType, getAvailableGranularities, getTimeBuckets, type ChartGranularity } from '../../lib/chartUtils';
import { formatDate, getDateRange, safeLocalDateKey, toLocalDateKey, toLocalDayEndISO, toLocalDayStartISO } from '../../lib/dateUtils';
import { useTransactionPress } from '../../lib/useTransactionPress';
import { FONT_WEIGHT, TYPE } from '../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT, SCREEN_GUTTER, SCREEN_HEADER, SPACING, BOTTOM_SHEET_TOKENS } from '../../lib/layoutTokens';
import type { IncomeExpenseBucket } from '../../services/analytics';
import { getAccountBalanceTrend, getBalanceTrend, getCashflowSnapshot, getIncomeExpenseByBuckets } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import type { CashflowSummary, PeriodType, Transaction } from '../../types';

type HomePeriodType = 'today' | PeriodType;

const PERIODS: HomePeriodType[] = ['today', 'week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<string, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom'
};

// Rolling/anchored range presets exposed in the filters sheet. These complement
// (not duplicate) the inline period switcher. Each preset's range is recomputed
// every time the screen comes into focus, so windows roll forward across midnight.
const RANGE_PRESETS: { key: RangePresetKey; label: string }[] = [
  { key: 'last7', label: 'Last 7D' },
  { key: 'last30', label: 'Last 30D' },
  { key: 'last90', label: 'Last 90D' },
  { key: 'ytd', label: 'YTD' },
  { key: 'prevMonth', label: 'Last Month' },
  { key: 'prevYear', label: 'Last Year' },
];

function computePresetRange(key: RangePresetKey, yearStart: number = 0): { from: string; to: string } {
  const now = new Date();
  if (key === 'last7' || key === 'last30' || key === 'last90') {
    const days = key === 'last7' ? 7 : key === 'last30' ? 30 : 90;
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    return { from: toLocalDayStartISO(start), to: toLocalDayEndISO(now) };
  }
  // For YTD / Last Year, "year" follows the user's financial-year setting (yearStart is
  // the 0-indexed start month). Current FY started either this calendar year or the
  // previous one, depending on whether we've crossed the start month yet.
  const fyAnchorYear = now.getMonth() >= yearStart ? now.getFullYear() : now.getFullYear() - 1;
  if (key === 'ytd') {
    const start = new Date(fyAnchorYear, yearStart, 1);
    return { from: toLocalDayStartISO(start), to: toLocalDayEndISO(now) };
  }
  if (key === 'prevMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toLocalDayStartISO(start), to: toLocalDayEndISO(end) };
  }
  // prevYear — the full FY that ended just before the current FY started.
  const start = new Date(fyAnchorYear - 1, yearStart, 1);
  const end = new Date(fyAnchorYear, yearStart, 0); // day 0 of next month = last day of prev month
  return { from: toLocalDayStartISO(start), to: toLocalDayEndISO(end) };
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const isFocused = useIsFocused();

  const accounts = useAccountsStore((s) => s.accounts);
  const accountsLoaded = useAccountsStore((s) => s.isLoaded);
  const loadAccounts = useAccountsStore((s) => s.load);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const categories = useCategoriesStore((s) => s.categories);
  const categoriesLoaded = useCategoriesStore((s) => s.isLoaded);
  const loadCategories = useCategoriesStore((s) => s.load);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const tags = useCategoriesStore((s) => s.tags);
  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);

  const settingsYearStart = useUIStore((s) => s.settings.yearStart);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const mutationVersion = useTransactionsStore((s) => s.mutationVersion);

  // Default insights view: a rolling 7-day window so the screen is never empty on a
  // fresh week/month. Implemented as `period: 'custom'` with the range recomputed on
  // every mount so the dates stay current as the calendar rolls forward.
  // Default to a rolling 7-day window so the screen is never empty on a fresh
  // calendar month (which would happen with a strict `month` default).
  const dateFilter = useDateFilter({ 
    initialPeriod: 'month',
    initialCustomRange: computePresetRange('last7', settingsYearStart)
  });
  const period = dateFilter.period;
  const customRangeFrom = dateFilter.customRange?.from ?? computePresetRange('last7', settingsYearStart).from;
  const customRangeTo = dateFilter.customRange?.to ?? computePresetRange('last7', settingsYearStart).to;
  
  const [chartMode, setChartMode] = useState<CategoryChartMode>('expense');
  const [selectedChartCategoryId, setSelectedChartCategoryId] = useState<string | null>(null);
  const [chartResetNonce, setChartResetNonce] = useState(0);
  const loadRequestIdRef = useRef(0);
  // The active preset drives both the rolling-on-focus behavior and the inline
  // switcher's left label. `null` means the user picked a real custom range or a
  // different period chip — in that case nothing rolls automatically.
  const [activePreset, setActivePreset] = useState<RangePresetKey | null>(null);
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const [customRangeOpen, setCustomRangeOpen] = useState(false);

  const [expandedChartState, setExpandedChartState] = useState<{
    transactions: Transaction[];
    mode: CategoryChartMode;
    resetTrigger: number;
  } | null>(null);
  const [expandedSheetTxs, setExpandedSheetTxs] = useState<Transaction[]>([]);
  const [incExpExpanded, setIncExpExpanded] = useState(false);
  const [incExpBucketFilter, setIncExpBucketFilter] = useState<{ from: string; to: string } | null>(null);

  // Scroll-to-top affordance for the expanded sheets. One ref/state serves whichever
  // sheet is open (only one mounts at a time).
  const sheetListRef = useRef<any>(null);
  const [showSheetScrollTop, setShowSheetScrollTop] = useState(false);
  const lastShowSheetTopRef = useRef(false);
  const isScrollingToTopRef = useRef(false);

  const handleSheetScroll = useCallback((offsetY: number) => {
    if (isScrollingToTopRef.current) {
      if (offsetY <= 0) {
        isScrollingToTopRef.current = false;
      }
      return;
    }
    const next = offsetY > 240;
    if (next !== lastShowSheetTopRef.current) {
      lastShowSheetTopRef.current = next;
      setShowSheetScrollTop(next);
    }
  }, []);

  const scrollSheetToTop = useCallback(() => {
    isScrollingToTopRef.current = true;
    sheetListRef.current?.scrollToOffset({ offset: 0, animated: true });
    lastShowSheetTopRef.current = false;
    setShowSheetScrollTop(false);
  }, []);

  const resetSheetScrollTop = useCallback(() => {
    isScrollingToTopRef.current = false;
    lastShowSheetTopRef.current = false;
    setShowSheetScrollTop(false);
  }, []);

  // Filters surfaced through InsightsFiltersSheet.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [cashflowMode, setCashflowMode] = useState<'incomeExpense' | 'total'>('incomeExpense');

  const [periodTransactions, setPeriodTransactions] = useState<Transaction[]>([]);
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [chartInteracting, setChartInteracting] = useState(false);
  const [isLoadingTrend, setIsLoadingTrend] = useState(true);
  const [incomeExpenseGranularity, setIncomeExpenseGranularity] = useState<ChartGranularity>('day');
  const [chartPanelCloseToken, setChartPanelCloseToken] = useState(0);

  // Reset granularity override whenever the period changes — but only if it's not already 'auto'.
  // Returning the previous ref tells React to skip the re-render entirely.
  useEffect(() => {
    setIncomeExpenseGranularity(period === 'month' ? 'day' : 'auto');
  }, [period]);

  // Wrappers that flip the loading mask ON in the SAME batch as the state change that triggers
  // a refetch. Crucially, they NO-OP when the user re-taps the already-active value — otherwise
  // isLoading would flip true with no follow-up fetch (loadData's useCallback dep wouldn't change),
  // leaving the mask stuck on "Updating…" forever.
  const handlePeriodChange = useCallback((next: HomePeriodType) => {
    if (next === period) return;
    // Any explicit period change exits the active preset.
    setActivePreset(null);
    if (next === 'custom') {
      setCustomRangeOpen(true);
      return;
    }
    dateFilter.setPeriod(next);
  }, [period, dateFilter]);
  const handleGranularityChange = useCallback((g: ChartGranularity) => {
    if (g === incomeExpenseGranularity) return;
    setIsLoadingTrend(true);
    setIncomeExpenseGranularity(g);
  }, [incomeExpenseGranularity]);

  const [balanceTrend, setBalanceTrend] = useState<{ date: string; balance: number }[]>([]);
  const [incomeExpenseData, setIncomeExpenseData] = useState<IncomeExpenseBucket[]>([]);

  const mappedTrendPoints = useMemo(() => {
    return balanceTrend.map((t) => ({ date: t.date, val: t.balance }));
  }, [balanceTrend]);

  const dateRange = useMemo(() => {
    if (period === 'today') {
      const now = new Date();
      return { from: toLocalDayStartISO(now), to: toLocalDayEndISO(now) };
    }
    return getDateRange(
      period as PeriodType,
      settingsYearStart,
      period === 'custom' ? new Date(customRangeFrom).toISOString() : undefined,
      period === 'custom' ? new Date(customRangeTo).toISOString() : undefined,
    );
  }, [period, settingsYearStart, customRangeFrom, customRangeTo]);

  // Which granularity chips to expose, and what bucket type Auto will produce — both derived from period+span.
  const { availableGranularities, autoBucketType } = useMemo(() => {
    const spanDays = Math.round(
      (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000,
    );
    return {
      availableGranularities: getAvailableGranularities(period, spanDays),
      autoBucketType: getAutoBucketType(period, spanDays),
    };
  }, [period, dateRange]);

  // If the active granularity is no longer allowed (e.g. user shrank the custom range so 'day'
  // no longer applies), snap back to 'auto'.
  useEffect(() => {
    setIncomeExpenseGranularity((prev) =>
      availableGranularities.includes(prev) ? prev : 'auto',
    );
  }, [availableGranularities]);

  const isDefaultView =
    period === 'month' &&
    activePreset === null &&
    selectedChartCategoryId === null &&
    selectedAccountId === 'all' &&
    cashflowMode === 'incomeExpense';

  const filtersActiveCount =
    (selectedAccountId !== 'all' ? 1 : 0) + (cashflowMode === 'total' ? 1 : 0);

  // Rich preset caption shown next to the period switcher when a preset window is
  // active. Format varies by preset so the dates carry meaning per kind:
  //   Last 7D/30D/90D (1 Jun 2026 - 7 Jun 2026)
  //   YTD             (1 Apr 2026 - 4 Jun 2026)
  //   Last Month      (May 26)
  //   Last Year       (Apr 25 - Mar 26)
  const activePresetLabel = useMemo(() => {
    if (!activePreset) return undefined;
    const preset = RANGE_PRESETS.find((p) => p.key === activePreset);
    if (!preset) return undefined;
    const fmtDayMonth = (iso: string) =>
      new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const fmtMonthShortYY = (iso: string) =>
      new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const from = dateRange.from;
    const to = dateRange.to;
    let detail: string;
    if (activePreset === 'prevMonth') {
      detail = fmtMonthShortYY(from);
    } else if (activePreset === 'prevYear') {
      detail = `${fmtMonthShortYY(from)} - ${fmtMonthShortYY(to)}`;
    } else {
      // last7 / last30 / last90 / ytd — dd mmm on both ends (year dropped; window is implied).
      detail = `${fmtDayMonth(from)} - ${fmtDayMonth(to)}`;
    }
    return `${preset.label} (${detail})`;
  }, [activePreset, dateRange.from, dateRange.to]);

  const incExpVisibleTxs = useMemo(() => {
    if (!incExpBucketFilter) return periodTransactions;
    // Use toLocalDateKey on both sides — bucket dates are UTC ISO strings from .toISOString(),
    // so a bare split('T')[0] gives the UTC date, not the local date (wrong in any non-UTC timezone).
    const from = toLocalDateKey(incExpBucketFilter.from);
    const to = toLocalDateKey(incExpBucketFilter.to);
    return periodTransactions.filter((tx) => {
      const day = safeLocalDateKey(tx.date);
      return !!day && day >= from && day <= to;
    });
  }, [incExpBucketFilter, periodTransactions]);


  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);


  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);
  const tagNamesById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);

  const handleTransactionPress = useTransactionPress();

  const chartTheme = useMemo(() => ({
    brand: palette.brand,
    card: palette.card,
    surface: palette.layers.chartWell, // Higher contrast grey background
    inputBg: palette.layers.insightsInputBg, // Clean dark theme input background, standard white in light theme
    progressTrack: palette.states.progressTrack,
    border: palette.lines.chartBorder, // Enhanced border contrast
    text: palette.text,
    muted: '#7C8498',
    textMuted: palette.textMuted,
    accent: palette.brand,
    positive: palette.numberPositive,
    negative: palette.numberNegative,
  }), [palette]);

  const loadData = useCallback(async () => {
    setIsLoadingTrend(true);
    const requestId = ++loadRequestIdRef.current;
    const buckets = getTimeBuckets(period, dateRange.from, dateRange.to, incomeExpenseGranularity);
    const isTotal = cashflowMode === 'total';
    try {
      const [snapshot, txs, trend, incExp] = await Promise.all([
        getCashflowSnapshot(selectedAccountId, dateRange.from, dateRange.to, { includeTransfers: isTotal, includeLoans: isTotal, includeDeposits: isTotal }),
        getTransactions({ fromDate: dateRange.from, toDate: dateRange.to, accountId: selectedAccountId === 'all' ? undefined : selectedAccountId }),
        selectedAccountId === 'all'
          ? getBalanceTrend(dateRange.from, dateRange.to)
          : getAccountBalanceTrend(selectedAccountId, dateRange.from, dateRange.to),
        getIncomeExpenseByBuckets(buckets, dateRange.from, dateRange.to, selectedAccountId, { includeTransfers: isTotal, includeLoans: isTotal, includeDeposits: isTotal }),
      ]);
      if (requestId !== loadRequestIdRef.current) return;
      setCashflow(snapshot.summary);
      setPeriodTransactions(txs);
      setBalanceTrend(trend);
      setIncomeExpenseData(incExp);
    } catch (err) {
      console.error(err);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setIsLoadingTrend(false);
      }
    }
  }, [dateRange, period, incomeExpenseGranularity, selectedAccountId, cashflowMode]);

  // Roll the active preset's window forward each time the screen comes into focus,
  // so the dates stay current — even after the app has been backgrounded across
  // midnight or the year boundary (relevant for YTD).
  useEffect(() => {
    if (!isFocused || !activePreset) return;
    const { from: nextFrom, to: nextTo } = computePresetRange(activePreset, settingsYearStart);
    if (nextFrom !== customRangeFrom || nextTo !== customRangeTo) {
      dateFilter.setCustomRange({ from: nextFrom, to: nextTo });
    }
  }, [isFocused, activePreset, customRangeFrom, customRangeTo, settingsYearStart, dateFilter]);

  useEffect(() => {
    if (!isFocused) return;
    // Defer one frame so React commits + OS paints the chip highlight + "Updating…" mask
    // BEFORE the SQLite queries + post-fetch re-render begin. setTimeout(…, 0) is more
    // predictable on Android than InteractionManager for this case.
    const id = setTimeout(() => loadData(), 0);
    return () => clearTimeout(id);
  }, [loadData, isFocused, mutationVersion]);

  useEffect(() => {
    if (!accountsLoaded) loadAccounts().catch(() => undefined);
    if (!categoriesLoaded) loadCategories().catch(() => undefined);
    if (!loansLoaded) loadLoans().catch(() => undefined);
  }, [accountsLoaded, categoriesLoaded, loansLoaded, loadAccounts, loadCategories, loadLoans]);

  useEffect(() => {
    if (selectedChartCategoryId === null) {
      setChartResetNonce((n) => n + 1);
    }
  }, [selectedChartCategoryId]);

  const scrollRef = useRef<any>(null);

  useEffect(() => {
    return registerTabReset('insights', ({ mode, animated }) => {
      scrollRef.current?.scrollTo({ y: 0, animated });
      setChartPanelCloseToken((t) => t + 1);
      setExpandedChartState(null);
      setExpandedSheetTxs([]);
      setIncExpExpanded(false);
      setIncExpBucketFilter(null);
      if (mode === 'full') {
        if (period === 'custom' && !activePreset) {
          dateFilter.setPeriod('month');
          setActivePreset(null);
        }
        setSelectedChartCategoryId(null);
        setSelectedAccountId('all');
        setCashflowMode('incomeExpense');
        setIncomeExpenseGranularity('day');
      } else {
        setIncomeExpenseGranularity(period === 'month' ? 'day' : 'auto');
      }
    });
  }, [period]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAccounts();
    await loadData();
    setRefreshing(false);
  }, [loadData, refreshAccounts]);

  const openCustomRange = useCallback(() => {
    setCustomDraftFrom(new Date(customRangeFrom));
    setCustomDraftTo(new Date(customRangeTo));
    setCustomRangeOpen(true);
  }, [customRangeFrom, customRangeTo]);

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

  const handleCustomRangeDone = useCallback(() => {
    const fromDate = customDraftFrom <= customDraftTo ? customDraftFrom : customDraftTo;
    const toDate = customDraftTo >= customDraftFrom ? customDraftTo : customDraftFrom;
    const newFromIso = toLocalDayStartISO(fromDate);
    const newToIso = toLocalDayEndISO(toDate);
    // 1. Close the modal first so its dismiss animation isn't blocked by the chart re-render.
    setCustomRangeOpen(false);
    // 2. Defer the heavy state updates (period change → chart refetch) until the modal
    //    animation finishes — keeps the Done tap feeling instant.
    InteractionManager.runAfterInteractions(() => {
      // Skip the optimistic loading flag if nothing about the chart query is actually changing —
      // otherwise isLoading would flip true with no follow-up fetch, leaving the mask stuck.
      const willTriggerRefetch =
        period !== 'custom' ||
        newFromIso !== customRangeFrom ||
        newToIso !== customRangeTo;
      if (!willTriggerRefetch) return;
      // User-picked custom range — clear the active preset so it doesn't override on focus.
      setActivePreset(null);
      setIsLoadingTrend(true);
      setCustomDraftFrom(fromDate);
      setCustomDraftTo(toDate);
      dateFilter.setCustomRange({ from: newFromIso, to: newToIso });
      dateFilter.setPeriod('custom');
    });
  }, [customDraftFrom, customDraftTo, period, customRangeFrom, customRangeTo, dateFilter]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingBottom: SPACING.md, paddingHorizontal: SCREEN_HEADER.paddingX, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: TYPE.title, fontWeight: FONT_WEIGHT.regular, color: palette.text, letterSpacing: -0.5 }}>
          Insights
        </Text>
        <HeaderResetButton
          visible={!isDefaultView}
          onPress={() => getTabReset('insights')?.({ mode: 'full', animated: true })}
          palette={palette}
          style={{ marginLeft: 10 }}
          isFocused={isFocused}
        />
        <View style={{ flex: 1 }} />
        <FilterMoreButton
          onPress={() => setFiltersOpen(true)}
          moreActiveCount={filtersActiveCount}
          palette={palette}
          iconOnly
          marginLeft={0}
        />
      </View>

      <ReAnimated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        scrollEnabled={!chartInteracting}
      >
        <PeriodSelector
          period={period}
          from={dateRange.from}
          to={dateRange.to}
          onPeriodChange={(next) => handlePeriodChange(next as HomePeriodType)}
          onOpenCustomRange={openCustomRange}
          theme={chartTheme}
          options={PERIODS.map((value) => ({ key: value, label: PERIOD_LABELS[value] }))}
          // When a preset is active, replace the right-side date range with the
          // self-contained rich caption ("Last 7D (1 Jun 2026 - 7 Jun 2026)" etc).
          rightLabel={activePresetLabel && period === 'custom' ? activePresetLabel : undefined}
        />

        <SummaryCard
          cashflow={cashflow}
          sym={showCurrencySymbol ? currencySymbol : ''}
          palette={palette}
          isCashflowMode={cashflowMode === 'total'}
        />

        <TrendLineChart
          points={mappedTrendPoints}
          palette={palette}
          currencySymbol={showCurrencySymbol ? currencySymbol : ''}
          title={selectedAccountId === 'all' ? 'All Accounts Balance Trend' : `${accounts.find((a) => a.id === selectedAccountId)?.name ?? 'Account'} Balance Trend`}
          subtitle={`(${PERIOD_LABELS[period]})`}
          lineColor={palette.brand}
          onInteractionStateChange={setChartInteracting}
          isLoading={isLoadingTrend}
          containerStyle={{ marginTop: 8 }}
          startDate={dateRange.from}
          endDate={dateRange.to}
        />

        <View style={{ height: 24 }} />

        <IncomeExpenseChart
          data={incomeExpenseData}
          palette={palette}
          sym={showCurrencySymbol ? currencySymbol : ''}
          period={period}
          onInteractionStateChange={setChartInteracting}
          title={cashflowMode === 'total' ? 'Inflow vs Outflow' : 'Income vs Expense'}
          subtitle={`(${PERIOD_LABELS[period]})`}
          granularity={incomeExpenseGranularity}
          onGranularityChange={handleGranularityChange}
          availableGranularities={availableGranularities}
          autoBucketType={autoBucketType}
          panelCloseToken={chartPanelCloseToken}
          isLoading={isLoadingTrend}
          onExpand={() => setIncExpExpanded(true)}
          isCashflowMode={cashflowMode === 'total'}
        />

        <View
          style={{
            backgroundColor: palette.card,
            borderWidth: 1,
            borderColor: palette.divider,
            borderRadius: HOME_RADIUS.card,
            paddingTop: 12,
            paddingBottom: 12,
          }}
        >
          <CategoryDonutChartBlock
            transactions={periodTransactions}
            categoriesById={categoriesById}
            sym={showCurrencySymbol ? currencySymbol : ''}
            listPalette={palette}
            getCategoryFullDisplayName={getCategoryFullDisplayName}
            theme={chartTheme}
            mode={chartMode}
            onModeChange={setChartMode}
            selectedCategoryId={selectedChartCategoryId}
            onCategorySelect={setSelectedChartCategoryId}
            resetTrigger={`${period}:${dateRange.from}:${dateRange.to}:${chartResetNonce}`}
            accountsById={accountsById}
            loansById={loansById}
            onTransactionPress={handleTransactionPress}
            onExpand={(mode) => {
              setExpandedSheetTxs(periodTransactions); // pre-populate so no empty→populated jump
              setExpandedChartState({ transactions: periodTransactions, mode, resetTrigger: Date.now() });
            }}
            isCashflowMode={cashflowMode === 'total'}
          />
        </View>
      </ReAnimated.ScrollView>

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

      {expandedChartState ? (
        <BottomSheet
          title="Category Breakdown"
          palette={palette}
          backgroundColor={palette.background}
          disableShadow
          onClose={() => {
            setExpandedChartState(null);
            setExpandedSheetTxs([]);
            resetSheetScrollTop();
          }}
          maxHeightRatio={BOTTOM_SHEET_TOKENS.insightsMaxHeight}
          fixedHeightRatio={BOTTOM_SHEET_TOKENS.insightsMaxHeight}
          hasNavBar
          bareContent
          titleRight={<SheetScrollTopButton visible={showSheetScrollTop} onPress={scrollSheetToTop} palette={palette} />}
        >
          <DateGroupedTransactionSheetList
            transactions={expandedSheetTxs}
            palette={palette}
            sym={showCurrencySymbol ? currencySymbol : ''}
            categoriesById={categoriesById}
            accountsById={accountsById}
            loansById={loansById}
            tagNamesById={tagNamesById}
            getCategoryFullDisplayName={getCategoryFullDisplayName}
            onTransactionPress={handleTransactionPress}
            emptyText="No transactions"
            contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 24 }}
            listRef={sheetListRef}
            onScrollSettle={handleSheetScroll}
            ListHeaderComponent={
              // Donut + category list — no internal scroll, no internal transactions
              <View style={{ backgroundColor: palette.card, borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, overflow: 'hidden' }}>
                <CategoryDonutChartBlock
                  transactions={expandedChartState.transactions}
                  categoriesById={categoriesById}
                  sym={showCurrencySymbol ? currencySymbol : ''}
                  listPalette={palette}
                  getCategoryFullDisplayName={getCategoryFullDisplayName}
                  theme={chartTheme}
                  expanded
                  disableScroll
                  externalTransactions
                  onSelectedTransactionsChange={setExpandedSheetTxs}
                  initialMode={expandedChartState.mode}
                  resetTrigger={expandedChartState.resetTrigger}
                  accountsById={accountsById}
                  loansById={loansById}
                  onTransactionPress={handleTransactionPress}
                  isCashflowMode={cashflowMode === 'total'}
                />
              </View>
            }
          />
        </BottomSheet>
      ) : null}

      {filtersOpen ? (
        <InsightsFiltersSheet
          palette={palette}
          onClose={() => setFiltersOpen(false)}
          cashflowMode={cashflowMode}
          onCashflowModeChange={setCashflowMode}
          rangePresets={RANGE_PRESETS}
          selectedRangeKey={activePreset}
          onSelectRange={(key) => {
            // Close the sheet first; defer the heavy data reload to the next frame
            // so the close animation isn't blocked by the load (esp. for "Last Year",
            // which pulls a full year of transactions + a 365-point trend).
            setFiltersOpen(false);
            const { from, to } = computePresetRange(key, settingsYearStart);
            requestAnimationFrame(() => {
              setIsLoadingTrend(true);
              dateFilter.setCustomRange({ from, to });
              setActivePreset(key);
              dateFilter.setPeriod('custom');
            });
          }}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={(id) => {
            setSelectedAccountId(id);
            setFiltersOpen(false);
          }}
        />
      ) : null}

      {incExpExpanded ? (
        <BottomSheet
          title="Income vs Expense"
          palette={palette}
          backgroundColor={palette.background}
          disableShadow
          onClose={() => {
            setIncExpExpanded(false);
            setIncExpBucketFilter(null);
            resetSheetScrollTop();
          }}
          maxHeightRatio={BOTTOM_SHEET_TOKENS.insightsMaxHeight}
          fixedHeightRatio={BOTTOM_SHEET_TOKENS.insightsMaxHeight}
          hasNavBar
          bareContent
          titleRight={<SheetScrollTopButton visible={showSheetScrollTop} onPress={scrollSheetToTop} palette={palette} />}
        >
          <DateGroupedTransactionSheetList
            transactions={incExpVisibleTxs}
            palette={palette}
            sym={showCurrencySymbol ? currencySymbol : ''}
            categoriesById={categoriesById}
            accountsById={accountsById}
            loansById={loansById}
            tagNamesById={tagNamesById}
            getCategoryFullDisplayName={getCategoryFullDisplayName}
            onTransactionPress={handleTransactionPress}
            emptyText="No transactions in this period"
            contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 24 }}
            listRef={sheetListRef}
            onScrollSettle={handleSheetScroll}
            ListHeaderComponent={
              <IncomeExpenseChart
                data={incomeExpenseData}
                palette={palette}
                sym={showCurrencySymbol ? currencySymbol : ''}
                period={period}
                subtitle={PERIOD_LABELS[period]}
                granularity={incomeExpenseGranularity}
                onGranularityChange={handleGranularityChange}
                availableGranularities={availableGranularities}
                autoBucketType={autoBucketType}
                isLoading={isLoadingTrend}
                onBucketPress={(bucket) => {
                  // Defer the list filter update to the next frame so the bar highlight
                  // paints first — makes the tap feel instant.
                  requestAnimationFrame(() => {
                    setIncExpBucketFilter(
                      bucket?.from && bucket?.to ? { from: bucket.from, to: bucket.to } : null,
                    );
                  });
                }}
                isCashflowMode={cashflowMode === 'total'}
              />
            }
          />
        </BottomSheet>
      ) : null}
    </View>
  );
}
