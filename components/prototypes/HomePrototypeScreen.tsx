import { AppIcon, isValidIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { FabButton } from '@/components/ui/FabButton';
import { formatAccountDisplayName } from '@/lib/account-utils';
import { formatDate, getDateRange } from '@/lib/dateUtils';
import {
  formatCurrency,
  getTransactionCashflowImpact,
} from '@/lib/derived';
import { HOME_LAYOUT, HOME_RADIUS, HOME_TEXT, getFabBottomOffset } from '@/lib/layoutTokens';
import { getPrototypeCategoryColor } from '@/lib/prototypeCategoryColors';
import { getTransactions } from '@/services/transactions';
import { useAccountsStore } from '@/stores/useAccountsStore';
import { HomeDonutChartBlock } from '../HomeDonutChartBlock';
import { useCategoriesStore } from '@/stores/useCategoriesStore';
import { useUIStore } from '@/stores/useUIStore';
import type { Category, PeriodType, Transaction } from '@/types';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLoansStore } from '@/stores/useLoansStore';
import Svg, { G, Path } from 'react-native-svg';
import type { TabResetMode } from '@/lib/tabResetRegistry';

type Mode = 'expense' | 'income';
type AccountSurfaceTab = {
  id: string | 'all';
  name: string;
  subtitle: string;
};
const lightTheme = {
  bg: '#F5F7FB',
  card: '#FFFFFF',
  surface: '#EEF2F8',
  surfaceStrong: '#F2F5FA',
  inputBg: '#FFFFFF',
  progressTrack: '#DDE4F0',
  border: '#DFE5EF',
  text: '#15213E',
  muted: '#7C8498',
  accent: '#4F46E5',
  positive: '#047857',
  negative: '#A11C1C',
  shadow: '#4F46E5',
};
const HOME_FAB_COLOR = '#24324F';

const UNCATEGORIZED_ICON = ':o';

function formatMetricValue(value: number, currencySymbol: string) {
  return value === 0 ? '—' : formatCurrency(Math.abs(value), currencySymbol);
}

function getMetricColor(value: number, activeColor: string, neutralColor: string) {
  return value === 0 ? neutralColor : activeColor;
}

function categoryPathForTx(tx: Transaction, categoriesById: Map<string, Category>) {
  const category = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
  const parent = category?.parentId ? categoriesById.get(category.parentId) : undefined;
  if (parent && category) {
    return {
      topLabel: parent.name,
      subLabel: category.name,
      display: `${parent.name} > ${category.name}`,
      icon: category.icon || parent.icon || 'tag',
      color: category.color || parent.color,
    };
  }
  if (category) {
    return {
      topLabel: category.name,
      subLabel: null,
      display: category.name,
      icon: category.icon || UNCATEGORIZED_ICON,
      color: category.color,
    };
  }
  return {
    topLabel: 'Uncategorized',
    subLabel: null,
    display: 'Uncategorized',
    icon: UNCATEGORIZED_ICON,
    color: undefined,
  };
}

function HomeIconBadge({
  icon,
  color,
  size = 36,
}: {
  icon?: string;
  color?: string;
  size?: number;
}) {
  const isEmoji = icon ? !/^[a-z-]+$/.test(icon) : false;
  const iconSize = Math.floor(size * 0.47);
  return (
    <View style={[styles.iconBadge, { width: size, height: size, borderRadius: Math.round(size * 0.3) }]}>
      {icon && isEmoji ? (
        <Text style={{ fontSize: Math.round(size * 0.48) }}>{icon}</Text>
      ) : icon && isValidIcon(icon) ? (
        <AppIcon name={icon} size={iconSize} color={color || lightTheme.text} />
      ) : (
        <Text style={{ fontSize: Math.round(size * 0.34), fontWeight: '700' }}>{UNCATEGORIZED_ICON}</Text>
      )}
    </View>
  );
}

