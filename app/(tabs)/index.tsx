import { Ionicons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountTabBar } from '../../components/AccountTabBar';
import { SummaryCard } from '../../components/SummaryCard';
import { TransactionItem as TransactionRow } from '../../components/TransactionItem';
import { InlineDot } from '../../components/ui/InlineDot';
import { formatDate, getDateRange, todayUTC } from '../../lib/dateUtils';
import { buildSpendingChartData, formatCurrency, getTotalBalance } from '../../lib/derived';
import { HOME_COLORS, HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../lib/homeTokens';
import { getCashflowSummary, getDailySpending } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import type {
  CashflowSummary,
  DailySpending,
  PeriodType,
  Transaction,
} from '../../types';

const PERIODS: PeriodType[] = ['week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<PeriodType, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom',
};

type AccountTab = {
  id: string | 'all';
  name: string;
};

export default function HomeScreen() {
  const { accounts, refresh: refreshAccounts } = useAccountsStore();
  const { settings } = useUIStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customRangeFrom, setCustomRangeFrom] = useState(() => todayUTC());
  const [customRangeTo, setCustomRangeTo] = useState(() => todayUTC());
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());

  const displayAccounts: AccountTab[] = [{ id: 'all', name: 'All' }, ...accounts.map((a) => ({ id: a.id, name: a.name }))];
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [pagerHeight, setPagerHeight] = useState(0);

  useEffect(() => {
    if (
      selectedAccountId !== 'all' &&
      !accounts.some((account) => account.id === selectedAccountId)
    ) {
      setSelectedAccountId('all');
    }
  }, [accounts, selectedAccountId]);

  const selectedIndex = Math.max(
    0,
    displayAccounts.findIndex((account) => account.id === selectedAccountId),
  );

  const handleTabPress = useCallback(
    (index: number) => {
      const next = displayAccounts[index];
      if (!next) return;
      setSelectedAccountId(next.id);
      pagerRef.current?.scrollTo({ x: index * width, animated: true });
    },
    [displayAccounts, width],
  );

  const handlePagerEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
      const next = displayAccounts[nextIndex];
      if (next && next.id !== selectedAccountId) {
        setSelectedAccountId(next.id);
      }
    },
    [displayAccounts, selectedAccountId, width],
  );

  useEffect(() => {
    pagerRef.current?.scrollTo({ x: selectedIndex * width, animated: false });
  }, [selectedIndex, width]);

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
        onValueChange: (_event, selected) => {
          if (!selected) return;
          if (stage === 'from') {
            setCustomDraftFrom(selected);
            if (selected > customDraftTo) {
              setCustomDraftTo(selected);
            }
          } else {
            setCustomDraftTo(selected < customDraftFrom ? customDraftFrom : selected);
          }
        },
        onDismiss: () => { },
      });
    },
    [customDraftFrom, customDraftTo],
  );

  const handleCustomRangeDone = useCallback(() => {
    const fromDate = customDraftFrom <= customDraftTo ? customDraftFrom : customDraftTo;
    const toDate = customDraftTo >= customDraftFrom ? customDraftTo : customDraftFrom;
    setCustomDraftFrom(fromDate);
    setCustomDraftTo(toDate);
    setCustomRangeFrom(fromDate.toISOString());
    setCustomRangeTo(toDate.toISOString());
    setCustomRangeOpen(false);
  }, [customDraftFrom, customDraftTo]);

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: HOME_COLORS.background }}
    >
      <AccountTabBar
        accounts={displayAccounts}
        selectedId={selectedAccountId}
        externalScrollX={scrollX}
        onSelect={(id) => {
          const index = displayAccounts.findIndex((a) => a.id === id);
          handleTabPress(index);
        }}
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
          onMomentumScrollEnd={handlePagerEnd}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            {
              useNativeDriver: false,
            },
          )}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {displayAccounts.map((account) => (
            <View key={account.id} style={{ width, height: pagerHeight || undefined }}>
              <HomeAccountPage
                pageHeight={pagerHeight}
                accountId={account.id}
                accountName={account.name}
                settingsYearStart={settings.yearStart}
                currencySymbol={settings.currencySymbol}
                customRange={{ from: new Date(customRangeFrom), to: new Date(customRangeTo) }}
                onOpenCustomRange={openCustomRange}
                totalBalance={
                  account.id === 'all'
                    ? getTotalBalance(accounts)
                    : (accounts.find((item) => item.id === account.id)?.balance ?? 0)
                }
                onRefresh={refreshAccounts}
                isSelected={account.id === selectedAccountId}
              />
            </View>
          ))}
        </Animated.ScrollView>
      </View>

      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: '/modals/add-transaction',
            params: selectedAccountId === 'all' ? undefined : { accountId: selectedAccountId },
          })
        }
        style={{
          position: 'absolute',
          bottom: Math.max(0, insets.bottom - 24),
          right: 24,
          width: HOME_LAYOUT.fabSize,
          height: HOME_LAYOUT.fabSize,
          borderRadius: HOME_RADIUS.fab,
          backgroundColor: HOME_COLORS.active,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000000',
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={28} color={HOME_COLORS.surface} />
      </TouchableOpacity>

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
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <Pressable
            onPress={() => { }}
            style={{
              backgroundColor: HOME_COLORS.surface,
              borderRadius: HOME_RADIUS.large,
              padding: HOME_SPACE.xxl,
            }}
          >
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: HOME_COLORS.text, marginBottom: 8 }}>
              Custom range
            </Text>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: HOME_COLORS.textMuted, marginBottom: 16 }}>
              Pick the from and to dates for this range.
            </Text>
            <View style={{ gap: HOME_SPACE.md, marginBottom: HOME_SPACE.lg }}>
              <TouchableOpacity
                onPress={() => openDatePicker('from')}
                style={{
                  borderWidth: 1,
                  borderColor: HOME_COLORS.divider,
                  borderRadius: HOME_RADIUS.card,
                  paddingHorizontal: HOME_SPACE.lg,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ fontSize: HOME_TEXT.caption, color: HOME_COLORS.textMuted, marginBottom: 4 }}>From</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: HOME_COLORS.text }}>
                  {formatDate(customDraftFrom.toISOString())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openDatePicker('to')}
                style={{
                  borderWidth: 1,
                  borderColor: HOME_COLORS.divider,
                  borderRadius: HOME_RADIUS.card,
                  paddingHorizontal: HOME_SPACE.lg,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ fontSize: HOME_TEXT.caption, color: HOME_COLORS.textMuted, marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: HOME_COLORS.text }}>
                  {formatDate(customDraftTo.toISOString())}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md, marginTop: HOME_SPACE.lg }}>
              <TouchableOpacity
                onPress={() => setCustomRangeOpen(false)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: HOME_RADIUS.tab,
                  backgroundColor: HOME_COLORS.divider,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: HOME_COLORS.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCustomRangeDone}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: HOME_RADIUS.tab,
                  backgroundColor: HOME_COLORS.active,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: HOME_COLORS.surface }}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function HomeAccountPage({
  pageHeight,
  accountId,
  accountName,
  settingsYearStart,
  currencySymbol,
  customRange,
  onOpenCustomRange,
  totalBalance,
  onRefresh,
  isSelected,
}: {
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
  const [period, setPeriod] = useState<PeriodType>('week');
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [todayCashflow, setTodayCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [dailyData, setDailyData] = useState<DailySpending[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const { from, to } = getDateRange(
    period,
    settingsYearStart,
    customRange ? customRange.from.toISOString() : undefined,
    customRange ? customRange.to.toISOString() : undefined,
  );
  const today = todayUTC();

  const loadPageData = useCallback(async () => {
    const accountFilter = accountId === 'all' ? undefined : accountId;
    const [periodSummary, dailySummary, recentTransactions, todaySummary] = await Promise.all([
      getCashflowSummary(accountId, from, to),
      getDailySpending(accountId, from, to),
      getTransactions({ accountId: accountFilter, limit: 5 }),
      getCashflowSummary(accountId, today, today),
    ]);

    setCashflow(periodSummary);
    setDailyData(dailySummary);
    setTransactions(recentTransactions);
    setTodayCashflow(todaySummary);
  }, [accountId, from, to, today]);

  useEffect(() => {
    if (!isSelected) return;
    loadPageData();
  }, [isSelected, loadPageData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    await loadPageData();
    setRefreshing(false);
  }, [loadPageData, onRefresh]);

  const chartPoints = buildSpendingChartData(period, dailyData, from, to, settingsYearStart);
  const maxSpend = Math.max(...chartPoints.map((entry) => entry.amount), 1);

  return (
    <View style={{ flex: 1, height: pageHeight }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={{ paddingHorizontal: HOME_SPACE.screen, paddingTop: 14, paddingBottom: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 18 }}>
              <Text style={{ fontSize: HOME_TEXT.heroLabel, color: HOME_COLORS.text, fontWeight: '700' }}>
                {accountId === 'all' ? 'All Accounts' : accountName}
              </Text>
              <Text style={{ fontSize: HOME_TEXT.caption, color: HOME_COLORS.textMuted, marginTop: 2 }}>Current Balance</Text>
            </View>
            <Text
              style={{
                fontSize: HOME_TEXT.heroValue,
                lineHeight: 36,
                fontWeight: '700',
                color: HOME_COLORS.text,
                textAlign: 'right',
                flexShrink: 1,
              }}
            >
              {formatCurrency(totalBalance, currencySymbol)}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: HOME_COLORS.borderSoft, marginTop: 18, marginBottom: 14 }} />
        </View>

        <View style={{ paddingHorizontal: HOME_SPACE.screen }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: HOME_COLORS.text }}>
              {formatDate(today)}
            </Text>
            <InlineDot size={3} color={HOME_COLORS.todayDot} />
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: HOME_COLORS.text }}>Today</Text>
          </View>
          <SummaryCard cashflow={todayCashflow} sym={currencySymbol} />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 6 }}>
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: HOME_COLORS.text, marginRight: 12 }}>
              This
            </Text>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                backgroundColor: HOME_COLORS.surface,
                borderRadius: HOME_RADIUS.tab,
                overflow: 'hidden',
              }}
            >
              {PERIODS.map((value) => (
                <TouchableOpacity
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
                    paddingHorizontal: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: period === value ? HOME_COLORS.heroBar : HOME_COLORS.surface,
                    borderLeftWidth: value === 'week' ? 0 : 1,
                    borderLeftColor: HOME_COLORS.divider,
                  }}
                >
                  <Text
                    style={{
                      fontSize: HOME_TEXT.bodySmall,
                      fontWeight: '500',
                      lineHeight: 13,
                      textAlignVertical: 'center',
                      includeFontPadding: false,
                      color: period === value ? HOME_COLORS.surface : HOME_COLORS.textMuted,
                    }}
                  >
                    {PERIOD_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={{ fontSize: HOME_TEXT.caption, color: HOME_COLORS.textMuted, marginBottom: 10 }}>
            {formatDate(from)} — {formatDate(to)}
          </Text>

          <SummaryCard cashflow={cashflow} sym={currencySymbol} />

          <View
            style={{
              backgroundColor: HOME_COLORS.surface,
              borderRadius: HOME_RADIUS.card,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 10,
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: HOME_COLORS.text, marginBottom: 18 }}>
              Spending
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: HOME_LAYOUT.chartHeight, paddingHorizontal: 2 }}>
              {chartPoints.length > 0
                ? chartPoints.map((entry, index) => (
                  <View key={`${entry.label}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 14,
                        backgroundColor: HOME_COLORS.chartBar,
                        borderRadius: HOME_RADIUS.chartBar,
                        opacity: entry.amount > 0 ? 0.88 : 0.2,
                        height: Math.max(4, (entry.amount / maxSpend) * HOME_LAYOUT.chartBarHeight),
                      }}
                    />
                    <Text style={{ fontSize: HOME_TEXT.tiny, color: HOME_COLORS.textSoft, marginTop: 8 }}>
                      {entry.label}
                    </Text>
                  </View>
                ))
                : ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                  <View key={`${day}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 10,
                        height: 4,
                        backgroundColor: index === 0 ? HOME_COLORS.heroBar : HOME_COLORS.chartBarMuted,
                        borderRadius: HOME_RADIUS.full,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: HOME_TEXT.tiny,
                        color: index === 0 ? HOME_COLORS.text : HOME_COLORS.textMuted,
                        marginTop: 8,
                        fontWeight: index === 0 ? '700' : '500',
                      }}
                    >
                      {day}
                    </Text>
                  </View>
                ))}
            </View>
          </View>

          <View style={{ backgroundColor: HOME_COLORS.surface, borderRadius: HOME_RADIUS.card, paddingTop: 14, paddingBottom: 4, marginBottom: HOME_SPACE.pageBottom }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                paddingHorizontal: 16,
              }}
            >
              <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: HOME_COLORS.text }}>Recent</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/activity')}>
                <Text style={{ fontSize: HOME_TEXT.bodySmall, color: HOME_COLORS.active, fontWeight: '600' }}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: 260 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              {transactions.length === 0 ? (
                <Text style={{ color: HOME_COLORS.textSoft, fontSize: HOME_TEXT.bodySmall, textAlign: 'center', paddingVertical: 16 }}>
                  No transactions yet
                </Text>
              ) : (
                transactions.map((transaction, index) => (
                  <TransactionRow
                    key={transaction.id}
                    tx={transaction}
                    sym={currencySymbol}
                    isLast={index === transactions.length - 1}
                  />
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
