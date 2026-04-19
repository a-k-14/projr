import { Ionicons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedRef } from 'react-native-reanimated';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountTabBar } from '../../components/AccountTabBar';
import { ChoiceRow } from '../../components/settings-ui';
import { SummaryCard } from '../../components/SummaryCard';
import { TransactionListItem } from '../../components/TransactionListItem';
import { FabButton } from '../../components/ui/FabButton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { InlineDot } from '../../components/ui/InlineDot';
import { formatAccountDisplayName } from '../../lib/account-utils';
import {
  formatDate,
  getDateRange,
  toLocalDateKey,
  toLocalDayEndISO,
  toLocalDayStartISO } from '../../lib/dateUtils';
import { buildCashflowChartData, formatCurrency, formatIndianNumberStr, getTotalBalance } from '../../lib/derived';
import { CARD_PADDING, SCREEN_GUTTER } from '../../lib/design';
import {
  HOME_LAYOUT,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_SURFACE,
  HOME_TEXT,
  getFabBottomOffset } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { getCashflowSnapshot, getCashflowSummary } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import type {
  CashflowSummary,
  DailyCashflow,
  TransactionType,
  PeriodType,
  Transaction
} from '../../types';

const PERIODS: PeriodType[] = ['week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<PeriodType, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom' };

type AccountTab = {
  id: string | 'all';
  name: string;
};

