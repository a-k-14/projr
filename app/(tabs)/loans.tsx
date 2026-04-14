import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateShort } from '../../lib/dateUtils';
import { formatCurrency, getLoanSummary } from '../../lib/derived';
import { CARD_PADDING, SCREEN_GUTTER } from '../../lib/design';
import {
  HOME_LAYOUT,
  HOME_RADIUS,
  HOME_SHADOW,
  HOME_SPACE,
  HOME_TEXT,
  getFabBottomOffset,
} from '../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';
import { FabButton } from '../../components/ui/FabButton';
import type { LoanStatus, LoanWithSummary } from '../../types';
import { useCallback } from 'react';


export default function LoansScreen() {
  const loans = useLoansStore((s) => s.loans);
  const loadLoans = useLoansStore((s) => s.load);
  const filters = useLoansStore((s) => s.filters);
  const accounts = useAccountsStore((s) => s.accounts);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadLoans();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLoans(filters);
    setRefreshing(false);
  };

  const summary = getLoanSummary(loans);
  const net = summary.net;
  const netPositive = net >= 0;

  const displayAccounts = [
    { id: 'all', name: 'All accounts' },
    ...accounts.map((a) => ({ id: a.id, name: a.name })),
  ];

  const renderLoanItem = useCallback(
    ({ item, index }: { item: LoanWithSummary; index: number }) => {
      const account = accounts.find((a) => a.id === item.accountId);
      return (
        <LoanRow
          loan={item}
          accountName={account?.name}
          sym={sym}
          palette={palette}
          isLast={index === loans.length - 1}
          onPress={() => router.push(`/loan/${item.id}`)}
        />
      );
    },
    [accounts, sym, palette, loans.length],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
      <FlatList
        data={loans}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />
        }
        contentContainerStyle={{ paddingBottom: HOME_LAYOUT.fabContentBottomPadding }}
        ListHeaderComponent={
          <View style={{ padding: SCREEN_GUTTER }}>
            {/* Title */}
            <View style={{ paddingTop: HOME_SPACE.xs, paddingBottom: HOME_SPACE.md }}>
              <Text style={{ fontSize: HOME_TEXT.screenTitle, fontWeight: '700', color: palette.text }}>
                Loans
              </Text>
            </View>

            {/* Summary cards: Lent / Owe */}
            <View style={{ flexDirection: 'row', gap: SCREEN_GUTTER, marginBottom: SCREEN_GUTTER }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: palette.surface,
                  borderRadius: HOME_RADIUS.card,
                  padding: CARD_PADDING,
                }}
              >
                <Text
                  style={{
                    fontSize: HOME_TEXT.tiny + 1,
                    color: palette.textMuted,
                    fontWeight: '600',
                    letterSpacing: 0.5,
                  }}
                >
                  YOU LENT
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: palette.positive,
                    marginTop: HOME_SPACE.xs,
                  }}
                >
                  {formatCurrency(summary.youLent, sym)}
                </Text>
                <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, marginTop: 2 }}>
                  to be received
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: palette.surface,
                  borderRadius: HOME_RADIUS.card,
                  padding: HOME_SPACE.xl,
                }}
              >
                <Text
                  style={{
                    fontSize: HOME_TEXT.tiny + 1,
                    color: palette.textMuted,
                    fontWeight: '600',
                    letterSpacing: 0.5,
                  }}
                >
                  YOU OWE
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: palette.negative,
                    marginTop: HOME_SPACE.xs,
                  }}
                >
                  {formatCurrency(summary.youOwe, sym)}
                </Text>
                <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, marginTop: 2 }}>
                  to be paid back
                </Text>
              </View>
            </View>

            {/* Net position */}
            <View
              style={{
                backgroundColor: palette.surface,
                borderRadius: HOME_RADIUS.card,
                paddingHorizontal: HOME_SPACE.xl,
                paddingVertical: HOME_SPACE.lg,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: HOME_SPACE.xl,
              }}
            >
              <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '600', color: palette.text }}>
                Net position
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: HOME_SPACE.sm }}>
                <View
                  style={{
                    paddingHorizontal: HOME_SPACE.md,
                    paddingVertical: 3,
                    borderRadius: HOME_RADIUS.full,
                    backgroundColor: netPositive ? palette.inBg : palette.outBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: HOME_TEXT.caption,
                      fontWeight: '600',
                      color: netPositive ? palette.positive : palette.negative,
                    }}
                  >
                    {netPositive ? 'NET LENDER' : 'NET BORROWER'}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: HOME_TEXT.heroLabel,
                    fontWeight: '700',
                    color: netPositive ? palette.positive : palette.negative,
                  }}
                >
                  {netPositive ? '+' : ''}{formatCurrency(net, sym)}
                </Text>
              </View>
            </View>

            {/* Account filter */}
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md, marginBottom: HOME_SPACE.xs }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                {displayAccounts.map((acc) => {
                  const active = (filters.accountId ?? 'all') === acc.id;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => loadLoans({ accountId: acc.id === 'all' ? undefined : acc.id, status: filters.status })}
                      style={{
                        paddingHorizontal: HOME_SPACE.lg,
                        paddingVertical: HOME_SPACE.sm,
                        borderRadius: HOME_RADIUS.small,
                        marginRight: HOME_SPACE.sm,
                        backgroundColor: active ? palette.brand : palette.surface,
                        borderWidth: 1,
                        borderColor: active ? palette.brand : palette.divider,
                      }}
                    >
                      <Text style={{ fontSize: HOME_TEXT.bodySmall, color: active ? palette.surface : palette.textSecondary }}>
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {(['open', 'closed', undefined] as (LoanStatus | undefined)[]).map((s) => {
                const active = filters.status === s;
                return (
                  <TouchableOpacity
                    key={String(s)}
                    onPress={() => loadLoans({ ...filters, status: s })}
                    style={{
                      paddingHorizontal: HOME_SPACE.lg,
                      paddingVertical: HOME_SPACE.sm,
                      borderRadius: HOME_RADIUS.small,
                      backgroundColor: active ? palette.brand : palette.surface,
                      borderWidth: 1,
                      borderColor: active ? palette.brand : palette.divider,
                    }}
                  >
                    <Text style={{ fontSize: HOME_TEXT.bodySmall, color: active ? palette.surface : palette.textSecondary }}>
                      {s === undefined ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Ionicons name="people-outline" size={48} color={palette.textMuted} />
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, marginTop: HOME_SPACE.md }}>
              No loans found
            </Text>
          </View>
        }
        renderItem={renderLoanItem}
        ItemSeparatorComponent={() => null}
      />

      {/* FAB */}
      <FabButton
        bottom={getFabBottomOffset(insets.bottom)}
        palette={palette}
        backgroundColor={palette.loan}
        iconColor={palette.onLoan}
        onPress={() => router.push({ pathname: '/modals/add-transaction', params: { type: 'loan' } })}
      />
    </SafeAreaView>
  );
}

// ─── LoanRow ──────────────────────────────────────────────────────────────────

function LoanRow({
  loan,
  accountName,
  sym,
  palette,
  isLast,
  onPress,
}: {
  loan: LoanWithSummary;
  accountName?: string;
  sym: string;
  palette: AppThemePalette;
  isLast: boolean;
  onPress: () => void;
}) {
  const isLent = loan.direction === 'lent';
  const dirColor = isLent ? palette.positive : palette.negative;
  const dirBg = isLent ? palette.inBg : palette.outBg;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: palette.surface,
        marginHorizontal: SCREEN_GUTTER,
        marginBottom: 2,
        borderRadius: HOME_RADIUS.card,
        padding: HOME_SPACE.xl,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Direction icon */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: dirBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: HOME_SPACE.md,
        }}
      >
        <Ionicons name={isLent ? 'arrow-down' : 'arrow-up'} size={18} color={dirColor} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '600', color: palette.text }}>
          {loan.personName}
        </Text>
        <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 2 }}>
          {isLent ? 'Lent' : 'Borrowed'} · {accountName} · {formatDateShort(loan.date)}
        </Text>

        {/* Ghost progress bar — visible even at 0% */}
        {loan.repaidPercent < 100 && (
          <View
            style={{
              height: 3,
              backgroundColor: palette.divider,
              borderRadius: 2,
              marginTop: HOME_SPACE.sm,
              overflow: 'hidden',
            }}
          >
            {loan.repaidPercent > 0 && (
              <View
                style={{
                  height: 3,
                  width: `${loan.repaidPercent}%`,
                  backgroundColor: dirColor,
                  borderRadius: 2,
                }}
              />
            )}
          </View>
        )}
      </View>

      <View style={{ alignItems: 'flex-end', marginLeft: HOME_SPACE.md }}>
        <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: dirColor }}>
          {formatCurrency(loan.pendingAmount, sym)}
        </Text>
        <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, marginTop: 2 }}>
          of {formatCurrency(loan.givenAmount, sym)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
