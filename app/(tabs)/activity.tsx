import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { groupTransactionsByDate, formatCurrency } from '../../lib/derived';
import { getRelativeDateLabel } from '../../lib/dateUtils';
import { HOME_RADIUS, HOME_TEXT, TRANSACTIONS_PAGE_SIZE } from '../../lib/layoutTokens';
import { getThemePalette, resolveTheme, AppThemePalette } from '../../lib/theme';
import { SCREEN_GUTTER, CARD_PADDING } from '../../lib/design';
import { AccountTabBar } from '../../components/AccountTabBar';
import { InlineDot } from '../../components/ui/InlineDot';
import { TransactionListItem } from '../../components/TransactionListItem';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { ChoiceRow } from '../../components/settings-ui';
import * as transactionsService from '../../services/transactions';
import type { TransactionType, Transaction } from '../../types';

const FILTERS: { label: string; value: TransactionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'In', value: 'in' },
  { label: 'Out', value: 'out' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Loan', value: 'loan' },
];

/** Net of in/out for a day group. Transfers and loans are neutral. */
function calcDayNet(txs: Transaction[]): number {
  return txs.reduce((sum, tx) => {
    if (tx.type === 'in') return sum + tx.amount;
    if (tx.type === 'out') return sum - tx.amount;
    return sum;
  }, 0);
}

