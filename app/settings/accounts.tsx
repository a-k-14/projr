import { useEffect, useColorScheme } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { SCREEN_GUTTER, SPACING } from '../../lib/design';
import { symbolFor, formatDisplayCurrency } from '../../lib/settings-shared';
import { CardSection, SettingsRow } from '../../components/settings-ui';

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
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: SPACING.lg, paddingBottom: 8 }}>
        <CardSection palette={palette}>
          {accounts.map((account, index) => (
            <SettingsRow
              key={account.id}
              icon={(account.icon as keyof typeof Feather.glyphMap) ?? 'credit-card'}
              label={account.name}
              palette={palette}
              onPress={() =>
                router.push({ pathname: '/settings/account-form', params: { id: account.id } })
              }
              noBorder={index === accounts.length - 1}
              rightElement={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: palette.textMuted, fontSize: 13, fontWeight: '500' }}>
                    {`${account.type} · ${formatDisplayCurrency(account.balance, symbolFor(account.currency))}`}
                  </Text>
                  <Feather name="chevron-right" size={18} color={palette.textSoft} />
                </View>
              }
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
          paddingTop: SPACING.md,
          paddingBottom: insets.bottom + SPACING.md,
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
