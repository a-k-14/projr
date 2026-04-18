import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View , TouchableOpacity} from 'react-native';
import {
  CardSection,
  FixedBottomActions,
  SettingsRow,
  SettingsScreenLayout } from '../../components/settings-ui';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { TYPE } from '../../lib/design';
import { formatDisplayCurrency, symbolFor } from '../../lib/settings-shared';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';

export default function AccountsScreen() {
  const { accounts, load, isLoaded } = useAccountsStore();
  const { palette } = useAppTheme();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  return (
    <SettingsScreenLayout
      palette={palette}
      bottomAction={
        <FixedBottomActions palette={palette}>
          <TouchableOpacity delayPressIn={0}
            onPress={() => router.push('/settings/account-form')}
            activeOpacity={0.7}
            style={{
              minHeight: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: palette.brand,
              alignItems: 'center',
              justifyContent: 'center' }}
          >
            <Text style={{ fontSize: TYPE.section, fontWeight: '600', color: palette.brand }}>
              + Add Account
            </Text>
          </TouchableOpacity>
        </FixedBottomActions>
      }
    >
      <CardSection palette={palette}>
        {accounts.map((account, index) => (
          <SettingsRow
            key={account.id}
            label={formatAccountDisplayName(account.name, account.accountNumber)}
            subtitle={`${account.type.charAt(0).toUpperCase() + account.type.slice(1)} · ${formatDisplayCurrency(account.initialBalance, symbolFor(account.currency))}`}
            palette={palette}
            leftElement={<Feather name="menu" size={18} color={palette.textSoft} />}
            onPress={() => router.push({ pathname: '/settings/account-form', params: { id: account.id } })}
            noBorder={index === accounts.length - 1}
          />
        ))}
        {accounts.length === 0 && (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: palette.textMuted, fontSize: TYPE.rowValue }}>No accounts yet.</Text>
          </View>
        )}
      </CardSection>
    </SettingsScreenLayout>
  );
}
