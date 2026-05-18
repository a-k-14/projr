import { Text } from '@/components/ui/AppText';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  BackHandler,
  Easing,
  InteractionManager,
  LayoutAnimation,
  LayoutChangeEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityFilterBar } from '../../components/activity/ActivityFilterBar';
import { ActivityMoreFiltersSheet } from '../../components/activity/ActivityMoreFiltersSheet';
import { ActivityPeriodHeader } from '../../components/activity/ActivityPeriodHeader';
import { CategoryIconBadge } from '../../components/activity/ActivityUI';
import { CardSection, ChoiceRow } from '../../components/settings-ui';
import { SummaryCard } from '../../components/SummaryCard';
import { TransactionListItem } from '../../components/TransactionListItem';
import { AppChevron } from '../../components/ui/AppChevron';
import { AppIcon } from '../../components/ui/AppIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { EmptyStateCard } from '../../components/ui/EmptyStateCard';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { getScrollableBottomPadding, SystemBottomGuard } from '../../components/ui/safeBottom';
import { ListHeading } from '../../components/ui/ListHeading';
import { PillIconButton } from '../../components/ui/PillIconButton';
import { getActivityDisplayedCashflow, getActivityDrilldownTransactions } from '../../lib/activityCashflow';
import { getCategoryDisplayIcon } from '../../lib/category-utils';
import {
  getNavigableDateRange,
  getPeriodNavLabel,
  getRelativeDateLabel,
  toLocalDayEndISO,
  toLocalDayStartISO
} from '../../lib/dateUtils';
import {
  formatCurrency,
  getCashflowFromList,
  getLoanTransactionKind,
  getTransactionCashflowImpact,
  groupTransactionsByDate
} from '../../lib/derived';
import { CARD_PADDING , FONT_WEIGHT} from '../../lib/design';
import { ACTIVITY_LAYOUT, BUTTON_TOKENS, HOME_LAYOUT, HOME_TEXT, TRANSACTIONS_PAGE_SIZE, getTxTypeConfig , HOME_RADIUS} from '../../lib/layoutTokens';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../../lib/settings-shared';
import { registerTabReset } from '../../lib/tabResetRegistry';
import { useAppTheme } from '../../lib/theme';
import { formatDateFull } from '../../lib/ui-format';
import * as transactionsService from '../../services/transactions';
import { getActivityPeriodCashflow } from '../../services/analytics';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useFixedDepositsStore } from '../../stores/useFixedDepositsStore';
import { useUIStore } from '../../stores/useUIStore';
import { useActivityFiltersStore } from '../../stores/useActivityFiltersStore';
import type { Account, CashflowSummary, Category, Transaction, TransactionFilters, TransactionType } from '../../types';

type ActivityPeriod = 'all' | 'day' | 'week' | 'month' | 'year' | 'custom';
type ActivityGroup = {
  groupKey: string;
  title: string;
  subtitle?: string;
  net: number;
  items: Transaction[];
};
type ActivityDateRow =
  | {
      type: 'dateHeader';
      key: string;
      title: string;
      subtitle?: string;
      isFirst: boolean;
    }
  | {
      type: 'transaction';
      key: string;
      tx: Transaction;
      indexInSection: number;
      sectionLength: number;
    };
type GroupByMode = 'date' | 'category';
type CategoryDrilldown = {
  parentKey: string;
  parentLabel: string;
  subKey: string;
  subLabel: string;
  compactLabel?: boolean;
};
type HierarchyFamily = 'in' | 'out' | 'loan' | 'deposit' | 'transfer';

