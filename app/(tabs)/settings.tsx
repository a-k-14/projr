import { useMemo, useState } from 'react';
import { ScrollView, Switch, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUIStore } from '../../stores/useUIStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { CardSection, ScreenTitle, SectionLabel, SettingsRow, ChoiceRow } from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import {
  CURRENCIES,
  MONTHS,
  THEMES,
  formatDisplayCurrency,
  symbolFor,
} from '../../lib/settings-shared';

type PickerKind = 'year-start' | 'default-account' | 'currency' | 'theme' | null;

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useUIStore();
  const { accounts } = useAccountsStore();
  const { categories, tags } = useCategoriesStore();
  const systemScheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, systemScheme));
  const [picker, setPicker] = useState<PickerKind>(null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === settings.defaultAccountId),
    [accounts, settings.defaultAccountId],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }} // Increased for seamless scroll behind navbar
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle title="Settings" palette={palette} />

        <View>
          <SectionLabel label="GENERAL" palette={palette} />
          <CardSection palette={palette}>
            <SettingsRow
              icon="calendar"
              label="Year Start"
              value={MONTHS[settings.yearStart]}
              palette={palette}
              onPress={() => setPicker('year-start')}
            />
            <SettingsRow
              icon="credit-card"
              label="Default Account"
              value={selectedAccount?.name ?? 'None'}
              palette={palette}
              onPress={() => setPicker('default-account')}
            />
            <SettingsRow
              icon="dollar-sign"
              label="Currency"
              value={`${settings.currency} ${settings.currencySymbol}`}
              palette={palette}
              onPress={() => setPicker('currency')}
            />
            <SettingsRow
              icon="sun"
              label="Theme"
              value={capitalize(settings.theme)}
              palette={palette}
              onPress={() => setPicker('theme')}
              noBorder
            />
          </CardSection>
        </View>

        <View>
          <SectionLabel label="MANAGE" palette={palette} />
          <CardSection palette={palette}>
            <SettingsRow
              icon="layers"
              label="Accounts"
              value={String(accounts.length)}
              palette={palette}
              onPress={() => router.push('/settings/accounts')}
            />
            <SettingsRow
              icon="grid"
              label="Categories"
              value={String(categories.length)}
              palette={palette}
              onPress={() => router.push('/settings/categories')}
            />
            <SettingsRow
              icon="tag"
              label="Tags"
              value={String(tags.length)}
              palette={palette}
              onPress={() => router.push('/settings/tags')}
              noBorder
            />
          </CardSection>
        </View>

        <View>
          <SectionLabel label="DATA" palette={palette} />
          <CardSection palette={palette}>
            <SettingsRow
              icon="cloud"
              label="Cloud Backup"
              value={settings.cloudBackupEnabled ? 'On' : 'Off'}
              palette={palette}
              rightElement={
                <Switch
                  value={settings.cloudBackupEnabled}
                  onValueChange={(value) => updateSettings({ cloudBackupEnabled: value })}
                  trackColor={{ false: palette.border, true: palette.tabActive }}
                  thumbColor={settings.cloudBackupEnabled ? '#FFFFFF' : '#F3F4F6'}
                />
              }
              noBorder
            />
          </CardSection>
        </View>

        <View>
          <SectionLabel label="ABOUT" palette={palette} />
          <CardSection palette={palette}>
            <SettingsRow icon="info" label="Version" value="1.0.0" palette={palette} noBorder />
          </CardSection>
        </View>
      </ScrollView>

      {picker ? (
        <BottomSheet
          title={pickerTitle(picker)}
          subtitle={pickerSubtitle(picker)}
          palette={palette}
          onClose={() => setPicker(null)}
          hasNavBar
        >
          {picker === 'year-start'
            ? MONTHS.map((month, index) => (
                <ChoiceRow
                  key={month}
                  title={month}
                  selected={settings.yearStart === index}
                  palette={palette}
                  onPress={() => {
                    setPicker(null);
                    updateSettings({ yearStart: index });
                  }}
                  noBorder={index === MONTHS.length - 1}
                />
              ))
            : null}

          {picker === 'default-account'
            ? [
                <ChoiceRow
                  key="none"
                  title="None"
                  subtitle="Prompt every time"
                  selected={!settings.defaultAccountId}
                  palette={palette}
                  onPress={() => {
                    setPicker(null);
                    updateSettings({ defaultAccountId: '' });
                  }}
                />,
                ...accounts.map((account, index) => (
                  <ChoiceRow
                    key={account.id}
                    title={account.name}
                    subtitle={`${capitalize(account.type)} · ${formatDisplayCurrency(account.balance, symbolFor(account.currency))}`}
                    selected={settings.defaultAccountId === account.id}
                    palette={palette}
                    onPress={() => {
                      setPicker(null);
                      updateSettings({ defaultAccountId: account.id });
                    }}
                    noBorder={index === accounts.length - 1}
                  />
                )),
              ]
            : null}

          {picker === 'currency'
            ? CURRENCIES.map((currency, index) => (
                <ChoiceRow
                  key={currency.code}
                  title={`${currency.symbol} ${currency.code}`}
                  subtitle={currency.name}
                  selected={settings.currency === currency.code}
                  palette={palette}
                  onPress={() => {
                    setPicker(null);
                    updateSettings({ currency: currency.code, currencySymbol: currency.symbol });
                  }}
                  noBorder={index === CURRENCIES.length - 1}
                />
              ))
            : null}

          {picker === 'theme'
            ? THEMES.map((theme, index) => (
                <ChoiceRow
                  key={theme.key}
                  title={theme.label}
                  subtitle={
                    theme.key === 'auto'
                      ? 'Follow the device setting'
                      : theme.key === 'light'
                        ? 'Always use light mode'
                        : 'Always use dark mode'
                  }
                  selected={settings.theme === theme.key}
                  palette={palette}
                  onPress={() => {
                    setPicker(null);
                    updateSettings({ theme: theme.key });
                  }}
                  noBorder={index === THEMES.length - 1}
                />
              ))
            : null}
        </BottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

function pickerTitle(kind: PickerKind) {
  switch (kind) {
    case 'year-start':
      return 'Year Start';
    case 'default-account':
      return 'Default Account';
    case 'currency':
      return 'Currency';
    case 'theme':
      return 'Theme';
    default:
      return '';
  }
}

function pickerSubtitle(kind: PickerKind) {
  switch (kind) {
    case 'year-start':
      return 'Choose the first month of your year';
    case 'default-account':
      return 'Choose the default account for new transactions';
    case 'currency':
      return 'Pick the currency shown across the app';
    case 'theme':
      return 'Choose how the app follows system appearance';
    default:
      return undefined;
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
