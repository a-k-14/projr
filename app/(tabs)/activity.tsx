import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardSection, ChoiceRow, SectionLabel } from '../../components/settings-ui';
import { SummaryCard } from '../../components/SummaryCard';
import { TransactionListItem } from '../../components/TransactionListItem';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FilterChip } from '../../components/ui/FilterChip';
import {
  getNavigableDateRange,
  getPeriodNavLabel,
  getRelativeDateLabel,
} from '../../lib/dateUtils';
import { formatCurrency, getLoanTransactionKind, getTransactionCashflowImpact, groupTransactionsByDate } from '../../lib/derived';
import { CARD_PADDING } from '../../lib/design';
import { ACTIVITY_LAYOUT, HOME_LAYOUT, HOME_TEXT, TRANSACTIONS_PAGE_SIZE, getTxTypeConfig } from '../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
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
};
type HierarchyFamily = 'out' | 'in' | 'loan' | 'transfer';

const TYPE_OPTIONS: { label: string; value: TransactionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'In', value: 'in' },
  { label: 'Out', value: 'out' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Loan', value: 'loan' },
];

const PERIOD_ARROW_WIDTH = 34;

export default function ActivityScreen() {
  const isFocused = useIsFocused();
  const routeParams = useLocalSearchParams<{
    source?: string;
    period?: string;
    accountId?: string;
    type?: string;
    cashflowBucket?: string;
    from?: string;
    to?: string;
    ts?: string;
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

  const [period, setPeriod] = useState<ActivityPeriod>('all');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState<string | undefined>();
  const [customTo, setCustomTo] = useState<string | undefined>();
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [cashflowBucket, setCashflowBucket] = useState<'all' | 'in' | 'out'>('all');
  const [search, setSearch] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [amountMinStr, setAmountMinStr] = useState('');
  const [amountMaxStr, setAmountMaxStr] = useState('');
  const [groupByMode, setGroupByMode] = useState<GroupByMode>('date');
  const [draftGroupByMode, setDraftGroupByMode] = useState<GroupByMode>('date');
  const [categoryDrilldown, setCategoryDrilldown] = useState<CategoryDrilldown | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);
  const lastAppliedRouteTsRef = useRef<string | null>(null);

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
  const isDefaultView =
    period === 'all' &&
    selectedAccountId === 'all' &&
    typeFilter === 'all' &&
    cashflowBucket === 'all' &&
    !search &&
    selectedCategoryIds.length === 0 &&
    selectedTagIds.length === 0 &&
    !amountMinStr &&
    !amountMaxStr;

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
            : typeFilter === 'all'
              ? undefined
              : typeFilter;
        const filters: TransactionFilters = {
          accountId: selectedAccountId === 'all' ? undefined : selectedAccountId,
          type: effectiveTypeFilter,
          fromDate: dateRange?.from,
          toDate: dateRange?.to,
          search: search || undefined,
          limit: period === 'all' ? TRANSACTIONS_PAGE_SIZE : undefined,
          offset: period === 'all' ? currentOffset : 0,
        };
        const results = await transactionsService.getTransactions(filters);
        if (requestId !== requestIdRef.current) return;
        if (isInitial) {
          setTransactions(results);
          offsetRef.current = results.length;
          setHasMore(period === 'all' && results.length === TRANSACTIONS_PAGE_SIZE);
        } else {
          setTransactions((prev) => {
            const ids = new Set(prev.map((tx) => tx.id));
            return [...prev, ...results.filter((tx) => !ids.has(tx.id))];
          });
          offsetRef.current += results.length;
          setHasMore(results.length === TRANSACTIONS_PAGE_SIZE);
        }
      } finally {
        loadingRef.current = false;
      }
    },
    [cashflowBucket, dateRange?.from, dateRange?.to, period, search, selectedAccountId, typeFilter],
  );

  useEffect(() => {
    if (isFocused) {
      if (isDefaultView) {
        if (!storeTransactionsLoaded) {
          loadStoreTransactions().catch(() => undefined);
        }
      } else {
        loadData(true);
      }
    }
  }, [isDefaultView, isFocused, loadData, loadStoreTransactions, storeTransactionsLoaded]);

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
    const source = typeof routeParams.source === 'string' ? routeParams.source : undefined;
    const ts = typeof routeParams.ts === 'string' ? routeParams.ts : undefined;
    if (!source || !ts || lastAppliedRouteTsRef.current === ts) return;

    const periodParam = typeof routeParams.period === 'string' ? routeParams.period : undefined;
    const accountParam = typeof routeParams.accountId === 'string' ? routeParams.accountId : undefined;
    const typeParam = typeof routeParams.type === 'string' ? routeParams.type : undefined;
    const cashflowBucketParam =
      typeof routeParams.cashflowBucket === 'string' ? routeParams.cashflowBucket : undefined;
    const fromParam = typeof routeParams.from === 'string' ? routeParams.from : undefined;
    const toParam = typeof routeParams.to === 'string' ? routeParams.to : undefined;

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

    if (source === 'activity-tab' || source === 'home-view-all') {
      lastAppliedRouteTsRef.current = ts;
      return;
    }

    if (periodParam === 'day') {
      setPeriod('day');
      setPeriodOffset(0);
    } else if (periodParam === 'week' || periodParam === 'month' || periodParam === 'year') {
      setPeriod(periodParam);
      setPeriodOffset(0);
    } else if (periodParam === 'custom') {
      setPeriod('custom');
      setCustomFrom(fromParam);
      setCustomTo(toParam);
    } else if (periodParam === 'all') {
      setPeriod('all');
      setPeriodOffset(0);
    }

    if (accountParam === 'all') {
      setSelectedAccountId('all');
    } else if (accountParam && accounts.some((account) => account.id === accountParam)) {
      setSelectedAccountId(accountParam);
    }

    if (typeParam === 'all' || typeParam === 'in' || typeParam === 'out' || typeParam === 'transfer' || typeParam === 'loan') {
      setTypeFilter(typeParam);
    }
    if (cashflowBucketParam === 'all' || cashflowBucketParam === 'in' || cashflowBucketParam === 'out') {
      setCashflowBucket(cashflowBucketParam);
      if (cashflowBucketParam === 'in' || cashflowBucketParam === 'out') {
        setTypeFilter(cashflowBucketParam);
      }
    }

    lastAppliedRouteTsRef.current = ts;
  }, [accounts, routeParams.accountId, routeParams.cashflowBucket, routeParams.from, routeParams.period, routeParams.source, routeParams.to, routeParams.ts, routeParams.type]);

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
      onChange: (_, date) => {
        if (!date) return;
        const pickedFrom = startOfDayIso(date);
        const currentTo = customTo ? new Date(customTo).toISOString() : undefined;
        if (currentTo && pickedFrom > currentTo) {
          setCustomTo(endOfDayIso(date));
        }
        setCustomFrom(pickedFrom);
        setPeriod('custom');
      },
    });
  };

  const openCustomToPicker = () => {
    const minDate = customFrom ? new Date(customFrom) : undefined;
    DateTimePickerAndroid.open({
      value: customTo ? new Date(customTo) : new Date(),
      mode: 'date',
      minimumDate: minDate,
      onChange: (_, date) => {
        if (!date) return;
        const pickedTo = endOfDayIso(date);
        const currentFrom = customFrom ? new Date(customFrom).toISOString() : undefined;
        if (currentFrom && currentFrom > pickedTo) {
          setCustomFrom(startOfDayIso(date));
        }
        setCustomTo(pickedTo);
        setPeriod('custom');
      },
    });
  };

  const filteredTransactions = useMemo(() => {
    const minAmount = amountMinStr ? Number(amountMinStr) : undefined;
    const maxAmount = amountMaxStr ? Number(amountMaxStr) : undefined;
    const selectedTagSet = new Set(selectedTagIds);
    const selectedCategoryAndDescendants = new Set<string>();
    selectedCategoryIds.forEach((id) => {
      selectedCategoryAndDescendants.add(id);
      categories
        .filter((category) => category.parentId === id)
        .forEach((child) => selectedCategoryAndDescendants.add(child.id));
    });

    return transactions.filter((tx) => {
      if (
        cashflowBucket !== 'all' &&
        (typeFilter === 'all' || typeFilter === cashflowBucket) &&
        getTransactionCashflowImpact(tx) !== cashflowBucket
      ) {
        return false;
      }
      if (selectedCategoryAndDescendants.size > 0) {
        if (!tx.categoryId || !selectedCategoryAndDescendants.has(tx.categoryId)) return false;
      }
      if (selectedTagSet.size > 0) {
        if (!tx.tags.some((tagId) => selectedTagSet.has(tagId))) return false;
      }
      if (minAmount !== undefined && !Number.isNaN(minAmount) && tx.amount < minAmount) return false;
      if (maxAmount !== undefined && !Number.isNaN(maxAmount) && tx.amount > maxAmount) return false;
      return true;
    });
  }, [amountMaxStr, amountMinStr, cashflowBucket, categories, selectedCategoryIds, selectedTagIds, transactions]);

  const periodCashflow = useMemo(() => calcCashflowSummary(filteredTransactions), [filteredTransactions]);
  const overallNet = useMemo(() => calcNet(filteredTransactions), [filteredTransactions]);
  const drilldownTransactions = useMemo(() => {
    if (!categoryDrilldown) return filteredTransactions;
    return filteredTransactions.filter((tx) => {
      if (!tx.categoryId) {
        return categoryDrilldown.subKey === `type:${tx.type}`;
      }
      return tx.categoryId === categoryDrilldown.subKey;
    });
  }, [categoryDrilldown, filteredTransactions]);
  const displayedCashflow = categoryDrilldown ? calcCashflowSummary(drilldownTransactions) : periodCashflow;

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
        net: calcNet(group.items),
        items: group.items,
      };
    });
  }, [categoryDrilldown, drilldownTransactions, filteredTransactions]);

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
          : `type:${tx.type}`;
      const parentLabel = parent
        ? parent.name
        : category
          ? category.name
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
      const subKey = category?.id ?? `type:${tx.type}`;
      const subLabel = category
        ? parent
          ? category.name
          : category.name
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
          subMap: new Map(),
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
        total: calcNet(entry.transactions),
        subcategories: Array.from(entry.subMap.values())
          .map((sub) => ({
            subKey: sub.subKey,
            subLabel: sub.subLabel,
            total: calcNet(sub.transactions),
            transactions: sub.transactions,
          }))
          .sort((a, b) => a.subLabel.localeCompare(b.subLabel, 'en', { sensitivity: 'base' })),
        familyOrder: entry.familyOrder,
        familyKey: entry.familyKey,
      }))
      .sort((a, b) => {
        if (a.familyOrder !== b.familyOrder) return a.familyOrder - b.familyOrder;
        return a.parentLabel.localeCompare(b.parentLabel, 'en', { sensitivity: 'base' });
      });
  }, [categoryById, filteredTransactions]);

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
          items: categoryHierarchy.filter((category) => category.familyKey === section.key),
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
              { paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, marginBottom: ACTIVITY_LAYOUT.groupHeaderBottom },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: palette.text }}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <>
                  <Text
                    style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: palette.textMuted, marginHorizontal: 6 }}
                  >
                    •
                  </Text>
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted }}>
                    {item.subtitle}
                  </Text>
                </>
              ) : null}
            </View>
            {item.items.length > 1 && groupNet !== 0 ? (
              <Text
                style={{
                  fontSize: HOME_TEXT.bodySmall,
                  fontWeight: '800',
                  color: groupNet > 0 ? palette.brand : palette.negative,
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
              overflow: 'hidden',
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
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      {isSearchActive ? (
        <View style={[styles.topBar, { backgroundColor: palette.background, borderBottomColor: palette.divider }]}>
          <View style={[styles.searchBox, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Ionicons name="search" size={15} color={palette.textMuted} />
            <TextInput
              autoFocus
              placeholder="Search transactions…"
              placeholderTextColor={palette.textSoft}
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1, fontSize: 14, color: palette.text, padding: 0 }}
              returnKeyType="search"
            />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={palette.textSoft} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => { setIsSearchActive(false); setSearch(''); }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.brand, marginLeft: 12 }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.topBar, { backgroundColor: palette.background, borderBottomColor: palette.divider }]}>
          <View style={styles.topBarMainRow}>
            <Text style={{ fontSize: 26, fontWeight: '700', color: palette.text, letterSpacing: -0.5 }}>
              Activity
            </Text>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              onPress={() => setIsSearchActive(true)}
              style={[styles.iconBtn, { backgroundColor: palette.surface, borderColor: palette.divider }]}
            >
              <Ionicons name="search" size={17} color={palette.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {groupByMode === 'date' || categoryDrilldown ? (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.groupKey}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingBottom: insets.bottom + ACTIVITY_LAYOUT.listBottomPadding }}
          ListHeaderComponent={
          <View style={{ paddingTop: ACTIVITY_LAYOUT.headerPaddingTop }}>
            <View
              style={[
                styles.row,
                {
                  paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
                  marginBottom: ACTIVITY_LAYOUT.headerRowGap,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setShowAccountSheet(true)}
                style={[
                  styles.accountPicker,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.divider,
                    width: '36%',
                    marginRight: ACTIVITY_LAYOUT.controlChipGap,
                  },
                ]}
              >
                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: palette.text, flex: 1 }}>
                  {accountLabel}
                </Text>
                <Ionicons name="chevron-down" size={13} color={palette.textMuted} />
              </TouchableOpacity>

              <View
                style={[
                  styles.periodBar,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.divider,
                    flex: 1,
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={goPrev}
                  disabled={period === 'custom' || period === 'all'}
                  style={[styles.periodArrow, { borderRightColor: palette.divider }]}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name="chevron-back"
                    size={14}
                    color={palette.text}
                    style={{ opacity: period === 'custom' || period === 'all' ? 0.2 : 1 }}
                  />
                </TouchableOpacity>

                <View style={styles.periodCenter}>
                  <TouchableOpacity
                    onPress={() => setShowPeriodSheet(true)}
                    style={styles.periodCenterTouch}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }} numberOfLines={1}>
                      {periodLabel}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={goNext}
                  disabled={!canGoNext}
                  style={[styles.periodArrow, { borderLeftColor: palette.divider }]}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={palette.text}
                    style={{ opacity: canGoNext ? 1 : 0.2 }}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.row, { paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingRight: ACTIVITY_LAYOUT.controlChipGap, paddingBottom: 2 }}
              >
                <View style={styles.chipRow}>
                  {TYPE_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      isActive={typeFilter === option.value}
                      onPress={() => {
                        setTypeFilter(option.value);
                        setCashflowBucket(
                          option.value === 'in' || option.value === 'out' ? option.value : 'all',
                        );
                      }}
                      palette={palette}
                    />
                  ))}
                </View>
              </ScrollView>
              <TouchableOpacity
                onPress={() => setShowMoreSheet(true)}
                activeOpacity={0.75}
                style={[
                  styles.moreChip,
                  {
                    backgroundColor: moreActiveCount > 0 ? moreActiveBg : palette.surface,
                    borderColor: moreActiveCount > 0 ? moreActiveBorder : palette.divider,
                    marginLeft: ACTIVITY_LAYOUT.moreButtonGap,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, fontSize: 13, fontWeight: '700', color: moreActiveCount > 0 ? palette.brand : palette.textMuted }}
                >
                  {moreActiveCount > 0 ? `More ${moreActiveCount}` : 'More'}
                </Text>
                <MaterialIcons name="filter-list" size={17} color={moreActiveCount > 0 ? palette.brand : palette.textMuted} />
              </TouchableOpacity>
            </View>

            {period !== 'all' ? (
              <View style={{ paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX }}>
                <SummaryCard cashflow={displayedCashflow} sym={sym} palette={palette} />
              </View>
            ) : null}

            {groupByMode === 'category' && categoryDrilldown ? (
              <View
                style={{
                  paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
                  marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom,
                }}
              >
                <TouchableOpacity
                  onPress={() => setCategoryDrilldown(null)}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Feather name="chevron-left" size={16} color={palette.textMuted} />
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, fontSize: 14, fontWeight: '700', color: palette.text }}
                  >
                    {categoryDrilldown.parentLabel} › {categoryDrilldown.subLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={{ height: 1, backgroundColor: palette.divider, marginBottom: 14 }} />
          </View>
          }
          renderItem={renderGroupItem}
          ListEmptyComponent={
            !refreshing ? (
              <View style={{ alignItems: 'center', paddingTop: 64 }}>
                <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted, fontWeight: '500' }}>
                  No transactions found
                </Text>
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
            <View
              style={[
                styles.row,
                {
                  paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
                  marginBottom: ACTIVITY_LAYOUT.headerRowGap,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setShowAccountSheet(true)}
                style={[
                  styles.accountPicker,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.divider,
                    width: '36%',
                    marginRight: ACTIVITY_LAYOUT.controlChipGap,
                  },
                ]}
              >
                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: palette.text, flex: 1 }}>
                  {accountLabel}
                </Text>
                <Ionicons name="chevron-down" size={13} color={palette.textMuted} />
              </TouchableOpacity>

              <View
                style={[
                  styles.periodBar,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.divider,
                    flex: 1,
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={goPrev}
                  disabled={period === 'custom' || period === 'all'}
                  style={[styles.periodArrow, { borderRightColor: palette.divider }]}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name="chevron-back"
                    size={14}
                    color={palette.text}
                    style={{ opacity: period === 'custom' || period === 'all' ? 0.2 : 1 }}
                  />
                </TouchableOpacity>

                <View style={styles.periodCenter}>
                  <TouchableOpacity
                    onPress={() => setShowPeriodSheet(true)}
                    style={styles.periodCenterTouch}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }} numberOfLines={1}>
                      {periodLabel}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={goNext}
                  disabled={!canGoNext}
                  style={[styles.periodArrow, { borderLeftColor: palette.divider }]}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={palette.text}
                    style={{ opacity: canGoNext ? 1 : 0.2 }}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.row, { paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingRight: ACTIVITY_LAYOUT.controlChipGap, paddingBottom: 2 }}
              >
                <View style={styles.chipRow}>
                  {TYPE_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      isActive={typeFilter === option.value}
                      onPress={() => {
                        setTypeFilter(option.value);
                        setCashflowBucket(option.value === 'in' || option.value === 'out' ? option.value : 'all');
                      }}
                      palette={palette}
                    />
                  ))}
                </View>
              </ScrollView>
              <TouchableOpacity
                onPress={() => setShowMoreSheet(true)}
                activeOpacity={0.75}
                style={[
                  styles.moreChip,
                  {
                    backgroundColor: moreActiveCount > 0 ? moreActiveBg : palette.surface,
                    borderColor: moreActiveCount > 0 ? moreActiveBorder : palette.divider,
                    marginLeft: ACTIVITY_LAYOUT.moreButtonGap,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, fontSize: 13, fontWeight: '700', color: moreActiveCount > 0 ? palette.brand : palette.textMuted }}
                >
                  {moreActiveCount > 0 ? `More ${moreActiveCount}` : 'More'}
                </Text>
                <MaterialIcons name="filter-list" size={17} color={moreActiveCount > 0 ? palette.brand : palette.textMuted} />
              </TouchableOpacity>
            </View>

            {period !== 'all' ? (
              <View style={{ paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX }}>
                <SummaryCard cashflow={displayedCashflow} sym={sym} palette={palette} />
              </View>
            ) : null}

            <View style={{ height: 1, backgroundColor: palette.divider, marginBottom: 14 }} />

            <View>
              {hierarchySections.map((section) => (
                <View key={section.key}>
                  <SectionLabel label={section.label} palette={palette} />
                  <CardSection palette={palette}>
                    {section.items.map((category, categoryIndex) => {
                      const isExpanded = expandedCategoryIds.includes(category.parentKey);
                      const isLastCategory = categoryIndex === section.items.length - 1;
                      const syntheticCfg = category.parentSyntheticType ? txTypeConfig[category.parentSyntheticType] : undefined;
                      return (
                        <View key={category.parentKey}>
                          <TouchableOpacity
                            onPress={() => toggleCategoryExpansion(category.parentKey)}
                            activeOpacity={0.75}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 12,
                              paddingHorizontal: CARD_PADDING,
                              minHeight: 62,
                              borderBottomWidth: isLastCategory && !isExpanded ? 0 : 1,
                              borderBottomColor: palette.divider,
                              gap: 12,
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
                            <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text, flex: 1 }} numberOfLines={1}>
                              {category.parentLabel}
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: category.total >= 0 ? palette.brand : palette.negative,
                                marginRight: 2,
                              }}
                            >
                              {signedCurrency(category.total, sym)}
                            </Text>
                            <Feather
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color={palette.textSoft}
                            />
                          </TouchableOpacity>

                          {isExpanded ? (
                            <View
                              style={{
                                backgroundColor: palette.inputBg,
                                borderBottomWidth: isLastCategory ? 0 : 1,
                                borderBottomColor: palette.divider,
                              }}
                            >
                              {category.subcategories.map((sub, index) => (
                                <TouchableOpacity
                                  key={sub.subKey}
                                  onPress={() =>
                                    setCategoryDrilldown({
                                      parentKey: category.parentKey,
                                      parentLabel: category.parentLabel,
                                      subKey: sub.subKey,
                                      subLabel: sub.subLabel,
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
                                  }}
                                >
                                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '400', color: palette.text }}>
                                    {sub.subLabel}
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 14,
                                      fontWeight: '500',
                                      color: sub.total >= 0 ? palette.brand : palette.negative,
                                      marginRight: 10,
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

      {showAccountSheet ? (
        <BottomSheet title="Select account" palette={palette} onClose={() => setShowAccountSheet(false)} hasNavBar>
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
          extraBottomPadding={ACTIVITY_LAYOUT.periodSheetBottomOffset}
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
            subtitle={formatDateShortLabel(new Date().toISOString())}
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
            <Text style={{ fontSize: 11, fontWeight: '800', color: palette.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
              Custom Range
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                onPress={openCustomFromPicker}
                style={[
                  styles.dateField,
                  {
                    borderColor: period === 'custom' ? palette.brand : palette.divider,
                    backgroundColor: palette.surface,
                  },
                ]}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: palette.textMuted, letterSpacing: 0.6 }}>
                  FROM
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginTop: 2 }}>
                  {customFrom ? formatDateShortLabel(customFrom) : 'Select...'}
                </Text>
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={18} color={palette.textSoft} />
              <TouchableOpacity
                onPress={openCustomToPicker}
                style={[
                  styles.dateField,
                  {
                    borderColor: period === 'custom' ? palette.brand : palette.divider,
                    backgroundColor: palette.surface,
                  },
                ]}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: palette.textMuted, letterSpacing: 0.6 }}>
                  TO
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginTop: 2 }}>
                  {customTo ? formatDateShortLabel(customTo) : 'Select...'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (customFrom && customTo) {
                  const from = new Date(customFrom);
                  const to = new Date(customTo);
                  if (from > to) {
                    setCustomFrom(startOfDayIso(to));
                    setCustomTo(endOfDayIso(from));
                  }
                  setPeriod('custom');
                  setShowPeriodSheet(false);
                }
              }}
              style={[
                styles.applyBtn,
                {
                  backgroundColor: customFrom && customTo ? palette.brand : palette.borderSoft,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14, fontWeight: '800', color: palette.onBrand }}>
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>
      ) : null}

      {showMoreSheet ? (
        <BottomSheet
          title="More filters"
          palette={palette}
          onClose={() => setShowMoreSheet(false)}
          hasNavBar
          footer={
            <View style={{ paddingHorizontal: CARD_PADDING, paddingTop: 8, paddingBottom: 3, borderTopWidth: 1, borderTopColor: palette.divider, backgroundColor: palette.surface }}>
              <TouchableOpacity
                onPress={() => {
                  setGroupByMode(draftGroupByMode);
                  if (draftGroupByMode === 'date') {
                    setCategoryDrilldown(null);
                  }
                  setShowMoreSheet(false);
                }}
                style={{ backgroundColor: palette.brand, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 15, fontWeight: '800', color: palette.onBrand }}>Apply filters</Text>
              </TouchableOpacity>
            </View>
          }
          headerRight={
            <TouchableOpacity
              onPress={() => {
                setSelectedCategoryIds([]);
                setSelectedTagIds([]);
                setAmountMinStr('');
                setAmountMaxStr('');
                setExpandedCategoryIds([]);
                setGroupByMode('date');
                setDraftGroupByMode('date');
                setCategoryDrilldown(null);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
              style={styles.clearAllButton}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: palette.brand }}>Clear all</Text>
            </TouchableOpacity>
          }
        >
          <View style={{ paddingBottom: 12 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: palette.textMuted,
                paddingHorizontal: CARD_PADDING,
                paddingTop: 16,
                paddingBottom: 8,
              }}
            >
              Group by
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: ACTIVITY_LAYOUT.controlChipGap, paddingHorizontal: CARD_PADDING, paddingBottom: 8 }}>
              <FilterChip
                label="Date"
                isActive={draftGroupByMode === 'date'}
                onPress={() => {
                  setDraftGroupByMode('date');
                }}
                palette={palette}
              />
              <FilterChip
                label="Category"
                isActive={draftGroupByMode === 'category'}
                onPress={() => setDraftGroupByMode('category')}
                palette={palette}
              />
            </View>

            <View style={{ height: 1, backgroundColor: palette.divider }} />

            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: palette.textMuted,
                paddingHorizontal: CARD_PADDING,
                paddingTop: 16,
                paddingBottom: 8,
              }}
            >
              Category
            </Text>

            <View style={{ paddingTop: 2 }}>
              {topCategories.map((category) => {
                const children = childCategoriesByParent.get(category.id) ?? [];
                const childSelectedCount = children.filter((child) => selectedCategoryIds.includes(child.id)).length;
                const hasChildren = children.length > 0;
                const parentExplicitlySelected = selectedCategoryIds.includes(category.id);
                const allChildrenSelected = hasChildren && childSelectedCount === children.length;
                const isSelected = parentExplicitlySelected || allChildrenSelected;
                const isPartial = hasChildren && childSelectedCount > 0 && childSelectedCount < children.length && !parentExplicitlySelected;
                const isExpanded = expandedCategoryIds.includes(category.id);
                return (
                  <View key={category.id}>
                    <MoreCategoryRow
                      category={category}
                      selected={isSelected}
                      partial={isPartial}
                      expanded={isExpanded}
                      hasChildren={hasChildren}
                      palette={palette}
                      onToggleSelected={() => toggleCategoryFamily(category.id)}
                      onToggleExpanded={() => toggleCategoryExpansion(category.id)}
                    />
                    {isExpanded
                      ? children.map((child) => {
                        const childSelected = selectedCategoryIds.includes(child.id);
                        return (
                          <View
                            key={child.id}
                            style={[
                              styles.moreSubRow,
                              {
                                borderBottomColor: palette.divider,
                                paddingHorizontal: CARD_PADDING + 34,
                                backgroundColor: palette.inputBg,
                                minHeight: 56,
                              },
                            ]}
                          >
                            <TouchableOpacity
                              onPress={() => toggleCategoryId(child.id)}
                              activeOpacity={0.75}
                              style={{ marginRight: 12 }}
                            >
                              <Checkbox selected={childSelected} palette={palette} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => toggleCategoryId(child.id)}
                              activeOpacity={0.75}
                              style={{ flex: 1, minWidth: 0 }}
                            >
                              <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '400', color: palette.text }}>
                                {child.name}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })
                      : null}
                  </View>
                );
              })}
            </View>

            <View style={{ height: 1, backgroundColor: palette.divider }} />

            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: palette.textMuted,
                paddingHorizontal: CARD_PADDING,
                paddingTop: 16,
                paddingBottom: 8,
              }}
            >
              Tags
            </Text>

            {tags.length === 0 ? (
              <Text style={{ color: palette.textMuted, fontSize: 13, paddingHorizontal: CARD_PADDING, paddingVertical: 12 }}>
                No tags yet
              </Text>
            ) : (
              tags.map((tag) => {
                const count = getTagTxCount(transactions, tag.id);
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <MoreTagRow
                    key={tag.id}
                    tag={tag}
                    count={count}
                    selected={isSelected}
                    palette={palette}
                    onToggleSelected={() => toggleTagId(tag.id)}
                  />
                );
              })
            )}

            <View style={{ height: 1, backgroundColor: palette.divider }} />

            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: palette.textMuted,
                paddingHorizontal: CARD_PADDING,
                paddingTop: 16,
                paddingBottom: 12,
              }}
            >
              Amount Range
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: CARD_PADDING }}>
              <TextInput
                value={amountMinStr}
                onChangeText={setAmountMinStr}
                keyboardType="numeric"
                placeholder="Min ₹"
                placeholderTextColor={palette.textMuted}
                style={[styles.amountField, { borderColor: palette.divider, backgroundColor: palette.background, color: palette.text }]}
              />
              <Text style={{ color: palette.textMuted, fontSize: 18 }}>—</Text>
              <TextInput
                value={amountMaxStr}
                onChangeText={setAmountMaxStr}
                keyboardType="numeric"
                placeholder="Max ₹"
                placeholderTextColor={palette.textMuted}
                style={[styles.amountField, { borderColor: palette.divider, backgroundColor: palette.background, color: palette.text }]}
              />
            </View>
          </View>
        </BottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