function AccountTypeBadge({ account, palette }: { account?: Account; palette: ReturnType<typeof useAppTheme>['palette'] }) {
  const typeMeta = account ? ACCOUNT_TYPE_META[account.type] : undefined;
  const icon = typeMeta?.icon ?? 'wallet';
  const color = typeMeta?.color ?? palette.brand;

  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: HOME_RADIUS.chip,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${color}18`,
        borderWidth: 1,
        borderColor: `${color}30`,
      }}
    >
      <AppIcon name={icon as any} size={19} color={color} strokeWidth={1.6} />
    </View>
  );
}

export default function ActivityScreen() {
  const isFocused = useIsFocused();
  const routeParams = useLocalSearchParams<{
    source?: string;
    period?: string;
    accountId?: string;
    type?: string;
    cashflowBucket?: string;
    cashflowMode?: string;
    from?: string;
    to?: string;
    ts?: string;
    categoryId?: string;
  }>();
  const accounts = useAccountsStore((s) => s.accounts);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const yearStart = useUIStore((s) => s.settings.yearStart);
  const categories = useCategoriesStore((s) => s.categories);
  const tags = useCategoriesStore((s) => s.tags);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);

  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);

  const storeTransactions = useTransactionsStore((s) => s.transactions);
  const storeTransactionsLoaded = useTransactionsStore((s) => s.isLoaded);
  const storeTransactionsHasMore = useTransactionsStore((s) => s.hasMore);
  const storeTransactionsIsLoadingMore = useTransactionsStore((s) => s.isLoadingMore);
  const loadStoreTransactions = useTransactionsStore((s) => s.load);
  const loadMoreStoreTransactions = useTransactionsStore((s) => s.loadMore);
  const trimStoreTransactionsToFirstPage = useTransactionsStore((s) => s.trimToFirstPage);
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const txTypeConfig = useMemo(() => getTxTypeConfig(palette), [palette]);
  const accountsById = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((loan) => [loan.id, loan])), [loans]);
  const tagNamesById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags]);

  const [period, setPeriod] = useState<ActivityPeriod>('all');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState<string | undefined>();
  const [customTo, setCustomTo] = useState<string | undefined>();
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [cashflowBucket, setCashflowBucket] = useState<'all' | 'in' | 'out' | 'net'>('all');
  const [cashflowMode, setCashflowMode] = useState<'incomeExpense' | 'total'>('incomeExpense');
  const [search, setSearch] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [amountMinStr, setAmountMinStr] = useState('');
  const [amountMaxStr, setAmountMaxStr] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [groupByMode, setGroupByMode] = useState<GroupByMode>('date');
  const [categoryDrilldown, setCategoryDrilldown] = useState<CategoryDrilldown | null>(null);
  const [isInitialParamSyncComplete, setIsInitialParamSyncComplete] = useState(!routeParams.source);

  const [serverCashflow, setServerCashflow] = useState<CashflowSummary | null>(null);

  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [chipScrollResetToken, setChipScrollResetToken] = useState(0);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [activityHeaderHeight, setActivityHeaderHeight] = useState(0);
  const resetBtnPresence = useRef(new Animated.Value(0)).current;
  const resetBtnSpin = useRef(new Animated.Value(0)).current;
  const [stickyDateLabel, setStickyDateLabel] = useState<{ key: string; title: string; subtitle?: string } | null>(null);
  const [showStickyDateLabel, setShowStickyDateLabel] = useState(false);

  const [pendingPeriod, setPendingPeriod] = useState<ActivityPeriod>('all');
  const [pendingCustomFrom, setPendingCustomFrom] = useState<string | undefined>();
  const [pendingCustomTo, setPendingCustomTo] = useState<string | undefined>();

  const handleOpenPeriodSheet = useCallback(() => {
    setPendingPeriod(period);
    setPendingCustomFrom(customFrom);
    setPendingCustomTo(customTo);
    setShowPeriodSheet(true);
  }, [period, customFrom, customTo]);

  const flatListRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const pendingScrollToTopRef = useRef(false);
  const lastFilterScrollSignatureRef = useRef<string | null>(null);
  const storePrefetchStartedRef = useRef(false);
  const showStickyDateLabelRef = useRef(false);
  const stickyDateKeyRef = useRef<string | null>(null);
  const dateRowsViewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 1, minimumViewTime: 0 });

  const scrollToTop = useCallback((animated: boolean) => {
    if (flatListRef.current?.scrollToOffset) {
      flatListRef.current.scrollToOffset({ offset: 0, animated });
    }
    scrollViewRef.current?.scrollTo({ y: 0, animated });
  }, []);

  const queueScrollToTop = useCallback((animated: boolean) => {
    pendingScrollToTopRef.current = true;
    requestAnimationFrame(() => {
      scrollToTop(animated);
      InteractionManager.runAfterInteractions(() => {
        if (pendingScrollToTopRef.current) {
          scrollToTop(animated);
          pendingScrollToTopRef.current = false;
        }
      });
    });
  }, [scrollToTop]);

  const resetActivityScrollState = useCallback((animated: boolean) => {
    setChipScrollResetToken((value) => value + 1);
    queueScrollToTop(animated);
  }, [queueScrollToTop]);

  const resetAllFilters = useCallback((animated: boolean) => {
    setPeriod('all');
    setPeriodOffset(0);
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setSelectedAccountId('all');
    setTypeFilter('all');
    setCashflowBucket('all');
    setCashflowMode('incomeExpense');
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    setAmountMinStr('');
    setAmountMaxStr('');
    setSearch('');
    setGroupByMode('date');
    setCategoryDrilldown(null);
    setIsSearchActive(false);
    setServerCashflow(null);
    resetActivityScrollState(animated);
  }, [resetActivityScrollState]);

  useEffect(() => {
    return registerTabReset('activity', ({ mode, animated }) => {
      setShowAccountSheet(false);
      setShowPeriodSheet(false);
      setShowMoreSheet(false);
      if (mode === 'background') {
        trimStoreTransactionsToFirstPage();
        resetActivityScrollState(false);
      } else {
        resetAllFilters(animated);
      }
    });
  }, [resetActivityScrollState, resetAllFilters, trimStoreTransactionsToFirstPage]);

  useEffect(() => {
    if (storeTransactionsLoaded || storePrefetchStartedRef.current) return;
    storePrefetchStartedRef.current = true;
    const task = InteractionManager.runAfterInteractions(() => {
      loadStoreTransactions().catch(() => {
        storePrefetchStartedRef.current = false;
      });
    });
    return () => task.cancel();
  }, [loadStoreTransactions, storeTransactionsLoaded]);

  useEffect(() => {
    if (!isFocused || !isInitialParamSyncComplete) return;
    const signature = [
      period,
      periodOffset,
      customFrom ?? '',
      customTo ?? '',
      selectedAccountId,
      typeFilter,
      cashflowBucket,
      cashflowMode,
      groupByMode,
      categoryDrilldown ? `${categoryDrilldown.parentKey}:${categoryDrilldown.subKey}` : '',
    ].join('|');

    if (lastFilterScrollSignatureRef.current === null) {
      lastFilterScrollSignatureRef.current = signature;
      return;
    }

    if (lastFilterScrollSignatureRef.current !== signature) {
      lastFilterScrollSignatureRef.current = signature;
      queueScrollToTop(false);
    }
  }, [
    cashflowBucket,
    cashflowMode,
    categoryDrilldown,
    customFrom,
    customTo,
    groupByMode,
    isFocused,
    isInitialParamSyncComplete,
    period,
    periodOffset,
    queueScrollToTop,
    selectedAccountId,
    typeFilter,
  ]);

  const toggleSearch = useCallback((active: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchActive(active);
    if (!active) setSearch('');
  }, []);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const hasContent = transactions.length > 0 || storeTransactions.length > 0;
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const hasUserScrolledRef = useRef(false);
  const requestIdRef = useRef(0);
  const lastAppliedRouteTsRef = useRef<string | null>(null);
  const lastLoadedRemoteQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFocused || groupByMode !== 'category' || !categoryDrilldown) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setCategoryDrilldown(null);
      return true;
    });
    return () => sub.remove();
  }, [categoryDrilldown, groupByMode, isFocused]);

  const dateRange = useMemo(() => {
    if (period === 'all') return null;
    if (period === 'custom') return customFrom && customTo ? { from: customFrom, to: customTo } : null;
    return getNavigableDateRange(period, periodOffset, yearStart);
  }, [customFrom, customTo, period, periodOffset, yearStart]);
  const remoteQuerySignature = useMemo(
    () =>
      [
        period,
        periodOffset,
        dateRange?.from ?? '',
        dateRange?.to ?? '',
        selectedAccountId,
        typeFilter,
        cashflowBucket,
        cashflowMode,
      ].join('|'),
    [cashflowBucket, cashflowMode, dateRange?.from, dateRange?.to, period, periodOffset, selectedAccountId, typeFilter],
  );

  const canGoNext = period !== 'all' && period !== 'custom' && periodOffset < 0;
  const periodLabel = useMemo(() => {
    if (period === 'all' || !dateRange) return 'All Time';
    return getPeriodNavLabel(period, dateRange.from, dateRange.to);
  }, [dateRange, period]);
  const selectedAccount =
    selectedAccountId === 'all' ? null : accounts.find((account) => account.id === selectedAccountId);
  const accountLabel = selectedAccount ? selectedAccount.name : 'All Accounts';
  const source = typeof routeParams.source === 'string' ? routeParams.source : undefined;

  // A view is default ONLY if we haven't come from a specific source, OR we have finished syncing params
  const isDefaultView =
    (!source || isInitialParamSyncComplete) &&
    period === 'all' &&
    selectedAccountId === 'all' &&
    typeFilter === 'all' &&
    cashflowBucket === 'all' &&
    !search &&
    selectedCategoryIds.length === 0 &&
    selectedTagIds.length === 0 &&
    !amountMinStr &&
    !amountMaxStr;

  const setHasActiveFilters = useActivityFiltersStore((s) => s.setHasActiveFilters);
  useEffect(() => {
    setHasActiveFilters(!isDefaultView);
    return () => setHasActiveFilters(false);
  }, [isDefaultView, setHasActiveFilters]);

  useEffect(() => {
    if (isDefaultView) {
      Animated.parallel([
        Animated.timing(resetBtnPresence, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(resetBtnSpin, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(resetBtnPresence, {
          toValue: 1,
          damping: 12,
          stiffness: 260,
          useNativeDriver: true,
        }),
        Animated.timing(resetBtnSpin, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isDefaultView, resetBtnPresence, resetBtnSpin]);

  useEffect(() => {
    if (!isFocused) return;
    if (isDefaultView) {
      if (!storeTransactionsLoaded) {
        setIsTransitioning(true);
      } else {
        setIsTransitioning(false);
      }
      return;
    }
    if (!source || isInitialParamSyncComplete) {
      setIsTransitioning(true);
    }
  }, [isDefaultView, isFocused, isInitialParamSyncComplete, source, storeTransactionsLoaded]);

  const loadData = useMemo(
    () => async (isInitial: boolean) => {
      if (loadingRef.current && !isInitial) return;
      const requestId = ++requestIdRef.current;
      loadingRef.current = true;
      try {
        const currentOffset = isInitial ? 0 : offsetRef.current;
        const effectiveTypeFilter =
          cashflowBucket !== 'all' && (typeFilter === 'in' || typeFilter === 'out')
            ? undefined
            : typeFilter === 'transfer'
              ? undefined
              : typeFilter === 'all'
                ? undefined
                : typeFilter;
        const filters: TransactionFilters = {
          accountId: selectedAccountId === 'all' ? undefined : selectedAccountId,
          type: effectiveTypeFilter,
          fromDate: dateRange?.from,
          toDate: dateRange?.to,
          limit: TRANSACTIONS_PAGE_SIZE,
          offset: currentOffset
        };
        // Fetch paginated rows and (on initial load) server-side totals in parallel.
        const totalsPromise = isInitial && dateRange?.from && dateRange?.to
          ? getActivityPeriodCashflow(
              selectedAccountId,
              dateRange.from,
              dateRange.to,
              { includeTransfers: cashflowMode === 'total', includeLoans: cashflowMode === 'total' }
            )
          : Promise.resolve(null);
        const [results, totals] = await Promise.all([
          transactionsService.getTransactions(filters),
          totalsPromise,
        ]);
        if (requestId !== requestIdRef.current) return;
        if (isInitial) {
          setTransactions(results);
          offsetRef.current = results.length;
          setHasMore(results.length === TRANSACTIONS_PAGE_SIZE);
          setServerCashflow(totals);
        } else {
          setTransactions((prev) => {
            const ids = new Set(prev.map((tx) => tx.id));
            return [...prev, ...results.filter((tx) => !ids.has(tx.id))];
          });
          offsetRef.current += results.length;
          setHasMore(results.length === TRANSACTIONS_PAGE_SIZE);
        }
        if (isInitial) {
          lastLoadedRemoteQueryRef.current = remoteQuerySignature;
        }
      } finally {
        loadingRef.current = false;
      }
    },
    [cashflowBucket, cashflowMode, dateRange?.from, dateRange?.to, period, periodOffset, remoteQuerySignature, selectedAccountId, typeFilter],
  );

  useEffect(() => {
    if (isFocused) {
      if (isDefaultView) {
        if (!storeTransactionsLoaded) {
          if (!hasContent) setIsTransitioning(true);
          loadStoreTransactions().catch(() => undefined);
        }
      } else {
        // Only load data if we aren't waiting for an initial param sync
        if (!source || isInitialParamSyncComplete) {
          if (hasContent && lastLoadedRemoteQueryRef.current === remoteQuerySignature) {
            setIsTransitioning(false);
            return;
          }
          setIsTransitioning(true);
          loadData(true).finally(() => {
            setIsTransitioning(false);
          });
        }
      }
    }
  }, [hasContent, isDefaultView, isFocused, isInitialParamSyncComplete, loadData, loadStoreTransactions, remoteQuerySignature, source, storeTransactionsLoaded]);

  // In default view, the FlashList reads `storeTransactions` directly via
  // `activeTransactions` below — we no longer mirror it into local `transactions`
  // state. We still mirror hasMore and the transition flag (cheap booleans),
  // and keep offsetRef in sync so `onLoadMore` in custom-view fallback works.
  useEffect(() => {
    if (!isDefaultView) return;
    setHasMore(storeTransactionsHasMore);
    offsetRef.current = storeTransactions.length;
    if (storeTransactionsLoaded) {
      setIsTransitioning(false);
      lastLoadedRemoteQueryRef.current = remoteQuerySignature;
    }
  }, [isDefaultView, remoteQuerySignature, storeTransactions.length, storeTransactionsHasMore, storeTransactionsLoaded]);

  useEffect(() => {
    if (!loansLoaded) loadLoans().catch(() => undefined);
  }, [loansLoaded, loadLoans]);

  useEffect(() => {
    const sourceParam = typeof routeParams.source === 'string' ? routeParams.source : undefined;
    const tsParam = typeof routeParams.ts === 'string' ? routeParams.ts : undefined;

    if (!sourceParam || !tsParam || lastAppliedRouteTsRef.current === tsParam) {
      if (!isInitialParamSyncComplete) setIsInitialParamSyncComplete(true);
      return;
    }

    const periodParam = typeof routeParams.period === 'string' ? routeParams.period : undefined;
    const accountParam = typeof routeParams.accountId === 'string' ? routeParams.accountId : undefined;
    const typeParam = typeof routeParams.type === 'string' ? routeParams.type : undefined;
    const cashflowBucketParam =
      typeof routeParams.cashflowBucket === 'string' ? routeParams.cashflowBucket : undefined;
    const cashflowModeParam = routeParams.cashflowMode === 'total' ? 'total' : 'incomeExpense';
    const fromParam = typeof routeParams.from === 'string' ? routeParams.from : undefined;
    const toParam = typeof routeParams.to === 'string' ? routeParams.to : undefined;
    const categoryIdParam = typeof routeParams.categoryId === 'string' ? routeParams.categoryId : undefined;

    if (accountParam && accountParam !== 'all' && accounts.length === 0) {
      return;
    }

    setPeriod('all');
    setPeriodOffset(0);
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setSelectedAccountId('all');
    setTypeFilter('all');
    setCashflowBucket('all');
    setCashflowMode(cashflowModeParam);
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    setAmountMinStr('');
    setAmountMaxStr('');
    setExpandedCategoryIds([]);
    setGroupByMode('date');
    setCategoryDrilldown(null);
    setSearch('');
    setIsSearchActive(false);

    if (sourceParam === 'activity-tab') {
      void loadStoreTransactions().catch(() => undefined);
      lastAppliedRouteTsRef.current = tsParam;
      setIsInitialParamSyncComplete(true);
      return;
    }

    if (periodParam === 'day' || periodParam === 'week' || periodParam === 'month' || periodParam === 'year') {
      setPeriod(periodParam);
      setPeriodOffset(0);
    } else if (periodParam === 'custom') {
      setPeriod('custom');
      setCustomFrom(fromParam);
      setCustomTo(toParam);
    }

    if (accountParam === 'all') {
      setSelectedAccountId('all');
    } else if (accountParam && accounts.length > 0) {
      if (accounts.some((account) => account.id === accountParam)) {
        setSelectedAccountId(accountParam);
      }
    }

    if (categoryIdParam) {
      setSelectedCategoryIds([categoryIdParam]);
      setGroupByMode('date');
    }

    if (typeParam === 'all' || typeParam === 'in' || typeParam === 'out' || typeParam === 'transfer' || typeParam === 'loan') {
      setTypeFilter(typeParam);
    }

    if (cashflowBucketParam) {
      setCashflowBucket(cashflowBucketParam as any);
      if (cashflowModeParam !== 'total' && (cashflowBucketParam === 'in' || cashflowBucketParam === 'out')) {
        setTypeFilter(cashflowBucketParam as any);
      }
    }

    lastAppliedRouteTsRef.current = tsParam;
    setIsInitialParamSyncComplete(true);
  }, [accounts, isInitialParamSyncComplete, loadStoreTransactions, routeParams.accountId, routeParams.cashflowBucket, routeParams.cashflowMode, routeParams.categoryId, routeParams.from, routeParams.period, routeParams.source, routeParams.to, routeParams.ts, routeParams.type]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (isDefaultView) {
        await loadStoreTransactions();
      } else {
        await loadData(true);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Stable ref mirrors for hasMore + isDefaultView to avoid stale closures inside useCallback.
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const isDefaultViewRef = useRef(isDefaultView);
  isDefaultViewRef.current = isDefaultView;
  // Ref mirror so onLoadMore stays stable and doesn't recreate maybePrefetchMore on every
  // loading-state tick (which was the root cause of "Maximum update depth exceeded").
  const storeLoadingMoreRef = useRef(storeTransactionsIsLoadingMore);
  storeLoadingMoreRef.current = storeTransactionsIsLoadingMore;

  const onLoadMore = useCallback(async () => {
    if (
      !hasUserScrolledRef.current ||
      !hasMoreRef.current ||
      loadingRef.current ||
      (isDefaultViewRef.current && storeLoadingMoreRef.current)
    ) return;
    setIsLoadingMore(true);
    try {
      if (isDefaultViewRef.current) {
        await loadMoreStoreTransactions();
        return;
      }
      await loadData(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadData, loadMoreStoreTransactions]);

  const maybePrefetchMore = useCallback(
    (nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } }) => {
      if (nativeEvent.contentOffset.y > 24) {
        hasUserScrolledRef.current = true;
      }
      const shouldShowStickyDate =
        activityHeaderHeight > 0 && nativeEvent.contentOffset.y >= activityHeaderHeight + 8;
      if (showStickyDateLabelRef.current !== shouldShowStickyDate) {
        showStickyDateLabelRef.current = shouldShowStickyDate;
        setShowStickyDateLabel(shouldShowStickyDate);
      }
      const distanceFromEnd =
        nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
      if (distanceFromEnd < 900) {
        void onLoadMore();
      }
    },
    [activityHeaderHeight, onLoadMore],
  );

  const goPrev = () => {
    if (period !== 'all' && period !== 'custom') {
      setPeriodOffset((value) => value - 1);
      queueScrollToTop(false);
    }
  };

  const goNext = () => {
    if (canGoNext) {
      setPeriodOffset((value) => value + 1);
      queueScrollToTop(false);
    }
  };

  const openCustomFromPicker = () => {
    DateTimePickerAndroid.open({
      value: pendingCustomFrom ? new Date(pendingCustomFrom) : (customFrom ? new Date(customFrom) : new Date()),
      mode: 'date',
      display: 'calendar',
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        const pickedFrom = toLocalDayStartISO(date);
        setPendingCustomFrom(pickedFrom);
        setPendingPeriod('custom');
      }
    });
  };

  const openCustomToPicker = () => {
    const minDate = pendingCustomFrom ? new Date(pendingCustomFrom) : (customFrom ? new Date(customFrom) : undefined);
    DateTimePickerAndroid.open({
      value: pendingCustomTo ? new Date(pendingCustomTo) : (customTo ? new Date(customTo) : new Date()),
      mode: 'date',
      display: 'calendar',
      minimumDate: minDate,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        const pickedTo = toLocalDayEndISO(date);
        setPendingCustomTo(pickedTo);
        setPendingPeriod('custom');
      }
    });
  };

  const applyPeriodDirectly = (p: ActivityPeriod) => {
    setPeriod(p);
    setPeriodOffset(0);
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setShowPeriodSheet(false);
    queueScrollToTop(false);
  };

  const handleApplyPeriod = () => {
    if (pendingCustomFrom && pendingCustomTo) {
      const fromDate = new Date(pendingCustomFrom);
      const toDate = new Date(pendingCustomTo);
      if (fromDate > toDate) {
        setCustomFrom(toLocalDayStartISO(toDate));
        setCustomTo(toLocalDayEndISO(fromDate));
      } else {
        setCustomFrom(pendingCustomFrom);
        setCustomTo(pendingCustomTo);
      }
      setPeriod('custom');
      setPeriodOffset(0);
      setShowPeriodSheet(false);
      queueScrollToTop(false);
    }
  };

  // In default view, read from the store directly — avoids a double-render
  // every time the store's transactions array updates.
  const sourceTransactions = isDefaultView ? storeTransactions : transactions;

  // Deposit lookup mirrors `loansById` — used to pass deposit name/bank
  // through to TransactionListItem for type='deposit' rows.
  const deposits = useFixedDepositsStore((s) => s.deposits);
  const depositsById = useMemo(() => new Map(deposits.map((d) => [d.id, d])), [deposits]);

  const filteredTransactions = useMemo(() => {
    const minAmount = amountMinStr ? Number(amountMinStr) : undefined;
    const maxAmount = amountMaxStr ? Number(amountMaxStr) : undefined;
    const selectedTagSet = new Set(selectedTagIds);
    const selectedCategoryAndDescendants = new Set<string>();
    const query = search.trim().toLowerCase();
    selectedCategoryIds.forEach((id) => {
      selectedCategoryAndDescendants.add(id);
      categories
        .filter((category) => category.parentId === id)
        .forEach((child) => selectedCategoryAndDescendants.add(child.id));
    });

    return sourceTransactions.filter((tx) => {
      const incomeExpenseImpact = getTransactionCashflowImpact(tx, {
        includeTransfers: cashflowMode === 'total',
        includeLoans: cashflowMode === 'total',
      });

      // Account filter
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId) {
        return false;
      }

      // Type filter (Incomes, Expenses, Transfers, Loans)
      if (typeFilter === 'transfer') {
        if (!tx.transferPairId) return false;
      } else if (typeFilter === 'loan') {
        if (tx.type !== 'loan') return false;
      } else if (typeFilter !== 'all') {
        if (tx.transferPairId || tx.type === 'loan' || tx.type !== typeFilter) return false;
      }

      // Income/expense bucket filter.
      if (cashflowBucket !== 'all') {
        if (cashflowBucket === 'net') {
          if (incomeExpenseImpact === 'neutral') return false;
        } else if (incomeExpenseImpact !== cashflowBucket) {
          return false;
        }
      }

      // Category filter
      if (selectedCategoryAndDescendants.size > 0) {
        if (!tx.categoryId || !selectedCategoryAndDescendants.has(tx.categoryId)) return false;
      }

      // Tags filter
      if (selectedTagSet.size > 0) {
        if (!tx.tags.some((tagId) => selectedTagSet.has(tagId))) return false;
      }

      // Amount range filter
      if (minAmount !== undefined && !Number.isNaN(minAmount) && tx.amount < minAmount) return false;
      if (maxAmount !== undefined && !Number.isNaN(maxAmount) && tx.amount > maxAmount) return false;

      // Search filter
      if (query) {
        const loan = tx.loanId ? loansById.get(tx.loanId) : undefined;
        const linkedAccountName = tx.linkedAccountId ? accountsById.get(tx.linkedAccountId) : undefined;
        const searchable = [
          tx.note,
          tx.payee,
          tx.categoryId ? getCategoryFullDisplayName(tx.categoryId, ' › ') : undefined,
          accountsById.get(tx.accountId),
          linkedAccountName,
          loan?.personName,
          tx.tags.map((tagId) => tagNamesById.get(tagId)).filter(Boolean).join(' • '),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
  }, [accountsById, amountMaxStr, amountMinStr, cashflowBucket, cashflowMode, categories, getCategoryFullDisplayName, loansById, search, selectedCategoryIds, selectedTagIds, tagNamesById, sourceTransactions, typeFilter, selectedAccountId]);

  const drilldownTransactions = useMemo(
    () => getActivityDrilldownTransactions(filteredTransactions, categoryDrilldown),
    [categoryDrilldown, filteredTransactions],
  );
  const includeTotalCashflow = cashflowMode === 'total';
  const displayedCashflow = useMemo(
    () => getActivityDisplayedCashflow(filteredTransactions, categoryDrilldown, includeTotalCashflow, includeTotalCashflow),
    [categoryDrilldown, filteredTransactions, includeTotalCashflow],
  );

  // SummaryCard totals: use server-side aggregate (accurate for all pages) when available.
  // Apply cashflowBucket so the card matches the filtered list — when viewing only income,
  // only show income total; when viewing only expenses, only show expense total.
  const summaryCardCashflow = useMemo((): CashflowSummary => {
    const base = serverCashflow ?? displayedCashflow;
    if (cashflowBucket === 'in') return { in: base.in, out: 0, net: base.in };
    if (cashflowBucket === 'out') return { in: 0, out: base.out, net: -base.out };
    return base;
  }, [serverCashflow, displayedCashflow, cashflowBucket]);

  const moreActiveCount =
    selectedCategoryIds.length +
    selectedTagIds.length +
    (amountMinStr ? 1 : 0) +
    (amountMaxStr ? 1 : 0);


  const childCategoriesByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    categories.forEach((category) => {
      if (!category.parentId) return;
      const next = map.get(category.parentId) ?? [];
      next.push(category);
      map.set(category.parentId, next);
    });
    map.forEach((items, key) => {
      map.set(
        key,
        items.slice().sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
      );
    });
    return map;
  }, [categories]);

  const toggleCategoryId = (id: string) => {
    const category = categoriesById.get(id);
    setSelectedCategoryIds((prev) => {
      const exists = prev.includes(id);
      if (!category?.parentId) {
        return exists ? prev.filter((value) => value !== id) : [...prev, id];
      }
      const withoutParent = prev.filter((value) => value !== category.parentId);
      return exists ? withoutParent.filter((value) => value !== id) : [...withoutParent, id];
    });
  };

  const toggleCategoryFamily = (categoryId: string) => {
    const childIds = (childCategoriesByParent.get(categoryId) ?? []).map((child) => child.id);
    const familyIds = [categoryId, ...childIds];
    const hasAnySelected = familyIds.some((id) => selectedCategoryIds.includes(id));
    setSelectedCategoryIds((prev) => {
      if (hasAnySelected) {
        return prev.filter((id) => !familyIds.includes(id));
      }
      return Array.from(new Set([...prev, ...familyIds]));
    });
  };

  const toggleCategoryExpansion = (id: string) => {
    setExpandedCategoryIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const toggleTagId = (id: string) => {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const handleTransactionPress = useCallback((transaction: Transaction) => {
    if (transaction.type === 'deposit' && transaction.depositId) {
      router.push({ pathname: '/modals/add-transaction', params: { editDepositId: transaction.depositId, closeDepositId: '' } });
      return;
    }
    if (transaction.type === 'loan' && transaction.loanId) {
      const loan = loans.find((item) => item.id === transaction.loanId);
      if (loan && getLoanTransactionKind(transaction, loan.direction) === 'settlement') {
        router.push({ pathname: '/modals/loan-settlement', params: { editId: transaction.id } });
        return;
      }
    }
    router.push({ pathname: '/modals/add-transaction', params: { editId: transaction.id } });
  }, [loans]);

  const grouped = useMemo<ActivityGroup[]>(() => {
    return groupTransactionsByDate(categoryDrilldown ? drilldownTransactions : filteredTransactions).map((group) => {
      const { date, label } = getRelativeDateLabel(group.dateKey);
      return {
        groupKey: group.dateKey,
        title: date,
        subtitle: label || undefined,
        net: getCashflowFromList(group.items, includeTotalCashflow, includeTotalCashflow).net,
        items: group.items
      };
    });
  }, [categoryDrilldown, drilldownTransactions, filteredTransactions, includeTotalCashflow]);
  const dateRows = useMemo<ActivityDateRow[]>(() => {
    return grouped.flatMap((group, groupIndex) => {
      const rows: ActivityDateRow[] = [
        {
          type: 'dateHeader',
          key: `header:${group.groupKey}`,
          title: group.title,
          subtitle: group.subtitle,
          isFirst: groupIndex === 0,
        },
      ];
      group.items.forEach((tx, index) => {
        rows.push({
          type: 'transaction',
          key: tx.id,
          tx,
          indexInSection: index,
          sectionLength: group.items.length,
        });
      });
      return rows;
    });
  }, [grouped]);

  const categoryHierarchy = useMemo(() => {
    const parentMap = new Map<
      string,
      {
        parentKey: string;
        parentLabel: string;
        parentIcon?: string;
        parentSyntheticType?: HierarchyFamily;
        familyOrder: number;
        familyKey: HierarchyFamily;
        transactions: Transaction[];
        subMap: Map<string, { subKey: string; subLabel: string; transactions: Transaction[] }>;
      }
    >();

    const getFamilyKey = (tx: Transaction): HierarchyFamily => {
      if (tx.transferPairId) return 'transfer';
      if (tx.type === 'out') return 'out';
      if (tx.type === 'in') return 'in';
      if (tx.type === 'loan') return 'loan';
      return 'transfer';
    };

    const getFamilyOrder = (familyKey: HierarchyFamily) => {
      if (familyKey === 'in') return 0;
      if (familyKey === 'out') return 1;
      if (familyKey === 'loan') return 2;
      if (familyKey === 'deposit') return 3;
      return 4;
    };

    filteredTransactions.forEach((tx) => {
      const category = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
      const parent = category?.parentId ? categoriesById.get(category.parentId) : undefined;
      const familyKey = getFamilyKey(tx);
      const parentKey = parent
        ? parent.id
        : category
          ? category.id
          : tx.transferPairId
            ? 'type:transfer'
            : `type:${tx.type}`;
      const parentLabel = parent
        ? parent.name
        : category
          ? category.name
          : tx.transferPairId
            ? 'Transfer'
            : tx.type === 'transfer'
              ? 'Transfer'
              : tx.type === 'loan'
                ? 'Loan'
                : 'Uncategorized';
      const parentIcon = parent
        ? parent.icon
        : category
          ? category.icon
          : undefined;
      const subKey = category?.id ?? (tx.transferPairId ? 'type:transfer' : `type:${tx.type}`);
      const subLabel = category
        ? parent
          ? category.name
          : category.name
        : tx.transferPairId
          ? 'Transfer'
          : tx.type === 'transfer'
            ? 'Transfer'
            : tx.type === 'loan'
              ? 'Loan'
              : 'Uncategorized';

      if (!parentMap.has(parentKey)) {
        parentMap.set(parentKey, {
          parentKey,
          parentLabel,
          parentIcon,
          parentSyntheticType: parent || category ? undefined : familyKey,
          familyOrder: getFamilyOrder(familyKey),
          familyKey,
          transactions: [],
          subMap: new Map()
        });
      }

      const parentEntry = parentMap.get(parentKey)!;
      parentEntry.transactions.push(tx);

      if (!parentEntry.subMap.has(subKey)) {
        parentEntry.subMap.set(subKey, { subKey, subLabel, transactions: [] });
      }
      parentEntry.subMap.get(subKey)!.transactions.push(tx);
    });

    return Array.from(parentMap.values())
      .map((entry) => ({
        parentKey: entry.parentKey,
        parentLabel: entry.parentLabel,
        parentIcon: entry.parentIcon,
        parentSyntheticType: entry.parentSyntheticType,
        total: getCashflowFromList(entry.transactions, includeTotalCashflow, includeTotalCashflow).net,
        transactions: entry.transactions,
        subcategories: Array.from(entry.subMap.values())
          .map((sub) => ({
            subKey: sub.subKey,
            subLabel: sub.subLabel,
            total: getCashflowFromList(sub.transactions, includeTotalCashflow, includeTotalCashflow).net,
            transactions: sub.transactions
          }))
          .sort((a, b) => a.subLabel.localeCompare(b.subLabel, 'en', { sensitivity: 'base' })),
        familyOrder: entry.familyOrder,
        familyKey: entry.familyKey
      }))
      .sort((a, b) => {
        if (a.familyOrder !== b.familyOrder) return a.familyOrder - b.familyOrder;
        return a.parentLabel.localeCompare(b.parentLabel, 'en', { sensitivity: 'base' });
      });
  }, [categoriesById, filteredTransactions, includeTotalCashflow]);

  const hierarchySections = useMemo(
    () =>
      ([
        { key: 'in', label: 'Income' },
        { key: 'out', label: 'Expenses' },
        { key: 'loan', label: 'Loans' },
        { key: 'deposit', label: 'Deposits' },
        { key: 'transfer', label: 'Transfers' },
      ] as const)
        .map((section) => ({
          ...section,
          items: categoryHierarchy.filter((category) => category.familyKey === section.key)
        }))
        .filter((section) => section.items.length > 0),
    [categoryHierarchy],
  );

  const showLoadingMoreFooter = isLoadingMore || (isDefaultView && storeTransactionsIsLoadingMore);

  const updateStickyDateFromIndex = useCallback(
    (index: number | null) => {
      if (index == null || index < 0) return;
      for (let cursor = Math.min(index, dateRows.length - 1); cursor >= 0; cursor -= 1) {
        const row = dateRows[cursor];
        if (row?.type === 'dateHeader') {
          if (stickyDateKeyRef.current !== row.key) {
            stickyDateKeyRef.current = row.key;
            setStickyDateLabel({ key: row.key, title: row.title, subtitle: row.subtitle });
          }
          return;
        }
      }
    },
    [dateRows],
  );

  const handleDateRowsViewableChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: ActivityDateRow; index: number | null; isViewable: boolean }> }) => {
      const firstVisible = viewableItems
        .filter((item) => item.isViewable && item.index != null)
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
      updateStickyDateFromIndex(firstVisible?.index ?? null);
    },
  );

  useEffect(() => {
    handleDateRowsViewableChanged.current = ({ viewableItems }) => {
      const firstVisible = viewableItems
        .filter((item) => item.isViewable && item.index != null)
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
      updateStickyDateFromIndex(firstVisible?.index ?? null);
    };
  }, [updateStickyDateFromIndex]);

  useEffect(() => {
    const firstHeader = dateRows.find((row) => row.type === 'dateHeader');
    if (!firstHeader) {
      stickyDateKeyRef.current = null;
      setStickyDateLabel(null);
      return;
    }
    if (stickyDateKeyRef.current === null) {
      stickyDateKeyRef.current = firstHeader.key;
      setStickyDateLabel({ key: firstHeader.key, title: firstHeader.title, subtitle: firstHeader.subtitle });
    }
  }, [dateRows]);

  const handleDateRowsViewable = useCallback(
    (info: { viewableItems: Array<{ item: ActivityDateRow; index: number | null; isViewable: boolean }> }) => {
      handleDateRowsViewableChanged.current(info);
    },
    [],
  );

  const toggleSectionExpansion = useCallback((parentKeys: string[]) => {
    if (parentKeys.length === 0) return;
    setExpandedCategoryIds((prev) => {
      const allExpanded = parentKeys.every((key) => prev.includes(key));
      return allExpanded
        ? prev.filter((key) => !parentKeys.includes(key))
        : Array.from(new Set([...prev, ...parentKeys]));
    });
  }, []);

  const renderDateRow = useCallback(
    ({ item }: ListRenderItemInfo<ActivityDateRow>) => {
      if (item.type === 'dateHeader') {
        const labelSuffix = item.subtitle ? `  •  ${item.subtitle}` : '';
        return (
          <View
            style={{
              height: item.isFirst ? 30 : 54,
              paddingLeft: ACTIVITY_LAYOUT.groupHeaderPaddingX,
              paddingRight: ACTIVITY_LAYOUT.headerPaddingX + 10,
              paddingBottom: 1,
              paddingTop: item.isFirst ? 0 : 20,
              backgroundColor: palette.background,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text
              appWeight="medium"
              numberOfLines={1}
              style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}
            >
              {item.title}
              <Text style={{ color: palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>{labelSuffix}</Text>
            </Text>
          </View>
        );
      }

      const tx = item.tx;
      const accountName = accountsById.get(tx.accountId);
      const linkedAccountName = tx.linkedAccountId ? accountsById.get(tx.linkedAccountId) : undefined;
      const loan = tx.loanId ? loansById.get(tx.loanId) : undefined;
      const deposit = tx.depositId ? depositsById.get(tx.depositId) : undefined;
      const isFirst = item.indexInSection === 0;
      const isLast = item.indexInSection === item.sectionLength - 1;

      return (
        <TransactionListItem
          key={tx.id}
          tx={tx}
          sym={sym}
          palette={palette}
          isLast={isLast}
          paddingY={HOME_LAYOUT.listRowPaddingY + 2}
          categoryName={tx.categoryId ? getCategoryFullDisplayName(tx.categoryId, ' › ') : undefined}
          categoryIcon={getCategoryDisplayIcon(categoriesById, tx.categoryId)}
          accountName={accountName}
          linkedAccountName={linkedAccountName}
          loanPersonName={loan?.personName}
          loanDirection={loan?.direction}
          depositName={deposit?.name}
          depositBankName={deposit?.bankName}
          tertiaryText={
            tx.tags.length > 0
              ? tx.tags
                .map((tagId) => tagNamesById.get(tagId))
                .filter((value): value is string => !!value)
                .join(' • ') || undefined
              : undefined
          }
          showAmountSign={false}
          useTypeAmountColor
          onPress={handleTransactionPress}
          style={{
            marginHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
            backgroundColor: palette.surface,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderTopWidth: isFirst ? 1 : 0,
            borderColor: palette.divider,
            borderTopLeftRadius: isFirst ? ACTIVITY_LAYOUT.groupCardRadius : 0,
            borderTopRightRadius: isFirst ? ACTIVITY_LAYOUT.groupCardRadius : 0,
            borderBottomLeftRadius: isLast ? ACTIVITY_LAYOUT.groupCardRadius : 0,
            borderBottomRightRadius: isLast ? ACTIVITY_LAYOUT.groupCardRadius : 0,
          }}
        />
      );
    },
    [accountsById, categoriesById, loansById, depositsById, tagNamesById, getCategoryFullDisplayName, handleTransactionPress, palette, sym],
  );

  const activityHeader = useMemo(() => (
    <View
      onLayout={(event: LayoutChangeEvent) => {
        const nextHeight = event.nativeEvent.layout.height;
        setActivityHeaderHeight((current) => (Math.abs(current - nextHeight) > 1 ? nextHeight : current));
      }}
      style={{ paddingTop: 4 }}
    >
      <ActivityFilterBar
        accountLabel={accountLabel}
        setShowAccountSheet={setShowAccountSheet}
        viewMode={groupByMode}
        setViewMode={(mode) => {
          setGroupByMode(mode);
          setExpandedCategoryIds([]);
          if (mode === 'date') setCategoryDrilldown(null);
        }}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        setCashflowBucket={setCashflowBucket}
        setShowMoreSheet={setShowMoreSheet}
        moreActiveCount={moreActiveCount}
        palette={palette}
        chipScrollResetToken={chipScrollResetToken}
        periodNavigation={
          <ActivityPeriodHeader
            period={period}
            periodLabel={periodLabel}
            goPrev={goPrev}
            goNext={goNext}
            canGoNext={canGoNext}
            setShowPeriodSheet={handleOpenPeriodSheet}
            palette={palette}
          />
        }
      />

      {period !== 'all' ? (
        <View style={{ paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX }}>
          <SummaryCard cashflow={summaryCardCashflow} sym={sym} palette={palette} />
        </View>
      ) : null}

      <View style={{ height: 1, backgroundColor: palette.divider, marginBottom: 14 }} />

      {groupByMode === 'category' && categoryDrilldown ? (
        <View
          style={{
            paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
            marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom
          }}
        >
          <TouchableOpacity delayPressIn={0}
            onPress={() => setCategoryDrilldown(null)}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8
            }}
          >
            <AppChevron direction="left" size={16} tone="secondary" palette={palette} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.bold, color: palette.text }}
            >
              {categoryDrilldown.compactLabel
                ? categoryDrilldown.parentLabel
                : `${categoryDrilldown.parentLabel} › ${categoryDrilldown.subLabel}`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  ), [accountLabel, setShowAccountSheet, groupByMode, setGroupByMode, setExpandedCategoryIds, setCategoryDrilldown, typeFilter, setTypeFilter, setCashflowBucket, setShowMoreSheet, moreActiveCount, palette, chipScrollResetToken, period, periodLabel, goPrev, goNext, canGoNext, handleOpenPeriodSheet, summaryCardCashflow, sym]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      {isSearchActive ? (
        <View
          onLayout={(event: LayoutChangeEvent) => setTopBarHeight(event.nativeEvent.layout.height)}
          style={[styles.topBar, { backgroundColor: palette.background, borderBottomColor: palette.divider, flexDirection: 'row', alignItems: 'center' }]}
        >
          <View style={[styles.searchBox, { backgroundColor: palette.surface, borderColor: palette.divider, flex: 1 }]}>
            <AppIcon name="search" size={15} color={palette.textMuted} />
            <TextInput
              autoFocus
              placeholder="Search transactions…"
              placeholderTextColor={palette.textSoft}
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1, fontSize: HOME_TEXT.body, color: palette.text, padding: 0 }}
              returnKeyType="search"
            />
            {search.length > 0 ? (
              <TouchableOpacity delayPressIn={0} onPress={() => setSearch('')}>
                <AppIcon name="x-circle" size={16} color={palette.textSoft} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity delayPressIn={0} onPress={() => toggleSearch(false)}>
            <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: BUTTON_TOKENS.text.compactLabelWeight, color: palette.brand, marginLeft: 12 }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          onLayout={(event: LayoutChangeEvent) => setTopBarHeight(event.nativeEvent.layout.height)}
          style={[styles.topBar, { backgroundColor: palette.background, borderBottomColor: palette.divider }]}
        >
          <View style={styles.topBarMainRow}>
            <Text style={{ fontSize: HOME_TEXT.screenTitle, fontWeight: FONT_WEIGHT.regular, color: palette.text, letterSpacing: -0.5 }}>
              Activity
            </Text>

            <Animated.View style={{
              alignSelf: 'center',
              opacity: resetBtnPresence,
              transform: [
                { scale: resetBtnPresence.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                { rotate: resetBtnSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
              ],
              pointerEvents: isDefaultView ? 'none' : 'auto',
            }}>
              <TouchableOpacity delayPressIn={0} activeOpacity={0.5} onPress={() => resetAllFilters(true)}>
                <AppIcon name="rotate-ccw" size={17} color={palette.brand} strokeWidth={2.4} />
              </TouchableOpacity>
            </Animated.View>

            <View style={{ flex: 1 }} />

            <PillIconButton
              icon="search"
              onPress={() => toggleSearch(true)}
              palette={palette}
            />
          </View>
        </View>
      )}

      <>
          {groupByMode === 'date' || categoryDrilldown ? (
            <FlashList
              ref={flatListRef}
              data={dateRows}
              keyExtractor={(item) => item.key}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
              onScroll={({ nativeEvent }) => {
                maybePrefetchMore(nativeEvent);
              }}
              scrollEventThrottle={32}
              onEndReached={onLoadMore}
              onEndReachedThreshold={0.6}
              viewabilityConfig={dateRowsViewabilityConfigRef.current}
              onViewableItemsChanged={handleDateRowsViewable}
              getItemType={(item) => item.type}
              drawDistance={900}
              maintainVisibleContentPosition={{ disabled: true }}
              contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets) }}
              ListHeaderComponent={activityHeader}
              ListFooterComponent={showLoadingMoreFooter ? (
                <View style={{ paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>
                    Loading...
                  </Text>
                </View>
              ) : null}
              ListEmptyComponent={
                !refreshing && !isTransitioning && (isDefaultView ? storeTransactionsLoaded : true) ? (
                  <View style={{ paddingTop: 4, paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX }}>
                    <EmptyStateCard
                      palette={palette}
                      title="No transactions found"
                      subtitle="Add transactions or widen your filters to see activity here."
                      illustration={<FinanceEmptyMascot palette={palette} variant="activity" />}
                    />
                  </View>
                ) : null
              }
              renderItem={renderDateRow}
            />
          ) : null}

          {showStickyDateLabel && stickyDateLabel && !isSearchActive && (groupByMode === 'date' || categoryDrilldown) ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: insets.top + topBarHeight,
                left: 0,
                right: 0,
                height: 34,
                paddingLeft: ACTIVITY_LAYOUT.groupHeaderPaddingX,
                paddingRight: ACTIVITY_LAYOUT.headerPaddingX + 10,
                backgroundColor: palette.background,
                flexDirection: 'row',
                alignItems: 'center',
                zIndex: 20,
              }}
            >
              <Text
                appWeight="medium"
                numberOfLines={1}
                style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}
              >
                {stickyDateLabel.title}
                <Text style={{ color: palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>
                  {stickyDateLabel.subtitle ? `  •  ${stickyDateLabel.subtitle}` : ''}
                </Text>
              </Text>
            </View>
          ) : null}

          {groupByMode === 'category' && !categoryDrilldown ? (
            <ScrollView
              ref={scrollViewRef}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
              contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets) }}
            >
              <>
                {activityHeader}
                <View>
                  {hierarchySections.map((section, sectionIndex) => (
                    <View key={section.key}>
                      {(() => {
                        const expandableParentKeys = section.items
                          .filter((category) => category.familyKey !== 'loan' && category.familyKey !== 'transfer')
                          .map((category) => category.parentKey);
                        const allExpanded =
                          expandableParentKeys.length > 0 &&
                          expandableParentKeys.every((key) => expandedCategoryIds.includes(key));

                        const sectionHeaderStyle = {
                          flexDirection: 'row' as const,
                          alignItems: 'center' as const,
                          paddingHorizontal: CARD_PADDING,
                          paddingTop: sectionIndex === 0 ? 0 : 6,
                          paddingBottom: 7,
                        };

                        const sectionHeaderContent = (
                          <>
                            <Text
                              appWeight="medium"
                              style={{
                                flex: 1,
                                fontSize: HOME_TEXT.tiny + 1,
                                fontWeight: FONT_WEIGHT.heavy,
                                letterSpacing: 0.8,
                                textTransform: 'uppercase',
                                color: palette.text,
                              }}
                            >
                              {section.label}
                            </Text>
                            {expandableParentKeys.length > 0 ? (
                              <AppIcon
                                name={allExpanded ? 'chevrons-up' : 'chevrons-down'}
                                size={15}
                                color={palette.text}
                                strokeWidth={1.8}
                              />
                            ) : null}
                          </>
                        );

                        return expandableParentKeys.length > 0 ? (
                          <TouchableOpacity
                            delayPressIn={0}
                            onPress={() => toggleSectionExpansion(expandableParentKeys)}
                            activeOpacity={0.72}
                            style={sectionHeaderStyle}
                          >
                            {sectionHeaderContent}
                          </TouchableOpacity>
                        ) : (
                          <View
                            style={sectionHeaderStyle}
                          >
                            {sectionHeaderContent}
                          </View>
                        );
                      })()}
                      <CardSection palette={palette}>
                        {section.items.map((category, categoryIndex) => {
                          const isExpanded = expandedCategoryIds.includes(category.parentKey);
                          const isDirectNavigation = category.familyKey === 'loan' || category.familyKey === 'transfer';
                          const isLastCategory = categoryIndex === section.items.length - 1;
                          const syntheticCfg = category.parentSyntheticType ? (txTypeConfig as any)[category.parentSyntheticType] : undefined;
                          return (
                            <View key={category.parentKey}>
                              <TouchableOpacity delayPressIn={0}
                                onPress={() => {
                                  if (category.familyKey === 'loan') {
                                    setCategoryDrilldown({
                                      parentKey: category.parentKey,
                                      parentLabel: 'Loans',
                                      subKey: 'type:loan',
                                      subLabel: 'Loans',
                                      compactLabel: true
                                    });
                                    return;
                                  }

                                  if (category.familyKey === 'transfer') {
                                    setCategoryDrilldown({
                                      parentKey: category.parentKey,
                                      parentLabel: 'Transfers',
                                      subKey: 'type:transfer',
                                      subLabel: 'Transfers',
                                      compactLabel: true
                                    });
                                    return;
                                  }

                                  toggleCategoryExpansion(category.parentKey);
                                }}
                                activeOpacity={0.75}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  paddingVertical: 12,
                                  paddingHorizontal: CARD_PADDING,
                                  minHeight: 70,
                                  backgroundColor: palette.card,
                                  borderBottomWidth: isLastCategory && (!isExpanded || isDirectNavigation) ? 0 : 1,
                                  borderBottomColor: palette.divider,
                                  gap: 12
                                }}
                              >
                                <CategoryIconBadge
                                  icon={
                                    category.parentSyntheticType === 'loan'
                                      ? 'credit-card'
                                      : syntheticCfg?.iconName || category.parentIcon
                                  }
                                  palette={palette}
                                  iconColor={palette.brand}
                                  size={HOME_LAYOUT.listIconSize}
                                  iconSize={HOME_LAYOUT.listIconInnerSize}
                                  strokeWidth={HOME_LAYOUT.listIconStrokeWidth}
                                  noBackground
                                />
                                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.text, flex: 1 }} numberOfLines={1}>
                                  {category.parentLabel}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: HOME_TEXT.bodySmall,
                                    fontWeight: FONT_WEIGHT.medium,
                                    color: category.total >= 0 ? palette.numberPositive : palette.numberNegative,
                                    marginRight: 2
                                  }}
                                >
                                  {signedCurrency(category.total, sym)}
                                </Text>
                                {isDirectNavigation ? (
                                  <AppChevron direction="right" size={18} tone="secondary" palette={palette} />
                                ) : (
                                  <AppChevron direction={isExpanded ? 'up' : 'down'} size={18} tone="secondary" palette={palette} />
                                )}
                              </TouchableOpacity>

                              {isExpanded && !isDirectNavigation ? (
                                <View
                                  style={{
                                    backgroundColor: palette.surface,
                                    borderBottomWidth: isLastCategory ? 0 : 1,
                                    borderBottomColor: palette.divider
                                  }}
                                >
                                  {category.subcategories.map((sub) => (
                                    <TouchableOpacity delayPressIn={0}
                                      key={sub.subKey}
                                      onPress={() =>
                                        setCategoryDrilldown({
                                          parentKey: category.parentKey,
                                          parentLabel: category.parentLabel,
                                          subKey: sub.subKey,
                                          subLabel: sub.subLabel
                                        })
                                      }
                                      activeOpacity={0.75}
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: 12,
                                        paddingLeft: CARD_PADDING + 40,
                                        paddingRight: CARD_PADDING,
                                        minHeight: 52,
                                        borderTopWidth: 1,
                                        borderTopColor: palette.divider,
                                        backgroundColor: palette.surface,
                                      }}
                                    >
                                      <Text numberOfLines={1} style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>
                                        {sub.subLabel}
                                      </Text>
                                      <Text
                                        style={{
                                          fontSize: HOME_TEXT.bodySmall,
                                          fontWeight: FONT_WEIGHT.medium,
                                          color: sub.total >= 0 ? palette.numberPositive : palette.numberNegative,
                                          marginRight: 10
                                        }}
                                      >
                                        {signedCurrency(sub.total, sym)}
                                      </Text>
                                      <AppChevron direction="right" size={16} tone="secondary" palette={palette} />
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </CardSection>
                    </View>
                  ))}
                </View>
              </>
            </ScrollView>
          ) : null}
        </>

      {showAccountSheet ? (
        <BottomSheet title="Select Account" palette={palette} onClose={() => setShowAccountSheet(false)} hasNavBar>
          <ChoiceRow
            title="All Accounts"
            selected={selectedAccountId === 'all'}
            palette={palette}
            leftElement={<AccountTypeBadge palette={palette} />}
            onPress={() => {
              setSelectedAccountId('all');
              setShowAccountSheet(false);
              queueScrollToTop(false);
            }}
            noBorder={accounts.length === 0}
          />
          {accounts.map((account, index) => (
            <ChoiceRow
              key={account.id}
              title={account.name}
              subtitle={getAccountTypeLabel(account.type)}
              selected={selectedAccountId === account.id}
              palette={palette}
              leftElement={<AccountTypeBadge account={account} palette={palette} />}
              onPress={() => {
                setSelectedAccountId(account.id);
                setShowAccountSheet(false);
                queueScrollToTop(false);
              }}
              noBorder={index === accounts.length - 1}
            />
          ))}
        </BottomSheet>
      ) : null}

      {showPeriodSheet ? (
        <BottomSheet
          title="Period"
          palette={palette}
          onClose={() => setShowPeriodSheet(false)}
          hasNavBar
        >
          <ChoiceRow
            title="All Time"
            selected={pendingPeriod === 'all'}
            palette={palette}
            onPress={() => applyPeriodDirectly('all')}
          />
          <ChoiceRow
            title="Today"
            subtitle={formatDateFull(new Date().toISOString())}
            selected={pendingPeriod === 'day'}
            palette={palette}
            onPress={() => applyPeriodDirectly('day')}
          />
          <ChoiceRow
            title="This Week"
            subtitle={formatRangeLabel('week', yearStart, 0)}
            selected={pendingPeriod === 'week'}
            palette={palette}
            onPress={() => applyPeriodDirectly('week')}
          />
          <ChoiceRow
            title="This Month"
            subtitle={formatRangeLabel('month', yearStart, 0)}
            selected={pendingPeriod === 'month'}
            palette={palette}
            onPress={() => applyPeriodDirectly('month')}
          />
          <ChoiceRow
            title="This Year"
            subtitle={formatRangeLabel('year', yearStart, 0)}
            selected={pendingPeriod === 'year'}
            palette={palette}
            onPress={() => applyPeriodDirectly('year')}
          />
          <View style={{ backgroundColor: palette.background, paddingHorizontal: CARD_PADDING, paddingTop: 10, paddingBottom: 16, borderTopWidth: 1, borderTopColor: palette.divider }}>
            <ListHeading label="Custom Range" palette={palette} paddingHorizontal={0} paddingTop={0} paddingBottom={10} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <TouchableOpacity delayPressIn={0}
                onPress={openCustomFromPicker}
                style={[
                  styles.dateField,
                  {
                    borderColor: (pendingPeriod === 'custom' || pendingCustomFrom) ? palette.brand : palette.divider,
                    backgroundColor: palette.surface,
                    justifyContent: 'center',
                  },
                ]}
              >
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: (pendingCustomFrom || customFrom) ? palette.text : palette.textSoft }}>
                  {pendingCustomFrom ? formatDateFull(pendingCustomFrom) : (customFrom ? formatDateFull(customFrom) : 'From')}
                </Text>
              </TouchableOpacity>

              <AppIcon name="arrow-right" size={18} color={palette.textSoft} />

              <TouchableOpacity delayPressIn={0}
                onPress={openCustomToPicker}
                style={[
                  styles.dateField,
                  {
                    borderColor: (pendingPeriod === 'custom' || pendingCustomTo) ? palette.brand : palette.divider,
                    backgroundColor: palette.surface,
                    justifyContent: 'center',
                  },
                ]}
              >
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: (pendingCustomTo || customTo) ? palette.text : palette.textSoft }}>
                  {pendingCustomTo ? formatDateFull(pendingCustomTo) : (customTo ? formatDateFull(customTo) : 'To')}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity delayPressIn={0}
              onPress={handleApplyPeriod}
              style={[
                styles.applyBtn,
                {
                  height: 48,
                  borderRadius: HOME_RADIUS.pill,
                  backgroundColor: (pendingCustomFrom && pendingCustomTo) ? palette.brand : palette.borderSoft
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.bold, color: palette.onBrand }}>
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>
      ) : null}

      {showMoreSheet ? (
        <ActivityMoreFiltersSheet
          selectedCategoryIds={selectedCategoryIds}
          toggleCategoryId={toggleCategoryId}
          toggleCategoryFamily={toggleCategoryFamily}
          expandedCategoryIds={expandedCategoryIds}
          toggleCategoryExpansion={toggleCategoryExpansion}
          selectedTagIds={selectedTagIds}
          toggleTagId={toggleTagId}
          amountMinStr={amountMinStr}
          setAmountMinStr={setAmountMinStr}
          amountMaxStr={amountMaxStr}
          setAmountMaxStr={setAmountMaxStr}
          setShowMoreSheet={setShowMoreSheet}
          categories={categories}
          tags={tags}
          transactions={transactions}
          palette={palette}
          clearAll={() => {
            setSelectedCategoryIds([]);
            setSelectedTagIds([]);
            setAmountMinStr('');
            setAmountMaxStr('');
            setExpandedCategoryIds([]);
            setGroupByMode('date');
            setCategoryDrilldown(null);
          }}
        />
      ) : null}

      {refreshing && hasContent ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + ACTIVITY_LAYOUT.headerPaddingTop + 6,
            right: ACTIVITY_LAYOUT.headerPaddingX,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ActivityIndicator size="small" color={palette.brand} />
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>
            Refreshing
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function signedCurrency(value: number, sym: string) {
  const abs = Math.abs(value);
  return formatCurrency(abs, sym);
}

function formatRangeLabel(period: 'week' | 'month' | 'year', yearStart: number, offset: number) {
  const range = getNavigableDateRange(period, offset, yearStart);
  return getPeriodNavLabel(period, range.from, range.to);
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 0
  },
  topBarMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  dateField: {
    flex: 1,
    borderRadius: HOME_RADIUS.chip,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  applyBtn: {
    marginTop: 12,
    borderRadius: HOME_RADIUS.chip,
    paddingVertical: 13,
    alignItems: 'center'
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  }
});
