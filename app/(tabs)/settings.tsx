import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useUIStore } from '../../stores/useUIStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

const THEMES = ['auto', 'light', 'dark'] as const;

export default function SettingsScreen() {
  const { settings, updateSettings } = useUIStore();
  const { accounts } = useAccountsStore();
  const { categories, tags } = useCategoriesStore();
  const systemScheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, systemScheme));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: palette.text }}>Settings</Text>
        </View>

        {/* GENERAL */}
        <SectionHeader label="GENERAL" color={palette.textMuted} />
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: 16,
            marginHorizontal: 16,
            overflow: 'hidden',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: palette.border,
          }}
        >
          {/* Year Start */}
          <SettingsRow
            icon="calendar"
            label="Year Start"
            value={MONTHS[settings.yearStart]}
            palette={palette}
            onPress={() => {
              Alert.alert(
                'Year Start Month',
                'Select the month your financial year starts',
                MONTHS.map((m, i) => ({
                  text: m,
                  onPress: () => updateSettings({ yearStart: i }),
                  style: i === settings.yearStart ? 'default' : 'default',
                }))
              );
            }}
          />

          {/* Default Account */}
          <SettingsRow
            icon="credit-card"
            label="Default Account"
            value={accounts.find((a) => a.id === settings.defaultAccountId)?.name ?? 'None'}
            palette={palette}
            onPress={() => {
              Alert.alert(
                'Default Account',
                'Select your default account for new transactions',
                [
                  { text: 'None', onPress: () => updateSettings({ defaultAccountId: '' }) },
                  ...accounts.map((acc) => ({
                    text: acc.name,
                    onPress: () => updateSettings({ defaultAccountId: acc.id }),
                  })),
                  { text: 'Cancel', style: 'cancel' as const },
                ]
              );
            }}
          />

          {/* Currency */}
          <SettingsRow
            icon="dollar-sign"
            label="Currency"
            value={`${settings.currency} ${settings.currencySymbol}`}
            palette={palette}
            onPress={() => {
              Alert.alert(
                'Currency',
                undefined,
                [
                  ...CURRENCIES.map((c) => ({
                    text: `${c.name} (${c.symbol})`,
                    onPress: () =>
                      updateSettings({ currency: c.code, currencySymbol: c.symbol }),
                  })),
                  { text: 'Cancel', style: 'cancel' as const },
                ]
              );
            }}
          />

          {/* Theme */}
          <SettingsRow
            icon="sun"
            label="Theme"
            value={settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1)}
            palette={palette}
            onPress={() => {
              Alert.alert(
                'Theme',
                undefined,
                [
                  ...THEMES.map((t) => ({
                    text: t.charAt(0).toUpperCase() + t.slice(1),
                    onPress: () => updateSettings({ theme: t }),
                  })),
                  { text: 'Cancel', style: 'cancel' as const },
                ]
              );
            }}
            noBorder
          />
        </View>

        {/* MANAGE */}
        <SectionHeader label="MANAGE" color={palette.textMuted} />
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: 16,
            marginHorizontal: 16,
            overflow: 'hidden',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: palette.border,
          }}
        >
          <SettingsRow
            icon="layers"
            label="Accounts"
            value={String(accounts.length)}
            palette={palette}
            onPress={() => {
              // TODO: navigate to accounts management screen
              Alert.alert('Accounts', `You have ${accounts.length} accounts.`);
            }}
          />
          <SettingsRow
            icon="grid"
            label="Categories"
            value={String(categories.length)}
            palette={palette}
            onPress={() => {
              Alert.alert('Categories', `You have ${categories.length} categories.`);
            }}
          />
          <SettingsRow
            icon="tag"
            label="Tags"
            value={String(tags.length)}
            palette={palette}
            onPress={() => {
              Alert.alert('Tags', `You have ${tags.length} tags.`);
            }}
            noBorder
          />
        </View>

        {/* DATA */}
        <SectionHeader label="DATA" color={palette.textMuted} />
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: 16,
            marginHorizontal: 16,
            overflow: 'hidden',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: palette.border,
          }}
        >
          <SettingsRow
            icon="cloud"
            label="Cloud Backup"
            value={settings.cloudBackupEnabled ? 'On' : 'Off'}
            palette={palette}
            rightElement={
              <Switch
                value={settings.cloudBackupEnabled}
                onValueChange={(v) => {
                  if (v) {
                    Alert.alert(
                      'Cloud Backup',
                      'Cloud backup is coming soon. Your data is stored safely on your device.',
                      [{ text: 'OK' }]
                    );
                  } else {
                    updateSettings({ cloudBackupEnabled: false });
                  }
                }}
                trackColor={{ false: '#E5E7EB', true: '#1B4332' }}
                thumbColor={palette.surface}
              />
            }
            noBorder
          />
        </View>

        {/* ABOUT */}
        <SectionHeader label="ABOUT" color={palette.textMuted} />
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: 16,
            marginHorizontal: 16,
            overflow: 'hidden',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: palette.border,
          }}
        >
          <SettingsRow
            icon="info"
            label="Version"
            value="1.0.0"
            palette={palette}
            noBorder
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '600',
        color,
        letterSpacing: 0.8,
        marginHorizontal: 16,
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {label}
    </Text>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  palette,
  onPress,
  noBorder,
  rightElement,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  palette: ReturnType<typeof getThemePalette>;
  onPress?: () => void;
  noBorder?: boolean;
  rightElement?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !rightElement}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: palette.divider,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Feather name={icon} size={21} color={palette.iconTint} strokeWidth={1.8} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: palette.text, fontWeight: '400' }}>{label}</Text>
      {rightElement ? (
        rightElement
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {value && (
            <Text style={{ fontSize: 14, color: palette.textMuted }}>{value}</Text>
          )}
          {onPress && <Feather name="chevron-right" size={18} color={palette.textSoft} />}
        </View>
      )}
    </TouchableOpacity>
  );
}