export default function HomeScreen() {
  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const settingsYearStart = useUIStore((s) => s.settings.yearStart);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pagerRef = useAnimatedRef<Animated.ScrollView>();
  const { palette } = useAppTheme();
  const scrollX = useSharedValue(0);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customRangeFrom, setCustomRangeFrom] = useState(() => toLocalDayStartISO(new Date()));
  const [customRangeTo, setCustomRangeTo] = useState(() => toLocalDayEndISO(new Date()));
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());

  const displayAccounts = useMemo<AccountTab[]>(() => [
    { id: 'all', name: 'All' },
    ...accounts.map((a) => ({ id: a.id, name: formatAccountDisplayName(a.name, a.accountNumber) })),
  ], [accounts]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [pagerHeight, setPagerHeight] = useState(0);
  const selectedAccountIndex = useMemo(
    () => Math.max(0, displayAccounts.findIndex((account) => account.id === selectedAccountId)),
    [displayAccounts, selectedAccountId],
  );

  useEffect(() => {
    if (
      selectedAccountId !== 'all' &&
      !accounts.some((account) => account.id === selectedAccountId)
    ) {
      setSelectedAccountId('all');
      pagerRef.current?.scrollTo({ x: 0, animated: true });
    }
  }, [accounts, selectedAccountId]);

  const customRangeMemo = useMemo(
    () => ({ from: new Date(customRangeFrom), to: new Date(customRangeTo) }),
    [customRangeFrom, customRangeTo]
  );

  const handlePagerEnd = useCallback(
    (index: number) => {
      const next = displayAccounts[index];
      if (next && next.id !== selectedAccountId) {
        setSelectedAccountId(next.id);
      }
    },
    [displayAccounts, selectedAccountId],
  );

  const handlePagerMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / Math.max(width, 1));
      handlePagerEnd(nextIndex);
    },
    [handlePagerEnd, width],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    } });



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
        } });
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
    setCustomRangeOpen(false);
  }, [customDraftFrom, customDraftTo]);

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      <AccountTabBar
        accounts={displayAccounts}
        selectedId={selectedAccountId}
        onSelect={(id) => {
          const i = displayAccounts.findIndex((a) => a.id === id);
          if (i !== -1) {
            pagerRef.current?.scrollTo({ x: i * width, animated: true });
          }
          setSelectedAccountId(id);
        }}
        externalScrollX={scrollX}
        palette={palette}
      />

      <View
        style={{ flex: 1 }}
        onLayout={(event: LayoutChangeEvent) => {
          setPagerHeight(event.nativeEvent.layout.height);
        }}
      >
        <Animated.ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          directionalLockEnabled
          disableIntervalMomentum={true}
          snapToInterval={width}
          decelerationRate="fast"
          onScroll={scrollHandler}
          onMomentumScrollEnd={handlePagerMomentumEnd}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {displayAccounts.map((account, index) => {
            const shouldRenderPage = Math.abs(index - selectedAccountIndex) <= 1;
            return (
              <View key={account.id} style={{ width, height: pagerHeight || undefined }}>
                {shouldRenderPage ? (
                  <HomeAccountPage
                    pageHeight={pagerHeight}
                    accountId={account.id}
                    accountName={account.name}
                    settingsYearStart={settingsYearStart}
                    currencySymbol={showCurrencySymbol ? currencySymbol : ''}
                    customRange={customRangeMemo}
                    onOpenCustomRange={openCustomRange}
                    totalBalance={
                      account.id === 'all'
                        ? getTotalBalance(accounts)
                        : (accounts.find((item) => item.id === account.id)?.balance ?? 0)
                    }
                    onRefresh={refreshAccounts}
                    isSelected={account.id === selectedAccountId}
                  />
                ) : (
                  <View style={{ flex: 1 }} />
                )}
              </View>
            );
          })}
        </Animated.ScrollView>
      </View>

      <FabButton
        bottom={getFabBottomOffset(insets.bottom)}
        palette={palette}
        onPress={() =>
          router.push({
            pathname: '/modals/add-transaction',
            params: selectedAccountId === 'all' ? undefined : { accountId: selectedAccountId } })
        }
      />

      <Modal
        visible={customRangeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomRangeOpen(false)}
      >
        <Pressable
          onPress={() => setCustomRangeOpen(false)}
          style={{
            flex: 1,
            backgroundColor: palette.scrim,
            justifyContent: 'center',
            padding: 20 }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: palette.surface,
              borderRadius: HOME_RADIUS.large,
              padding: HOME_SPACE.xxl }}
          >
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, marginBottom: 8 }}>
              Custom range
            </Text>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginBottom: 16 }}>
              Pick the from and to dates for this range.
            </Text>
            <View style={{ gap: HOME_SPACE.md, marginBottom: HOME_SPACE.lg }}>
              <TouchableOpacity delayPressIn={0}
                onPress={() => openDatePicker('from')}
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: HOME_RADIUS.card,
                  paddingHorizontal: HOME_SPACE.lg,
                  paddingVertical: 12 }}
              >
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>From</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
                  {formatDate(customDraftFrom.toISOString())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0}
                onPress={() => openDatePicker('to')}
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: HOME_RADIUS.card,
                  paddingHorizontal: HOME_SPACE.lg,
                  paddingVertical: 12 }}
              >
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
                  {formatDate(customDraftTo.toISOString())}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md, marginTop: HOME_SPACE.lg }}>
              <TouchableOpacity delayPressIn={0}
                onPress={() => setCustomRangeOpen(false)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: HOME_RADIUS.tab,
                  backgroundColor: palette.divider,
                  alignItems: 'center',
                  justifyContent: 'center' }}
              >
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0}
                onPress={handleCustomRangeDone}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: HOME_RADIUS.tab,
                  backgroundColor: palette.brand,
                  alignItems: 'center',
                  justifyContent: 'center' }}
              >
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.onBrand }}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const HomeAccountPage = React.memo(function HomeAccountPage({
  pageHeight,
  accountId,
  accountName,
  settingsYearStart,
  currencySymbol,
  customRange,
  onOpenCustomRange,
  totalBalance,
  onRefresh,
  isSelected }: {
  pageHeight: number;
  accountId: string | 'all';
  accountName: string;
  settingsYearStart: number;
  currencySymbol: string;
  customRange?: { from: Date; to: Date };
  onOpenCustomRange: () => void;
  totalBalance: number;
  onRefresh: () => Promise<void>;
  isSelected: boolean;
}) {
  const { palette } = useAppTheme();
  const getCategoryDisplayName = useCategoriesStore((s) => s.getCategoryDisplayName);
  const [period, setPeriod] = useState<PeriodType>('week');
  const [activeView, setActiveView] = useState<'out' | 'in' | 'table'>('out');
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [todayCashflow, setTodayCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [dailyData, setDailyData] = useState<DailyCashflow[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showViewPicker, setShowViewPicker] = useState(false);
  const isScreenFocused = useIsFocused();

  const leftScrollRef = useRef<ScrollView>(null);
  const rightScrollRef = useRef<ScrollView>(null);

  const handleSyncScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    leftScrollRef.current?.scrollTo({ y, animated: false });
  };
  const isDarkMode = palette.statusBarStyle === 'light';

  const { from, to } = getDateRange(
    period,
    settingsYearStart,
    customRange ? customRange.from.toISOString() : undefined,
    customRange ? customRange.to.toISOString() : undefined,
  );
  
  // Use localized Today boundaries
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
  }, []);
  const todayKey = useMemo(() => toLocalDateKey(today), [today]);
  
  const todayEnd = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
  }, []);

  const loadPageData = useCallback(async () => {
    const accountFilter = accountId === 'all' ? undefined : accountId;
    const [periodSnapshot, recentTransactions, todaySnapshot] = await Promise.all([
      getCashflowSnapshot(accountId, from, to),
      getTransactions({ accountId: accountFilter, limit: 5 }),
      today >= from && todayEnd <= to
        ? Promise.resolve(null)
        : getCashflowSummary(accountId, today, todayEnd),
    ]);

    const periodSummary = periodSnapshot.summary;
    const dailySummary = periodSnapshot.daily;
    const todayEntry = dailySummary.find((entry) => entry.date === todayKey);
    const todaySummary =
      todaySnapshot ??
      (todayEntry
        ? { in: todayEntry.in, out: todayEntry.out, net: todayEntry.in - todayEntry.out }
        : { in: 0, out: 0, net: 0 });

    setCashflow(periodSummary);
    setDailyData(dailySummary);
    setTransactions(recentTransactions);
    setTodayCashflow(todaySummary);
  }, [accountId, from, to, today, todayEnd, todayKey]);

  useEffect(() => {
    if (!isScreenFocused || !isSelected) return;
    loadPageData();
  }, [isScreenFocused, isSelected, loadPageData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    await loadPageData();
    setRefreshing(false);
  }, [loadPageData, onRefresh]);

  const viewData = buildCashflowChartData(period, dailyData, from, to, settingsYearStart);
  const maxVal = Math.max(...viewData.map((entry) => activeView === 'in' ? entry.in : entry.out), 1);
  const drilldownRanges = useMemo(
    () => buildCashflowDrilldownRanges(period, from, to, settingsYearStart),
    [from, period, settingsYearStart, to],
  );
  const openTodayActivity = useCallback(
    (kind: 'in' | 'out' | 'net') => {
      router.navigate({
        pathname: '/(tabs)/activity',
        params: {
          source: 'home-today',
          period: 'day',
          accountId: accountId === 'all' ? 'all' : accountId,
          type: 'all',
          cashflowBucket: kind,
          ts: String(Date.now()) } });
    },
    [accountId],
  );
  const openPeriodActivity = useCallback(
    (kind: 'in' | 'out' | 'net') => {
      router.navigate({
        pathname: '/(tabs)/activity',
        params: {
          source: 'home-period',
          period,
          accountId: accountId === 'all' ? 'all' : accountId,
          type: 'all',
          cashflowBucket: kind,
          from,
          to,
          ts: String(Date.now()) } });
    },
    [accountId, from, period, to],
  );

  const handleTransactionPress = useCallback((tx: Transaction) => {
    router.push({
      pathname: '/modals/add-transaction',
      params: { editId: tx.id }
    });
  }, []);

  const openSliceActivity = useCallback(
    (range: { from: string; to: string }, type: TransactionType | 'all') => {
      router.navigate({
        pathname: '/(tabs)/activity',
        params: {
          source: 'home-slice',
          period: 'custom',
          accountId: accountId === 'all' ? 'all' : accountId,
          type: 'all',
          cashflowBucket: type,
          from: range.from,
          to: range.to,
          ts: String(Date.now()) } });
    },
    [accountId],
  );

  return (
    <View style={{ flex: 1, height: pageHeight }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: HOME_LAYOUT.fabContentBottomPadding }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: HOME_SURFACE.heroTop, paddingBottom: HOME_SURFACE.heroBottom }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: HOME_SPACE.lg }}>
              <Text style={{ fontSize: HOME_TEXT.heroLabel, color: palette.text, fontWeight: '700' }}>
                {accountId === 'all' ? 'All Accounts' : accountName}
              </Text>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 2 }}>Current Balance</Text>
            </View>
            <Text
              style={{
                fontSize: HOME_TEXT.heroValue,
                lineHeight: 36,
                fontWeight: '600',
                color: palette.text,
                textAlign: 'right',
                flexShrink: 1 }}
            >
              {totalBalance < 0 ? '-' : ''}{formatCurrency(Math.abs(totalBalance), currencySymbol)}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: palette.borderSoft, marginTop: HOME_SURFACE.heroDividerTop, marginBottom: HOME_SURFACE.heroDividerBottom }} />
        </View>

        <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text }}>
              {formatDate(today)}
            </Text>
            <InlineDot size={3} color={palette.todayDot} />
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text }}>Today</Text>
          </View>
          <SummaryCard
            cashflow={todayCashflow}
            sym={currencySymbol}
            palette={palette}
            onPressCategory={openTodayActivity}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 6 }}>
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text, marginRight: 12 }}>
              This
            </Text>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                backgroundColor: palette.card,
                borderRadius: HOME_RADIUS.tab,
                overflow: 'hidden' }}
            >
              {PERIODS.map((value) => (
                <TouchableOpacity delayPressIn={0}
                  key={value}
                  onPress={
                    value === 'custom'
                      ? () => {
                        setPeriod('custom');
                        onOpenCustomRange();
                      }
                      : () => setPeriod(value)
                  }
                  style={{
                    flex: 1,
                    height: HOME_LAYOUT.periodHeight,
                    paddingHorizontal: CARD_PADDING,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: period === value
                      ? palette.brandSoft
                      : 'transparent' }}
                >
                  <Text
                    style={{
                      fontSize: HOME_TEXT.caption,
                      fontWeight: period === value ? '700' : '600',
                      textAlign: 'center',
                      textAlignVertical: 'center',
                      includeFontPadding: false,
                      color: period === value
                        ? palette.brand
                        : palette.textMuted }}
                  >
                    {PERIOD_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 14 }}>
            {formatDate(from)} — {formatDate(to)}
          </Text>

          <SummaryCard
            cashflow={cashflow}
            sym={currencySymbol}
            palette={palette}
            onPressCategory={openPeriodActivity}
          />

          <View
            style={{
              backgroundColor: palette.card,
              borderRadius: HOME_RADIUS.card,
              paddingHorizontal: CARD_PADDING,
              paddingTop: HOME_SURFACE.cardPaddingY,
              paddingBottom: HOME_SURFACE.cardPaddingBottom,
              marginBottom: HOME_SURFACE.chartCardBottom }}
          >
            <TouchableOpacity delayPressIn={0}
              onPress={() => setShowViewPicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: HOME_SURFACE.panelHeaderGap,
                gap: 6 }}
            >
              <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>
                {activeView === 'out' ? 'Outflows' : activeView === 'in' ? 'Inflows' : 'Cashflow'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={palette.textMuted} />
            </TouchableOpacity>

            {activeView === 'table' ? (
              <View style={{ flexDirection: 'row' }}>
                {/* Left Fixed Column: Period */}
                <View style={{ width: 45 }}>
                  <View style={{ borderBottomWidth: 1, borderBottomColor: palette.borderSoft, paddingBottom: HOME_SURFACE.tableHeaderPaddingBottom, marginBottom: HOME_SURFACE.panelSubheaderGap }}>
                    <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted, textAlign: 'center' }}>
                      Period
                    </Text>
                  </View>
                  <ScrollView
                    ref={leftScrollRef}
                    style={{ maxHeight: 310 }}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={false} // Synced by right scroll
                  >
                    {viewData.map((row, i) => (
                      <View
                        key={i}
                        style={{
                            height: HOME_SURFACE.tableRowHeight,
                          justifyContent: 'center',
                          borderBottomWidth: i === viewData.length - 1 ? 0 : 0.6,
                          borderBottomColor: palette.borderSoft }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{ width: 45, fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text, opacity: 0.85, textAlign: 'center' }}
                        >
                          {row.label}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                {/* Right Scrollable Data: Inflow, Outflow, Net */}
                <GestureScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  disallowInterruption={true}
                  style={{ flex: 1 }}
                >
                  <View>
                    <View
                      style={{
                        flexDirection: 'row',
                        borderBottomWidth: 1,
                        borderBottomColor: palette.borderSoft,
                        paddingBottom: HOME_SURFACE.tableHeaderPaddingBottom,
                        marginBottom: HOME_SURFACE.panelSubheaderGap }}
                    >
                      <Text style={{ width: 95, fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted, textAlign: 'center', marginLeft: HOME_SURFACE.tableColumnGap }}>Inflow</Text>
                      <Text style={{ width: 95, fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted, textAlign: 'center', marginLeft: HOME_SURFACE.tableColumnGap }}>Outflow</Text>
                      <Text style={{ width: 95, fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted, textAlign: 'center', marginLeft: HOME_SURFACE.tableColumnGap }}>Net</Text>
                    </View>
                    <ScrollView
                      ref={rightScrollRef}
                      style={{ maxHeight: 310 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      onScroll={handleSyncScroll}
                      scrollEventThrottle={16}
                    >
                      {viewData.map((row, i) => (
                        <View
                          key={i}
                        style={{
                          flexDirection: 'row',
                          paddingVertical: HOME_SURFACE.cardPaddingY,
                          height: HOME_SURFACE.tableRowHeight,
                          borderBottomWidth: i === viewData.length - 1 ? 0 : 0.6,
                          borderBottomColor: palette.borderSoft,
                          alignItems: 'center' }}
                        >
                          <TouchableOpacity delayPressIn={0}
                            activeOpacity={0.75}
                            onPress={() => openSliceActivity(drilldownRanges[i] ?? { from, to }, 'in')}
                            style={{ width: 95, marginLeft: 12 }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{ fontSize: HOME_TEXT.body, fontWeight: '500', color: palette.text, opacity: 0.85, textAlign: 'right' }}
                            >
                              {row.in > 0 ? formatIndianNumberStr(String(row.in)) : '-'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity delayPressIn={0}
                            activeOpacity={0.75}
                            onPress={() => openSliceActivity(drilldownRanges[i] ?? { from, to }, 'out')}
                            style={{ width: 95, marginLeft: 12 }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{ fontSize: HOME_TEXT.body, fontWeight: '500', color: palette.text, opacity: 0.85, textAlign: 'right' }}
                            >
                              {row.out > 0 ? formatIndianNumberStr(String(row.out)) : '-'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity delayPressIn={0}
                            activeOpacity={0.75}
                            onPress={() => openSliceActivity(drilldownRanges[i] ?? { from, to }, 'all')}
                            style={{ width: 95, marginLeft: 12 }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: HOME_TEXT.body,
                                fontWeight: '600',
                                color: row.net > 0 ? palette.brand : row.net < 0 ? palette.negative : palette.text,
                                opacity: row.net === 0 ? 0.85 : 1,
                                textAlign: 'right' }}
                            >
                              {row.net !== 0 ? formatIndianNumberStr(String(Math.abs(row.net))) : '-'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                </GestureScrollView>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: HOME_LAYOUT.chartHeight, paddingHorizontal: 2 }}>
                {viewData.length > 0
                  ? viewData.map((entry, index) => {
                    const amount = activeView === 'in' ? entry.in : entry.out;
                    return (
                      <TouchableOpacity delayPressIn={0}
                        key={`${entry.label}-${index}`}
                        activeOpacity={0.75}
                        onPress={() =>
                          openSliceActivity(
                            drilldownRanges[index] ?? { from, to },
                            activeView === 'in' ? 'in' : 'out',
                          )
                        }
                        style={{ flex: 1, alignItems: 'center' }}
                      >
                        <View
                          style={{
                            width: 14,
                            backgroundColor: activeView === 'in' ? palette.brand : palette.negative,
                            borderRadius: HOME_RADIUS.chartBar,
                            opacity: amount > 0 ? 0.88 : 0.2,
                            height: Math.max(4, (amount / maxVal) * HOME_LAYOUT.chartBarHeight) }}
                        />
                        <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textSoft, marginTop: 8 }}>
                          {entry.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                  : ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                    <View key={`${day}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
                      <View
                        style={{
                          width: 10,
                          height: 4,
                          backgroundColor: index === 0 ? palette.heroBar : palette.chartBarMuted,
                          borderRadius: HOME_RADIUS.full }}
                      />
                      <Text
                        style={{
                          fontSize: HOME_TEXT.tiny,
                          color: index === 0 ? palette.text : palette.textMuted,
                          marginTop: 8,
                          fontWeight: index === 0 ? '700' : '500' }}
                      >
                        {day}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
          </View>

          <View style={{ backgroundColor: palette.card, borderRadius: HOME_RADIUS.card, paddingTop: HOME_SURFACE.cardPaddingY, paddingBottom: 4, marginBottom: HOME_SPACE.pageBottom }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: HOME_SPACE.sm,
                paddingHorizontal: CARD_PADDING }}
            >
              <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>Recent</Text>
              <TouchableOpacity delayPressIn={0}
                onPress={() =>
                  router.navigate({
                    pathname: '/(tabs)/activity',
                    params: {
                      source: 'home-view-all',
                      accountId: accountId === 'all' ? 'all' : accountId,
                      ts: String(Date.now()) } })
                }
              >
                <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.brand, fontWeight: '600' }}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
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
                  return (
                    <TransactionListItem
                      key={transaction.id}
                    tx={transaction}
                    sym={currencySymbol}
                    palette={palette}
                    isLast={index === transactions.length - 1}
                    categoryName={transaction.categoryId ? getCategoryDisplayName(transaction.categoryId) : undefined}
                    onPress={handleTransactionPress}
                  />
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </ScrollView>

      {showViewPicker && (
        <BottomSheet
          title="Select Chart"
          palette={palette}
          onClose={() => setShowViewPicker(false)}
          hasNavBar
        >
          {(['in', 'out', 'table'] as const).map((view, index) => (
            <ChoiceRow
              key={view}
              title={view === 'in' ? 'Inflows' : view === 'out' ? 'Outflows' : 'Cashflow'}
              subtitle={
                view === 'in'
                  ? 'Money coming in by category'
                  : view === 'out'
                    ? 'Money going out by category'
                    : 'Summary of cashflow'
              }
              selected={activeView === view}
              palette={palette}
              onPress={() => {
                setActiveView(view);
                setShowViewPicker(false);
              }}
              noBorder={index === 2}
            />
          ))}
        </BottomSheet>
      )}
    </View>
  );
});

function addDays(date: Date, amount: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function getDaysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / msPerDay));
}

function buildCashflowDrilldownRanges(
  period: PeriodType,
  fromIso: string,
  toIso: string,
  yearStart: number,
): { from: string; to: string }[] {
  const fromDate = new Date(fromIso);
  const toDate = new Date(toIso);

  if (period === 'week') {
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(fromDate, index);
      return { from: toLocalDayStartISO(day), to: toLocalDayEndISO(day) };
    });
  }

  if (period === 'month') {
    const monthStart = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    return Array.from({ length: 5 }, (_, index) => {
      const bucketStart = addDays(monthStart, index * 7);
      const bucketEnd = addDays(bucketStart, 6);
      const boundedStart = bucketStart < fromDate ? fromDate : bucketStart;
      const boundedEnd = bucketEnd > toDate ? toDate : bucketEnd;
      return { from: toLocalDayStartISO(boundedStart), to: toLocalDayEndISO(boundedEnd) };
    });
  }

  if (period === 'year') {
    const fiscalStartYear = fromDate.getMonth() >= yearStart ? fromDate.getFullYear() : fromDate.getFullYear() - 1;
    const fiscalStart = new Date(fiscalStartYear, yearStart, 1);
    return Array.from({ length: 12 }, (_, index) => {
      const monthStart = new Date(fiscalStart.getFullYear(), fiscalStart.getMonth() + index, 1);
      const monthEnd = new Date(fiscalStart.getFullYear(), fiscalStart.getMonth() + index + 1, 0);
      const boundedStart = monthStart < fromDate ? fromDate : monthStart;
      const boundedEnd = monthEnd > toDate ? toDate : monthEnd;
      return { from: toLocalDayStartISO(boundedStart), to: toLocalDayEndISO(boundedEnd) };
    });
  }

  const totalDays = getDaysBetween(fromIso, toIso) + 1;
  if (totalDays <= 14) {
    return Array.from({ length: totalDays }, (_, index) => {
      const day = addDays(fromDate, index);
      return { from: toLocalDayStartISO(day), to: toLocalDayEndISO(day) };
    });
  }

  const bucketsCount = totalDays <= 60 ? Math.min(5, Math.ceil(totalDays / 7)) : 12;
  const step = totalDays <= 60 ? 7 : 30;

  return Array.from({ length: bucketsCount }, (_, index) => {
    const bucketStart = addDays(fromDate, index * step);
    const bucketEnd = addDays(bucketStart, step - 1);
    const boundedStart = bucketStart < fromDate ? fromDate : bucketStart;
    const boundedEnd = bucketEnd > toDate ? toDate : bucketEnd;
    return { from: toLocalDayStartISO(boundedStart), to: toLocalDayEndISO(boundedEnd) };
  });
}
