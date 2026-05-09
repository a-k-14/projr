import { Text } from '@/components/ui/AppText';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenTitle } from '../../components/settings-ui';
import { EmptyStateCard } from '../../components/ui/EmptyStateCard';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { formatCurrency } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { HOME_LAYOUT, HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import { registerTabReset } from '../../lib/tabResetRegistry';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';

const DEPOSIT_ACCOUNT_TYPES = new Set(['savings', 'investment']);

export default function DepositsScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();

  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';

  const depositAccounts = useMemo(
    () => accounts.filter((account) => DEPOSIT_ACCOUNT_TYPES.has(account.type)),
    [accounts],
  );
  const totalDeposits = useMemo(
    () => depositAccounts.reduce((sum, account) => sum + account.balance, 0),
    [depositAccounts],
  );

  useEffect(
    () =>
      registerTabReset('deposits', async ({ mode }) => {
        if (mode !== 'full') return;
        await refreshAccounts();
      }),
    [refreshAccounts],
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      <ScreenTitle title="Deposits" subtitle="Savings and investment balances" palette={palette} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => refreshAccounts().catch(() => undefined)} tintColor={palette.brand} />}
        contentContainerStyle={{ paddingBottom: HOME_LAYOUT.fabContentBottomPadding }}
      >
        <View
          style={{
            marginHorizontal: SCREEN_GUTTER,
            marginBottom: 12,
            padding: 16,
            borderRadius: HOME_RADIUS.card,
            borderWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.card,
          }}
        >
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 6 }}>Total Deposits</Text>
          <Text style={{ fontSize: HOME_TEXT.heroValue, fontWeight: '700', color: palette.text }}>
            {formatCurrency(totalDeposits, sym)}
          </Text>
        </View>

        {depositAccounts.length === 0 ? (
          <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
            <EmptyStateCard
              palette={palette}
              title="No deposit accounts yet"
              subtitle="Add a savings or investment account to track deposits here."
              illustration={<FinanceEmptyMascot palette={palette} variant="budget" />}
            />
          </View>
        ) : (
          <View style={{ gap: 10, paddingHorizontal: SCREEN_GUTTER }}>
            {depositAccounts.map((account) => (
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={0.82}
                key={account.id}
                onPress={() => router.push(`/account/${account.id}`)}
                style={{
                  padding: 14,
                  borderRadius: HOME_RADIUS.card,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  backgroundColor: palette.card,
                }}
              >
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
                  {account.type === 'investment' ? 'Investment' : 'Savings'}
                </Text>
                <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, marginTop: 4 }}>
                  {formatAccountDisplayName(account.name, account.accountNumber)}
                </Text>
                <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, marginTop: 8 }}>
                  {formatCurrency(account.balance, sym)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
