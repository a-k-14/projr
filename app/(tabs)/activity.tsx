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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { groupTransactionsByDate, formatCurrency } from '../../lib/derived';
import { getRelativeDateLabel } from '../../lib/dateUtils';
import { HOME_COLORS, HOME_LAYOUT, HOME_RADIUS, HOME_TEXT } from '../../lib/homeTokens';
import { SCREEN_GUTTER } from '../../lib/design';
import { AccountTabBar } from '../../components/AccountTabBar';
import { InlineDot } from '../../components/ui/InlineDot';
import { FilterChip } from '../../components/ui/FilterChip';
import { TransactionItem } from '../../components/TransactionItem';
import * as transactionsService from '../../services/transactions';
import type { TransactionType, Transaction } from '../../types';

const FILTERS: { label: string; value: TransactionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'In', value: 'in' },
  { label: 'Out', value: 'out' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Loan', value: 'loan' },
];

export default function ActivityScreen() {
  const { accounts } = useAccountsStore();
  const { width } = useWindowDimensions();
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');

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

  // Sync pager when selectedAccountId changes (e.g. from external sources)
  useEffect(() => {
    pagerRef.current?.scrollTo({ x: selectedIndex * width, animated: false });
  }, [selectedIndex, width]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: HOME_COLORS.background }}>
      <AccountTabBar
        accounts={displayAccounts}
        selectedId={selectedAccountId}
        externalScrollX={scrollX}
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
}: {
  accountId: string | 'all';
  isSelected: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  typeFilter: TransactionType | 'all';
  onTypeFilterChange: (t: TransactionType | 'all') => void;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const loadingRef = useRef(false);

  const PAGE_SIZE = 40;
  const { settings } = useUIStore();
  const { getCategoryDisplayName } = useCategoriesStore();
  const sym = settings.currencySymbol;

  const loadData = useCallback(async (isInitial = true) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const currentOffset = isInitial ? 0 : offset;
      const filterParams = {
        accountId: accountId === 'all' ? undefined : accountId,
        type: typeFilter === 'all' ? undefined : typeFilter,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: currentOffset,
      };

      const results = await transactionsService.getTransactions(filterParams);

      if (isInitial) {
        setTransactions(results);
        setOffset(PAGE_SIZE);
        setHasMore(results.length === PAGE_SIZE);
      } else {
        setTransactions((prev) => {
          // Deduplicate by ID to prevent key collisions
          const existingIds = new Set(prev.map(t => t.id));
          const newTxs = results.filter(t => !existingIds.has(t.id));
          return [...prev, ...newTxs];
        });
        setOffset((prev) => prev + PAGE_SIZE);
        setHasMore(results.length === PAGE_SIZE);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [accountId, typeFilter, search, offset]);

  useEffect(() => {
    if (isSelected) {
      loadData(true);
    }
  }, [isSelected, typeFilter, search]);

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

  return (
    <FlatList
      data={grouped}
      keyExtractor={(item) => item.dateKey}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={HOME_COLORS.active} />}
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
              backgroundColor: HOME_COLORS.surface,
              borderRadius: HOME_RADIUS.card,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: HOME_COLORS.divider,
            }}
          >
            <Ionicons name="search" size={16} color={HOME_COLORS.textSoft} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search transactions..."
              placeholderTextColor={HOME_COLORS.textSoft}
              value={search}
              onChangeText={onSearchChange}
              style={{ flex: 1, fontSize: 14, color: HOME_COLORS.text, padding: 0 }}
              returnKeyType="search"
            />
          </View>

          {/* Type Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {FILTERS.map((f) => (
              <FilterChip
                key={f.value}
                label={f.label}
                isActive={typeFilter === f.value}
                onPress={() => onTypeFilterChange(f.value)}
              />
            ))}
          </ScrollView>
        </View>
      }
      renderItem={({ item }) => {
        const { date, label } = getRelativeDateLabel(item.dateKey);
        return (
          <View style={{ marginBottom: 16 }}>
            <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: HOME_COLORS.textSoft }}>
                {date}
              </Text>
              {label ? (
                <>
                  <InlineDot size={3} color={HOME_COLORS.textSoft} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: HOME_COLORS.textSoft }}>
                    {label}
                  </Text>
                </>
              ) : null}
            </View>
            <View style={{ backgroundColor: HOME_COLORS.surface, borderRadius: HOME_RADIUS.card, marginHorizontal: SCREEN_GUTTER, overflow: 'hidden' }}>
              {item.items.map((tx, idx) => (
                <TransactionItem
                  key={tx.id}
                  tx={tx}
                  sym={sym}
                  isLast={idx === item.items.length - 1}
                />
              ))}
            </View>
          </View>
        );
      }}
    />
  );
}
