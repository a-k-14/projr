import { Text } from '@/components/ui/AppText';
import { Feather, Ionicons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  InteractionManager,
  LayoutAnimation,
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
import { BottomSheet } from '../../components/ui/BottomSheet';
import { EmptyStateCard } from '../../components/ui/EmptyStateCard';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { ListHeading } from '../../components/ui/ListHeading';
import { getActivityDisplayedCashflow, getActivityDrilldownTransactions } from '../../lib/activityCashflow';
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
import { CARD_PADDING } from '../../lib/design';
import { ACTIVITY_LAYOUT, HOME_LAYOUT, HOME_TEXT, TRANSACTIONS_PAGE_SIZE, getTxTypeConfig } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { formatDateFull } from '../../lib/ui-format';
import * as transactionsService from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';
import type { Category, Transaction, TransactionFilters, TransactionType } from '../../types';

type ActivityPeriod = 'all' | 'day' | 'week' | 'month' | 'year' | 'custom';
type ActivityGroup = {
  groupKey: string;
  title: string;
  subtitle?: string;
  net: number;
  items: Transaction[];
};
type GroupByMode = 'date' | 'category';
type CategoryDrilldown = {
  parentKey: string;
  parentLabel: string;
  subKey: string;
  subLabel: string;
  compactLabel?: boolean;
};
type HierarchyFamily = 'out' | 'in' | 'loan' | 'transfer';

export default function ActivityScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const routeParams = useLocalSearchParams<{
    source?: string;
    period?: string;
    accountId?: string;
    type?: string;
    cashflowBucket?: string;
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
  const categoriesLoaded = useCategoriesStore((s) => s.isLoaded);
  const loadCategories = useCategoriesStore((s) => s.load);

  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);

  const storeTransactions = useTransactionsStore((s) => s.transactions);
  const storeTransactionsLoaded = useTransactionsStore((s) => s.isLoaded);
  const storeTransactionsHasMore = useTransactionsStore((s) => s.hasMore);
  const loadStoreTransactions = useTransactionsStore((s) => s.load);
  const loadMoreStoreTransactions = useTransactionsStore((s) => s.loadMore);
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const txTypeConfig = useMemo(() => getTxTypeConfig(palette), [palette]);
  const accountsById = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const loansById = useMemo(() => new Map(loans.map((loan) => [loan.id, loan])), [loans]);
  const tagNamesById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags]);

  const [period, setPeriod] = useState<ActivityPeriod>('all');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState<string | undefined>();
  const [customTo, setCustomTo] = useState<string | undefined>();
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [cashflowBucket, setCashflowBucket] = useState<'all' | 'in' | 'out' | 'net'>('all');
  const [search, setSearch] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [amountMinStr, setAmountMinStr] = useState('');
  const [amountMaxStr, setAmountMaxStr] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [groupByMode, setGroupByMode] = useState<GroupByMode>('date');
  const [draftGroupByMode, setDraftGroupByMode] = useState<GroupByMode>('date');
  const [categoryDrilldown, setCategoryDrilldown] = useState<CategoryDrilldown | null>(null);
  const [isInitialParamSyncComplete, setIsInitialParamSyncComplete] = useState(!routeParams.source);

  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const resetAllFilters = useCallback(() => {
    setPeriod('all');
    setPeriodOffset(0);
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setSelectedAccountId('all');
    setTypeFilter('all');
    setCashflowBucket('all');
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    setAmountMinStr('');
    setAmountMaxStr('');
    setSearch('');
    setGroupByMode('date');
    setCategoryDrilldown(null);
    setIsSearchActive(false);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener('tabPress', (e: any) => {
      if (navigation.isFocused()) {
        resetAllFilters();
      }
    });
    return unsubscribe;
  }, [navigation, resetAllFilters]);

  const toggleSearch = useCallback((active: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchActive(active);
    if (!active) setSearch('');
  }, []);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);
  const lastAppliedRouteTsRef = useRef<string | null>(null);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsTransitioning(false);
    });
    return () => task.cancel();
  }, []);



  useEffect(() => {
    if (!isFocused || groupByMode !== 'category' || !categoryDrilldown) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setCategoryDrilldown(null);
      return true;
    });
    return () => sub.remove();
  }, [categoryDrilldown, groupByMode, isFocused]);

  useEffect(() => {
    if (showMoreSheet) {
      setDraftGroupByMode(groupByMode);
    }
  }, [groupByMode, showMoreSheet]);

  const dateRange = useMemo(() => {
    if (period === 'all') return null;
    if (period === 'custom') return customFrom && customTo ? { from: customFrom, to: customTo } : null;
    return getNavigableDateRange(period, periodOffset, yearStart);
  }, [customFrom, customTo, period, periodOffset, yearStart]);

  const canGoNext = period !== 'all' && period !== 'custom' && periodOffset < 0;
  const periodLabel = useMemo(() => {
    if (period === 'all' || !dateRange) return 'All Time';
    return getPeriodNavLabel(period, dateRange.from, dateRange.to);
  }, [dateRange, period]);
  const selectedAccount =
    selectedAccountId === 'all' ? null : accounts.find((account) => account.id === selectedAccountId);
  const accountLabel = selectedAccount ? selectedAccount.name : 'All Accounts';
  const source = typeof routeParams.source === 'string' ? routeParams.source : undefined;
  const ts = typeof routeParams.ts === 'string' ? routeParams.ts : undefined;

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
  const needsFullDataset =
    period === 'all' &&
    (!!search.trim() ||
      selectedCategoryIds.length > 0 ||
      selectedTagIds.length > 0 ||
      !!amountMinStr ||
      !!amountMaxStr ||
      cashflowBucket !== 'all' ||
      groupByMode === 'category' ||
      categoryDrilldown !== null);

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
          limit: period === 'all' && !needsFullDataset ? TRANSACTIONS_PAGE_SIZE : undefined,
          offset: period === 'all' && !needsFullDataset ? currentOffset : 0
        };
        const results = await transactionsService.getTransactions(filters);
        if (requestId !== requestIdRef.current) return;
        if (isInitial) {
          setTransactions(results);
          offsetRef.current = results.length;
          setHasMore(period === 'all' && !needsFullDataset && results.length === TRANSACTIONS_PAGE_SIZE);
        } else {
          setTransactions((prev) => {
            const ids = new Set(prev.map((tx) => tx.id));
            return [...prev, ...results.filter((tx) => !ids.has(tx.id))];
          });
          offsetRef.current += results.length;
          setHasMore(!needsFullDataset && results.length === TRANSACTIONS_PAGE_SIZE);
        }
      } finally {
        loadingRef.current = false;
      }
    },
    [cashflowBucket, dateRange?.from, dateRange?.to, needsFullDataset, period, selectedAccountId, typeFilter],
  );

  useEffect(() => {
    if (isFocused) {
      if (isDefaultView) {
        if (!storeTransactionsLoaded) {
          loadStoreTransactions().catch(() => undefined);
        }
      } else {
        // Only load data if we aren't waiting for an initial param sync
        if (!source || isInitialParamSyncComplete) {
          loadData(true);
        }
      }
    }
  }, [isDefaultView, isFocused, isInitialParamSyncComplete, loadData, loadStoreTransactions, source, storeTransactionsLoaded]);

  useEffect(() => {
    if (!isDefaultView) return;
    setTransactions(storeTransactions);
    setHasMore(storeTransactionsHasMore);
    offsetRef.current = storeTransactions.length;
  }, [isDefaultView, storeTransactions, storeTransactionsHasMore]);

  useEffect(() => {
    if (!categoriesLoaded) loadCategories().catch(() => undefined);
  }, [categoriesLoaded, loadCategories]);

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
      if (cashflowBucketParam === 'in' || cashflowBucketParam === 'out') {
        setTypeFilter(cashflowBucketParam as any);
      }
    }

    lastAppliedRouteTsRef.current = tsParam;
    setIsInitialParamSyncComplete(true);
  }, [accounts, isInitialParamSyncComplete, loadStoreTransactions, routeParams.accountId, routeParams.cashflowBucket, routeParams.categoryId, routeParams.from, routeParams.period, routeParams.source, routeParams.to, routeParams.ts, routeParams.type]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isDefaultView) {
      await loadStoreTransactions();
    } else {
      await loadData(true);
    }
    setRefreshing(false);
  };

  const onLoadMore = () => {
    if (!hasMore || loadingRef.current) return;
    if (isDefaultView) {
      void loadMoreStoreTransactions();
      return;
    }
    void loadData(false);
  };

  const goPrev = () => {
    if (period !== 'all' && period !== 'custom') setPeriodOffset((value) => value - 1);
  };

  const goNext = () => {
    if (canGoNext) setPeriodOffset((value) => value + 1);
  };

  const openCustomFromPicker = () => {
    DateTimePickerAndroid.open({
      value: customFrom ? new Date(customFrom) : new Date(),
      mode: 'date',
      display: 'calendar',
      onChange: (_, date) => {
        if (!date) return;
        const pickedFrom = toLocalDayStartISO(date);
        const currentTo = customTo ? new Date(customTo).toISOString() : undefined;
        if (currentTo && pickedFrom > currentTo) {
          setCustomTo(toLocalDayEndISO(date));
        }
        setCustomFrom(pickedFrom);
        setPeriod('custom');
      }
    });
  };

  const openCustomToPicker = () => {
    const minDate = customFrom ? new Date(customFrom) : undefined;
    DateTimePickerAndroid.open({
      value: customTo ? new Date(customTo) : new Date(),
      mode: 'date',
      display: 'calendar',
      minimumDate: minDate,
      onChange: (_, date) => {
        if (!date) return;
        const pickedTo = toLocalDayEndISO(date);
        const currentFrom = customFrom ? new Date(customFrom).toISOString() : undefined;
        if (currentFrom && currentFrom > pickedTo) {
          setCustomFrom(toLocalDayStartISO(date));
        }
        setCustomTo(pickedTo);
        setPeriod('custom');
      }
    });
  };

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

    const includeTransfers = selectedAccountId !== 'all';

    return transactions.filter((tx) => {
      const impact = getTransactionCashflowImpact(tx, { includeTransfers });

      // Account filter
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId) {
        return false;
      }

      // Type filter (Incomes, Expenses, Transfers, Loans)
      if (typeFilter === 'transfer') {
        if (!tx.transferPairId) return false;
      } else if (typeFilter !== 'all') {
        if (tx.transferPairId) return false;

        // Handle Loan transactions as In/Out if impact matches
        if (tx.type !== typeFilter) {
          if (tx.type === 'loan') {
            if (impact !== typeFilter) return false;
          } else {
            return false;
          }
        }
      }

      // Cashflow bucket filter (Inflow, Outflow, Net)
      if (cashflowBucket !== 'all') {
        if (cashflowBucket === 'net') {
          if (impact === 'neutral') return false;
        } else if (impact !== cashflowBucket) {
          // IMPORTANT: If we are specifically drilling for 'in' (Inflow), 
          // we ONLY show transactions where impact is 'in'.
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
  }, [accountsById, amountMaxStr, amountMinStr, cashflowBucket, categories, getCategoryFullDisplayName, loansById, search, selectedCategoryIds, selectedTagIds, tagNamesById, transactions, typeFilter, selectedAccountId]);

  const drilldownTransactions = useMemo(
    () => getActivityDrilldownTransactions(filteredTransactions, categoryDrilldown),
    [categoryDrilldown, filteredTransactions],
  );
  const displayedCashflow = useMemo(
    () => getActivityDisplayedCashflow(filteredTransactions, categoryDrilldown, selectedAccountId !== 'all'),
    [categoryDrilldown, filteredTransactions, selectedAccountId],
  );

  const moreActiveCount =
    selectedCategoryIds.length +
    selectedTagIds.length +
    (amountMinStr ? 1 : 0) +
    (amountMaxStr ? 1 : 0) +
    (groupByMode === 'category' ? 1 : 0);
  const moreActiveBg = palette.brandSoft;
  const moreActiveBorder = palette.brand;

  const topCategories = useMemo(
    () =>
      categories
        .filter((category) => !category.parentId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
    [categories],
  );
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
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
    const category = categoryById.get(id);
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
        net: getCashflowFromList(group.items, selectedAccountId !== 'all').net,
        items: group.items
      };
    });
  }, [categoryDrilldown, drilldownTransactions, filteredTransactions, selectedAccountId]);

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
      if (familyKey === 'out') return 0;
      if (familyKey === 'in') return 1;
      if (familyKey === 'loan') return 2;
      return 3;
    };

    filteredTransactions.forEach((tx) => {
      const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
      const parent = category?.parentId ? categoryById.get(category.parentId) : undefined;
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
        total: getCashflowFromList(entry.transactions, selectedAccountId !== 'all').net,
        transactions: entry.transactions,
        subcategories: Array.from(entry.subMap.values())
          .map((sub) => ({
            subKey: sub.subKey,
            subLabel: sub.subLabel,
            total: getCashflowFromList(sub.transactions, selectedAccountId !== 'all').net,
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
  }, [categoryById, filteredTransactions, selectedAccountId]);

  const hierarchySections = useMemo(
    () =>
      ([
        { key: 'out', label: 'Expenses' },
        { key: 'in', label: 'Income' },
        { key: 'loan', label: 'Loan' },
        { key: 'transfer', label: 'Transfer' },
      ] as const)
        .map((section) => ({
          ...section,
          items: categoryHierarchy.filter((category) => category.familyKey === section.key)
        }))
        .filter((section) => section.items.length > 0),
    [categoryHierarchy],
  );

  const renderGroupItem = useCallback(
    ({ item }: { item: ActivityGroup }) => {
      const groupNet = item.net;
      return (
        <View style={{ marginBottom: ACTIVITY_LAYOUT.groupCardMarginBottom }}>
          <View
            style={[
              styles.groupHeader,
              {
                paddingLeft: ACTIVITY_LAYOUT.headerPaddingX,
                paddingRight: ACTIVITY_LAYOUT.headerPaddingX + HOME_LAYOUT.listRowPaddingX,
                marginBottom: ACTIVITY_LAYOUT.groupHeaderBottom,
              },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: palette.text }}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <>
                  <Text
                    style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: palette.textMuted, marginHorizontal: 6 }}
                  >
                    •
                  </Text>
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted }}>
                    {item.subtitle}
                  </Text>
                </>
              ) : null}
            </View>
            {item.items.length > 1 && groupNet !== 0 ? (
              <Text
                appWeight="medium"
                style={{
                  fontSize: HOME_TEXT.cardContent,
                  color: groupNet > 0 ? palette.brand : palette.negative
                }}
              >
                {signedCurrency(groupNet, sym)}
              </Text>
            ) : null}
          </View>

          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: ACTIVITY_LAYOUT.groupCardRadius,
              marginHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
              overflow: 'hidden'
            }}
          >
            {item.items.map((tx, index) => {
              const account = accounts.find((a) => a.id === tx.accountId);
              const linkedAccount = tx.linkedAccountId ? accounts.find((a) => a.id === tx.linkedAccountId) : undefined;
              const loan = tx.loanId ? loans.find((l) => l.id === tx.loanId) : undefined;

              return (
                <TransactionListItem
                  key={tx.id}
                  tx={tx}
                  sym={sym}
                  palette={palette}
                  isLast={index === item.items.length - 1}
                  categoryName={tx.categoryId ? getCategoryFullDisplayName(tx.categoryId, ' › ') : undefined}
                  accountName={account?.name}
                  linkedAccountName={linkedAccount?.name}
                  loanPersonName={loan?.personName}
                  loanDirection={loan?.direction}
                  tertiaryText={
                    tx.tags.length > 0
                      ? tx.tags
                        .map((tagId) => tags.find((tag) => tag.id === tagId)?.name)
                        .filter((value): value is string => !!value)
                        .join(' • ') || undefined
                      : undefined
                  }
                  showAmountSign={false}
                  useTypeAmountColor
                  onPress={handleTransactionPress}
                />
              );
            })}
          </View>
        </View>
      );
    },
    [accounts, loans, getCategoryFullDisplayName, handleTransactionPress, palette, sym],
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      {isSearchActive ? (
        <View style={[styles.topBar, { backgroundColor: palette.background, borderBottomColor: palette.divider, flexDirection: 'row', alignItems: 'center' }]}>
          <View style={[styles.searchBox, { backgroundColor: palette.surface, borderColor: palette.divider, flex: 1 }]}>
            <Ionicons name="search" size={15} color={palette.textMuted} />
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
                <Ionicons name="close-circle" size={16} color={palette.textSoft} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity delayPressIn={0} onPress={() => toggleSearch(false)}>
            <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.brand, marginLeft: 12 }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.topBar, { backgroundColor: palette.background, borderBottomColor: palette.divider }]}>
          <View style={styles.topBarMainRow}>
            <Text style={{ fontSize: HOME_TEXT.screenTitle, fontWeight: '400', color: palette.text, letterSpacing: -0.5 }}>
              Activity
            </Text>

            <View style={{ flex: 1 }} />

            <TouchableOpacity delayPressIn={0}
              onPress={() => toggleSearch(true)}
              style={[styles.iconBtn, { backgroundColor: palette.surface, borderColor: palette.divider }]}
            >
              <Ionicons name="search" size={17} color={palette.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isTransitioning ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : (
        <>
          {groupByMode === 'date' || categoryDrilldown ? (
            <FlatList
              ref={flatListRef}
              data={grouped}
              keyExtractor={(item) => item.groupKey}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
              onEndReached={onLoadMore}
              onEndReachedThreshold={0.4}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              contentContainerStyle={{ paddingBottom: insets.bottom + ACTIVITY_LAYOUT.listBottomPadding }}
              ListHeaderComponent={
                <View style={{ paddingTop: ACTIVITY_LAYOUT.headerPaddingTop }}>
                  <ActivityFilterBar
                    accountLabel={accountLabel}
                    setShowAccountSheet={setShowAccountSheet}
                    typeFilter={typeFilter}
                    setTypeFilter={setTypeFilter}
                    setCashflowBucket={setCashflowBucket}
                    setShowMoreSheet={setShowMoreSheet}
                    moreActiveCount={moreActiveCount}
                    palette={palette}
                    periodNavigation={
                      <ActivityPeriodHeader
                        period={period}
                        periodLabel={periodLabel}
                        goPrev={goPrev}
                        goNext={goNext}
                        canGoNext={canGoNext}
                        setShowPeriodSheet={setShowPeriodSheet}
                        palette={palette}
                      />
                    }
                  />

                  {period !== 'all' ? (
                    <View style={{ paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX }}>
                      <SummaryCard cashflow={displayedCashflow} sym={sym} palette={palette} />
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
                        <Feather name="chevron-left" size={16} color={palette.textMuted} />
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text }}
                        >
                          {categoryDrilldown.compactLabel
                            ? categoryDrilldown.parentLabel
                            : `${categoryDrilldown.parentLabel} › ${categoryDrilldown.subLabel}`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              }
              renderItem={renderGroupItem}
              ListEmptyComponent={
                !refreshing ? (
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
            />
          ) : null}

          {groupByMode === 'category' && !categoryDrilldown ? (
            <ScrollView
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
              contentContainerStyle={{ paddingBottom: insets.bottom + ACTIVITY_LAYOUT.listBottomPadding }}
            >
              <View style={{ paddingTop: ACTIVITY_LAYOUT.headerPaddingTop }}>
                <ActivityFilterBar
                  accountLabel={accountLabel}
                  setShowAccountSheet={setShowAccountSheet}
                  typeFilter={typeFilter}
                  setTypeFilter={setTypeFilter}
                  setCashflowBucket={setCashflowBucket}
                  setShowMoreSheet={setShowMoreSheet}
                  moreActiveCount={moreActiveCount}
                  palette={palette}
                  periodNavigation={
                    <ActivityPeriodHeader
                      period={period}
                      periodLabel={periodLabel}
                      goPrev={goPrev}
                      goNext={goNext}
                      canGoNext={canGoNext}
                      setShowPeriodSheet={setShowPeriodSheet}
                      palette={palette}
                    />
                  }
                />

                {period !== 'all' ? (
                  <View style={{ paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX }}>
                    <SummaryCard cashflow={displayedCashflow} sym={sym} palette={palette} />
                  </View>
                ) : null}

                <View style={{ height: 1, backgroundColor: palette.divider, marginBottom: 14 }} />

                <View>
                  {hierarchySections.map((section, sectionIndex) => (
                    <View key={section.key}>
                      <ListHeading
                        label={section.label}
                        palette={palette}
                        paddingHorizontal={CARD_PADDING}
                        paddingTop={sectionIndex === 0 ? 0 : 16}
                        paddingBottom={10}
                      />
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
                                  minHeight: 62,
                                  borderBottomWidth: isLastCategory && (!isExpanded || isDirectNavigation) ? 0 : 1,
                                  borderBottomColor: palette.divider,
                                  gap: 12
                                }}
                              >
                                <CategoryIconBadge
                                  icon={category.parentIcon}
                                  ioniconName={
                                    category.parentSyntheticType === 'loan'
                                      ? 'card-outline'
                                      : syntheticCfg?.iconName
                                  }
                                  palette={palette}
                                  iconColor={syntheticCfg?.color}
                                />
                                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '500', color: palette.text, flex: 1 }} numberOfLines={1}>
                                  {category.parentLabel}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: HOME_TEXT.body,
                                    fontWeight: '600',
                                    color: category.total >= 0 ? palette.brand : palette.negative,
                                    marginRight: 2
                                  }}
                                >
                                  {signedCurrency(category.total, sym)}
                                </Text>
                                <Feather
                                  name={isDirectNavigation ? 'chevron-right' : isExpanded ? 'chevron-up' : 'chevron-down'}
                                  size={18}
                                  color={palette.textSoft}
                                />
                              </TouchableOpacity>

                              {isExpanded && !isDirectNavigation ? (
                                <View
                                  style={{
                                    backgroundColor: palette.inputBg,
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
                                        borderTopColor: palette.divider
                                      }}
                                    >
                                      <Text appWeight="medium" numberOfLines={1} style={{ flex: 1, fontSize: HOME_TEXT.sectionTitle, fontWeight: '400', color: palette.text }}>
                                        {sub.subLabel}
                                      </Text>
                                      <Text
                                        style={{
                                          fontSize: HOME_TEXT.body,
                                          fontWeight: '500',
                                          color: sub.total >= 0 ? palette.brand : palette.negative,
                                          marginRight: 10
                                        }}
                                      >
                                        {signedCurrency(sub.total, sym)}
                                      </Text>
                                      <Feather
                                        name="chevron-right"
                                        size={16}
                                        color={palette.textSoft}
                                      />
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
              </View>
            </ScrollView>
          ) : null}
        </>
      )}

      {showAccountSheet ? (
        <BottomSheet title="Select Account" palette={palette} onClose={() => setShowAccountSheet(false)} hasNavBar>
          <ChoiceRow
            title="All Accounts"
            selected={selectedAccountId === 'all'}
            palette={palette}
            onPress={() => {
              setSelectedAccountId('all');
              setShowAccountSheet(false);
            }}
            noBorder={accounts.length === 0}
          />
          {accounts.map((account, index) => (
            <ChoiceRow
              key={account.id}
              title={account.name}
              selected={selectedAccountId === account.id}
              palette={palette}
              onPress={() => {
                setSelectedAccountId(account.id);
                setShowAccountSheet(false);
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
            selected={period === 'all'}
            palette={palette}
            onPress={() => {
              setPeriod('all');
              setPeriodOffset(0);
              setShowPeriodSheet(false);
            }}
          />
          <ChoiceRow
            title="Today"
            subtitle={formatDateFull(new Date().toISOString())}
            selected={period === 'day'}
            palette={palette}
            onPress={() => {
              setPeriod('day');
              setPeriodOffset(0);
              setShowPeriodSheet(false);
            }}
          />
          <ChoiceRow
            title="This Week"
            subtitle={formatRangeLabel('week', yearStart, 0)}
            selected={period === 'week'}
            palette={palette}
            onPress={() => {
              setPeriod('week');
              setPeriodOffset(0);
              setShowPeriodSheet(false);
            }}
          />
          <ChoiceRow
            title="This Month"
            subtitle={formatRangeLabel('month', yearStart, 0)}
            selected={period === 'month'}
            palette={palette}
            onPress={() => {
              setPeriod('month');
              setPeriodOffset(0);
              setShowPeriodSheet(false);
            }}
          />
          <ChoiceRow
            title="This Year"
            subtitle={formatRangeLabel('year', yearStart, 0)}
            selected={period === 'year'}
            palette={palette}
            onPress={() => {
              setPeriod('year');
              setPeriodOffset(0);
              setShowPeriodSheet(false);
            }}
          />
          <View style={{ backgroundColor: palette.background, paddingHorizontal: CARD_PADDING, paddingTop: 16, paddingBottom: 18 }}>
            <ListHeading label="Custom Range" palette={palette} paddingHorizontal={0} paddingTop={0} paddingBottom={10} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity delayPressIn={0}
                onPress={openCustomFromPicker}
                style={[
                  styles.dateField,
                  {
                    borderColor: period === 'custom' ? palette.brand : palette.divider,
                    backgroundColor: palette.surface
                  },
                ]}
              >
                <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: '700', color: palette.textMuted, letterSpacing: 0.6 }}>
                  FROM
                </Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text, marginTop: 2 }}>
                  {customFrom ? formatDateFull(customFrom) : 'Select...'}
                </Text>
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={18} color={palette.textSoft} />
              <TouchableOpacity delayPressIn={0}
                onPress={openCustomToPicker}
                style={[
                  styles.dateField,
                  {
                    borderColor: period === 'custom' ? palette.brand : palette.divider,
                    backgroundColor: palette.surface
                  },
                ]}
              >
                <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: '700', color: palette.textMuted, letterSpacing: 0.6 }}>
                  TO
                </Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text, marginTop: 2 }}>
                  {customTo ? formatDateFull(customTo) : 'Select...'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity delayPressIn={0}
              onPress={() => {
                if (customFrom && customTo) {
                  const from = new Date(customFrom);
                  const to = new Date(customTo);
                  if (from > to) {
                    setCustomFrom(toLocalDayStartISO(to));
                    setCustomTo(toLocalDayEndISO(from));
                  }
                  setPeriod('custom');
                  setShowPeriodSheet(false);
                }
              }}
              style={[
                styles.applyBtn,
                {
                  backgroundColor: customFrom && customTo ? palette.brand : palette.borderSoft
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '800', color: palette.onBrand }}>
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>
      ) : null}

      {showMoreSheet ? (
        <ActivityMoreFiltersSheet
          groupByMode={groupByMode}
          setGroupByMode={setGroupByMode}
          draftGroupByMode={draftGroupByMode}
          setDraftGroupByMode={setDraftGroupByMode}
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
            setDraftGroupByMode('date');
            setCategoryDrilldown(null);
          }}
        />
      ) : null}
    </View>
  );
}

function signedCurrency(amount: number, sym: string) {
  return formatCurrency(Math.abs(amount), sym);
}

function formatRangeLabel(period: 'week' | 'month' | 'year', yearStart: number, offset: number) {
  const range = getNavigableDateRange(period, offset, yearStart);
  return getPeriodNavLabel(period, range.from, range.to);
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
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
  iconBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  dateField: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  applyBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center'
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  }
});
