import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { getTotalBalance, formatCurrency, groupTransactionsByDate } from '../../lib/derived';
import { getDateRange, getRelativeDateLabel, getDayLabel, todayUTC, formatDate } from '../../lib/dateUtils';
import { getCashflowSummary, getDailySpending } from '../../services/analytics';
import type { PeriodType, Transaction, CashflowSummary, DailySpending } from '../../types';

const PERIODS: PeriodType[] = ['week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<PeriodType, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom',
};

export default function HomeScreen() {
  const { accounts, refresh: refreshAccounts } = useAccountsStore();
  const { settings } = useUIStore();
  const { transactions, load: loadTransactions } = useTransactionsStore();
  const { getCategoryDisplayName } = useCategoriesStore();

  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [period, setPeriod] = useState<PeriodType>('week');
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [todayCashflow, setTodayCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [dailyData, setDailyData] = useState<DailySpending[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const sym = settings.currencySymbol;
  const { from, to } = getDateRange(period, settings.yearStart);
  const today = todayUTC();

  const loadData = useCallback(async () => {
    const accountFilter = selectedAccountId === 'all' ? undefined : selectedAccountId;
    const [cf, tcf, daily] = await Promise.all([
      getCashflowSummary(selectedAccountId, from, to),
      getCashflowSummary(selectedAccountId, today, today),
      getDailySpending(selectedAccountId, from, to),
    ]);
    setCashflow(cf);
    setTodayCashflow(tcf);
    setDailyData(daily);
    await loadTransactions({ accountId: accountFilter, limit: 5 });
  }, [selectedAccountId, period, from, to]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshAccounts(), loadData()]);
    setRefreshing(false);
  };

  const totalBalance =
    selectedAccountId === 'all'
      ? getTotalBalance(accounts)
      : (accounts.find((a) => a.id === selectedAccountId)?.balance ?? 0);

  const displayAccounts = [
    { id: 'all', name: 'All' },
    ...accounts.map((a) => ({ id: a.id, name: a.name })),
  ];

  const maxSpend = Math.max(...dailyData.map((d) => d.amount), 1);
  const chartDays = dailyData.slice(-7);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F0F5' }}>
      {/* Account Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', maxHeight: 48 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {displayAccounts.map((acc) => (
          <TouchableOpacity
            key={acc.id}
            onPress={() => setSelectedAccountId(acc.id)}
            style={{ marginRight: 24, paddingVertical: 12, position: 'relative' }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: selectedAccountId === acc.id ? '600' : '400',
                color: selectedAccountId === acc.id ? '#1B4332' : '#6B7280',
              }}
              numberOfLines={1}
            >
              {acc.name.length > 14 ? acc.name.substring(0, 12) + '…' : acc.name}
            </Text>
            {selectedAccountId === acc.id && (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: '#1B4332',
                  borderRadius: 2,
                }}
              />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Balance */}
        <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 }}>
          <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '500' }}>
            {selectedAccountId === 'all'
              ? 'All Accounts'
              : accounts.find((a) => a.id === selectedAccountId)?.name}
          </Text>
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Current Balance</Text>
          <Text style={{ fontSize: 32, fontWeight: '700', color: '#0A0A0A', marginTop: 4 }}>
            {formatCurrency(totalBalance, sym)}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          {/* Today */}
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#0A0A0A', marginBottom: 12 }}>
            {formatDate(today)} · Today
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {(['in', 'out', 'net'] as const).map((k) => (
              <View
                key={k}
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  padding: 12,
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4, textTransform: 'capitalize' }}>
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: k === 'out' ? '#DC2626' : k === 'in' ? '#16A34A' : '#0A0A0A',
                  }}
                >
                  {formatCurrency(todayCashflow[k], sym)}
                </Text>
              </View>
            ))}
          </View>

          {/* Period Toggle */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 4,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#0A0A0A', paddingHorizontal: 12 }}>
              This
            </Text>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: period === p ? '#1B4332' : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: period === p ? '#fff' : '#6B7280',
                  }}
                >
                  {PERIOD_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
            {formatDate(from)} — {formatDate(to)}
          </Text>

          {/* Period Cashflow */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {(['in', 'out', 'net'] as const).map((k) => (
              <View
                key={k}
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  padding: 12,
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: k === 'out' ? '#DC2626' : k === 'in' ? '#16A34A' : '#0A0A0A',
                  }}
                >
                  {formatCurrency(cashflow[k], sym)}
                </Text>
              </View>
            ))}
          </View>

          {/* Spending Chart */}
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#0A0A0A', marginBottom: 16 }}>
              Spending
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, paddingHorizontal: 4 }}>
              {chartDays.length > 0
                ? chartDays.map((d, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                      <View
                        style={{
                          width: 20,
                          backgroundColor: '#1B4332',
                          borderRadius: 4,
                          opacity: 0.7,
                          height: Math.max(4, (d.amount / maxSpend) * 56),
                        }}
                      />
                      <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                        {getDayLabel(d.date)}
                      </Text>
                    </View>
                  ))
                : ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                      <View style={{ width: 20, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 }} />
                      <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{day}</Text>
                    </View>
                  ))}
            </View>
          </View>

          {/* Recent */}
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#0A0A0A' }}>Recent</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/activity')}>
                <Text style={{ fontSize: 13, color: '#1B4332', fontWeight: '500' }}>View all ›</Text>
              </TouchableOpacity>
            </View>
            {transactions.length === 0 ? (
              <Text style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>
                No transactions yet
              </Text>
            ) : (
              transactions.slice(0, 5).map((tx, i) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  sym={sym}
                  isLast={i === Math.min(transactions.length, 5) - 1}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

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

function TransactionRow({
  tx,
  sym,
  isLast,
}: {
  tx: Transaction;
  sym: string;
  isLast: boolean;
}) {
  const { getById } = useAccountsStore();
  const { getCategoryDisplayName } = useCategoriesStore();
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
    tx.type === 'in'
      ? '#DCFCE7'
      : tx.type === 'out'
      ? '#FEE2E2'
      : '#F1F5F9';

  const iconColor =
    tx.type === 'in'
      ? '#16A34A'
      : tx.type === 'out'
      ? '#DC2626'
      : '#1E293B';

  const subtitle = [
    tx.categoryId ? getCategoryDisplayName(tx.categoryId) : null,
    account?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
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
        {subtitle ? (
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
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
    </View>
  );
}
