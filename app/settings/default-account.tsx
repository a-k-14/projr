import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { formatDisplayCurrency, PickerSheetShell } from './_shared';
import { ChoiceRow, SectionLabel } from '../../components/settings-ui';
import { getThemePalette, resolveTheme } from '../../lib/theme';

export default function DefaultAccountScreen() {
  const router = useRouter();
  const { settings, updateSettings, load, isLoaded } = useUIStore();
  const { accounts, load: loadAccounts, isLoaded: accountsLoaded } = useAccountsStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));

  useEffect(() => {
    if (!isLoaded) {
      load().catch(() => undefined);
    }
    if (!accountsLoaded) {
      loadAccounts().catch(() => undefined);
    }
  }, [isLoaded, accountsLoaded, load, loadAccounts]);

  return (
    <PickerSheetShell
      title="Default Account"
      subtitle="Choose the default account for new transactions"
      palette={palette}
      onClose={() => router.back()}
    >
      <SectionLabel label="Choose the default account for new transactions" palette={palette} />
      <ChoiceRow
        title="None"
        subtitle="Prompt every time"
        selected={!settings.defaultAccountId}
        palette={palette}
        onPress={() => updateSettings({ defaultAccountId: '' })}
      />
      {accounts.map((account, index) => (
        <ChoiceRow
          key={account.id}
          title={account.name}
          subtitle={`${capitalize(account.type)} · ${formatDisplayCurrency(account.balance, symbolFor(account.currency))}`}
          selected={settings.defaultAccountId === account.id}
          palette={palette}
          onPress={() => updateSettings({ defaultAccountId: account.id })}
          noBorder={index === accounts.length - 1}
        />
      ))}
    </PickerSheetShell>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function symbolFor(currency: string) {
  switch (currency) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return '₹';
  }
}
