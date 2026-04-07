import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppThemePalette } from '../../lib/theme';
import { CardSection, ScreenTitle, SectionLabel } from '../../components/settings-ui';
import { formatCurrency } from '../../lib/derived';

export const MONTHS = [
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

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

export const THEMES = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
] as const;

export const ACCOUNT_TYPES = [
  { key: 'savings', label: 'Savings' },
  { key: 'credit', label: 'Credit Card' },
  { key: 'cash', label: 'Cash' },
  { key: 'wallet', label: 'Wallet' },
] as const;

export const ACCOUNT_ICONS = [
  'credit-card',
  'smartphone',
  'briefcase',
  'home',
  'dollar-sign',
  'shopping-cart',
  'truck',
  'coffee',
  'box',
  'archive',
] as const;

export const ACCOUNT_COLORS = [
  '#17673B',
  '#0F4C81',
  '#8B5CF6',
  '#CC3B2D',
  '#B45309',
  '#2563EB',
  '#7C3AED',
  '#0F766E',
] as const;

export const CATEGORY_ICONS = [
  'shopping-cart',
  'coffee',
  'truck',
  'home',
  'briefcase',
  'smartphone',
  'credit-card',
  'gift',
  'map-pin',
  'archive',
] as const;

export const CATEGORY_COLORS = [
  '#17673B',
  '#0F4C81',
  '#8B5CF6',
  '#CC3B2D',
  '#B45309',
  '#2563EB',
  '#7C3AED',
  '#0F766E',
] as const;

export const TAG_COLORS = [
  '#17673B',
  '#0F4C81',
  '#8B5CF6',
  '#CC3B2D',
  '#B45309',
  '#2563EB',
  '#7C3AED',
  '#0F766E',
] as const;

export function formatDisplayCurrency(amount: number, symbol: string) {
  return formatCurrency(amount, symbol);
}

export function SettingsScreenShell({
  palette,
  children,
}: {
  palette: AppThemePalette;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PickerSheetShell({
  title,
  subtitle,
  palette,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  palette: AppThemePalette;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' }}>
      <Pressable style={{ flex: 1, justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          style={{
            backgroundColor: palette.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: palette.border,
            maxHeight: '92%',
            overflow: 'hidden',
          }}
          onPress={() => undefined}
        >
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View
              style={{
                width: 42,
                height: 4,
                borderRadius: 2,
                backgroundColor: palette.divider,
              }}
            />
          </View>
          <ScreenTitle title={title} subtitle={subtitle} palette={palette} />
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </SafeAreaView>
  );
}

export { CardSection, SectionLabel };