function HomeSegmentedControl({
  options,
  value,
  onChange,
  theme,
  width,
}: {
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (key: string) => void;
  theme: typeof lightTheme;
  width?: number | '100%';
}) {
  const [controlWidth, setControlWidth] = useState(0);
  const indicatorLeft = useRef(new Animated.Value(0)).current;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.key === value));
  const segmentWidth = controlWidth > 0 ? controlWidth / options.length : 0;

  useEffect(() => {
    if (segmentWidth <= 0) return;
    Animated.timing(indicatorLeft, {
      toValue: selectedIndex * segmentWidth,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [indicatorLeft, selectedIndex, segmentWidth]);

  return (
    <View
      onStartShouldSetResponder={() => true}
      onLayout={(event: LayoutChangeEvent) => setControlWidth(event.nativeEvent.layout.width)}
      style={[
        styles.segmentedControl,
        {
          backgroundColor: theme.surface,
          borderColor: '#CBD5E1',
          width: width ?? '100%',
        },
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
          styles.segmentedHighlight,
          {
            left: Animated.add(indicatorLeft, 1),
            width: segmentWidth - 2,
            backgroundColor: theme.inputBg,
            borderColor: theme.border,
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const active = value === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={styles.segmentedOption}
          >
          <Text
              style={[
                styles.switchText,
                {
                  color: active ? theme.text : theme.muted,
                  fontWeight: active ? '700' : '600',
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function HomePrototypeScreen({
  resetTick,
}: {
  resetTick?: { count: number; animated: boolean; mode: TabResetMode };
}) {
  const theme = lightTheme;
  const { width } = useWindowDimensions();
  const accounts = useAccountsStore((s) => s.accounts);
  const accountsLoaded = useAccountsStore((s) => s.isLoaded);
  const loadAccounts = useAccountsStore((s) => s.load);
  const categories = useCategoriesStore((s) => s.categories);
  const categoriesLoaded = useCategoriesStore((s) => s.isLoaded);
  const loadCategories = useCategoriesStore((s) => s.load);
  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const yearStart = useUIStore((s) => s.settings.yearStart);
  const homeAccountViewMode = useUIStore((s) => s.settings.homeAccountViewMode);
  const updateSettings = useUIStore((s) => s.updateSettings);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const showAllAccountsTab = accounts.length !== 1;
  const displayAccounts = useMemo<AccountSurfaceTab[]>(() => [
    ...(showAllAccountsTab ? [{ id: 'all' as const, name: 'All Accounts', subtitle: `${accounts.length} accounts` }] : []),
    ...accounts.map((account) => ({
      id: account.id,
      name: formatAccountDisplayName(account.name, account.accountNumber),
      subtitle: account.type,
    })),
  ], [accounts, showAllAccountsTab]);
  const rootAccountId = showAllAccountsTab ? 'all' : (accounts[0]?.id ?? 'all');

  const [mode, setMode] = useState<Mode>('expense');
  const [period, setPeriod] = useState<PeriodType>('month');
  const [refreshing, setRefreshing] = useState(false);
  const [periodTransactions, setPeriodTransactions] = useState<Transaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>(rootAccountId);

  const [chartExpanded, setChartExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const accountsPagerRef = useRef<PagerView>(null);

  const dateRange = useMemo(() => getDateRange(period, yearStart), [period, yearStart]);
  const rangeFrom = useMemo(() => new Date(dateRange.from), [dateRange.from]);
  const rangeTo = useMemo(() => new Date(dateRange.to), [dateRange.to]);
  const todayLabel = useMemo(() => formatDate(new Date().toISOString()), []);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, formatAccountDisplayName(account.name, account.accountNumber)])),
    [accounts],
  );
  const loansById = useMemo(() => new Map(loans.map((loan) => [loan.id, loan])), [loans]);

  useEffect(() => {
    if (selectedAccountId === 'all' && !showAllAccountsTab && accounts[0]) {
      setSelectedAccountId(accounts[0].id);
      return;
    }
    if (selectedAccountId !== 'all' && !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(rootAccountId);
    }
  }, [accounts, rootAccountId, selectedAccountId, showAllAccountsTab]);

  const selectedAccount = useMemo(
    () => (selectedAccountId === 'all' ? null : accounts.find((account) => account.id === selectedAccountId) ?? null),
    [accounts, selectedAccountId],
  );

  const totalBalance = useMemo(
    () => (selectedAccountId === 'all' ? accounts.reduce((sum, account) => sum + account.balance, 0) : (selectedAccount?.balance ?? 0)),
    [accounts, selectedAccount, selectedAccountId],
  );

  const filteredModeTransactions = useMemo(
    () => periodTransactions.filter((tx) => getTransactionCashflowImpact(tx) === (mode === 'income' ? 'in' : 'out')),
    [mode, periodTransactions],
  );


  const recentTransactions = useMemo(
    () =>
      periodTransactions
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10),
    [periodTransactions],
  );



  const todayCashflow = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    let totalIn = 0;
    let totalOut = 0;
    periodTransactions.forEach((tx) => {
      if (!tx.date.startsWith(todayKey)) return;
      const impact = getTransactionCashflowImpact(tx);
      if (impact === 'in') totalIn += tx.amount;
      if (impact === 'out') totalOut += tx.amount;
    });
    return { in: totalIn, out: totalOut, net: totalIn - totalOut };
  }, [periodTransactions]);

  const cashflow = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    periodTransactions.forEach((tx) => {
      const impact = getTransactionCashflowImpact(tx);
      if (impact === 'in') totalIn += tx.amount;
      if (impact === 'out') totalOut += tx.amount;
    });
    return { in: totalIn, out: totalOut, net: totalIn - totalOut };
  }, [periodTransactions]);

  const loadData = async () => {
    const scopedTxs = await getTransactions({
      fromDate: dateRange.from,
      toDate: dateRange.to,
      accountId: selectedAccountId === 'all' ? undefined : selectedAccountId,
    });
    setPeriodTransactions(scopedTxs);
  };

  useEffect(() => {
    if (!accountsLoaded) loadAccounts().catch(() => undefined);
    if (!categoriesLoaded) loadCategories().catch(() => undefined);
    if (!loansLoaded) loadLoans().catch(() => undefined);
  }, [accountsLoaded, categoriesLoaded, loansLoaded, loadAccounts, loadCategories, loadLoans]);

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [dateRange.from, dateRange.to, selectedAccountId]);

  useEffect(() => {
    if (!resetTick || resetTick.count === 0) return;
    scrollRef.current?.scrollTo({ y: 0, animated: resetTick.animated });
    accountsPagerRef.current?.setPage?.(0);
    setChartExpanded(false);
    setPeriod('month');
    setSelectedAccountId(rootAccountId);
  }, [resetTick, rootAccountId]);

  const pageSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          const nextIndex = displayAccounts.findIndex((account) => account.id === selectedAccountId);
          if (gesture.dx < -50 && nextIndex < displayAccounts.length - 1) {
            const next = displayAccounts[nextIndex + 1];
            if (next) {
              setSelectedAccountId(next.id);
              accountsPagerRef.current?.setPage(nextIndex + 1);
            }
          } else if (gesture.dx > 50 && nextIndex > 0) {
            const next = displayAccounts[nextIndex - 1];
            if (next) {
              setSelectedAccountId(next.id);
              accountsPagerRef.current?.setPage(nextIndex - 1);
            }
          }
        },
      }),
    [accountsPagerRef, displayAccounts, selectedAccountId],
  );



  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadAccounts().catch(() => undefined),
      loadCategories().catch(() => undefined),
      loadData().catch(() => undefined),
    ]);
    setRefreshing(false);
  };





  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Accounts</Text>
        <View style={[styles.headerToggle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {(['swipe', 'list'] as const).map((item) => {
            const active = homeAccountViewMode === item;
            return (
              <Pressable
                key={item}
                onPress={() => updateSettings({ homeAccountViewMode: item }, 'home-prototype-view-mode').catch(() => undefined)}
                style={[
                  styles.headerToggleItem,
                  active && { backgroundColor: theme.inputBg },
                ]}
              >
                <AppIcon
                  name={item === 'list' ? 'list' : 'gallery-thumbnails'}
                  size={18}
                  color={active ? theme.text : theme.muted}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: HOME_LAYOUT.fabContentBottomPadding + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        {homeAccountViewMode === 'swipe' ? (
          <PagerView
            ref={accountsPagerRef}
            style={styles.accountPager}
            initialPage={Math.max(0, displayAccounts.findIndex((account) => account.id === selectedAccountId))}
            onPageSelected={(event) => {
              const next = displayAccounts[event.nativeEvent.position];
              if (next) setSelectedAccountId(next.id);
            }}
          >
            {displayAccounts.map((account) => (
              <View key={account.id} style={styles.accountPagerPage}>
                <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.heroHeader}>
                    <View style={styles.heroLeft}>
                      <View style={styles.heroLabelRow}>
                        <Text style={[styles.heroLabel, { color: theme.muted }]}>Account</Text>
                        <Text style={[styles.heroLabelDot, { color: theme.muted }]}>•</Text>
                        <Text style={[styles.heroLabel, { color: theme.muted }]}>
                          {account.id === 'all' ? `${accounts.length} accounts` : account.subtitle}
                        </Text>
                      </View>
                      <Text numberOfLines={2} style={[styles.heroTitle, { color: theme.text }]}>{account.name}</Text>
                    </View>
                    <View style={styles.heroRight}>
                      <Text style={[styles.heroBalanceLabel, { color: theme.muted }]}>Current balance</Text>
                      <Text numberOfLines={1} style={[styles.heroBalance, { color: theme.text }]}>
                        {formatCurrency(
                          account.id === 'all'
                            ? accounts.reduce((sum, item) => sum + item.balance, 0)
                            : (accounts.find((item) => item.id === account.id)?.balance ?? 0),
                          sym,
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.heroTodaySection}>
                    <Text style={[styles.heroTodayLabel, { color: theme.muted }]}>Today</Text>
                    <Text style={[styles.heroTodayDate, { color: theme.muted }]}>· {todayLabel}</Text>
                  </View>

                  <View style={styles.heroStatsRow}>
                    {([
                      { key: 'in', label: 'In', value: todayCashflow.in, color: theme.positive },
                      { key: 'out', label: 'Out', value: todayCashflow.out, color: theme.negative },
                      { key: 'net', label: 'Net', value: Math.abs(todayCashflow.net), color: todayCashflow.net >= 0 ? theme.accent : theme.negative },
                    ] as const).map((item, index) => (
                      <View key={item.key} style={styles.heroStatsItemWrap}>
                        {index > 0 ? <View style={[styles.heroMetricDivider, { backgroundColor: theme.border }]} /> : null}
                        <View
                          style={[
                            styles.heroStatCard,
                            index === 0 ? styles.heroStatStart : index === 2 ? styles.heroStatEnd : styles.heroStatCenter,
                          ]}
                        >
                          <Text style={[styles.heroStatLabel, { color: theme.muted }]}>{item.label}</Text>
                          <Text numberOfLines={1} style={[styles.heroStatValue, { color: getMetricColor(item.value, item.color, theme.muted) }]}>
                            {formatMetricValue(item.value, sym)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </PagerView>
        ) : (
          <View style={styles.accountList}>
            {displayAccounts.map((account) => (
              <View key={account.id} style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.heroHeader}>
                  <View style={styles.heroLeft}>
                    <View style={styles.heroLabelRow}>
                      <Text style={[styles.heroLabel, { color: theme.muted }]}>Account</Text>
                      <Text style={[styles.heroLabelDot, { color: theme.muted }]}>•</Text>
                      <Text style={[styles.heroLabel, { color: theme.muted }]}>
                        {account.id === 'all' ? `${accounts.length} accounts` : account.subtitle}
                      </Text>
                    </View>
                    <Text numberOfLines={2} style={[styles.heroTitle, { color: theme.text }]}>{account.name}</Text>
                  </View>
                  <View style={styles.heroRight}>
                    <Text style={[styles.heroBalanceLabel, { color: theme.muted }]}>Current balance</Text>
                    <Text numberOfLines={1} style={[styles.heroBalance, { color: theme.text }]}>
                      {formatCurrency(
                        account.id === 'all'
                          ? accounts.reduce((sum, item) => sum + item.balance, 0)
                          : (accounts.find((item) => item.id === account.id)?.balance ?? 0),
                        sym,
                      )}
                    </Text>
                  </View>
                </View>

                <View style={styles.heroTodaySection}>
                  <Text style={[styles.heroTodayLabel, { color: theme.muted }]}>Today</Text>
                  <Text style={[styles.heroTodayDate, { color: theme.muted }]}>· {todayLabel}</Text>
                </View>

                <View style={styles.heroStatsRow}>
                  {([
                    { key: 'in', label: 'In', value: todayCashflow.in, color: theme.positive },
                    { key: 'out', label: 'Out', value: todayCashflow.out, color: theme.negative },
                    { key: 'net', label: 'Net', value: Math.abs(todayCashflow.net), color: todayCashflow.net >= 0 ? theme.accent : theme.negative },
                  ] as const).map((item, index) => (
                    <View key={item.key} style={styles.heroStatsItemWrap}>
                      {index > 0 ? <View style={[styles.heroMetricDivider, { backgroundColor: theme.border }]} /> : null}
                      <View
                        style={[
                          styles.heroStatCard,
                          index === 0 ? styles.heroStatStart : index === 2 ? styles.heroStatEnd : styles.heroStatCenter,
                        ]}
                      >
                        <Text style={[styles.heroStatLabel, { color: theme.muted }]}>{item.label}</Text>
                        <Text numberOfLines={1} style={[styles.heroStatValue, { color: getMetricColor(item.value, item.color, theme.muted) }]}>
                          {formatMetricValue(item.value, sym)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {homeAccountViewMode === 'swipe' ? (
          <View style={styles.swipeIndicatorWrap}>
            <View style={[styles.swipeIndicatorTrack, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.swipeIndicatorDots}>
                {displayAccounts.map((account, index) => {
                  const active = account.id === selectedAccountId;
                  return (
                    <View
                      key={account.id}
                      style={[
                        styles.swipeIndicatorDot,
                        {
                          width: active ? 20 : 6,
                          backgroundColor: active ? theme.accent : theme.border,
                          opacity: active ? 1 : 0.9,
                          marginRight: index === displayAccounts.length - 1 ? 0 : 8,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.periodSection}>
          <View style={styles.summaryTopRow}>
            <Text style={[styles.summaryLead, { color: theme.muted }]}>This</Text>
            <Text style={[styles.summaryRange, { color: theme.muted }]}>
              {formatDate(rangeFrom.toISOString())} - {formatDate(rangeTo.toISOString())}
            </Text>
          </View>

          <HomeSegmentedControl
            options={[
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
              { key: 'year', label: 'Year' },
              { key: 'custom', label: 'Custom' },
            ]}
            value={period}
            onChange={(next) => setPeriod(next as PeriodType)}
            theme={theme}
            width="100%"
          />
        </View>

        <View style={[styles.mainCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.summaryStrip, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            {([
              { key: 'in', label: 'In', value: cashflow.in, color: theme.positive },
              { key: 'out', label: 'Out', value: cashflow.out, color: theme.negative },
              { key: 'net', label: 'Net', value: Math.abs(cashflow.net), color: cashflow.net >= 0 ? theme.accent : theme.negative },
            ] as const).map((item) => (
              <View key={item.key} style={[styles.summaryMetricCard, item.key !== 'net' && styles.summaryMetricDivider]}>
                <Text style={[styles.summaryMetricLabel, { color: theme.muted }]}>{item.label}</Text>
                <Text numberOfLines={1} style={[styles.summaryMetricValue, { color: getMetricColor(item.value, item.color, theme.muted) }]}>
                  {formatMetricValue(item.value, sym)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.chartBody}>
            <HomeDonutChartBlock
              transactions={periodTransactions}
              categoriesById={categoriesById}
              sym={sym}
              theme={theme}
              expanded={false}
              onExpand={() => setChartExpanded(true)}
            />
          </View>
        </View>

        <View style={[styles.transactionsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.transactionsHeader}>
            <View style={styles.transactionsHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent</Text>
            </View>
          </View>

          <View style={styles.txList}>
            {recentTransactions.map((tx, index) => {
              const path = categoryPathForTx(tx, categoriesById);
              const accountLabel = accountsById.get(tx.accountId) ?? 'Account';
              const linkedAccountName = tx.linkedAccountId ? accountsById.get(tx.linkedAccountId) : undefined;
              const amountColor = getTransactionCashflowImpact(tx) === 'in' ? theme.positive : theme.negative;
              
              const isTransfer = !!tx.transferPairId;
              const isLoan = tx.type === 'loan';
              
              let displayTitle = tx.payee || 'Transaction';
              let displaySubtitle = [path.display, accountLabel].filter(Boolean).join(' \u2022 ');
              let noteLine = tx.note?.trim() || undefined;
              let iconName = path.icon;
              let iconColor = path.color;

              if (isTransfer && linkedAccountName) {
                displayTitle = `Transfer ${tx.type === 'out' ? 'Out' : 'In'}`;
                const from = tx.type === 'out' ? accountLabel : linkedAccountName;
                const to = tx.type === 'out' ? linkedAccountName : accountLabel;
                displaySubtitle = `${from} \u2192 ${to}`;
                iconName = 'repeat';
                iconColor = theme.muted;
              } else if (isLoan) {
                const loan = tx.loanId ? loansById.get(tx.loanId) : undefined;
                const rawType = tx.loanTransactionType || 'principal';
                const typeLabel = rawType === 'principal' ? 'Principal' : rawType === 'interest' ? 'Interest' : 'Others';
                displayTitle = `Loan › ${typeLabel}`;
                displaySubtitle = [accountLabel, loan?.personName].filter(Boolean).join(' \u2022 ');
                iconName = 'credit-card';
                iconColor = theme.accent;
              } else if (tx.type === 'in' || tx.type === 'out') {
                displayTitle = path.display || (tx.type === 'in' ? 'Income' : 'Expense');
                displaySubtitle = [accountLabel, tx.payee].filter(Boolean).join(' \u2022 ');
              }

              return (
                <View
                  key={tx.id}
                  style={[
                    styles.txCard,
                    { backgroundColor: theme.card },
                  ]}
                >
                  <HomeIconBadge icon={iconName} color={iconColor} size={40} />
                  <View style={styles.txBody}>
                    <Text style={[styles.txDate, { color: theme.muted }]}>{formatDate(tx.date)}</Text>
                    <Text style={[styles.txCategoryPath, { color: theme.text }]}>{displayTitle}</Text>
                    <Text numberOfLines={1} style={[styles.txTitle, { color: theme.text }]}>
                      {displaySubtitle}
                    </Text>
                    {noteLine ? (
                      <Text style={[styles.txMeta, { color: theme.muted }]} numberOfLines={2}>
                        {noteLine}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.txAmount, { color: amountColor }]}>
                    {getTransactionCashflowImpact(tx) === 'in' ? '+' : '-'}{formatCurrency(tx.amount, sym)}
                  </Text>
                </View>
              );
            })}

            {!recentTransactions.length ? (
              <View style={[styles.emptyTransactions, { backgroundColor: theme.surface }]}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No recent transactions in this range</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.prototypeLinks}>
          <TouchableOpacity activeOpacity={0.82} onPress={() => router.push('/chart-prototype')}>
            <Text style={[styles.prototypeLinkText, { color: theme.accent }]}>Open Chart Prototype</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.82} onPress={() => router.push('/loan-prototype')}>
            <Text style={[styles.prototypeLinkText, { color: theme.accent }]}>Open Loan Prototype</Text>
          </TouchableOpacity>
        </View>

        <View style={{ width: '100%', alignItems: 'center', marginBottom: -70, marginTop: 40 }}>
          <Text
            style={{
              fontSize: 180,
              fontWeight: '900',
              color: theme.text,
              opacity: 0.05,
              textAlign: 'center',
              letterSpacing: -6,
              lineHeight: 180,
              width: '140%',
            }}
          >
            reni
          </Text>
        </View>
      </ScrollView>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill} {...pageSwipeResponder.panHandlers} />
      <FabButton
        onPress={() => router.push('/modals/add-transaction')}
        palette={{
          isDark: false,
          background: theme.bg,
          surface: theme.surface,
          card: theme.card,
          border: theme.border,
          divider: theme.border,
          text: theme.text,
          listText: theme.text,
          textMuted: theme.muted,
          textSoft: theme.muted,
          tabActive: theme.accent,
          tabInactive: theme.muted,
          iconTint: theme.muted,
          statusBarStyle: 'dark',
          positive: theme.positive,
          negative: theme.negative,
          navigationButtonStyle: 'dark',
          surfaceRaised: theme.card,
          textSecondary: theme.muted,
          borderSoft: theme.border,
          active: theme.accent,
          inactive: theme.muted,
          neutral: theme.text,
          chartBar: theme.accent,
          chartBarMuted: theme.progressTrack,
          heroBar: theme.accent,
          todayDot: theme.text,
          brand: theme.accent,
          brandSoft: theme.surfaceStrong,
          onBrand: '#FFFFFF',
          loan: theme.accent,
          loanSoft: theme.surfaceStrong,
          onLoan: '#FFFFFF',
          budget: theme.accent,
          budgetSoft: theme.surfaceStrong,
          onBudget: '#FFFFFF',
          inBg: theme.surfaceStrong,
          outBg: theme.surfaceStrong,
          transferBg: theme.surfaceStrong,
          loanBg: theme.surfaceStrong,
          budgetBg: theme.surfaceStrong,
          transferText: theme.text,
          inputBg: theme.inputBg,
          scrim: 'rgba(0, 0, 0, 0.4)',
          scrimHeavy: 'rgba(0, 0, 0, 0.55)',
          pressedBg: 'rgba(0, 0, 0, 0.04)',
        }}
        bottom={getFabBottomOffset(insets.bottom)}
        backgroundColor={HOME_FAB_COLOR}
        iconColor="#FFFFFF"
      />
      {chartExpanded ? (
        <BottomSheet
          title=""
          palette={{
            isDark: false,
            background: theme.bg,
            surface: theme.surface,
            card: theme.card,
            border: theme.border,
            divider: theme.border,
            text: theme.text,
            listText: theme.text,
            textMuted: theme.muted,
            textSoft: theme.muted,
            tabActive: theme.accent,
            tabInactive: theme.muted,
            iconTint: theme.muted,
            statusBarStyle: 'dark',
            positive: theme.positive,
            negative: theme.negative,
            navigationButtonStyle: 'dark',
            surfaceRaised: theme.card,
            textSecondary: theme.muted,
            borderSoft: theme.border,
            active: theme.accent,
            inactive: theme.muted,
            neutral: theme.text,
            chartBar: theme.accent,
            chartBarMuted: theme.progressTrack,
            heroBar: theme.accent,
            todayDot: theme.text,
            brand: theme.accent,
            brandSoft: theme.surfaceStrong,
            onBrand: '#FFFFFF',
            loan: theme.accent,
            loanSoft: theme.surfaceStrong,
            onLoan: '#FFFFFF',
            budget: theme.accent,
            budgetSoft: theme.surfaceStrong,
            onBudget: '#FFFFFF',
            inBg: theme.surfaceStrong,
            outBg: theme.surfaceStrong,
            transferBg: theme.surfaceStrong,
            loanBg: theme.surfaceStrong,
            budgetBg: theme.surfaceStrong,
            transferText: theme.text,
            inputBg: theme.inputBg,
            scrim: 'rgba(0, 0, 0, 0.4)',
            scrimHeavy: 'rgba(0, 0, 0, 0.55)',
            pressedBg: 'rgba(0, 0, 0, 0.04)',
          }}
          onClose={() => setChartExpanded(false)}
          showHeaderTitle={false}
          scrollEnabled={false}
          fixedHeightRatio={0.62}
        >
          <View style={styles.sheetInner}>
            <HomeDonutChartBlock
              transactions={periodTransactions}
              categoriesById={categoriesById}
              sym={sym}
              theme={theme}
              expanded={true}
              onExpand={() => setChartExpanded(true)}
            />
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 52 },
  periodSection: { marginBottom: 12, paddingHorizontal: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 16 },
  headerTitle: { fontSize: 28, fontWeight: '400', letterSpacing: -0.5 },
  headerToggle: { flexDirection: 'row', borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  headerToggleItem: {
    width: 42,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  heroHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  heroLeft: { flex: 1, minWidth: 0 },
  heroRight: { flexShrink: 1, maxWidth: '58%', alignItems: 'flex-end' },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLabel: { fontSize: 12, fontWeight: '500' },
  heroLabelDot: { fontSize: 11, fontWeight: '500' },
  heroTitle: { minHeight: 40, fontSize: 15, lineHeight: 20, fontWeight: '500', marginTop: 4 },
  heroBalanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  heroBalance: { fontSize: 24, lineHeight: 34, fontWeight: '600', letterSpacing: -0.2, marginTop: 6, textAlign: 'right' },
  heroTodaySection: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6 },
  heroTodayLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroTodayDate: { fontSize: 12, fontWeight: '600' },
  heroStatsRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: 8 },
  heroStatsItemWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'stretch' },
  heroMetricDivider: { width: 1, marginHorizontal: 12 },
  heroStatCard: { flex: 1, minWidth: 0 },
  heroStatStart: { alignItems: 'flex-start' },
  heroStatCenter: { alignItems: 'center' },
  heroStatEnd: { alignItems: 'flex-end' },
  heroStatLabel: { fontSize: 13.5, fontWeight: '500' },
  heroStatValue: { fontSize: 13.5, fontWeight: '500', marginTop: 4 },
  mainCard: {
    borderRadius: 16,
    padding: 0,
    borderWidth: 1,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    overflow: 'hidden',
  },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  summaryLead: { fontSize: 12, fontWeight: '700' },
  summaryRange: { flex: 1, textAlign: 'right', fontSize: 11.5, fontWeight: '600' },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: HOME_RADIUS.tab + 3,
    borderWidth: 1,
    overflow: 'hidden',
    height: HOME_LAYOUT.periodHeight,
    position: 'relative',
  },
  segmentedHighlight: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: HOME_RADIUS.tab,
    borderWidth: 1,
  },
  segmentedOption: {
    flex: 1,
    height: HOME_LAYOUT.periodHeight,
    borderRadius: HOME_RADIUS.tab,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  chartTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 2 },
  chartTopRowExpanded: { marginTop: 0, marginBottom: 14 },
  expandButton: {
    width: HOME_LAYOUT.periodHeight,
    height: HOME_LAYOUT.periodHeight,
    borderRadius: HOME_RADIUS.tab + 3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  expandPlaceholder: { width: HOME_LAYOUT.periodHeight, height: HOME_LAYOUT.periodHeight, marginLeft: 12 },
  switchText: { fontSize: HOME_TEXT.caption, fontWeight: '600', textAlign: 'center', includeFontPadding: false },
  swipeIndicatorWrap: { paddingHorizontal: 2, marginTop: 8, marginBottom: 8 },
  swipeIndicatorTrack: { height: 8, borderWidth: 1, borderRadius: 999, overflow: 'hidden', justifyContent: 'center' },
  swipeIndicatorDots: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  swipeIndicatorDot: { height: 6, borderRadius: 999 },
  summaryStrip: {
    flexDirection: 'row',
    marginTop: 0,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  summaryMetricCard: { flex: 1, paddingHorizontal: 10 },
  summaryMetricDivider: { borderRightWidth: 1, borderRightColor: lightTheme.border },
  summaryMetricLabel: { fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryMetricValue: { fontSize: 13.5, fontWeight: '600', marginTop: 4 },
  sectionDivider: { height: 1, marginTop: 12, marginBottom: 4 },
  chartWrap: { height: 304, alignItems: 'center', justifyContent: 'center' },
  chartWrapExpanded: { height: 330 },
  centerLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  centerIcon: { fontSize: 24, marginBottom: 4 },
  centerName: { maxWidth: 132, fontSize: 12, fontWeight: '700', marginBottom: 2, textAlign: 'center' },
  centerAmount: { fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  centerMeta: { fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  breadcrumbRow: {
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  breadcrumbLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  breadcrumbTap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  breadcrumbLink: { fontSize: 12, fontWeight: '800' },
  breadcrumbSep: { fontSize: 14, fontWeight: '900' },
  breadcrumbCurrent: { flexShrink: 1, fontSize: 12.5, fontWeight: '700' },
  breadcrumbMeta: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  breadcrumbMetaText: { fontSize: 11.5, fontWeight: '800' },
  listSection: { marginTop: 8 },
  listViewport: { width: '100%' },
  listViewportCollapsed: { maxHeight: 116 },
  categoryList: { gap: 6 },
  categoryRow: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  splitRows: { gap: 8, marginTop: 6 },
  splitRow: { gap: 6 },
  splitRowTop: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 },
  splitName: { flex: 1, fontSize: 14, fontWeight: '500' },
  splitValue: { fontSize: 13, fontWeight: '800', flexShrink: 0 },
  progressTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 999 },
  iconBadge: { backgroundColor: lightTheme.surface, alignItems: 'center', justifyContent: 'center' },
  emptyState: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8 },
  emptyTransactions: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14 },
  emptyTitle: { fontSize: 13.5, fontWeight: '700' },
  transactionsCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginTop: 10,
    overflow: 'hidden',
  },
  transactionsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10, paddingHorizontal: 4 },
  transactionsHeaderText: { flex: 1, minWidth: 0, paddingRight: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  prototypeLinks: { alignItems: 'center', gap: 12, marginTop: 10, marginBottom: 6 },
  prototypeLinkText: { fontSize: HOME_TEXT.bodySmall, fontWeight: '700' },
  sectionSubWrap: { fontSize: 12.5, fontWeight: '600', marginTop: 2, lineHeight: 18, flexWrap: 'wrap' },
  countBadgeWrap: { minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  countBadgeText: { fontSize: 12, fontWeight: '800' },
  txList: { paddingBottom: 4 },
  txCard: {
    minHeight: 88,
    borderRadius: 0,
    paddingHorizontal: 4,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  txBody: { flex: 1, minWidth: 0 },
  txDate: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  txCategoryPath: { fontSize: 12.5, fontWeight: '700', lineHeight: 17, marginTop: 3 },
  txTitle: { fontSize: 13.5, fontWeight: '800', marginTop: 4 },
  txMeta: { fontSize: 11.5, fontWeight: '600', lineHeight: 16, marginTop: 3 },
  txAmount: { fontSize: 14.5, fontWeight: '800', marginTop: 2, flexShrink: 0, textAlign: 'right' },
  chartBody: { paddingHorizontal: 0, paddingTop: 8, paddingBottom: 12 },
  accountPager: { height: 214, marginHorizontal: -10 },
  accountPagerPage: { width: '100%', paddingHorizontal: 10 },
  accountList: { gap: 10 },
  expandedChartContent: { flex: 1 },
  expandedChartInner: { paddingBottom: 8 },
  sheetInner: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
});
