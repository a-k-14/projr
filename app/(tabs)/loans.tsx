import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLoansStore } from '../../stores/useLoansStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { getLoanSummary, formatCurrency } from '../../lib/derived';
import { formatDateShort } from '../../lib/dateUtils';
import { FilterChip } from '../../components/ui/FilterChip';
import { HOME_COLORS } from '../../lib/homeTokens';
import { SCREEN_GUTTER } from '../../lib/design';
import type { LoanWithSummary, LoanStatus } from '../../types';

import { ScreenTitle } from '../../components/settings-ui';

export default function LoansScreen() {
  const { loans, load, filters, setFilters } = useLoansStore();
  const { accounts } = useAccountsStore();
  const { settings } = useUIStore();
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const sym = settings.currencySymbol;

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(filters);
    setRefreshing(false);
  };

  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));

  const summary = getLoanSummary(loans);

  const displayAccounts = [
    { id: 'all', name: 'All accounts' },
    ...accounts.map((a) => ({ id: a.id, name: a.name })),
  ];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
      <FlatList
        data={loans}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            <ScreenTitle title="Loans" palette={palette} />
            <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 16 }}>
              {/* Summary cards */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5 }}>
                  YOU LENT
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#16A34A', marginTop: 4 }}>
                  {formatCurrency(summary.youLent, sym)}
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>to be received</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5 }}>
                  YOU OWE
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#DC2626', marginTop: 4 }}>
                  {formatCurrency(summary.youOwe, sym)}
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>to be paid back</Text>
              </View>
            </View>

            {/* Net */}
            <View
              style={{
                backgroundColor: palette.card,
                borderRadius: 16,
                paddingHorizontal: SCREEN_GUTTER,
                paddingVertical: 14,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>Net position</Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: summary.net >= 0 ? '#16A34A' : '#DC2626',
                }}
              >
                {summary.net >= 0 ? '+' : ''}{formatCurrency(summary.net, sym)}
              </Text>
            </View>

            {/* Filters */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                {displayAccounts.map((acc) => (
                  <FilterChip
                    key={acc.id}
                    label={acc.name}
                    isActive={(filters.accountId ?? 'all') === acc.id}
                    onPress={() => load({ accountId: acc.id === 'all' ? undefined : acc.id, status: filters.status })}
                    activeColor="#1B4332"
                  />
                ))}
              </ScrollView>

              {(['open', 'closed', undefined] as (LoanStatus | undefined)[]).map((s) => (
                <FilterChip
                  key={String(s)}
                  label={s === undefined ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  isActive={filters.status === s}
                  onPress={() => load({ ...filters, status: s })}
                  activeColor="#1B4332"
                />
              ))}
            </View>
          </View>
        </View>
      }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text style={{ color: '#9CA3AF', fontSize: 14, marginTop: 12 }}>No loans found</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <LoanRow
            loan={item}
            sym={sym}
            isLast={index === loans.length - 1}
            onPress={() => router.push(`/loan/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => null}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/modals/add-loan')}
        style={{
          position: 'absolute',
          bottom: Math.max(insets.bottom + 12, 24),
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

function LoanRow({
  loan,
  sym,
  isLast,
  onPress,
}: {
  loan: LoanWithSummary;
  sym: string;
  isLast: boolean;
  onPress: () => void;
}) {
  const { accounts } = useAccountsStore();
  const account = accounts.find((a) => a.id === loan.accountId);
  const isLent = loan.direction === 'lent';

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: '#fff',
        marginHorizontal: SCREEN_GUTTER,
        marginBottom: 2,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isLent ? '#DCFCE7' : '#FEE2E2',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons
          name={isLent ? 'arrow-down' : 'arrow-up'}
          size={18}
          color={isLent ? '#16A34A' : '#DC2626'}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#0A0A0A' }}>{loan.personName}</Text>
        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
          {isLent ? 'Lent' : 'Borrowed'} · {account?.name} · {formatDateShort(loan.date)}
        </Text>
        {loan.repaidPercent > 0 && loan.repaidPercent < 100 && (
          <View
            style={{
              height: 3,
              backgroundColor: '#E5E7EB',
              borderRadius: 2,
              marginTop: 6,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: 3,
                width: `${loan.repaidPercent}%`,
                backgroundColor: isLent ? '#16A34A' : '#DC2626',
                borderRadius: 2,
              }}
            />
          </View>
        )}
      </View>

      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: isLent ? '#16A34A' : '#DC2626' }}>
          {formatCurrency(loan.pendingAmount, sym)}
        </Text>
        <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
          of {formatCurrency(loan.givenAmount, sym)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
