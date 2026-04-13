import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChoiceRow } from '../../components/settings-ui';
import { TransactionListItem } from '../../components/TransactionListItem';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FilterChip } from '../../components/ui/FilterChip';
import {
  getNavigableDateRange,
  getPeriodNavLabel,
  getRelativeDateLabel,
} from '../../lib/dateUtils';
import { formatCurrency, groupTransactionsByDate } from '../../lib/derived';
import { CARD_PADDING } from '../../lib/design';
import { ACTIVITY_LAYOUT, HOME_TEXT, TRANSACTIONS_PAGE_SIZE } from '../../lib/layoutTokens';
import { getThemePalette, resolveTheme, type AppThemePalette } from '../../lib/theme';
import * as transactionsService from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
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

const TYPE_OPTIONS: { label: string; value: TransactionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'In', value: 'in' },
  { label: 'Out', value: 'out' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Loan', value: 'loan' },
];

export default function ActivityScreen() {
  const routeParams = useLocalSearchParams<{
    source?: string;
    period?: string;
    accountId?: string;
    type?: string;
    from?: string;
    to?: string;
    ts?: string;
  }>();
  const { accounts } = useAccountsStore();
  const { categories, tags, getCategoryDisplayName, load: loadCategories, isLoaded: categoriesLoaded } = useCategoriesStore();
  const { settings } = useUIStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));
  const insets = useSafeAreaInsets();
  const sym = settings.currencySymbol;

  const [period, setPeriod] = useState<ActivityPeriod>('all');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState<string | undefined>();
  const [customTo, setCustomTo] = useState<string | undefined>();
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
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

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const lastAppliedRouteTsRef = useRef<string | null>(null);

  const dateRange = useMemo(() => {
    if (period === 'all') return null;
    if (period === 'custom') return customFrom && customTo ? { from: customFrom, to: customTo } : null;
    return getNavigableDateRange(period, periodOffset, settings.yearStart);
  }, [customFrom, customTo, period, periodOffset, settings.yearStart]);

  const canGoNext = period !== 'all' && period !== 'custom' && periodOffset < 0;
  const periodLabel = useMemo(() => {
    if (period === 'all' || !dateRange) return 'All Time';
    return getPeriodNavLabel(period, dateRange.from, dateRange.to);
  }, [dateRange, period]);
  const selectedAccount =
    selectedAccountId === 'all' ? null : accounts.find((account) => account.id === selectedAccountId);
  const accountLabel = selectedAccount ? selectedAccount.name : 'All Accounts';

  const loadData = useMemo(
    () => async (isInitial: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const currentOffset = isInitial ? 0 : offsetRef.current;
        const filters: TransactionFilters = {
          accountId: selectedAccountId === 'all' ? undefined : selectedAccountId,
          type: typeFilter === 'all' ? undefined : typeFilter,
          fromDate: dateRange?.from,
          toDate: dateRange?.to,
          search: search || undefined,
          limit: period === 'all' ? TRANSACTIONS_PAGE_SIZE : undefined,
          offset: period === 'all' ? currentOffset : 0,
        };
        const results = await transactionsService.getTransactions(filters);
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
    [dateRange?.from, dateRange?.to, period, search, selectedAccountId, typeFilter],
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    if (!categoriesLoaded) loadCategories().catch(() => undefined);
  }, [categoriesLoaded, loadCategories]);

  useEffect(() => {
    const source = typeof routeParams.source === 'string' ? routeParams.source : undefined;
    const ts = typeof routeParams.ts === 'string' ? routeParams.ts : undefined;
    if (!source || !ts || lastAppliedRouteTsRef.current === ts) return;

    const periodParam = typeof routeParams.period === 'string' ? routeParams.period : undefined;
    const accountParam = typeof routeParams.accountId === 'string' ? routeParams.accountId : undefined;
    const typeParam = typeof routeParams.type === 'string' ? routeParams.type : undefined;
    const fromParam = typeof routeParams.from === 'string' ? routeParams.from : undefined;
    const toParam = typeof routeParams.to === 'string' ? routeParams.to : undefined;

    setPeriod('all');
    setPeriodOffset(0);
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setSelectedAccountId('all');
    setTypeFilter('all');
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    setAmountMinStr('');
    setAmountMaxStr('');
    setExpandedCategoryIds([]);
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

    lastAppliedRouteTsRef.current = ts;
  }, [accounts, routeParams.accountId, routeParams.from, routeParams.period, routeParams.source, routeParams.to, routeParams.ts, routeParams.type]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const onLoadMore = () => {
    if (!hasMore || loadingRef.current) return;
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
  }, [amountMaxStr, amountMinStr, categories, selectedCategoryIds, selectedTagIds, transactions]);

  const overallNet = useMemo(() => calcNet(filteredTransactions), [filteredTransactions]);

  const moreActiveCount =
    selectedCategoryIds.length +
    selectedTagIds.length +
    (amountMinStr ? 1 : 0) +
    (amountMaxStr ? 1 : 0);
  const moreActiveBg = palette.brandSoft;
  const moreActiveBorder = palette.brand;

  const topCategories = useMemo(() => categories.filter((category) => !category.parentId), [categories]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const childCategoriesByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    categories.forEach((category) => {
      if (!category.parentId) return;
      const next = map.get(category.parentId) ?? [];
      next.push(category);
      map.set(category.parentId, next);
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

  const grouped = useMemo<ActivityGroup[]>(() => {
    return groupTransactionsByDate(filteredTransactions).map((group) => {
      const { date, label } = getRelativeDateLabel(group.dateKey);
      return {
        groupKey: group.dateKey,
        title: date,
        subtitle: label || undefined,
        net: calcNet(group.items),
        items: group.items,
      };
    });
  }, [filteredTransactions]);

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
          <Text style={{ fontSize: 26, fontWeight: '700', color: palette.text, letterSpacing: -0.5 }}>
            Activity
          </Text>
          <TouchableOpacity
            onPress={() => setIsSearchActive(true)}
            style={[styles.iconBtn, { backgroundColor: palette.surface, borderColor: palette.divider }]}
          >
            <Ionicons name="search" size={17} color={palette.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={grouped}
        keyExtractor={(item) => item.groupKey}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: insets.bottom + ACTIVITY_LAYOUT.listBottomPadding }}
        ListHeaderComponent={
          <View style={{ paddingTop: ACTIVITY_LAYOUT.headerPaddingTop }}>
            <View style={[styles.row, { paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, marginBottom: ACTIVITY_LAYOUT.headerRowGap }]}>
              <TouchableOpacity
                onPress={() => setShowAccountSheet(true)}
                style={[styles.accountPicker, { backgroundColor: palette.surface, borderColor: palette.divider }]}
              >
                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: palette.text, flex: 1 }}>
                  {accountLabel}
                </Text>
                <Ionicons name="chevron-down" size={13} color={palette.textMuted} />
              </TouchableOpacity>

              <View
                style={[
                  styles.periodBar,
                  { backgroundColor: palette.surface, borderColor: palette.divider, flex: 3, marginLeft: ACTIVITY_LAYOUT.controlChipGap },
                ]}
              >
                <TouchableOpacity
                  onPress={goPrev}
                  disabled={period === 'custom'}
                  style={[styles.periodArrow, { borderRightColor: palette.divider }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="chevron-back"
                    size={14}
                    color={palette.text}
                    style={{ opacity: period === 'custom' ? 0.2 : 1 }}
                  />
                </TouchableOpacity>

                <View style={styles.periodCenter}>
                  <TouchableOpacity
                    onPress={() => setShowPeriodSheet(true)}
                    style={styles.periodCenterTouch}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }} numberOfLines={1}>
                      {periodLabel}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={goNext}
                  disabled={!canGoNext}
                  style={[styles.periodArrow, { borderLeftColor: palette.divider }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                      onPress={() => setTypeFilter(option.value)}
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
                <MaterialIcons name="filter-list" size={17} color={moreActiveCount > 0 ? palette.brand : palette.textMuted} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: moreActiveCount > 0 ? palette.brand : palette.textMuted, marginLeft: 4 }}>
                  {moreActiveCount > 0 ? `More ${moreActiveCount}` : 'More'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 1, backgroundColor: palette.divider, marginBottom: 14 }} />
          </View>
        }
        renderItem={({ item }) => {
          const groupNet = item.net;
          return (
            <View style={{ marginBottom: ACTIVITY_LAYOUT.groupCardMarginBottom }}>
              <View style={[styles.groupHeader, { paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, marginBottom: ACTIVITY_LAYOUT.groupHeaderBottom }]}>
                <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: palette.text }}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <>
                      <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: palette.textMuted, marginHorizontal: 6 }}>
                        •
                      </Text>
                      <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted }}>
                        {item.subtitle}
                      </Text>
                    </>
                  ) : null}
                </View>
                {item.items.length > 1 && groupNet !== 0 ? (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: groupNet > 0 ? palette.brand : palette.negative }}>
                    {signedCurrency(groupNet, sym)}
                  </Text>
                ) : null}
              </View>

              <View style={{
                backgroundColor: palette.surface,
                borderRadius: ACTIVITY_LAYOUT.groupCardRadius,
                marginHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
                overflow: 'hidden',
              }}>
                {item.items.map((tx, index) => (
                  <TransactionListItem
                    key={tx.id}
                    tx={tx}
                    sym={sym}
                    isLast={index === item.items.length - 1}
                    categoryName={tx.categoryId ? getCategoryDisplayName(tx.categoryId) : undefined}
                    palette={palette}
                  />
                ))}
              </View>
            </View>
          );
        }}
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
            subtitle={formatDateShortLabel(nowIso())}
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
            subtitle={formatRangeLabel('week', settings.yearStart, 0)}
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
            subtitle={formatRangeLabel('month', settings.yearStart, 0)}
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
            subtitle={formatRangeLabel('year', settings.yearStart, 0)}
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
                onPress={() => setShowMoreSheet(false)}
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
              Category
            </Text>

            <View style={{ paddingTop: 2 }}>
              {topCategories.map((category) => {
                const children = childCategoriesByParent.get(category.id) ?? [];
                const count = getCategoryTxCount(transactions, category.id, categories);
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
                      count={count}
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
                        const childCount = getCategoryTxCount(transactions, child.id, categories);
                        const childSelected = selectedCategoryIds.includes(child.id);
                        return (
                          <View
                            key={child.id}
                            style={[
                              styles.moreSubRow,
                              { borderBottomColor: palette.divider, paddingHorizontal: CARD_PADDING + 34 },
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
                            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textMuted, marginRight: 6 }}>
                              {childCount}
                            </Text>
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
  return txs.reduce((sum, tx) => {
    if (tx.type === 'in') return sum + tx.amount;
    if (tx.type === 'out') return sum - tx.amount;
    return sum;
  }, 0);
}

function signedCurrency(amount: number, sym: string) {
  if (amount === 0) return formatCurrency(0, sym);
  return `${amount > 0 ? '+' : '−'}${formatCurrency(Math.abs(amount), sym)}`;
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
  palette,
}: {
  icon: string;
  palette: AppThemePalette;
}) {
  const isEmoji = !/^[a-z-]+$/.test(icon);
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
      {isEmoji ? (
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      ) : (
        <Feather name={icon as keyof typeof Feather.glyphMap} size={16} color={palette.iconTint} />
      )}
    </View>
  );
}

function MoreCategoryRow({
  category,
  count,
  selected,
  partial,
  expanded,
  hasChildren,
  palette,
  onToggleSelected,
  onToggleExpanded,
}: {
  category: { id: string; name: string; icon: string; color: string };
  count: number;
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
      <Text style={{ fontSize: 14, fontWeight: '700', color: palette.textMuted, marginRight: 10 }}>
        {count}
      </Text>
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

function getCategoryTxCount(txs: Transaction[], categoryId: string, categories: { id: string; parentId?: string }[]) {
  const ids = new Set([categoryId, ...categories.filter((category) => category.parentId === categoryId).map((category) => category.id)]);
  return txs.filter((tx) => tx.categoryId && ids.has(tx.categoryId)).length;
}

function getTagTxCount(txs: Transaction[], tagId: string) {
  return txs.filter((tx) => tx.tags.includes(tagId)).length;
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
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
    flex: 2,
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
    width: 38,
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
    paddingHorizontal: 2,
  },
  periodCenterTouch: {
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
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