function AccountChip({
  label,
  active,
  onPress,
  palette,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  palette: AppThemePalette;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.accountChip,
        {
          backgroundColor: active ? palette.brandSoft : palette.inputBg,
          borderColor: active ? palette.brand : palette.borderSoft,
        },
      ]}
    >
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: active ? palette.brand : palette.textMuted }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function calcNet(txs: Transaction[]): number {
  return calcCashflowSummary(txs).net;
}

function calcCashflowSummary(txs: Transaction[]) {
  return txs.reduce(
    (summary, tx) => {
      const impact = getTransactionCashflowImpact(tx);
      if (impact === 'in') summary.in += tx.amount;
      if (impact === 'out') summary.out += tx.amount;
      summary.net = summary.in - summary.out;
      return summary;
    },
    { in: 0, out: 0, net: 0 },
  );
}

function signedCurrency(amount: number, sym: string) {
  return formatCurrency(Math.abs(amount), sym);
}

function startOfDayIso(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

function endOfDayIso(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function formatDateShortLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRangeLabel(period: 'week' | 'month' | 'year', yearStart: number, offset: number) {
  const range = getNavigableDateRange(period, offset, yearStart);
  return getPeriodNavLabel(period, range.from, range.to);
}

function Checkbox({
  selected,
  partial = false,
  palette,
}: {
  selected: boolean;
  partial?: boolean;
  palette: AppThemePalette;
}) {
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: selected || partial ? palette.brand : palette.border,
        backgroundColor: selected ? palette.brand : partial ? palette.brandSoft : palette.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? <Ionicons name="checkmark" size={15} color={palette.onBrand} /> : null}
      {partial ? <View style={{ width: 10, height: 2.5, borderRadius: 99, backgroundColor: palette.brand }} /> : null}
    </View>
  );
}

