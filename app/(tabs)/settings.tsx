import { useEffect, useMemo, useState } from 'react';
import { Keyboard, ScrollView, Switch, Text, View, Alert, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useUIStore } from '../../stores/useUIStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useAppTheme } from '../../lib/theme';
import { CardSection, ScreenTitle, SectionLabel, SettingsRow, ChoiceRow } from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import {
  CURRENCIES,
  MONTHS,
  THEMES,
  symbolFor,
} from '../../lib/settings-shared';
import { formatCurrency } from '../../lib/derived';

type PickerKind = 'year-start' | 'default-account' | 'currency' | 'theme' | null;

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useUIStore((s) => s.settings);
  const updateSettings = useUIStore((s) => s.updateSettings);
  const accounts = useAccountsStore((s) => s.accounts);
  const accountsLoaded = useAccountsStore((s) => s.isLoaded);
  const loadAccounts = useAccountsStore((s) => s.load);
  const categories = useCategoriesStore((s) => s.categories);
  const tags = useCategoriesStore((s) => s.tags);
  const categoriesLoaded = useCategoriesStore((s) => s.isLoaded);
  const loadCategories = useCategoriesStore((s) => s.load);
  const { palette } = useAppTheme();
  const [picker, setPicker] = useState<PickerKind>(null);

  useEffect(() => {
    if (!accountsLoaded) loadAccounts().catch(() => undefined);
  }, [accountsLoaded, loadAccounts]);

  useEffect(() => {
    if (!categoriesLoaded) loadCategories().catch(() => undefined);
  }, [categoriesLoaded, loadCategories]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === settings.defaultAccountId),
    [accounts, settings.defaultAccountId],
  );

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert('Not Supported', 'Your device does not support biometric authentication.');
        return;
      }
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        Alert.alert('Not Enrolled', 'No biometrics are enrolled on this device. Please set up a screen lock or biometrics in your device settings.');
        return;
      }
    }
    updateSettings({ biometricLock: value });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScreenTitle title="Settings" palette={palette} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
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
                icon="eye"
                label="Show Currency Symbol"
                value={settings.showCurrencySymbol ? 'On' : 'Off'}
                palette={palette}
                rightElement={
                  <Switch
                    value={settings.showCurrencySymbol}
                    onValueChange={(value) => updateSettings({ showCurrencySymbol: value })}
                    trackColor={{ false: palette.border, true: palette.tabActive }}
                    thumbColor={settings.showCurrencySymbol ? palette.onBrand : palette.surface}
                  />
                }
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
            <SectionLabel label="SECURITY" palette={palette} />
            <CardSection palette={palette}>
              <SettingsRow
                icon="lock"
                label="Biometric Lock"
                value={settings.biometricLock ? 'Enabled' : 'Disabled'}
                palette={palette}
                rightElement={
                  <Switch
                    value={settings.biometricLock}
                    onValueChange={handleBiometricToggle}
                    trackColor={{ false: palette.border, true: palette.tabActive }}
                    thumbColor={settings.biometricLock ? palette.onBrand : palette.surface}
                  />
                }
                noBorder
              />
            </CardSection>
          </View>

          <View>
            <SectionLabel label="DATA" palette={palette} />
            <CardSection palette={palette}>
              <SettingsRow
                icon="cloud-off"
                label="Cloud Backup"
                value="Not available"
                palette={palette}
              />
              <SettingsRow
                icon="refresh-cw"
                label="Reset App"
                labelStyle={{ color: palette.negative }}
                value="Erase everything"
                palette={palette}
                onPress={() => router.push('/settings/reset')}
                noBorder
              />
            </CardSection>
          </View>

          <View>
            <SectionLabel label="ABOUT" palette={palette} />
            <CardSection palette={palette}>
              <View style={{ padding: 20, alignItems: 'center' }}>
                <View style={{ marginBottom: 16 }}>
                  <FinanceEmptyMascot palette={palette} variant="activity" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text, letterSpacing: -0.5 }}>Reni</Text>
                <Text style={{ fontSize: 13, color: palette.textMuted, marginTop: 2 }}>Personal Finance Companion</Text>
                <View style={{ marginTop: 16, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: palette.inputBg }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: palette.textSecondary }}>VERSION 1.0.0</Text>
                </View>
              </View>
            </CardSection>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

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
                    updateSettings({ yearStart: index }, 'year-start');
                    setPicker(null);
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
                    updateSettings({ defaultAccountId: '' }, 'default-account-none');
                    setPicker(null);
                  }}
                />,
                ...accounts.map((account, index) => (
                  <ChoiceRow
                    key={account.id}
                    title={account.name}
                    subtitle={`${capitalize(account.type)} · ${formatCurrency(account.balance, symbolFor(account.currency))}`}
                    selected={settings.defaultAccountId === account.id}
                    palette={palette}
                    onPress={() => {
                      updateSettings({ defaultAccountId: account.id }, 'default-account');
                      setPicker(null);
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
                    updateSettings({ currency: currency.code, currencySymbol: currency.symbol }, 'currency');
                    setPicker(null);
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
                    updateSettings({ theme: theme.key }, 'theme');
                    setPicker(null);
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
