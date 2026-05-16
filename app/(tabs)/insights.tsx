import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, RefreshControl, Modal, Pressable, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { registerTabReset } from '../../lib/tabResetRegistry';

import { Text } from '@/components/ui/AppText';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';

import { PeriodSelector } from '../../components/ui/PeriodSelector';
import { HomeDonutChartBlock, HomeChartMode } from '../../components/HomeDonutChartBlock';
import { SummaryCard } from '../../components/SummaryCard';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FilledButton, TextButton } from '../../components/ui/AppButton';

import { getCashflowSnapshot } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { toLocalDayStartISO, toLocalDayEndISO, getDateRange, formatDate } from '../../lib/dateUtils';
import { TYPE , FONT_WEIGHT} from '../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT, SCREEN_GUTTER, SCREEN_HEADER, SPACING } from '../../lib/layoutTokens';
import type { CashflowSummary, PeriodType, Transaction } from '../../types';

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
  const [chartMode, setChartMode] = useState<HomeChartMode>('expense');
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
    mode: HomeChartMode;
    resetTrigger: number;
  } | null>(null);

  const [periodTransactions, setPeriodTransactions] = useState<Transaction[]>([]);
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);

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

  const loadData = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    const [snapshot, txs] = await Promise.all([
      getCashflowSnapshot('all', dateRange.from, dateRange.to),
      getTransactions({ fromDate: dateRange.from, toDate: dateRange.to }),
    ]);
    if (requestId !== loadRequestIdRef.current) return;
    setCashflow(snapshot.summary);
    setPeriodTransactions(txs);
  }, [dateRange]);

  useEffect(() => {
    loadData();
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
    return registerTabReset('insights', ({ mode }) => {
      scrollRef.current?.scrollTo({ y: 0, animated: mode === 'full' });
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
    setCustomDraftFrom(fromDate);
    setCustomDraftTo(toDate);
    setCustomRangeFrom(toLocalDayStartISO(fromDate));
    setCustomRangeTo(toLocalDayEndISO(toDate));
    setPeriod('custom');
    setCustomRangeOpen(false);
  }, [customDraftFrom, customDraftTo]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingBottom: SPACING.md, paddingHorizontal: SCREEN_HEADER.paddingX }}>
        <Text style={{ fontSize: TYPE.title, fontWeight: FONT_WEIGHT.regular, color: palette.text, letterSpacing: -0.5 }}>
          Insights
        </Text>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
          <PeriodSelector
            period={period}
            from={dateRange.from}
            to={dateRange.to}
            onPeriodChange={(next) => setPeriod(next as any)}
            onOpenCustomRange={openCustomRange}
            theme={chartTheme}
            options={PERIODS.map((value) => ({ key: value, label: PERIOD_LABELS[value] }))}
          />

          <SummaryCard
            cashflow={cashflow}
            sym={showCurrencySymbol ? currencySymbol : ''}
            palette={palette}
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
          <HomeDonutChartBlock
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
            onExpand={(mode) => {
              setExpandedChartState({ transactions: periodTransactions, mode, resetTrigger: Date.now() });
            }}
          />
        </View>
      </Animated.ScrollView>

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
                theme={chartTheme}
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
