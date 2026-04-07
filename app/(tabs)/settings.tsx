import { ScrollView, Switch, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUIStore } from '../../stores/useUIStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { CardSection, ScreenTitle, SectionLabel, SettingsRow } from '../../components/settings-ui';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useUIStore();
  const { accounts } = useAccountsStore();
  const { categories, tags } = useCategoriesStore();
  const systemScheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, systemScheme));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <ScreenTitle title="Settings" palette={palette} />

          <SectionLabel label="GENERAL" palette={palette} />
          <CardSection palette={palette}>
            <SettingsRow
              icon="calendar"
              label="Year Start"
              value={MONTHS[settings.yearStart]}
              palette={palette}
              onPress={() => router.push('/settings/year-start')}
            />
            <SettingsRow
              icon="credit-card"
              label="Default Account"
              value={accounts.find((a) => a.id === settings.defaultAccountId)?.name ?? 'None'}
              palette={palette}
              onPress={() => router.push('/settings/default-account')}
            />
            <SettingsRow
              icon="dollar-sign"
              label="Currency"
              value={`${settings.currency} ${settings.currencySymbol}`}
              palette={palette}
              onPress={() => router.push('/settings/currency')}
            />
            <SettingsRow
              icon="sun"
              label="Theme"
              value={capitalize(settings.theme)}
              palette={palette}
              onPress={() => router.push('/settings/theme')}
              noBorder
            />
          </CardSection>

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

          <SectionLabel label="ABOUT" palette={palette} />
          <CardSection palette={palette}>
            <SettingsRow icon="info" label="Version" value="1.0.0" palette={palette} noBorder />
          </CardSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
