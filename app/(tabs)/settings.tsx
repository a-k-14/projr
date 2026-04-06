import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUIStore } from '../../stores/useUIStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F0F5' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#0A0A0A' }}>Settings</Text>
        </View>

        {/* GENERAL */}
        <SectionHeader label="GENERAL" />
        <View style={{ backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, overflow: 'hidden', marginBottom: 16 }}>
          {/* Year Start */}
          <SettingsRow
            icon="calendar"
            label="Year Start"
            value={MONTHS[settings.yearStart]}
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
            icon="card"
            label="Default Account"
            value={accounts.find((a) => a.id === settings.defaultAccountId)?.name ?? 'None'}
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
            icon="cash"
            label="Currency"
            value={`${settings.currency} ${settings.currencySymbol}`}
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
            icon="contrast"
            label="Theme"
            value={settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1)}
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
        <SectionHeader label="MANAGE" />
        <View style={{ backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, overflow: 'hidden', marginBottom: 16 }}>
          <SettingsRow
            icon="layers"
            label="Accounts"
            value={String(accounts.length)}
            onPress={() => {
              // TODO: navigate to accounts management screen
              Alert.alert('Accounts', `You have ${accounts.length} accounts.`);
            }}
          />
          <SettingsRow
            icon="grid"
            label="Categories"
            value={String(categories.length)}
            onPress={() => {
              Alert.alert('Categories', `You have ${categories.length} categories.`);
            }}
          />
          <SettingsRow
            icon="pricetag"
            label="Tags"
            value={String(tags.length)}
            onPress={() => {
              Alert.alert('Tags', `You have ${tags.length} tags.`);
            }}
            noBorder
          />
        </View>

        {/* DATA */}
        <SectionHeader label="DATA" />
        <View style={{ backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, overflow: 'hidden', marginBottom: 16 }}>
          <SettingsRow
            icon="cloud-upload"
            label="Cloud Backup"
            value={settings.cloudBackupEnabled ? 'On' : 'Off'}
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
                thumbColor="#fff"
              />
            }
            noBorder
          />
        </View>

        {/* ABOUT */}
        <SectionHeader label="ABOUT" />
        <View style={{ backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, overflow: 'hidden', marginBottom: 16 }}>
          <SettingsRow
            icon="information-circle"
            label="Version"
            value="1.0.0"
            noBorder
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '600',
        color: '#9CA3AF',
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
  onPress,
  noBorder,
  rightElement,
}: {
  icon: string;
  label: string;
  value?: string;
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
        borderBottomColor: '#F3F4F6',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: '#F3F4F6',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name={icon as any} size={16} color="#6B7280" />
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: '#0A0A0A', fontWeight: '400' }}>{label}</Text>
      {rightElement ? (
        rightElement
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {value && (
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>{value}</Text>
          )}
          {onPress && <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />}
        </View>
      )}
    </TouchableOpacity>
  );
}
