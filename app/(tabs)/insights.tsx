import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, RefreshControl, Modal, Pressable, TouchableOpacity, InteractionManager } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import ReAnimated from 'react-native-reanimated';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { getTabReset, registerTabReset } from '../../lib/tabResetRegistry';

import { Text } from '@/components/ui/AppText';
import { HeaderResetButton } from '../../components/ui/HeaderResetButton';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';

import { PeriodSelector } from '../../components/ui/PeriodSelector';
import { CategoryDonutChartBlock, type CategoryChartMode } from '../../components/CategoryDonutChartBlock';
import { SummaryCard } from '../../components/SummaryCard';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FilledButton, TextButton } from '../../components/ui/AppButton';

import { getCashflowSnapshot, getBalanceTrend, getIncomeExpenseByBuckets } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { toLocalDayStartISO, toLocalDayEndISO, getDateRange, formatDate } from '../../lib/dateUtils';
import { getLoanTransactionKind } from '../../lib/derived';
import { TYPE , FONT_WEIGHT} from '../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT, SCREEN_GUTTER, SCREEN_HEADER, SPACING } from '../../lib/layoutTokens';
import type { CashflowSummary, PeriodType, Transaction } from '../../types';
import { getTimeBuckets, getAvailableGranularities, getAutoBucketType, type ChartGranularity } from '../../lib/chartUtils';
import { IncomeExpenseChart } from '../../components/insights/IncomeExpenseChart';
import { TrendLineChart } from '../../components/insights/TrendLineChart';
import type { IncomeExpenseBucket } from '../../services/analytics';

type HomePeriodType = 'today' | PeriodType;