export default function ActivityScreen() {
  const { accounts } = useAccountsStore();
  const { width } = useWindowDimensions();
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  const { settings } = useUIStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));

  const pagerRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const displayAccounts = [
    { id: 'all' as const, name: 'All' },
    ...accounts.map((a) => ({ id: a.id, name: a.name })),
  ];

  const selectedIndex = Math.max(
    0,
    displayAccounts.findIndex((a) => a.id === selectedAccountId),
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

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      <AccountTabBar
        accounts={displayAccounts}
        selectedId={selectedAccountId}
        externalScrollX={scrollX}
        palette={palette}
        onSelect={(id) => {
          const index = displayAccounts.findIndex((a) => a.id === id);
          handleTabPress(index);
        }}
      />

      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        onMomentumScrollEnd={handlePagerEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {displayAccounts.map((account) => (
          <View key={account.id} style={{ width }}>
            <ActivityAccountPage
              accountId={account.id}
              isSelected={account.id === selectedAccountId}
              search={search}
              onSearchChange={setSearch}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              palette={palette}
            />
          </View>
        ))}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function ActivityAccountPage({
  accountId,
  isSelected,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  palette,
}: {
  accountId: string | 'all';
  isSelected: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  typeFilter: TransactionType | 'all';
  onTypeFilterChange: (t: TransactionType | 'all') => void;
  categoryFilter?: string;
  onCategoryFilterChange: (id: string | undefined) => void;
  palette: AppThemePalette;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const { settings } = useUIStore();
  const { categories, getCategoryDisplayName } = useCategoriesStore();
  const sym = settings.currencySymbol;
  const topCategories = categories.filter((c) => !c.parentId);

  const loadData = useCallback(async (isInitial = true) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const currentOffset = isInitial ? 0 : offsetRef.current;
      const results = await transactionsService.getTransactions({
        accountId: accountId === 'all' ? undefined : accountId,
        type: typeFilter === 'all' ? undefined : typeFilter,
        categoryId: categoryFilter || undefined,
        search: search || undefined,
        limit: TRANSACTIONS_PAGE_SIZE,
        offset: currentOffset,
      });

      if (isInitial) {
        setTransactions(results);
        offsetRef.current = TRANSACTIONS_PAGE_SIZE;
        setHasMore(results.length === TRANSACTIONS_PAGE_SIZE);
      } else {
        setTransactions((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          return [...prev, ...results.filter((t) => !existingIds.has(t.id))];
        });
        offsetRef.current += TRANSACTIONS_PAGE_SIZE;
        setHasMore(results.length === TRANSACTIONS_PAGE_SIZE);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [accountId, typeFilter, categoryFilter, search]);

  useEffect(() => {
    if (isSelected) loadData(true);
  }, [isSelected, typeFilter, categoryFilter, search, loadData]);

  const onRefresh = async () => {
    if (loadingRef.current) return;
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const onLoadMore = async () => {
    if (!hasMore || loadingRef.current || transactions.length === 0) return;
    await loadData(false);
  };

  const grouped = groupTransactionsByDate(transactions);
  const activeCategoryName = categoryFilter
    ? topCategories.find((c) => c.id === categoryFilter)?.name
    : undefined;

  return (
    <>
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.dateKey}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 16, paddingBottom: 8 }}>
            {/* Search */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: palette.surface,
                borderRadius: HOME_RADIUS.card,
                paddingHorizontal: CARD_PADDING,
                paddingVertical: 10,
                marginBottom: SCREEN_GUTTER,
                borderWidth: 1,
                borderColor: palette.divider,
              }}
            >
              <Ionicons name="search" size={16} color={palette.textSoft} style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search transactions..."
                placeholderTextColor={palette.textSoft}
                value={search}
                onChangeText={onSearchChange}
                style={{ flex: 1, fontSize: 14, color: palette.text, padding: 0 }}
                returnKeyType="search"
              />
            </View>

            {/* Type filter pills + category filter button */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.value}
                    onPress={() => onTypeFilterChange(f.value)}
                    style={{
                      paddingHorizontal: CARD_PADDING,
                      paddingVertical: 6,
                      borderRadius: HOME_RADIUS.tab,
                      marginRight: 8,
                      backgroundColor: typeFilter === f.value ? palette.brand : palette.surface,
                      borderWidth: 1,
                      borderColor: typeFilter === f.value ? palette.brand : palette.divider,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: HOME_TEXT.bodySmall,
                        fontWeight: '500',
                        color: typeFilter === f.value ? palette.surface : palette.textMuted,
                      }}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Category filter — opens BottomSheet */}
              <TouchableOpacity
                onPress={() => setShowCategorySheet(true)}
                style={{
                  paddingHorizontal: CARD_PADDING,
                  paddingVertical: 6,
                  borderRadius: HOME_RADIUS.tab,
                  borderWidth: 1,
                  marginLeft: 8,
                  borderColor: categoryFilter ? palette.brand : palette.divider,
                  backgroundColor: categoryFilter ? palette.brand : palette.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Ionicons
                  name="options-outline"
                  size={14}
                  color={categoryFilter ? palette.surface : palette.textMuted}
                />
                {activeCategoryName ? (
                  <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: '600', color: palette.surface }}>
                    {activeCategoryName}
                  </Text>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const { date, label } = getRelativeDateLabel(item.dateKey);
          const net = calcDayNet(item.items);
          const hasNet = net !== 0;
          return (
            <View style={{ marginBottom: 16 }}>
              {/* Date header with day net */}
              <View
                style={{
                  paddingHorizontal: SCREEN_GUTTER,
                  marginBottom: SCREEN_GUTTER,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textSoft }}>
                  {date}
                </Text>
                {label ? (
                  <>
                    <InlineDot size={3} color={palette.textSoft} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textSoft }}>
                      {label}
                    </Text>
                  </>
                ) : null}
                {hasNet && (
                  <Text
                    style={{
                      marginLeft: 'auto',
                      fontSize: 13,
                      fontWeight: '600',
                      color: net > 0 ? palette.brand : palette.negative,
                    }}
                  >
                    {net > 0 ? '+' : '−'}{formatCurrency(Math.abs(net), sym)}
                  </Text>
                )}
              </View>

              {/* Transaction card */}
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderRadius: HOME_RADIUS.card,
                  marginHorizontal: SCREEN_GUTTER,
                  overflow: 'hidden',
                }}
              >
                {item.items.map((tx, idx) => (
                  <TransactionListItem
                    key={tx.id}
                    tx={tx}
                    sym={sym}
                    isLast={idx === item.items.length - 1}
                    categoryName={tx.categoryId ? getCategoryDisplayName(tx.categoryId) : undefined}
                    palette={palette}
                  />
                ))}
              </View>
            </View>
          );
        }}
      />

      {/* Category filter sheet */}
      {showCategorySheet && (
        <BottomSheet
          title="Filter by category"
          palette={palette}
          onClose={() => setShowCategorySheet(false)}
        >
          <ChoiceRow
            title="All categories"
            selected={!categoryFilter}
            palette={palette}
            onPress={() => {
              onCategoryFilterChange(undefined);
              setShowCategorySheet(false);
            }}
          />
          {topCategories.map((cat, index) => (
            <ChoiceRow
              key={cat.id}
              title={cat.name}
              selected={categoryFilter === cat.id}
              palette={palette}
              leftElement={
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: cat.color,
                  }}
                />
              }
              noBorder={index === topCategories.length - 1}
              onPress={() => {
                onCategoryFilterChange(categoryFilter === cat.id ? undefined : cat.id);
                setShowCategorySheet(false);
              }}
            />
          ))}
        </BottomSheet>
      )}
    </>
  );
}