function CategoryIconBadge({
  icon,
  ioniconName,
  palette,
  iconColor,
}: {
  icon?: string;
  ioniconName?: string;
  palette: AppThemePalette;
  iconColor?: string;
}) {
  const isEmoji = icon ? !/^[a-z-]+$/.test(icon) : false;
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: palette.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {ioniconName ? (
        <Ionicons name={ioniconName as never} size={16} color={iconColor ?? palette.iconTint} />
      ) : isEmoji ? (
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      ) : (
        <Feather name={(icon ?? 'tag') as keyof typeof Feather.glyphMap} size={16} color={iconColor ?? palette.iconTint} />
      )}
    </View>
  );
}

function MoreCategoryRow({
  category,
  selected,
  partial,
  expanded,
  hasChildren,
  palette,
  onToggleSelected,
  onToggleExpanded,
}: {
  category: { id: string; name: string; icon: string; color: string };
  selected: boolean;
  partial: boolean;
  expanded: boolean;
  hasChildren: boolean;
  palette: AppThemePalette;
  onToggleSelected: () => void;
  onToggleExpanded: () => void;
}) {
  return (
    <View style={[styles.moreRow, { borderBottomColor: palette.divider, paddingHorizontal: CARD_PADDING }]}>
      <TouchableOpacity onPress={onToggleSelected} activeOpacity={0.75} style={{ marginRight: 12 }}>
        <Checkbox selected={selected} partial={partial} palette={palette} />
      </TouchableOpacity>
      <TouchableOpacity onPress={hasChildren ? onToggleExpanded : onToggleSelected} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <CategoryIconBadge icon={category.icon} palette={palette} />
        <View style={{ marginLeft: 14, flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '500', color: palette.text }}>
            {category.name}
          </Text>
        </View>
      </TouchableOpacity>
      {hasChildren ? (
        <TouchableOpacity onPress={onToggleExpanded} activeOpacity={0.7}>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textSoft} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 18 }} />
      )}
    </View>
  );
}

