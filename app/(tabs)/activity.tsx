import { Text } from '@/components/ui/AppText';
import { useIsFocused } from '@react-navigation/native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  InteractionManager,
  LayoutAnimation,
  LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountFilterSheet } from '../../components/activity/AccountFilterSheet';
import { ActivityFilterBar } from '../../components/activity/ActivityFilterBar';
import { ActivityMoreFiltersSheet } from '../../components/activity/ActivityMoreFiltersSheet';
import { ActivityPeriodHeader } from '../../components/activity/ActivityPeriodHeader';
import { CategoryIconBadge } from '../../components/activity/ActivityUI';
import { PeriodFilterSheet } from '../../components/activity/PeriodFilterSheet';
import { CardSection } from '../../components/settings-ui';
import { SummaryCard } from '../../components/SummaryCard';
import { TransactionListItem } from '../../components/TransactionListItem';
import { OutlinedButton } from '../../components/ui/AppButton';
import { AppChevron } from '../../components/ui/AppChevron';
import { AppIcon } from '../../components/ui/AppIcon';
import { EmptyStateCard } from '../../components/ui/EmptyStateCard';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { HeaderResetButton } from '../../components/ui/HeaderResetButton';
import { HeaderSearchBar, HeaderSearchTrigger } from '../../components/ui/HeaderSearchBar';
import { getScrollableBottomPadding } from '../../components/ui/safeBottom';
import { getActivityDisplayedCashflow, getActivityDrilldownTransactions } from '../../lib/activityCashflow';
import { getCategoryDisplayIcon } from '../../lib/category-utils';
import {
  APP_LOCALE,
  getRelativeDateLabel
} from '../../lib/dateUtils';
import {
  formatCurrency,
  getCashflowFromList,
  groupTransactionsByDate
} from '../../lib/derived';
import { CARD_PADDING, FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { ACTIVITY_LAYOUT, getTxTypeConfig, HOME_LAYOUT, HOME_RADIUS, HOME_TEXT, TRANSACTIONS_PAGE_SIZE } from '../../lib/layoutTokens';
import { registerTabReset } from '../../lib/tabResetRegistry';
import { useAppTheme } from '../../lib/theme';
import { filterTransactions } from '../../lib/transactionFilters';
import { DEFAULT_FILTER_PERIOD, useDateFilter } from '../../lib/useDateFilter';
import { useTransactionPress } from '../../lib/useTransactionPress';
import { getActivityPeriodCashflow, getActivityPeriodCashflowFromTransactions } from '../../services/analytics';
import * as transactionsService from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useActivityFiltersStore } from '../../stores/useActivityFiltersStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { ACTIVITY_VARIANT_LABEL, useDesignLabStore } from '../../stores/useDesignLabStore';
import { useFixedDepositsStore } from '../../stores/useFixedDepositsStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';
import type { CashflowSummary, Transaction, TransactionFilters, TransactionType } from '../../types';

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

const TICK_W = 2;
const TICK_GAP = 4;
const TICK_CONTAINER_W = Math.max(80, Dimensions.get('window').width - 2 * SCREEN_GUTTER - 2 * 14);
const TICK_TOTAL = Math.floor((TICK_CONTAINER_W + TICK_GAP) / (TICK_W + TICK_GAP));
const TICK_CONTENT_W = TICK_TOTAL * (TICK_W + TICK_GAP) - TICK_GAP;

function splitTickAmount(amount: number): { int: string; dec: string } {
  const abs = Math.abs(amount);
  const truncated = Math.floor(abs * 100) / 100;
  const intPart = Math.floor(truncated);
  const cents = Math.round((truncated - intPart) * 100);
  return {
    int: intPart.toLocaleString(APP_LOCALE),
    dec: cents > 0 ? '.' + String(cents).padStart(2, '0') : '',
  };
}

const METRIC_ARM_WINDOW_MS = 1200;

function useMetricSprings(tweenTrigger: number, leftAmount: number, rightAmount: number) {
  const leftSpring = useSharedValue(0);
  const rightSpring = useSharedValue(0);
  const lastTweenTriggerRef = useRef(tweenTrigger);
  const armedStampRef = useRef(0);
  const lastLeftAmountRef = useRef(leftAmount);
  const lastRightAmountRef = useRef(rightAmount);

  useEffect(() => {
    if (tweenTrigger !== lastTweenTriggerRef.current) {
      lastTweenTriggerRef.current = tweenTrigger;
      armedStampRef.current = performance.now();
    }

    const leftChanged = leftAmount !== lastLeftAmountRef.current;
    const rightChanged = rightAmount !== lastRightAmountRef.current;
    lastLeftAmountRef.current = leftAmount;
    lastRightAmountRef.current = rightAmount;

    if (armedStampRef.current === 0) return;
    if (performance.now() - armedStampRef.current > METRIC_ARM_WINDOW_MS) {
      armedStampRef.current = 0;
      return;
    }

    const springUp = (sv: typeof leftSpring) => {
      sv.value = -4;
      sv.value = withSpring(0, { damping: 12, stiffness: 220, mass: 0.6 });
    };

    if (leftChanged) springUp(leftSpring);
    if (rightChanged) springUp(rightSpring);
    if (leftChanged || rightChanged) armedStampRef.current = 0;
  }, [tweenTrigger, leftAmount, rightAmount, leftSpring, rightSpring]);

  const leftSpringStyle = useAnimatedStyle(() => ({ transform: [{ translateY: leftSpring.value }] }));
  const rightSpringStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rightSpring.value }] }));

  return { leftSpringStyle, rightSpringStyle };
}

function AnimatedMetricValue({
  style,
  children,
}: {
  style: ReturnType<typeof useMetricSprings>['leftSpringStyle'];
  children: React.ReactNode;
}) {
  return <Animated.View style={style}>{children}</Animated.View>;
}

const PREMIUM_ROW_STYLE = {
  backgroundColor: 'transparent',
  borderWidth: 0,
  borderLeftWidth: 0,
  borderRightWidth: 0,
  borderTopWidth: 0,
  borderBottomWidth: 0,
  borderRadius: 0,
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  paddingLeft: 8,
  paddingRight: 16,
  marginHorizontal: 0,
  shadowOpacity: 0,
  elevation: 0,
};

