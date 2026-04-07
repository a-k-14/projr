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
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { buildSpendingChartData, getTotalBalance, formatCurrency } from '../../lib/derived';
import { getDateRange, todayUTC, formatDate } from '../../lib/dateUtils';
import { getCashflowSummary, getDailySpending } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import type {
  PeriodType,
  Transaction,
  CashflowSummary,
  DailySpending,
} from '../../types';

const PERIODS: PeriodType[] = ['week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<PeriodType, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom',
};

const TAB_ACTIVE = '#183B2E';
const TAB_INACTIVE = '#B2B8C2';

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
  const tabStripRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customRangeFrom, setCustomRangeFrom] = useState(() => todayUTC());
  const [customRangeTo, setCustomRangeTo] = useState(() => todayUTC());
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const TAB_GAP = 8;
  const TAB_PADDING = 12;

  const displayAccounts: AccountTab[] = [{ id: 'all', name: 'All' }, ...accounts.map((a) => ({ id: a.id, name: a.name }))];
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [pagerHeight, setPagerHeight] = useState(0);
  const tabWidths = displayAccounts.map((account) =>
    Math.max(54, Math.min(118, 22 + account.name.length * 7)),
  );
  const tabOffsets = tabWidths.map((_, index) => {
    return tabWidths.slice(0, index).reduce((sum, widthValue) => sum + widthValue + TAB_GAP, 0);
  });
  const inputRange = displayAccounts.map((_, index) => index * width);
  const underlineTranslateX = scrollX.interpolate({
    inputRange,
    outputRange: tabOffsets,
    extrapolate: 'clamp',
  });
  const underlineWidth = scrollX.interpolate({
    inputRange,
    outputRange: tabWidths,
    extrapolate: 'clamp',
  });

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

  useEffect(() => {
    const currentOffset = tabOffsets[selectedIndex] ?? 0;
    const currentWidth = tabWidths[selectedIndex] ?? 54;
    const targetX = Math.max(
      0,
      currentOffset - (width - currentWidth) / 2 + TAB_PADDING,
    );
    tabStripRef.current?.scrollTo({ x: targetX, animated: true });
  }, [TAB_PADDING, selectedIndex, tabOffsets, tabWidths, width]);

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
        onDismiss: () => {},
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
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: '#F0F0F5' }}
    >
      <ScrollView
        ref={tabStripRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
          maxHeight: 52,
        }}
        contentContainerStyle={{ paddingHorizontal: 12 }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: TAB_PADDING,
            bottom: 0,
            height: 3,
            borderRadius: 999,
            backgroundColor: '#17673B',
            width: underlineWidth,
            transform: [
              {
                translateX: underlineTranslateX,
              },
            ],
          }}
        />
        {displayAccounts.map((account, index) => (
          <TouchableOpacity
            key={account.id}
            onPress={() => handleTabPress(index)}
            style={{
              minWidth: 54,
              maxWidth: 118,
              width: tabWidths[index],
              marginRight: TAB_GAP,
              paddingHorizontal: 8,
              paddingVertical: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: '100%', paddingHorizontal: 2 }}>
              <Animated.Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  fontSize: 15,
                  lineHeight: 18,
                  fontWeight: '500',
                  color: scrollX.interpolate({
                    inputRange:
                      index === 0
                        ? [0, width * 0.35, width * 0.8]
                        : [Math.max(0, (index - 1) * width), index * width, (index + 1) * width],
                    outputRange:
                      index === 0
                        ? [TAB_ACTIVE, TAB_ACTIVE, TAB_INACTIVE]
                        : [TAB_INACTIVE, TAB_ACTIVE, TAB_INACTIVE],
                    extrapolate: 'clamp',
                  }),
                }}
              >
                {account.name}
              </Animated.Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
        onPress={() => router.push('/modals/add-transaction')}
        style={{
          position: 'absolute',
          bottom: Math.max(0, insets.bottom - 24),
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#17673B',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000000',
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 6,
        }}
        >
        <Ionicons name="add" size={28} color="#FFFFFF" />
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
            onPress={() => {}}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 20,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2A44', marginBottom: 8 }}>
              Custom range
            </Text>
            <Text style={{ fontSize: 13, color: '#8C94AF', marginBottom: 16 }}>
              Pick the from and to dates for this range.
            </Text>
            <View style={{ gap: 12, marginBottom: 18 }}>
              <TouchableOpacity
                onPress={() => openDatePicker('from')}
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ fontSize: 12, color: '#8C94AF', marginBottom: 4 }}>From</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2A44' }}>
                  {formatDate(customDraftFrom.toISOString())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openDatePicker('to')}
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ fontSize: 12, color: '#8C94AF', marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2A44' }}>
                  {formatDate(customDraftTo.toISOString())}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
          <TouchableOpacity
            onPress={() => setCustomRangeOpen(false)}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 14,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2A44' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCustomRangeDone}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 14,
                  backgroundColor: '#17673B',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>Done</Text>
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
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={{ fontSize: 16, color: '#1F2A44', fontWeight: '700' }}>
                {accountId === 'all' ? 'All Accounts' : accountName}
              </Text>
              <Text style={{ fontSize: 12, color: '#8C94AF', marginTop: 4 }}>Current Balance</Text>
            </View>
            <Text
              style={{
                fontSize: 30,
                lineHeight: 36,
                fontWeight: '700',
                color: '#1F2A44',
                textAlign: 'right',
                flexShrink: 1,
              }}
            >
              {formatCurrency(totalBalance, currencySymbol)}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: '#D8DDE8', marginTop: 10 }} />
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2A44', marginBottom: 10 }}>
              {formatDate(today)} <InlineDot size={8} /> Today
            </Text>
          <SummaryCard cashflow={todayCashflow} sym={currencySymbol} />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2A44', marginRight: 12 }}>
              This
            </Text>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
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
                    height: 34,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: period === value ? '#202845' : '#FFFFFF',
                    borderLeftWidth: value === 'week' ? 0 : 1,
                    borderLeftColor: '#E5E7EB',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '500',
                      lineHeight: 16,
                      includeFontPadding: false,
                      color: period === value ? '#FFFFFF' : '#8C94AF',
                    }}
                  >
                    {PERIOD_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={{ fontSize: 12, color: '#8C94AF', marginBottom: 10 }}>
            {formatDate(from)} — {formatDate(to)}
          </Text>

          <SummaryCard cashflow={cashflow} sym={currencySymbol} />

          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 10,
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2A44', marginBottom: 18 }}>
              Spending
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 116, paddingHorizontal: 2 }}>
              {chartPoints.length > 0
                ? chartPoints.map((entry, index) => (
                    <View key={`${entry.label}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
                      <View
                        style={{
                          width: 14,
                          backgroundColor: '#17673B',
                          borderRadius: 6,
                          opacity: entry.amount > 0 ? 0.88 : 0.2,
                          height: Math.max(4, (entry.amount / maxSpend) * 74),
                        }}
                      />
                      <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8 }}>
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
                          backgroundColor: index === 0 ? '#202845' : '#D9DDE7',
                          borderRadius: 999,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 10,
                          color: index === 0 ? '#1F2A44' : '#8C94AF',
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

          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 32 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2A44' }}>Recent</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/activity')}>
                <Text style={{ fontSize: 13, color: '#17673B', fontWeight: '600' }}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: 260 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              {transactions.length === 0 ? (
                <Text style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>
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

function SummaryCard({
  cashflow,
  sym,
}: {
  cashflow: CashflowSummary;
  sym: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 18,
      }}
    >
      {(['in', 'out', 'net'] as const).map((key, index) => (
        <View
          key={key}
          style={{
            flex: 1,
            paddingVertical: 16,
            paddingHorizontal: 8,
            alignItems: 'center',
            borderLeftWidth: index === 0 ? 0 : 1,
            borderLeftColor: '#E5E7EB',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: '#8C94AF',
              marginBottom: 6,
              textTransform: 'capitalize',
            }}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: key === 'out' ? '#CC3B2D' : '#17673B',
            }}
          >
            {formatCurrency(cashflow[key], sym)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function InlineDot({ size = 8, color = '#8C94AF' }: { size?: number; color?: string }) {
  return (
    <Text
      style={{
        fontSize: size,
        lineHeight: size,
        color,
        fontWeight: '700',
      }}
    >
      •
    </Text>
  );
}

function TransactionRow({
  tx,
  sym,
  isLast,
}: {
  tx: Transaction;
  sym: string;
  isLast: boolean;
}) {
  const { getById } = useAccountsStore();
  const { getCategoryDisplayName } = useCategoriesStore();
  const account = getById(tx.accountId);

  const iconName =
    tx.type === 'in'
      ? 'arrow-down'
      : tx.type === 'out'
        ? 'arrow-up'
        : tx.type === 'transfer'
          ? 'swap-horizontal'
          : 'cash';

  const iconBg =
    tx.type === 'in'
      ? '#DCFCE7'
      : tx.type === 'out'
        ? '#FEE2E2'
        : '#F1F5F9';

  const iconColor =
    tx.type === 'in'
      ? '#16A34A'
      : tx.type === 'out'
        ? '#DC2626'
        : '#1E293B';

  const subtitle = [
    tx.categoryId ? getCategoryDisplayName(tx.categoryId) : null,
    account?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: '#F3F4F6',
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name={iconName as never} size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#0A0A0A' }} numberOfLines={1}>
          {tx.note ?? tx.type}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: tx.type === 'in' ? '#16A34A' : '#0A0A0A',
        }}
      >
        {formatCurrency(tx.amount, sym)}
      </Text>
    </View>
  );
}