function MoreTagRow({
  tag,
  count,
  selected,
  palette,
  onToggleSelected,
}: {
  tag: { id: string; name: string; color: string };
  count: number;
  selected: boolean;
  palette: AppThemePalette;
  onToggleSelected: () => void;
}) {
  return (
    <View style={[styles.moreRow, { borderBottomColor: palette.divider, paddingHorizontal: CARD_PADDING }]}>
      <TouchableOpacity onPress={onToggleSelected} activeOpacity={0.75} style={{ marginRight: 12 }}>
        <Checkbox selected={selected} palette={palette} />
      </TouchableOpacity>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tag.color, marginRight: 14 }} />
      <TouchableOpacity onPress={onToggleSelected} activeOpacity={0.75} style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '500', color: palette.text }}>
          {tag.name}
        </Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 14, fontWeight: '700', color: palette.textMuted, marginRight: 10 }}>
        {count}
      </Text>
      <View style={{ width: 18 }} />
    </View>
  );
}

function getTagTxCount(txs: Transaction[], tagId: string) {
  return txs.filter((tx) => tx.tags.includes(tagId)).length;
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
  },
  iconBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ACTIVITY_LAYOUT.controlChipGap,
  },
  accountChip: {
    minWidth: ACTIVITY_LAYOUT.accountChipMinWidth,
    maxWidth: ACTIVITY_LAYOUT.accountChipMaxWidth,
    height: ACTIVITY_LAYOUT.accountChipHeight,
    paddingHorizontal: ACTIVITY_LAYOUT.accountChipHorizontalPadding,
    borderRadius: ACTIVITY_LAYOUT.controlRadius,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ACTIVITY_LAYOUT.controlHeight,
    borderRadius: ACTIVITY_LAYOUT.controlRadius,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  accountPicker: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: ACTIVITY_LAYOUT.controlHeight,
    paddingHorizontal: ACTIVITY_LAYOUT.accountChipHorizontalPadding,
    borderRadius: ACTIVITY_LAYOUT.controlRadius,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  periodArrow: {
    width: PERIOD_ARROW_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 0,
    borderLeftWidth: 0,
  },
  periodCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  periodCenterTouch: {
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ACTIVITY_LAYOUT.controlHeight,
    paddingHorizontal: ACTIVITY_LAYOUT.filterChipHorizontalPadding,
    borderRadius: ACTIVITY_LAYOUT.controlRadius,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  moreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1.5,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  clearAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: -4,
  },
  moreRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  moreSubRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  dateField: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  amountField: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  applyBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