export default function ActivityScreen() {
  const isFocused = useIsFocused();
  const activityVariantRaw = useDesignLabStore((s) => s.activityVariant || 'card2');
  const activityVariant = __DEV__ ? activityVariantRaw : 'card2';
  const cycleActivityVariant = useDesignLabStore((s) => s.cycleActivityVariant);
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
    returnTo?: string;
  }>();
  const source = typeof routeParams.source === 'string' ? routeParams.source : undefined;
  const returnTo = typeof routeParams.returnTo === 'string' ? routeParams.returnTo : undefined;
  const isSourceDrivenActivity = !!source && source !== 'activity-tab';
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
  const storeMutationVersion = useTransactionsStore((s) => s.mutationVersion);
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
  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  const dateFilter = useDateFilter({ initialPeriod: DEFAULT_FILTER_PERIOD });
  const period = dateFilter.period;
  const periodOffset = dateFilter.offset;
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [cashflowBucket, setCashflowBucket] = useState<'all' | 'in' | 'out' | 'net'>('all');
  const [cashflowMode, setCashflowMode] = useState<'incomeExpense' | 'total'>('incomeExpense');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 150);
    return () => clearTimeout(handler);
  }, [search]);

  const filterButtonAnimation = useSharedValue(0);
  useEffect(() => {
    filterButtonAnimation.value = withSpring(isFiltersExpanded ? 1 : 0, {
      damping: 18,
      stiffness: 160,
      mass: 0.8,
    });
  }, [isFiltersExpanded]);

  const filterDotsStyle = useAnimatedStyle(() => {
    const rotation = `${filterButtonAnimation.value * 90}deg`;
    return {
      opacity: 1 - filterButtonAnimation.value,
      transform: [
        { scale: 1 - filterButtonAnimation.value * 0.15 },
        { rotate: rotation },
      ],
    };
  });

  const filterCloseStyle = useAnimatedStyle(() => {
    const rotation = `${(filterButtonAnimation.value - 1) * 90}deg`;
    return {
      opacity: filterButtonAnimation.value,
      transform: [
        { scale: 0.85 + filterButtonAnimation.value * 0.15 },
        { rotate: rotation },
      ],
    };
  });

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
  const activityHeaderHeightRef = useRef(0);
  const heightTimeoutRef = useRef<any>(null);

  // Reference activityHeaderHeight to trigger re-renders on layout change, satisfying TS compiler
  void activityHeaderHeight;

  const [stickyDateLabel, setStickyDateLabel] = useState<{ key: string; title: string; subtitle?: string } | null>(null);
  const [showStickyDateLabel, setShowStickyDateLabel] = useState(false);

  const handleOpenPeriodSheet = useCallback(() => {
    setShowPeriodSheet(true);
  }, []);

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
    dateFilter.setPeriod(DEFAULT_FILTER_PERIOD);
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
    setIsFiltersExpanded(false);
    // Don't null serverCashflow — the existing aggregate stays valid for the
    // default month view we just reset to. Nulling causes a flash of
    // local-derived (paginated) totals before the new aggregate arrives.
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
    if (!isFocused) {
      setIsFiltersExpanded(false);
    }
  }, [isFocused]);

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
      dateFilter.customRange?.from ?? '',
      dateFilter.customRange?.to ?? '',
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
    dateFilter.customRange?.from,
    dateFilter.customRange?.to,
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
  const lastSeenMutationVersionRef = useRef(0);

  const handleSourceBack = useCallback(() => {
    resetAllFilters(false);
    if (returnTo) {
      router.replace(returnTo as any);
      return true;
    }
    if (router.canGoBack()) {
      router.back();
      return true;
    }
    router.replace('/' as any);
    return true;
  }, [resetAllFilters, returnTo]);

  useEffect(() => {
    if (!isFocused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (groupByMode === 'category' && categoryDrilldown) {
        setCategoryDrilldown(null);
        return true;
      }
      if (isSourceDrivenActivity) {
        return handleSourceBack();
      }
      return false;
    });
    return () => sub.remove();
  }, [categoryDrilldown, groupByMode, handleSourceBack, isFocused, isSourceDrivenActivity]);

  const dateRange = useMemo(() => {
    if (period === 'all') return null;
    return { from: dateFilter.from, to: dateFilter.to };
  }, [dateFilter.from, dateFilter.to, period]);

  const derivedCashflowMode = useMemo(() => {
    if (typeFilter === 'transfer' || typeFilter === 'loan' || typeFilter === 'deposit') {
      return 'total';
    }
    if (cashflowBucket !== 'all' && typeFilter === 'all') {
      return 'total';
    }
    if (typeFilter === 'in' || typeFilter === 'out') {
      return 'incomeExpense';
    }
    return cashflowMode;
  }, [typeFilter, cashflowBucket, cashflowMode]);

  const remoteQuerySignature = useMemo(
    () =>
      [
        // `searchActive` is part of the sig so toggling search forces a reload —
        // we drop the period/account/type constraints in that mode and pull the
        // full set, so the previous query's result wouldn't satisfy this one.
        debouncedSearch.trim() ? 'search' : 'normal',
        period,
        periodOffset,
        dateRange?.from ?? '',
        dateRange?.to ?? '',
        selectedAccountId,
        typeFilter,
        cashflowBucket,
        derivedCashflowMode,
        groupByMode,
      ].join('|'),
    [cashflowBucket, derivedCashflowMode, dateRange?.from, dateRange?.to, groupByMode, period, periodOffset, debouncedSearch, selectedAccountId, typeFilter],
  );

  const canGoNext = dateFilter.canNavigateNext;
  const periodLabel = dateFilter.label;
  const selectedAccount =
    selectedAccountId === 'all' ? null : accounts.find((account) => account.id === selectedAccountId);
  const accountLabel = selectedAccount ? selectedAccount.name : 'All Accounts';
  // A view is default ONLY if we haven't come from a specific source, OR we have finished syncing params
  const isDefaultView =
    (!source || isInitialParamSyncComplete) &&
    period === 'month' &&
    periodOffset === 0 &&
    selectedAccountId === 'all' &&
    typeFilter === 'all' &&
    cashflowBucket === 'all' &&
    !debouncedSearch &&
    selectedCategoryIds.length === 0 &&
    selectedTagIds.length === 0 &&
    !amountMinStr &&
    !amountMaxStr;

  const isFullyDefault = isDefaultView && groupByMode === 'date';

  // The store fast-path serves the paginated All-Time *list*. The grouped (category)
  // view is an aggregate over the whole set, so it must NEVER read the paginated store —
  // it loads the full filtered set instead (see `loadAll` in loadData). This is what keeps
  // the grouped category cards matching the individual transactions.
  const useStoreFastPath = isDefaultView && groupByMode === 'date';

  const setHasActiveFilters = useActivityFiltersStore((s) => s.setHasActiveFilters);
  useEffect(() => {
    setHasActiveFilters(!isFullyDefault);
    return () => setHasActiveFilters(false);
  }, [isFullyDefault, setHasActiveFilters]);



  useEffect(() => {
    if (!isFocused) return;
    if (useStoreFastPath) {
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
  }, [useStoreFastPath, isFocused, isInitialParamSyncComplete, source, storeTransactionsLoaded]);

  const loadData = useMemo(
    () => async (isInitial: boolean) => {
      if (loadingRef.current && !isInitial) return;
      const requestId = ++requestIdRef.current;
      loadingRef.current = true;
      try {
        const currentOffset = isInitial ? 0 : offsetRef.current;
        const effectiveTypeFilter =
          typeFilter === 'transfer'
            ? undefined
            : typeFilter === 'all'
              ? undefined
              : typeFilter;
        // For a bounded period (day/week/month/year/custom) the result set is naturally
        // finite, so we load the WHOLE range in one shot (no pagination). That keeps the
        // visible list, per-date nets, and grouped/category totals all derived from the
        // complete set — so they reconcile exactly with the summary strip. Only the
        // unbounded "All Time" view stays paginated.
        // Load the whole set (no pagination) for a bounded period OR whenever the grouped
        // category view is showing — both need the complete set so totals reconcile.
        // When the user is searching, drop period/account/type constraints so search
        // results are drawn from the FULL transaction set — search is meant to ignore
        // every other filter (the client-side `filterTransactions` does the same).
        const searchActive = !!debouncedSearch.trim();
        const loadAll = searchActive || !!(dateRange?.from && dateRange?.to) || groupByMode === 'category';
        const filters: TransactionFilters = {
          accountId: searchActive ? undefined : (selectedAccountId === 'all' ? undefined : selectedAccountId),
          type: searchActive ? undefined : effectiveTypeFilter,
          fromDate: searchActive ? undefined : dateRange?.from,
          toDate: searchActive ? undefined : dateRange?.to,
          limit: loadAll ? undefined : TRANSACTIONS_PAGE_SIZE,
          offset: loadAll ? 0 : currentOffset
        };
        const cashflowOptions = {
          includeTransfers: derivedCashflowMode === 'total',
          includeLoans: derivedCashflowMode === 'total',
          includeDeposits: derivedCashflowMode === 'total',
        };
        const canDeriveTotalsFromResults = isInitial && loadAll && !!dateRange?.from && !!dateRange?.to && !searchActive;
        // Fetch paginated rows and (on initial load) server-side totals in parallel.
        // When this load already contains the complete bounded range, derive totals
        // from those rows instead of asking SQLite for the same scan again.
        const totalsPromise = isInitial && dateRange?.from && dateRange?.to && !searchActive && !canDeriveTotalsFromResults
          ? getActivityPeriodCashflow(
            selectedAccountId,
            dateRange.from,
            dateRange.to,
            cashflowOptions
          )
          : Promise.resolve(null);
        const [results, queriedTotals] = await Promise.all([
          transactionsService.getTransactions(filters),
          totalsPromise,
        ]);
        if (requestId !== requestIdRef.current) return;
        const totals = canDeriveTotalsFromResults
          ? getActivityPeriodCashflowFromTransactions(results, cashflowOptions)
          : queriedTotals;
        if (isInitial) {
          setTransactions(results);
          offsetRef.current = results.length;
          setHasMore(loadAll ? false : results.length === TRANSACTIONS_PAGE_SIZE);
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
    [cashflowBucket, derivedCashflowMode, dateRange?.from, dateRange?.to, groupByMode, period, periodOffset, remoteQuerySignature, debouncedSearch, selectedAccountId, typeFilter],
  );

  useEffect(() => {
    if (isFocused) {
      // Fast-path: the store already has correct data after write-before-close
      // mutations, so skip InteractionManager — read it immediately.
      if (useStoreFastPath) {
        const noNewMutations = lastSeenMutationVersionRef.current === storeMutationVersion;
        if (!storeTransactionsLoaded || !noNewMutations) {
          lastSeenMutationVersionRef.current = storeMutationVersion;
          if (!hasContent) setIsTransitioning(true);
          loadStoreTransactions().catch(() => undefined).finally(() => {
            setIsTransitioning(false);
          });
        }
      } else {
        // Custom-filtered path: heavier SQL queries benefit from waiting for
        // the navigation animation to finish before firing.
        const task = InteractionManager.runAfterInteractions(() => {
          // Only load data if we aren't waiting for an initial param sync
          if (!source || isInitialParamSyncComplete) {
            // We're on the custom (non-fast-path) read here, so only the local
            // `transactions` set counts as "loaded". If we just transitioned out of
            // the store fast-path (e.g. user added a category/tag/amount filter),
            // `storeTransactions` is populated but `transactions` is still empty —
            // `hasContent` would falsely report ready and skip the load, leaving
            // the filter to run over an empty array and show "No transactions".
            const queryUnchanged = transactions.length > 0 && lastLoadedRemoteQueryRef.current === remoteQuerySignature;
            const noNewMutations = lastSeenMutationVersionRef.current === storeMutationVersion;
            if (queryUnchanged && noNewMutations) {
              setIsTransitioning(false);
              return;
            }
            lastSeenMutationVersionRef.current = storeMutationVersion;
            if (!queryUnchanged) setIsTransitioning(true);
            loadData(true).finally(() => {
              setIsTransitioning(false);
            });
          }
        });
        return () => task.cancel();
      }
    }
  }, [hasContent, useStoreFastPath, isFocused, isInitialParamSyncComplete, loadData, loadStoreTransactions, remoteQuerySignature, source, storeMutationVersion, storeTransactionsLoaded]);

  // In default view, the FlashList reads `storeTransactions` directly via
  // `activeTransactions` below — we no longer mirror it into local `transactions`
  // state. We still mirror hasMore and the transition flag (cheap booleans),
  // and keep offsetRef in sync so `onLoadMore` in custom-view fallback works.
  useEffect(() => {
    if (!useStoreFastPath) return;
    setHasMore(storeTransactionsHasMore);
    offsetRef.current = storeTransactions.length;
    if (storeTransactionsLoaded) {
      setIsTransitioning(false);
      lastLoadedRemoteQueryRef.current = remoteQuerySignature;
    }
  }, [useStoreFastPath, remoteQuerySignature, storeTransactions.length, storeTransactionsHasMore, storeTransactionsLoaded]);

  // Fast-path serves a paginated 50-row window of the bounded period (last 30 days
  // by default), so the in-memory list is too narrow to compute correct totals for
  // the summary strip. Run the SQL-side aggregate in parallel — same source loadData
  // uses on the non-fast-path branch.
  useEffect(() => {
    if (!useStoreFastPath || !dateRange?.from || !dateRange?.to) return;
    let cancelled = false;
    const includeTotal = derivedCashflowMode === 'total';
    getActivityPeriodCashflow(
      selectedAccountId,
      dateRange.from,
      dateRange.to,
      { includeTransfers: includeTotal, includeLoans: includeTotal, includeDeposits: includeTotal },
    )
      .then((totals) => { if (!cancelled) setServerCashflow(totals); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [useStoreFastPath, dateRange?.from, dateRange?.to, derivedCashflowMode, selectedAccountId, storeMutationVersion]);

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

    dateFilter.setPeriod(DEFAULT_FILTER_PERIOD);
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

    // periodParam comes from deep-link callers. The pre-reset above already
    // landed us on the 'month' default; only override here for explicit values.
    if (periodParam === 'all' || periodParam === 'last30') {
      dateFilter.setPeriod(periodParam);
    } else if (periodParam === 'day' || periodParam === 'week' || periodParam === 'month' || periodParam === 'year') {
      dateFilter.setPeriod(periodParam === 'day' ? 'today' : periodParam);
    } else if (periodParam === 'custom' && typeof fromParam === 'string' && typeof toParam === 'string') {
      dateFilter.setCustomRange({ from: fromParam, to: toParam });
      dateFilter.setPeriod('custom');
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
      if (useStoreFastPath) {
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
  // Mirrors the store-pagination path (date list, All-Time). Category view loads in full,
  // so it must NOT take the store loadMore branch.
  const isDefaultViewRef = useRef(useStoreFastPath);
  isDefaultViewRef.current = useStoreFastPath;
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
      const headerHeight = activityHeaderHeightRef.current;
      const shouldShowStickyDate =
        headerHeight > 0 && nativeEvent.contentOffset.y >= headerHeight + 8;
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
    [onLoadMore],
  );

  const handleScroll = useCallback(
    ({ nativeEvent }: any) => {
      maybePrefetchMore(nativeEvent);
    },
    [maybePrefetchMore],
  );

  const goPrev = () => {
    if (period !== 'all' && period !== 'last30' && period !== 'custom') {
      dateFilter.navigatePrevious();
      queueScrollToTop(false);
    }
  };

  const goNext = () => {
    if (canGoNext) {
      dateFilter.navigateNext();
      queueScrollToTop(false);
    }
  };


  // In default view, read from the store directly — avoids a double-render
  // every time the store's transactions array updates.
  const sourceTransactions = useStoreFastPath ? storeTransactions : transactions;

  // Deposit lookup mirrors `loansById` — used to pass deposit name/bank
  // through to TransactionListItem for type='deposit' rows.
  const deposits = useFixedDepositsStore((s) => s.deposits);
  const depositsById = useMemo(() => new Map(deposits.map((d) => [d.id, d])), [deposits]);

  const filteredTransactions = useMemo(() => {
    return filterTransactions(
      sourceTransactions,
      {
        accountId: selectedAccountId,
        typeFilter,
        cashflowBucket,
        cashflowMode: derivedCashflowMode,
        selectedCategoryIds,
        selectedTagIds,
        amountMin: amountMinStr ? Number(amountMinStr) : undefined,
        amountMax: amountMaxStr ? Number(amountMaxStr) : undefined,
        searchQuery: debouncedSearch,
      },
      {
        categories,
        accountsById,
        tagNamesById,
        loansById,
        getCategoryFullDisplayName,
      }
    );
  }, [
    sourceTransactions,
    selectedAccountId,
    typeFilter,
    cashflowBucket,
    derivedCashflowMode,
    selectedCategoryIds,
    selectedTagIds,
    amountMinStr,
    amountMaxStr,
    debouncedSearch,
    categories,
    accountsById,
    tagNamesById,
    loansById,
    getCategoryFullDisplayName,
  ]);

  const drilldownTransactions = useMemo(
    () => getActivityDrilldownTransactions(filteredTransactions, categoryDrilldown),
    [categoryDrilldown, filteredTransactions],
  );
  const includeTotalCashflow = derivedCashflowMode === 'total';
  const includeTransfersForCurrentView =
    includeTotalCashflow || (selectedAccountId !== 'all' && categoryDrilldown?.subKey === 'type:transfer');
  const includeLoansForCurrentView = includeTotalCashflow || categoryDrilldown?.subKey === 'type:loan';
  const includeDepositsForCurrentView = includeTotalCashflow || categoryDrilldown?.subKey === 'type:deposit';
  const displayedCashflow = useMemo(
    () => getActivityDisplayedCashflow(
      filteredTransactions,
      categoryDrilldown,
      includeTransfersForCurrentView,
      includeLoansForCurrentView,
      includeDepositsForCurrentView,
    ),
    [
      categoryDrilldown,
      filteredTransactions,
      includeDepositsForCurrentView,
      includeLoansForCurrentView,
      includeTransfersForCurrentView,
    ],
  );

  const summaryUsesLocalScope =
    categoryDrilldown !== null ||
    selectedCategoryIds.length > 0 ||
    selectedTagIds.length > 0 ||
    !!amountMinStr ||
    !!amountMaxStr ||
    !!debouncedSearch.trim();

  // SummaryCard totals: use server-side aggregate (accurate for paginated base pages)
  // when available; for local-only scopes, use the exact rows visible on screen.
  // Apply cashflowBucket so the card matches the filtered list — when viewing only income,
  // only show income total; when viewing only expenses, only show expense total.
  const baseCashflow = useMemo(() => {
    return summaryUsesLocalScope ? displayedCashflow : (serverCashflow ?? displayedCashflow);
  }, [summaryUsesLocalScope, displayedCashflow, serverCashflow]);

  const summaryCardCashflow = useMemo((): CashflowSummary => {
    if (cashflowBucket === 'in') return { in: baseCashflow.in, out: 0, net: baseCashflow.in };
    if (cashflowBucket === 'out') return { in: 0, out: baseCashflow.out, net: -baseCashflow.out };
    return baseCashflow;
  }, [baseCashflow, cashflowBucket]);

  const metricLeftAmount = baseCashflow.in;
  const metricRightAmount = baseCashflow.out;
  const netAmount = baseCashflow.net;

  const tickIn = metricLeftAmount;
  const tickOut = metricRightAmount;
  const totalTick = tickIn + tickOut;
  const incomeFraction = totalTick > 0 ? tickIn / totalTick : 0.5;
  const animatedIncomeFraction = useSharedValue(incomeFraction);
  const tickActivityProgress = useSharedValue(totalTick > 0 ? 1 : 0);

  const prevTotalTickRef = useRef(totalTick);

  useEffect(() => {
    if (totalTick > 0) {
      if (prevTotalTickRef.current === 0) {
        animatedIncomeFraction.value = incomeFraction;
      } else {
        animatedIncomeFraction.value = withSpring(incomeFraction, { damping: 26, stiffness: 180, mass: 0.9, overshootClamping: true });
      }
    }
    tickActivityProgress.value = withTiming(totalTick > 0 ? 1 : 0, { duration: 250 });
    prevTotalTickRef.current = totalTick;
  }, [tickIn, tickOut, incomeFraction, totalTick]);

  const detailIncomeTickOverlayStyle = useAnimatedStyle(() => {
    const progress = tickActivityProgress.value;
    const fraction = animatedIncomeFraction.value;
    const greenTicksCount = Math.round(fraction * TICK_TOTAL);
    const currentGreenTicks = greenTicksCount * progress;
    const width = currentGreenTicks > 0
      ? currentGreenTicks * TICK_W + (currentGreenTicks - 1) * TICK_GAP
      : 0;
    return {
      width: Math.max(0, width),
    };
  });

  const detailExpenseTickOverlayStyle = useAnimatedStyle(() => {
    const progress = tickActivityProgress.value;
    const fraction = animatedIncomeFraction.value;
    const greenTicksCount = Math.round(fraction * TICK_TOTAL);
    const redTicksCount = TICK_TOTAL - greenTicksCount;
    const currentRedTicks = redTicksCount * progress;
    const width = currentRedTicks > 0
      ? currentRedTicks * TICK_W + (currentRedTicks - 1) * TICK_GAP
      : 0;
    return {
      width: Math.max(0, width),
      right: 0,
    };
  });

  const premiumInflowLineStyle = useAnimatedStyle(() => {
    const fraction = animatedIncomeFraction.value;
    const progress = tickActivityProgress.value;
    const gap = (fraction > 0 && fraction < 1) ? 2 : 0;
    const targetW = fraction * TICK_CONTENT_W - gap;
    return {
      width: Math.max(0, targetW * progress),
    };
  });

  const premiumOutflowLineStyle = useAnimatedStyle(() => {
    const fraction = animatedIncomeFraction.value;
    const progress = tickActivityProgress.value;
    const gap = (fraction > 0 && fraction < 1) ? 2 : 0;
    const targetW = (1 - fraction) * TICK_CONTENT_W - gap;
    return {
      width: Math.max(0, targetW * progress),
    };
  });

  const { leftSpringStyle, rightSpringStyle } = useMetricSprings(
    storeMutationVersion,
    metricLeftAmount,
    metricRightAmount
  );

  const detailCashflowNoteProgress = useSharedValue(0);
  useEffect(() => {
    detailCashflowNoteProgress.value = withTiming(cashflowMode === 'total' ? 1 : 0, { duration: 220 });
  }, [cashflowMode]);

  const detailCashflowNoteStyle = useAnimatedStyle(() => ({
    height: detailCashflowNoteProgress.value * 22,
    opacity: detailCashflowNoteProgress.value,
    overflow: 'hidden',
  }));

  const isCashflowFilterActiveInMore = cashflowBucket !== 'all';

  const moreActiveCount =
    selectedCategoryIds.length +
    selectedTagIds.length +
    (amountMinStr ? 1 : 0) +
    (amountMaxStr ? 1 : 0) +
    (isCashflowFilterActiveInMore ? 1 : 0);


  const toggleCategoryExpansion = (id: string) => {
    setExpandedCategoryIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };



  const handleTransactionPress = useTransactionPress();

  const grouped = useMemo<ActivityGroup[]>(() => {
    return groupTransactionsByDate(categoryDrilldown ? drilldownTransactions : filteredTransactions).map((group) => {
      const { date, label } = getRelativeDateLabel(group.dateKey);
      const items = group.items.slice().sort((a, b) => {
        // Within same deposit: closed (principal) before interest income
        if (a.depositId && a.depositId === b.depositId) {
          const aOrder = a.depositTransactionType === 'closed' ? 0 : 1;
          const bOrder = b.depositTransactionType === 'closed' ? 0 : 1;
          return aOrder - bOrder;
        }
        return 0;
      });
      return {
        groupKey: group.dateKey,
        title: date,
        subtitle: label || undefined,
        net: getCashflowFromList(
          items,
          includeTransfersForCurrentView,
          includeLoansForCurrentView,
          includeDepositsForCurrentView,
        ).net,
        items,
      };
    });
  }, [
    categoryDrilldown,
    drilldownTransactions,
    filteredTransactions,
    includeDepositsForCurrentView,
    includeLoansForCurrentView,
    includeTransfersForCurrentView,
  ]);
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
      if (tx.type === 'deposit') return 'deposit';
      return 'transfer';
    };

    const getFamilyOrder = (familyKey: HierarchyFamily) => {
      // Match the add-form chips / more cards order: Income, Expense, Transfers, Deposits, Loans.
      if (familyKey === 'in') return 0;
      if (familyKey === 'out') return 1;
      if (familyKey === 'transfer') return 2;
      if (familyKey === 'deposit') return 3;
      return 4; // loan
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
                : tx.type === 'deposit'
                  ? 'Deposit'
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
              : tx.type === 'deposit'
                ? 'Deposit'
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
      .map((entry) => {
        const includeTransfersForEntry =
          includeTotalCashflow || (entry.familyKey === 'transfer' && selectedAccountId !== 'all');
        return {
          parentKey: entry.parentKey,
          parentLabel: entry.parentLabel,
          parentIcon: entry.parentIcon,
          parentSyntheticType: entry.parentSyntheticType,
          total: getCashflowFromList(
            entry.transactions,
            includeTransfersForEntry,
            entry.familyKey === 'loan' ? true : includeTotalCashflow,
            includeTotalCashflow
          ).net,
          transactions: entry.transactions,
          subcategories: Array.from(entry.subMap.values())
            .map((sub) => ({
              subKey: sub.subKey,
              subLabel: sub.subLabel,
              total: getCashflowFromList(
                sub.transactions,
                includeTransfersForEntry,
                entry.familyKey === 'loan' ? true : includeTotalCashflow,
                includeTotalCashflow
              ).net,
              transactions: sub.transactions
            }))
            .sort((a, b) => a.subLabel.localeCompare(b.subLabel, 'en', { sensitivity: 'base' })),
          familyOrder: entry.familyOrder,
          familyKey: entry.familyKey
        };
      })
      .sort((a, b) => {
        if (a.familyOrder !== b.familyOrder) return a.familyOrder - b.familyOrder;
        return a.parentLabel.localeCompare(b.parentLabel, 'en', { sensitivity: 'base' });
      });
  }, [categoriesById, filteredTransactions, includeTotalCashflow, selectedAccountId]);

  const hierarchySections = useMemo(
    () =>
      ([
        { key: 'in', label: 'Income' },
        { key: 'out', label: 'Expenses' },
        { key: 'transfer', label: 'Transfers' },
        { key: 'deposit', label: 'Deposits' },
        { key: 'loan', label: 'Loans' },
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

  // The sticky label should reflect the topmost visible item. Under a 1% visibility 
  // threshold config, we keep the header locked to the current date until its last 
  // item scrolls completely off-screen.
  const pickStickyIndex = (
    viewableItems: Array<{ item: ActivityDateRow; index: number | null; isViewable: boolean }>,
  ): number | null => {
    const sorted = viewableItems
      .filter((item) => item.isViewable && item.index != null)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    return sorted[0]?.index ?? null;
  };

  const handleDateRowsViewableChanged = useRef<any>(null);
  handleDateRowsViewableChanged.current = ({ viewableItems }: any) => {
    updateStickyDateFromIndex(pickStickyIndex(viewableItems));
  };

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
        const isPremium = activityVariant === 'premium';
        return (
          <View
            style={{
              height: item.isFirst ? 30 : 54,
              paddingLeft: isPremium ? ACTIVITY_LAYOUT.headerPaddingX : ACTIVITY_LAYOUT.groupHeaderPaddingX,
              paddingRight: isPremium ? 24 : ACTIVITY_LAYOUT.headerPaddingX + 10,
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
              style={
                isPremium
                  ? {
                    fontSize: 10,
                    fontWeight: FONT_WEIGHT.bold,
                    color: palette.textSecondary,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }
                  : { fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }
              }
            >
              {item.title}
              <Text style={{ color: palette.textMuted, fontWeight: FONT_WEIGHT.medium, textTransform: isPremium ? 'uppercase' : 'none' }}>{labelSuffix}</Text>
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
      const txTags = tx.tags.length > 0
        ? tx.tags.map((tagId) => tagsById.get(tagId)).filter((value): value is { id: string; name: string; color: string } => !!value)
        : undefined;

      const rowItem = (
        <TransactionListItem
          tx={tx}
          sym={sym}
          palette={palette}
          isFirst={isFirst}
          isLast={isLast}
          isGrouped={true}
          txTags={txTags}
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
          noteNumberOfLines={1}
          onPress={handleTransactionPress}
          style={activityVariant === 'premium' ? PREMIUM_ROW_STYLE : undefined}
        />
      );

      if (activityVariant === 'premium') {
        return (
          <View style={{ marginHorizontal: ACTIVITY_LAYOUT.headerPaddingX }}>
            {rowItem}
            {!isLast && (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: palette.divider,
                  marginLeft: 48, // aligns under the text column (0px padding + 36px icon + 12px gap)
                  marginRight: 14, // matches the right padding
                  opacity: 0.6,
                }}
              />
            )}
          </View>
        );
      }

      return rowItem;
    },
    [accountsById, categoriesById, loansById, depositsById, tagNamesById, tagsById, getCategoryFullDisplayName, handleTransactionPress, palette, sym, activityVariant],
  );

  const activityHeader = useMemo(() => (
    <View
      onLayout={(event: LayoutChangeEvent) => {
        const nextHeight = event.nativeEvent.layout.height;
        activityHeaderHeightRef.current = nextHeight;

        if (heightTimeoutRef.current) clearTimeout(heightTimeoutRef.current);
        heightTimeoutRef.current = setTimeout(() => {
          setActivityHeaderHeight((current) => (Math.abs(current - nextHeight) > 1 ? nextHeight : current));
        }, 200); // 200ms matching transition duration
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
        cashflowBucket={cashflowBucket}
        setCashflowBucket={setCashflowBucket}
        setShowMoreSheet={setShowMoreSheet}
        moreActiveCount={moreActiveCount}
        palette={palette}
        chipScrollResetToken={chipScrollResetToken}
        isExpanded={isFiltersExpanded}
        setIsExpanded={setIsFiltersExpanded}
        hidePeriodNavigation={activityVariant === 'card2' || activityVariant === 'premium'}
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

      {/* CARD 2 REDESIGN VARIANT CONTAINER */}
      {activityVariant === 'card2' && period !== 'all' ? (
        <View
          style={{
            borderRadius: HOME_RADIUS.card,
            borderWidth: 1,
            borderColor: palette.borderSoft,
            backgroundColor: palette.card,
            paddingTop: 16,
            paddingBottom: 12,
            paddingHorizontal: 18,
            marginBottom: 24,
            marginHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Row 1: Period switcher */}
          <View style={{ height: 28, width: TICK_CONTENT_W + 8, alignSelf: 'center', marginBottom: 0, marginTop: -4 }}>
            <ActivityPeriodHeader
              period={period === 'today' ? 'day' : period as 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'}
              periodLabel={
                typeFilter === 'in'
                  ? `${cashflowMode === 'total' ? 'Inflow' : 'Income'} · ${periodLabel}`
                  : typeFilter === 'out'
                    ? `${cashflowMode === 'total' ? 'Outflow' : 'Expenses'} · ${periodLabel}`
                    : periodLabel
              }
              goPrev={goPrev}
              goNext={goNext}
              canGoNext={canGoNext}
              setShowPeriodSheet={handleOpenPeriodSheet}
              palette={palette}
              height={28}
              noBackground={true}
              showArrowBorders={true}
            />
          </View>

          {/* Row 3: Ticks and Values */}
          <View style={{ paddingBottom: 0 }}>
            {/* Speedometer sweep ticks */}
            <View style={{ flexDirection: 'row', gap: TICK_GAP, marginTop: 12, marginBottom: 10, width: TICK_CONTENT_W, alignSelf: 'center' }}>
              {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }} />
              ))}
              <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: 12, overflow: 'hidden' }, detailIncomeTickOverlayStyle]}>
                <View style={{ flexDirection: 'row', gap: TICK_GAP, width: TICK_CONTENT_W }}>
                  {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                    <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.positive }} />
                  ))}
                </View>
              </Animated.View>
              <Animated.View style={[{ position: 'absolute', top: 0, height: 12, overflow: 'hidden' }, detailExpenseTickOverlayStyle]}>
                <View style={{ position: 'absolute', right: 0, flexDirection: 'row', gap: TICK_GAP, width: TICK_CONTENT_W }}>
                  {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                    <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.negative }} />
                  ))}
                </View>
              </Animated.View>
            </View>

            {/* Values (Income/Expense / Inflow/Outflow / Net in one row) */}
            {(() => {
              const leftSplit = splitTickAmount(metricLeftAmount);
              const rightSplit = splitTickAmount(metricRightAmount);
              const leftIsZero = metricLeftAmount === 0;
              const rightIsZero = metricRightAmount === 0;
              const leftSign = metricLeftAmount < 0 ? '-' : '';
              const rightSign = metricRightAmount < 0 ? '-' : '';
              return (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 2, width: TICK_CONTENT_W, alignSelf: 'center', alignItems: 'center' }}>
                  {/* Column 1: Income */}
                  <TouchableOpacity
                    delayPressIn={0}
                    activeOpacity={0.75}
                    onPress={() => {
                      setTypeFilter('in');
                      setCashflowBucket('all');
                    }}
                    style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <AppIcon
                        name="arrow-down-left"
                        size={14}
                        color={leftIsZero ? palette.textMuted : palette.positive}
                        strokeWidth={2.4}
                      />
                      <Text style={{ fontSize: 10, color: palette.textMuted, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                        {cashflowMode === 'total' ? 'Inflow' : 'Income'}
                      </Text>
                    </View>
                    <AnimatedMetricValue style={leftSpringStyle}>
                      <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.regular, color: leftIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }} numberOfLines={1}>
                        {leftIsZero ? '—' : (
                          <Text>{leftSign}{leftSplit.int}{leftSplit.dec ? <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.regular, color: palette.textMuted }}>{leftSplit.dec}</Text> : null}</Text>
                        )}
                      </Text>
                    </AnimatedMetricValue>
                  </TouchableOpacity>

                  {/* Divider 1 */}
                  <View style={{ width: 1, height: 22, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: 8 }} />

                  {/* Column 2: Expense */}
                  <TouchableOpacity
                    delayPressIn={0}
                    activeOpacity={0.75}
                    onPress={() => {
                      setTypeFilter('out');
                      setCashflowBucket('all');
                    }}
                    style={{ flex: 1, flexDirection: 'column', alignItems: 'center', gap: 2 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 10, color: palette.textMuted, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                        {cashflowMode === 'total' ? 'Outflow' : 'Expense'}
                      </Text>
                      <AppIcon
                        name="arrow-up-right"
                        size={14}
                        color={rightIsZero ? palette.textMuted : palette.negative}
                        strokeWidth={2.4}
                      />
                    </View>
                    <AnimatedMetricValue style={rightSpringStyle}>
                      <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.regular, color: rightIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }} numberOfLines={1}>
                        {rightIsZero ? '—' : (
                          <Text>{rightSign}{rightSplit.int}{rightSplit.dec ? <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.regular, color: palette.textMuted }}>{rightSplit.dec}</Text> : null}</Text>
                        )}
                      </Text>
                    </AnimatedMetricValue>
                  </TouchableOpacity>

                  {/* Divider 2 */}
                  <View style={{ width: 1, height: 22, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: 8 }} />

                  {/* Column 3: Net */}
                  <View style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 10, color: palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>
                        Net
                      </Text>
                      <AppIcon
                        name={netAmount >= 0 ? 'trending-up' : 'trending-down'}
                        size={14}
                        color={netAmount === 0 ? palette.textMuted : netAmount < 0 ? palette.negative : palette.positive}
                        strokeWidth={2.4}
                      />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.regular, color: netAmount === 0 ? palette.textMuted : netAmount < 0 ? palette.negative : palette.positive, letterSpacing: -0.4 }} numberOfLines={1} adjustsFontSizeToFit>
                      {netAmount === 0 ? '—' : formatCurrency(netAmount, sym)}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      ) : null}

      {activityVariant === 'premium' && period !== 'all' ? (
        <View
          style={{
            paddingTop: 12,
            paddingBottom: 16,
            marginBottom: 16,
            marginHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
          }}
        >
          {/* Row 1: Period Navigation (Minimal layout) */}
          <View style={{ height: 28, width: TICK_CONTENT_W + 8, alignSelf: 'center', marginBottom: 12 }}>
            <ActivityPeriodHeader
              period={period === 'today' ? 'day' : period as 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'}
              periodLabel={
                typeFilter === 'in'
                  ? `Income · ${periodLabel}`
                  : typeFilter === 'out'
                    ? `Expenses · ${periodLabel}`
                    : periodLabel
              }
              goPrev={goPrev}
              goNext={goNext}
              canGoNext={canGoNext}
              setShowPeriodSheet={handleOpenPeriodSheet}
              palette={palette}
              height={28}
              noBackground={true}
              showArrowBorders={false}
            />
          </View>

          {/* Row 2: Elegant Proportional 6px Cashflow Balance Capsules */}
          <View
            style={{
              width: TICK_CONTENT_W,
              height: 6,
              alignSelf: 'center',
              marginVertical: 14,
              position: 'relative',
            }}
          >
            {/* Proportional Income Fill */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  backgroundColor: palette.positive,
                  borderRadius: 3,
                },
                premiumInflowLineStyle,
              ]}
            />
            {/* Proportional Expense Fill */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  backgroundColor: palette.negative,
                  borderRadius: 3,
                },
                premiumOutflowLineStyle,
              ]}
            />
          </View>

          {/* Row 3: Values Row (Three equal columns, minimal text styling) */}
          {(() => {
            const leftSplit = splitTickAmount(metricLeftAmount);
            const rightSplit = splitTickAmount(metricRightAmount);
            const leftIsZero = metricLeftAmount === 0;
            const rightIsZero = metricRightAmount === 0;
            const leftSign = metricLeftAmount < 0 ? '-' : '';
            const rightSign = metricRightAmount < 0 ? '-' : '';

            return (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  width: TICK_CONTENT_W,
                  alignSelf: 'center',
                  alignItems: 'center',
                  marginTop: 6,
                }}
              >
                {/* Income / Inflow */}
                <TouchableOpacity
                  delayPressIn={0}
                  activeOpacity={0.75}
                  onPress={() => {
                    setTypeFilter('in');
                    setCashflowBucket('all');
                  }}
                  style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                >
                  <Text
                    style={{
                      fontSize: 8.5,
                      fontWeight: FONT_WEIGHT.semibold,
                      color: palette.textMuted,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                    }}
                  >
                    INCOME
                  </Text>
                  <AnimatedMetricValue style={leftSpringStyle}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: FONT_WEIGHT.regular,
                        color: leftIsZero ? palette.textMuted : palette.text,
                        letterSpacing: -0.3,
                      }}
                      numberOfLines={1}
                    >
                      {leftIsZero ? '—' : (
                        <Text>
                          {leftSign}{leftSplit.int}
                          {leftSplit.dec ? (
                            <Text style={{ fontSize: 10, color: palette.textMuted }}>{leftSplit.dec}</Text>
                          ) : null}
                        </Text>
                      )}
                    </Text>
                  </AnimatedMetricValue>
                </TouchableOpacity>

                {/* Vertical Divider */}
                <View
                  style={{
                    width: 1,
                    height: 16,
                    backgroundColor: palette.divider,
                    opacity: 0.5,
                    marginHorizontal: 4,
                  }}
                />

                {/* Expense / Outflow */}
                <TouchableOpacity
                  delayPressIn={0}
                  activeOpacity={0.75}
                  onPress={() => {
                    setTypeFilter('out');
                    setCashflowBucket('all');
                  }}
                  style={{ flex: 1, flexDirection: 'column', alignItems: 'center', gap: 2 }}
                >
                  <Text
                    style={{
                      fontSize: 8.5,
                      fontWeight: FONT_WEIGHT.semibold,
                      color: palette.textMuted,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                    }}
                  >
                    EXPENSES
                  </Text>
                  <AnimatedMetricValue style={rightSpringStyle}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: FONT_WEIGHT.regular,
                        color: rightIsZero ? palette.textMuted : palette.text,
                        letterSpacing: -0.3,
                      }}
                      numberOfLines={1}
                    >
                      {rightIsZero ? '—' : (
                        <Text>
                          {rightSign}{rightSplit.int}
                          {rightSplit.dec ? (
                            <Text style={{ fontSize: 10, color: palette.textMuted }}>{rightSplit.dec}</Text>
                          ) : null}
                        </Text>
                      )}
                    </Text>
                  </AnimatedMetricValue>
                </TouchableOpacity>

                {/* Vertical Divider */}
                <View
                  style={{
                    width: 1,
                    height: 16,
                    backgroundColor: palette.divider,
                    opacity: 0.5,
                    marginHorizontal: 4,
                  }}
                />

                {/* Net */}
                <View style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 8.5,
                      fontWeight: FONT_WEIGHT.semibold,
                      color: palette.textMuted,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                    }}
                  >
                    NET
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: FONT_WEIGHT.regular,
                      color: netAmount === 0 ? palette.textMuted : netAmount < 0 ? palette.negative : palette.positive,
                      letterSpacing: -0.3,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {netAmount === 0 ? '—' : formatCurrency(netAmount, sym)}
                  </Text>
                </View>
              </View>
            );
          })()}
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.divider, marginTop: 18, opacity: 0.4 }} />
        </View>
      ) : null}

      {activityVariant === 'current' && period !== 'all' ? (
        <View style={{ paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX }}>
          <SummaryCard cashflow={summaryCardCashflow} sym={sym} palette={palette} isCashflowMode={cashflowBucket !== 'all'} style={{ marginTop: 12, marginBottom: 32 }} />
        </View>
      ) : null}

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
            <AppIcon name="arrow-left" size={18} color={palette.text} strokeWidth={1.8} />
            <Text style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
              {categoryDrilldown.compactLabel
                ? categoryDrilldown.parentLabel
                : `${categoryDrilldown.parentLabel} \u203a ${categoryDrilldown.subLabel}`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  ), [
    accountLabel,
    setShowAccountSheet,
    groupByMode,
    setGroupByMode,
    setExpandedCategoryIds,
    setCategoryDrilldown,
    typeFilter,
    setTypeFilter,
    cashflowBucket,
    setCashflowBucket,
    derivedCashflowMode,
    setShowMoreSheet,
    moreActiveCount,
    palette,
    chipScrollResetToken,
    period,
    periodLabel,
    goPrev,
    goNext,
    canGoNext,
    handleOpenPeriodSheet,
    summaryCardCashflow,
    sym,
    isFiltersExpanded,
    setIsFiltersExpanded,
    activityVariant,
    cashflowMode,
    metricLeftAmount,
    metricRightAmount,
    netAmount,
    detailIncomeTickOverlayStyle,
    detailExpenseTickOverlayStyle,
    premiumInflowLineStyle,
    premiumOutflowLineStyle,
    leftSpringStyle,
    rightSpringStyle,
    detailCashflowNoteStyle,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      {isSearchActive ? (
        <HeaderSearchBar
          visible={isSearchActive}
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions…"
          onClose={() => toggleSearch(false)}
          palette={palette}
          onLayout={(event: LayoutChangeEvent) => setTopBarHeight(event.nativeEvent.layout.height)}
          style={{ borderBottomWidth: 1 }}
        />
      ) : (
        <View
          onLayout={(event: LayoutChangeEvent) => setTopBarHeight(event.nativeEvent.layout.height)}
          style={[styles.topBar, { backgroundColor: palette.background, borderBottomColor: palette.divider }]}
        >
          <View style={styles.topBarMainRow}>
            <Pressable
              onPress={__DEV__ ? cycleActivityVariant : undefined}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{
                fontSize: HOME_TEXT.screenTitle,
                fontWeight: activityVariant === 'premium' ? FONT_WEIGHT.semibold : FONT_WEIGHT.regular,
                color: palette.text,
                letterSpacing: activityVariant === 'premium' ? 1.0 : -0.5,
                textTransform: activityVariant === 'premium' ? 'uppercase' : 'none'
              }}>
                Activity
              </Text>

              {__DEV__ && activityVariant !== 'card2' && (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: palette.brand,
                    backgroundColor: palette.brandSoft,
                  }}
                >
                  <Text style={{
                    fontSize: 9.5,
                    fontWeight: FONT_WEIGHT.heavy,
                    color: palette.brand,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                  }}>
                    {ACTIVITY_VARIANT_LABEL[activityVariant]}
                  </Text>
                </View>
              )}
            </Pressable>

            <HeaderResetButton
              visible={!isFullyDefault}
              onPress={() => resetAllFilters(true)}
              palette={palette}
              isFocused={isFocused}
            />

            <View style={{ flex: 1 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <HeaderSearchTrigger
                onPress={() => toggleSearch(true)}
                palette={palette}
              />
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={0.75}
                onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
                style={{ paddingLeft: 4, paddingVertical: 6, paddingRight: 0, width: 24, height: 32, position: 'relative', justifyContent: 'center', alignItems: 'center' }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Animated.View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }, filterDotsStyle]}>
                  <AppIcon
                    name="more-vertical"
                    size={20}
                    color={palette.text}
                    strokeWidth={2}
                  />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }, filterCloseStyle]}>
                  <AppIcon
                    name="x"
                    size={20}
                    color={palette.text}
                    strokeWidth={2}
                  />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {isSearchActive ? (
        search.trim() === '' || debouncedSearch.trim() === '' ? (
          <View style={{ flex: 1, backgroundColor: palette.background }} />
        ) : (
          <FlashList
            ref={flatListRef}
            data={dateRows}
            keyExtractor={(item) => item.key}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
            onScroll={handleScroll}
            scrollEventThrottle={32}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.6}
            getItemType={(item) => item.type}
            drawDistance={900}
            maintainVisibleContentPosition={{ disabled: true }}
            contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets), paddingHorizontal: SCREEN_GUTTER }}
            ListFooterComponent={showLoadingMoreFooter ? (
              <View style={{ paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}>
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>
                  Loading...
                </Text>
              </View>
            ) : null}
            ListEmptyComponent={
              !refreshing && !isTransitioning ? (
                <View style={{ paddingTop: 40, alignItems: 'center', paddingHorizontal: 24 }}>
                  <Text style={{ fontSize: 14, color: palette.textMuted, textAlign: 'center' }}>
                    No transactions match "{debouncedSearch}"
                  </Text>
                </View>
              ) : null
            }
            renderItem={renderDateRow}
          />
        )
      ) : (
        <>
          {groupByMode === 'date' || categoryDrilldown ? (
            <FlashList
              ref={flatListRef}
              data={dateRows}
              keyExtractor={(item) => item.key}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
              onScroll={handleScroll}
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
                      footer={
                        period === 'month' && periodOffset === 0 ? (
                          <OutlinedButton
                            label="Show Last 30 Days"
                            onPress={() => dateFilter.setPeriod('last30')}
                            palette={palette}
                          />
                        ) : null
                      }
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
                paddingLeft: activityVariant === 'premium' ? ACTIVITY_LAYOUT.headerPaddingX : ACTIVITY_LAYOUT.groupHeaderPaddingX,
                paddingRight: activityVariant === 'premium' ? 24 : ACTIVITY_LAYOUT.headerPaddingX + 10,
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
                          .filter((category) => category.familyKey !== 'loan' && category.familyKey !== 'transfer' && category.familyKey !== 'deposit')
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
                          const isDirectNavigation = category.familyKey === 'loan' || category.familyKey === 'transfer' || category.familyKey === 'deposit';
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

                                  if (category.familyKey === 'deposit') {
                                    setCategoryDrilldown({
                                      parentKey: category.parentKey,
                                      parentLabel: 'Deposits',
                                      subKey: 'type:deposit',
                                      subLabel: 'Deposits',
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
                                    fontSize: HOME_TEXT.body,
                                    fontWeight: FONT_WEIGHT.semibold,
                                    // Lock color to the bucket role, not the sign of the value.
                                    // A negative income still belongs to the income bucket (green);
                                    // a negative expense (refund) still belongs to expense (red).
                                    // The leading minus on the value carries the direction signal.
                                    color: category.familyKey === 'in'
                                      ? palette.numberPositive
                                      : category.familyKey === 'out'
                                        ? palette.numberNegative
                                        : category.total >= 0 ? palette.numberPositive : palette.numberNegative,
                                    marginRight: 2
                                  }}
                                >
                                  {familyAwareCurrency(category.familyKey, category.total, sym)}
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
                                  {category.subcategories.map((sub) => {
                                    return (
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
                                          paddingLeft: CARD_PADDING + 52,
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
                                            // Sub inherits its parent's bucket role for coloring.
                                            color: category.familyKey === 'in'
                                              ? palette.numberPositive
                                              : category.familyKey === 'out'
                                                ? palette.numberNegative
                                                : sub.total >= 0 ? palette.numberPositive : palette.numberNegative,
                                            marginRight: 10
                                          }}
                                        >
                                          {familyAwareCurrency(category.familyKey, sub.total, sym)}
                                        </Text>
                                        <AppChevron direction="right" size={16} tone="secondary" palette={palette} />
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </CardSection>
                    </View>
                  ))}
                </View>
                {hierarchySections.length === 0 && (
                  <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
                    <EmptyStateCard
                      palette={palette}
                      title="No transactions found"
                      subtitle="Add transactions or widen your filters to see activity here."
                      illustration={<FinanceEmptyMascot palette={palette} variant="activity" />}
                    />
                  </View>
                )}
              </>
            </ScrollView>
          ) : null}
        </>
      )}

      {showAccountSheet ? (
        <AccountFilterSheet
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelect={(id) => {
            setSelectedAccountId(id);
            setShowAccountSheet(false);
            queueScrollToTop(false);
          }}
          onClose={() => setShowAccountSheet(false)}
          palette={palette}
        />
      ) : null}

      {showPeriodSheet ? (
        <PeriodFilterSheet
          period={period === 'today' ? 'day' : (period as any)}
          periodOffset={periodOffset}
          customFrom={dateFilter.customRange?.from}
          customTo={dateFilter.customRange?.to}
          yearStart={yearStart}
          palette={palette}
          onSelectPeriod={(nextPeriod, nextOffset) => {
            dateFilter.setPeriod(nextPeriod === 'day' ? 'today' : (nextPeriod as any));
            dateFilter.setOffset(nextOffset);
            setShowPeriodSheet(false);
            queueScrollToTop(false);
          }}
          onApplyCustom={(fromStr, toStr) => {
            dateFilter.setCustomRange({ from: fromStr, to: toStr });
            dateFilter.setPeriod('custom');
            setShowPeriodSheet(false);
            queueScrollToTop(false);
          }}
          onClose={() => setShowPeriodSheet(false)}
        />
      ) : null}

      {showMoreSheet ? (
        <ActivityMoreFiltersSheet
          selectedCategoryIds={selectedCategoryIds}
          selectedTagIds={selectedTagIds}
          amountMinStr={amountMinStr}
          amountMaxStr={amountMaxStr}
          categories={categories}
          tags={tags}
          palette={palette}
          cashflowBucket={cashflowBucket}
          onApply={({ selectedCategoryIds: nextCats, selectedTagIds: nextTags, amountMinStr: nextMin, amountMaxStr: nextMax, cashflowBucket: nextBucket }) => {
            setSelectedCategoryIds(nextCats);
            setSelectedTagIds(nextTags);
            setAmountMinStr(nextMin);
            setAmountMaxStr(nextMax);
            setTypeFilter('all');
            setCashflowBucket(nextBucket);
            setShowMoreSheet(false);
          }}
          onClose={() => setShowMoreSheet(false)}
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
  const formatted = formatCurrency(abs, sym);
  return value < 0 ? `-${formatted}` : formatted;
}

// Mirrors the list/card convention (getAmountPrefix with showAmountSign=false):
// income/expense bucket totals show their magnitude in the family color, with a sign
// ONLY when the net runs against the family (a refund/reversal flips it). Neutral
// families (loan/deposit/transfer) keep their signed net, since direction varies and
// the sign is meaningful there.
function familyAwareCurrency(familyKey: HierarchyFamily, total: number, sym: string) {
  if (familyKey === 'in' || familyKey === 'out') {
    // Natural value in the family's own direction: income is +net, expense is the outflow (-net).
    const naturalValue = familyKey === 'out' ? -total : total;
    const prefix = naturalValue < 0 ? '-' : '';
    return `${prefix}${formatCurrency(Math.abs(total), sym)}`;
  }
  return signedCurrency(total, sym);
}


const styles = StyleSheet.create({
  topBar: {
    paddingLeft: SCREEN_GUTTER,
    paddingRight: SCREEN_GUTTER,
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
