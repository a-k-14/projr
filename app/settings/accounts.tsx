import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardSection, SettingsRow } from '../../components/settings-ui';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { SCREEN_GUTTER, SPACING } from '../../lib/design';
import { formatDisplayCurrency, symbolFor } from '../../lib/settings-shared';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';

export default function AccountsScreen() {
  const { accounts, load, isLoaded } = useAccountsStore();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: SPACING.md, paddingBottom: 8 }}>
        <CardSection palette={palette}>
          {accounts.map((account, index) => (
            <SettingsRow
              key={account.id}
              label={formatAccountDisplayName(account.name, account.accountNumber)}
              subtitle={`${account.type.charAt(0).toUpperCase() + account.type.slice(1)} · ${formatDisplayCurrency(account.initialBalance, symbolFor(account.currency))}`}
              palette={palette}
              onPress={() =>
                router.push({ pathname: '/settings/account-form', params: { id: account.id } })
              }
              noBorder={index === accounts.length - 1}
            />
          ))}
          {accounts.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted, fontSize: 14 }}>No accounts yet.</Text>
            </View>
          )}
        </CardSection>
      </ScrollView>

      {/* Fixed bottom add button */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: palette.divider,
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: SPACING.sm,
          paddingBottom: (insets.bottom || 16) + 2,
          backgroundColor: palette.background,
        }}
      >
        <TouchableOpacity
          onPress={() => router.push('/settings/account-form')}
          activeOpacity={0.7}
          style={{
            minHeight: 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: palette.active,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.active }}>+ Add Account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
