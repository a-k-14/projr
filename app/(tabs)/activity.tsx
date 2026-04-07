import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { groupTransactionsByDate, formatCurrency } from '../../lib/derived';
import { getRelativeDateLabel } from '../../lib/dateUtils';
import { HOME_COLORS } from '../../lib/homeTokens';
import { AccountTabBar } from '../../components/AccountTabBar';
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
  const { settings } = useUIStore();
  const { transactions, load, loadMore, hasMore } = useTransactionsStore();
  const { getCategoryDisplayName } = useCategoriesStore();

  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const sym = settings.currencySymbol;

  const displayAccounts = [
    { id: 'all' as const, name: 'All' },
    ...accounts.map((a) => ({ id: a.id, name: a.name })),
  ];

  const loadData = useCallback(async () => {
    await load({
      accountId: selectedAccountId === 'all' ? undefined : selectedAccountId,
      type: typeFilter === 'all' ? undefined : typeFilter,
      search: search || undefined,
    });
  }, [selectedAccountId, typeFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const grouped = groupTransactionsByDate(transactions);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HOME_COLORS.background }}>
      <AccountTabBar
        accounts={displayAccounts}
        selectedId={selectedAccountId}
        onSelect={(id) => setSelectedAccountId(id)}
      />

      <FlatList
        data={grouped}
        keyExtractor={(item) => item.dateKey}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        onEndReached={() => hasMore && loadMore()}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
            {/* Search */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#fff',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 12,
              }}
            >
              <Ionicons name="search" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search transactions..."
                placeholderTextColor="#9CA3AF"
                value={search}
                onChangeText={setSearch}
                style={{ flex: 1, fontSize: 14, color: '#0A0A0A' }}
                returnKeyType="search"
              />
            </View>

            {/* Type Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  onPress={() => setTypeFilter(f.value)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 8,
                    backgroundColor: typeFilter === f.value ? '#1B4332' : '#fff',
                    borderWidth: 1,
                    borderColor: typeFilter === f.value ? '#1B4332' : '#E5E7EB',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '500',
                      color: typeFilter === f.value ? '#fff' : '#6B7280',
                    }}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
            <Text style={{ color: '#9CA3AF', fontSize: 14, marginTop: 12 }}>No transactions found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '500', marginBottom: 8 }}>
              {getRelativeDateLabel(item.dateKey + 'T00:00:00.000Z')}
            </Text>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' }}>
              {item.items.map((tx, i) => (
                <ActivityRow
                  key={tx.id}
                  tx={tx}
                  sym={sym}
                  isLast={i === item.items.length - 1}
                  onPress={() => router.push({ pathname: '/modals/add-transaction', params: { editId: tx.id } })}
                />
              ))}
            </View>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/modals/add-transaction')}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#1B4332',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function ActivityRow({
  tx,
  sym,
  isLast,
  onPress,
}: {
  tx: Transaction;
  sym: string;
  isLast: boolean;
  onPress: () => void;
}) {
  const { getById } = useAccountsStore();
  const { getCategoryDisplayName, getTagById } = useCategoriesStore();
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
    tx.type === 'in' ? '#DCFCE7' : tx.type === 'out' ? '#FEE2E2' : '#F1F5F9';
  const iconColor =
    tx.type === 'in' ? '#16A34A' : tx.type === 'out' ? '#DC2626' : '#1E293B';

  const tagNames = tx.tags
    .map((id) => getTagById(id)?.name)
    .filter(Boolean)
    .join(' · ');

  const subtitleParts = [
    tx.categoryId ? getCategoryDisplayName(tx.categoryId) : null,
    account?.name,
    tagNames || null,
  ].filter(Boolean);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
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
        <Ionicons name={iconName as any} size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#0A0A0A' }} numberOfLines={1}>
          {tx.note ?? tx.type}
        </Text>
        {subtitleParts.length > 0 && (
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }} numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </Text>
        )}
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
    </TouchableOpacity>
  );
}
