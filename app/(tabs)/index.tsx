import { Ionicons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountTabBar } from '../../components/AccountTabBar';
import { ChoiceRow } from '../../components/settings-ui';
import { SummaryCard } from '../../components/SummaryCard';
import { TransactionListItem } from '../../components/TransactionListItem';
import { FabButton } from '../../components/ui/FabButton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { InlineDot } from '../../components/ui/InlineDot';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { formatDate, getDateRange, todayUTC } from '../../lib/dateUtils';
import { buildCashflowChartData, formatCurrency, formatIndianNumberStr, getTotalBalance } from '../../lib/derived';
import { CARD_PADDING, SCREEN_GUTTER } from '../../lib/design';
import { HOME_LAYOUT, HOME_RADIUS, HOME_SHADOW, HOME_SPACE, HOME_TEXT } from '../../lib/homeTokens';
import { getThemePalette, resolveTheme, type AppThemePalette } from '../../lib/theme';
import { getCashflowSummary, getDailyCashflow } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import type {
  CashflowSummary,
  DailyCashflow,
  PeriodType,
  Transaction
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
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));
  const scrollX = useRef(new Animated.Value(0)).current;
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customRangeFrom, setCustomRangeFrom] = useState(() => todayUTC());
  const [customRangeTo, setCustomRangeTo] = useState(() => todayUTC());
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());

  const displayAccounts: AccountTab[] = [
    { id: 'all', name: 'All' },
    ...accounts.map((a) => ({ id: a.id, name: formatAccountDisplayName(a.name, a.accountNumber) })),
  ];
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
        display: 'calendar', // Material 3 Calendar
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
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      <AccountTabBar
        accounts={displayAccounts}
        selectedId={selectedAccountId}
        onSelect={(id) => {
          setSelectedAccountId(id);
          const i = displayAccounts.findIndex((a) => a.id === id);
          if (i !== -1) {
            pagerRef.current?.scrollTo({ x: i * width, animated: true });
          }
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
                palette={palette}
              />
            </View>
          ))}
        </Animated.ScrollView>
      </View>

      <FabButton
        bottom={Math.max(0, insets.bottom - 24)}
        palette={palette}
        onPress={() =>
          router.push({
            pathname: '/modals/add-transaction',
            params: selectedAccountId === 'all' ? undefined : { accountId: selectedAccountId },
          })
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
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <Pressable
            onPress={() => { }}
            style={{
              backgroundColor: palette.surface,
              borderRadius: HOME_RADIUS.large,
              padding: HOME_SPACE.xxl,
            }}
          >
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, marginBottom: 8 }}>
              Custom range
            </Text>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginBottom: 16 }}>
              Pick the from and to dates for this range.
            </Text>
            <View style={{ gap: HOME_SPACE.md, marginBottom: HOME_SPACE.lg }}>
              <TouchableOpacity
                onPress={() => openDatePicker('from')}
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: HOME_RADIUS.card,
                  paddingHorizontal: HOME_SPACE.lg,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>From</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
                  {formatDate(customDraftFrom.toISOString())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openDatePicker('to')}
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: HOME_RADIUS.card,
                  paddingHorizontal: HOME_SPACE.lg,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
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
                  backgroundColor: palette.divider,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCustomRangeDone}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: HOME_RADIUS.tab,
                  backgroundColor: palette.active,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.surface }}>Done</Text>
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
  palette,
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
  palette: AppThemePalette;
}) {
  const { getCategoryDisplayName } = useCategoriesStore();
  const [period, setPeriod] = useState<PeriodType>('week');
  const [activeView, setActiveView] = useState<'out' | 'in' | 'table'>('out');
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [todayCashflow, setTodayCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [dailyData, setDailyData] = useState<DailyCashflow[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showViewPicker, setShowViewPicker] = useState(false);

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
  const today = todayUTC();

  const loadPageData = useCallback(async () => {
    const accountFilter = accountId === 'all' ? undefined : accountId;
    const [periodSummary, dailySummary, recentTransactions, todaySummary] = await Promise.all([
      getCashflowSummary(accountId, from, to),
      getDailyCashflow(accountId, from, to),
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

  const viewData = buildCashflowChartData(period, dailyData, from, to, settingsYearStart);
  const maxVal = Math.max(...viewData.map((entry) => activeView === 'in' ? entry.in : entry.out), 1);

  return (
    <View style={{ flex: 1, height: pageHeight }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 14, paddingBottom: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 18 }}>
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
                flexShrink: 1,
              }}
            >
              {formatCurrency(totalBalance, currencySymbol)}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: palette.borderSoft, marginTop: 18, marginBottom: 14 }} />
        </View>

        <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text }}>
              {formatDate(today)}
            </Text>
            <InlineDot size={3} color={palette.todayDot} />
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text }}>Today</Text>
          </View>
          <SummaryCard cashflow={todayCashflow} sym={currencySymbol} palette={palette} />

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
                    paddingHorizontal: CARD_PADDING,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: period === value
                      ? 'rgba(23, 103, 59, 0.15)'
                      : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: period === value ? '700' : '600',
                      textAlign: 'center',
                      textAlignVertical: 'center',
                      includeFontPadding: false,
                      color: period === value
                        ? palette.active
                        : palette.textMuted,
                    }}
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

          <SummaryCard cashflow={cashflow} sym={currencySymbol} palette={palette} />

          <View
            style={{
              backgroundColor: palette.card,
              borderRadius: HOME_RADIUS.card,
              paddingHorizontal: CARD_PADDING,
              paddingTop: 14,
              paddingBottom: 10,
              marginBottom: 14,
            }}
          >
            <TouchableOpacity
              onPress={() => setShowViewPicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 18,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>
                {activeView === 'out' ? 'Outflows' : activeView === 'in' ? 'Inflows' : 'Cashflow Table'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={palette.textMuted} />
            </TouchableOpacity>

            {activeView === 'table' ? (
              <View style={{ flexDirection: 'row' }}>
                {/* Left Fixed Column: Period */}
                <View style={{ width: 45 }}>
                  <View style={{ borderBottomWidth: 1, borderBottomColor: palette.borderSoft, paddingBottom: 10, marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textMuted, textAlign: 'center' }}>
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
                          height: 52, // 14*2 + fontSize + padding
                          justifyContent: 'center',
                          borderBottomWidth: i === viewData.length - 1 ? 0 : 0.6,
                          borderBottomColor: palette.borderSoft,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{ width: 45, fontSize: 14, fontWeight: '600', color: palette.text, opacity: 0.85, textAlign: 'center' }}
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
                        paddingBottom: 10,
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{ width: 95, fontSize: 13, fontWeight: '700', color: palette.textMuted, textAlign: 'center', marginLeft: 12 }}>Inflow</Text>
                      <Text style={{ width: 95, fontSize: 13, fontWeight: '700', color: palette.textMuted, textAlign: 'center', marginLeft: 12 }}>Outflow</Text>
                      <Text style={{ width: 95, fontSize: 13, fontWeight: '700', color: palette.textMuted, textAlign: 'center', marginLeft: 12 }}>Net</Text>
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
                            paddingVertical: 14, // Adjusted from 18 to 14 to stabilize height
                            height: 52,
                            borderBottomWidth: i === viewData.length - 1 ? 0 : 0.6,
                            borderBottomColor: palette.borderSoft,
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={{ width: 95, fontSize: 14, fontWeight: '500', color: palette.text, opacity: 0.85, textAlign: 'right', marginLeft: 12 }}
                          >
                            {row.in > 0 ? formatIndianNumberStr(String(row.in)) : '-'}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{ width: 95, fontSize: 14, fontWeight: '500', color: palette.text, opacity: 0.85, textAlign: 'right', marginLeft: 12 }}
                          >
                            {row.out > 0 ? formatIndianNumberStr(String(row.out)) : '-'}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{
                              width: 95,
                              fontSize: 14,
                              fontWeight: '600',
                              color: row.net > 0 ? palette.active : row.net < 0 ? palette.negative : palette.text,
                              opacity: row.net === 0 ? 0.85 : 1,
                              textAlign: 'right',
                              marginLeft: 12
                            }}
                          >
                            {row.net !== 0 ? formatIndianNumberStr(String(row.net)) : '-'}
                          </Text>
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
                      <View key={`${entry.label}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
                        <View
                          style={{
                            width: 14,
                            backgroundColor: activeView === 'in' ? palette.active : palette.negative,
                            borderRadius: HOME_RADIUS.chartBar,
                            opacity: amount > 0 ? 0.88 : 0.2,
                            height: Math.max(4, (amount / maxVal) * HOME_LAYOUT.chartBarHeight),
                          }}
                        />
                        <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textSoft, marginTop: 8 }}>
                          {entry.label}
                        </Text>
                      </View>
                    );
                  })
                  : ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                    <View key={`${day}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
                      <View
                        style={{
                          width: 10,
                          height: 4,
                          backgroundColor: index === 0 ? palette.heroBar : palette.chartBarMuted,
                          borderRadius: HOME_RADIUS.full,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: HOME_TEXT.tiny,
                          color: index === 0 ? palette.text : palette.textMuted,
                          marginTop: 8,
                          fontWeight: index === 0 ? '700' : '500',
                        }}
                      >
                        {day}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
          </View>

          <View style={{ backgroundColor: palette.card, borderRadius: HOME_RADIUS.card, paddingTop: 14, paddingBottom: 4, marginBottom: HOME_SPACE.pageBottom }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                paddingHorizontal: CARD_PADDING,
              }}
            >
              <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>Recent</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/activity')}>
                <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.active, fontWeight: '600' }}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: 260 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              {transactions.length === 0 ? (
                <Text style={{ color: palette.textSoft, fontSize: HOME_TEXT.bodySmall, textAlign: 'center', paddingVertical: 16 }}>
                  No transactions yet
                </Text>
              ) : (
                transactions.map((transaction, index) => (
                  <TransactionListItem
                    key={transaction.id}
                    tx={transaction}
                    sym={currencySymbol}
                    isLast={index === transactions.length - 1}
                    padding={10}
                    iconSize={36}
                    categoryName={transaction.categoryId ? getCategoryDisplayName(transaction.categoryId) : undefined}
                    palette={palette}
                  />
                ))
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
              title={view === 'in' ? 'Inflows' : view === 'out' ? 'Outflows' : 'Cashflow Table'}
              subtitle={
                view === 'in'
                  ? 'Money coming in by category'
                  : view === 'out'
                    ? 'Money going out by category'
                    : 'Summary table of cashflow'
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
}