const PERIODS: HomePeriodType[] = ['today', 'week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<HomePeriodType, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom'
};

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
  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);
  
  const settingsYearStart = useUIStore((s) => s.settings.yearStart);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);

  const [period, setPeriod] = useState<HomePeriodType>('week');
  const [chartMode, setChartMode] = useState<CategoryChartMode>('expense');
  const [selectedChartCategoryId, setSelectedChartCategoryId] = useState<string | null>(null);
  const [chartResetNonce, setChartResetNonce] = useState(0);

  const loadRequestIdRef = useRef(0);
  const [customRangeFrom, setCustomRangeFrom] = useState(() => toLocalDayStartISO(new Date()));
  const [customRangeTo, setCustomRangeTo] = useState(() => toLocalDayEndISO(new Date()));
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const [customRangeOpen, setCustomRangeOpen] = useState(false);

  const [expandedChartState, setExpandedChartState] = useState<{
    transactions: Transaction[];
    mode: CategoryChartMode;
    resetTrigger: number;
  } | null>(null);

  const [periodTransactions, setPeriodTransactions] = useState<Transaction[]>([]);
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [chartInteracting, setChartInteracting] = useState(false);
  const [isLoadingTrend, setIsLoadingTrend] = useState(true);
  const [incomeExpenseGranularity, setIncomeExpenseGranularity] = useState<ChartGranularity>('auto');
  const [chartPanelCloseToken, setChartPanelCloseToken] = useState(0);

  // Reset granularity override whenever the period changes — but only if it's not already 'auto'.
  // Returning the previous ref tells React to skip the re-render entirely.
  useEffect(() => {
    setIncomeExpenseGranularity((prev) => (prev === 'auto' ? prev : 'auto'));
  }, [period]);

  // Wrappers that flip the loading mask ON in the SAME batch as the state change that triggers
  // a refetch. Crucially, they NO-OP when the user re-taps the already-active value — otherwise
  // isLoading would flip true with no follow-up fetch (loadData's useCallback dep wouldn't change),
  // leaving the mask stuck on "Updating…" forever.
  const handlePeriodChange = useCallback((next: HomePeriodType) => {
    if (next === period) return;
    setIsLoadingTrend(true);
    setPeriod(next);
  }, [period]);
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

  const isDefaultView = period === 'week' && selectedChartCategoryId === null;

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);


  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);

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

  const chartTheme = useMemo(() => ({
    brand: palette.brand,
    card: palette.card,
    surface: palette.isDark ? '#1F2937' : '#E2E8F0', // Higher contrast grey background
    inputBg: palette.isDark ? '#111827' : '#FFFFFF', // Clean dark theme input background, standard white in light theme
    progressTrack: palette.isDark ? '#374151' : '#DDE4F0',
    border: palette.isDark ? '#374151' : '#CBD5E1', // Enhanced border contrast
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
    try {
      const [snapshot, txs, trend, incExp] = await Promise.all([
        getCashflowSnapshot('all', dateRange.from, dateRange.to, { includeTransfers: false, includeLoans: false, includeDeposits: false }),
        getTransactions({ fromDate: dateRange.from, toDate: dateRange.to }),
        getBalanceTrend(dateRange.from, dateRange.to),
        getIncomeExpenseByBuckets(buckets, dateRange.from, dateRange.to),
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
  }, [dateRange, period, incomeExpenseGranularity]);

  useEffect(() => {
    // Defer one frame so React commits + OS paints the chip highlight + "Updating…" mask
    // BEFORE the SQLite queries + post-fetch re-render begin. setTimeout(…, 0) is more
    // predictable on Android than InteractionManager for this case.
    const id = setTimeout(() => loadData(), 0);
    return () => clearTimeout(id);
  }, [loadData]);

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
      setChartPanelCloseToken((t) => t + 1);                  // collapse any open config panel
      if (mode === 'full') {
        setPeriod('week');
        setSelectedChartCategoryId(null);
      }
    });
  }, []);

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
      setIsLoadingTrend(true);
      setCustomDraftFrom(fromDate);
      setCustomDraftTo(toDate);
      setCustomRangeFrom(newFromIso);
      setCustomRangeTo(newToIso);
      setPeriod('custom');
    });
  }, [customDraftFrom, customDraftTo, period, customRangeFrom, customRangeTo]);

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
          />

          <SummaryCard
            cashflow={cashflow}
            sym={showCurrencySymbol ? currencySymbol : ''}
            palette={palette}
          />

          <TrendLineChart
            points={mappedTrendPoints}
            palette={palette}
            currencySymbol={showCurrencySymbol ? currencySymbol : ''}
            title="All Accounts Balance Trend"
            subtitle={`(${PERIOD_LABELS[period]})`}
            lineColor={palette.brand}
            onInteractionStateChange={setChartInteracting}
            isLoading={isLoadingTrend}
            containerStyle={{ marginTop: 8 }}
            startDate={dateRange.from}
            endDate={dateRange.to}
          />

          <View style={{ height: 24 }} />

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
              setExpandedChartState({ transactions: periodTransactions, mode, resetTrigger: Date.now() });
            }}
          />
        </View>


        <View style={{ height: 24 }} />

        <IncomeExpenseChart
          data={incomeExpenseData}
          palette={palette}
          sym={showCurrencySymbol ? currencySymbol : ''}
          period={period}
          onInteractionStateChange={setChartInteracting}
          title="Income vs Expense"
          subtitle={`(${PERIOD_LABELS[period]})`}
          granularity={incomeExpenseGranularity}
          onGranularityChange={handleGranularityChange}
          availableGranularities={availableGranularities}
          autoBucketType={autoBucketType}
          panelCloseToken={chartPanelCloseToken}
          isLoading={isLoadingTrend}
        />
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
              <CategoryDonutChartBlock
                transactions={expandedChartState.transactions}
                categoriesById={categoriesById}
                sym={showCurrencySymbol ? currencySymbol : ''}
                listPalette={palette}
                getCategoryFullDisplayName={getCategoryFullDisplayName}
                theme={chartTheme}
                expanded
                initialMode={expandedChartState.mode}
                resetTrigger={expandedChartState.resetTrigger}
                accountsById={accountsById}
                loansById={loansById}
                onTransactionPress={handleTransactionPress}
              />
            </View>
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}
