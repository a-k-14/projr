import { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppThemePalette } from './theme';
import { CardSection, SectionLabel } from '../components/settings-ui';
import { formatCurrency } from './derived';

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
  { key: 'investment', label: 'Investment' },
  { key: 'other', label: 'Other' },
] as const;

export function getAccountTypeLabel(type?: string): string {
  return ACCOUNT_TYPES.find((item) => item.key === type)?.label ?? 'Account';
}

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

// Single palette shared by accounts, categories, and tags.
export const ENTITY_COLORS = [
  '#2DD4BF',
  '#0F4C81',
  '#8B5CF6',
  '#CC3B2D',
  '#B45309',
  '#2563EB',
  '#7C3AED',
  '#0F766E',
] as const;

/** @deprecated use ENTITY_COLORS */
export const ACCOUNT_COLORS = ENTITY_COLORS;

export const CATEGORY_EMOJIS = [
  // Food & Drink
  '🍽️', '☕', '🍔', '🍕', '🍜', '🍱', '🥗', '🥦', '🍎', '🥛', '🌮', '🍣', '🍦', '🍩', '🍪', '🥑', '🥞', '🥓', '🥪', '🍻', '🍷', '🍹', '🍾',
  // Shopping
  '🛒', '🛍️', '🎁', '📦', '💳', '🧾', '🏷️', '💎', '👟', '👕', '👗', '🧥', '👖', '👔', '👓', '👒', '💄', '🧴',
  // Transport
  '🚗', '🚕', '🚌', '🚆', '✈️', '⛵', '⛽', '🅿️', '🚲', '🏍️', '🚁', '🛴', '🚇', '🚢',
  // Home
  '🏠', '🏡', '🛋️', '🛏️', '🧹', '🧺', '🧽', '🧼', '🧻', '🚽', '🛁', '🚿', '🪴', '💡', '🔦', '🚪',
  // Entertainment & Leisure
  '🎬', '🎵', '🎮', '🎟️', '🎤', '🎧', '🎸', '🎹', '🎨', '🎪', '🎢', '🎡', '🎳', '🎯', '🧩', '🎲', '🎰', '📺', '📸', '📹',
  // Health & Wellness
  '💊', '🏥', '🩺', '🧘', '🏋️', '🚴', '🏃', '🏊', '🧠', '🩸', '🩹', '🦷', '💪',
  // Finance
  '💰', '🏦', '🪙', '📈', '📉', '💸', '💴', '💶', '💷',
  // Work & Education
  '💼', '📚', '🏫', '🎓', '✏️', '💻', '🖥️', '🖨️', '📁', '📂', '📊', '📋', '📅', '📆', '📎', '📌', '✂️', '🖋️',
  // Pets & Kids
  '🐾', '🐶', '🐱', '🐰', '🐹', '👶', '🧸', '🍼', '🚸',
  // Travel
  '🏖️', '🏝️', '🏕️', '⛺', '🗺️', '🧭', '🧳', '🏨', '🗽', '🗼', '⛩️',
  // Utilities & Services
  '⚡', '📱', '🔧', '🧰', '🛠️', '🔨', '⛏️', '🪚', '🔩', '⚙️', '⚖️', '🔗', '🔌', '🔋', '📡', '📞', '☎️', '📮', '✉️', '🗑️',
  // People
  '🧑‍🍳', '🧑‍💻', '🧑‍🏫', '🧑‍⚕️', '🧑‍🔧', '🧑‍🔬', '🧑‍🎨', '🧑‍🚀', '🧑‍🚒', '👮', '🕵️', '💂', '👷',
] as const;

export const CATEGORY_ICONS = [
  // Shopping & retail
  'shopping-cart',
  'shopping-bag',
  'tag',
  'gift',
  'box',
  'archive',
  // Food & drink
  'coffee',
  'feather',
  'thermometer',
  'star',
  // Home & utilities
  'home',
  'zap',
  'droplet',
  'wifi',
  'phone',
  'tv',
  'tool',
  'settings',
  // Transport
  'truck',
  'navigation',
  'map-pin',
  'map',
  'anchor',
  // Finance
  'credit-card',
  'dollar-sign',
  'briefcase',
  'trending-up',
  'trending-down',
  'bar-chart-2',
  'pie-chart',
  // Health & wellness
  'heart',
  'activity',
  'shield',
  'plus-circle',
  'user',
  // Entertainment & lifestyle
  'music',
  'film',
  'camera',
  'headphones',
  'book',
  'book-open',
  'globe',
  'monitor',
  'smartphone',
  // Travel
  'compass',
  'umbrella',
  'sun',
  'cloud',
  'wind',
  // Education
  'edit',
  'clipboard',
  'award',
  // Misc
  'inbox',
  'layers',
  'grid',
  'more-horizontal',
] as const;

/** @deprecated use ENTITY_COLORS */
export const CATEGORY_COLORS = ENTITY_COLORS;

/** @deprecated use ENTITY_COLORS */
export const TAG_COLORS = ENTITY_COLORS;

/** Returns the currency symbol for a known currency code, defaulting to the code itself. */
export function symbolFor(currencyCode: string): string {
  return CURRENCIES.find((c) => c.code === currencyCode)?.symbol ?? currencyCode;
}

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

export { CardSection, SectionLabel };
