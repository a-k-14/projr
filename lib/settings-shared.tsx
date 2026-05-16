import { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppThemePalette } from './theme';
import { CardSection, SectionLabel } from '../components/settings-ui';
import { formatCurrency } from './derived';
import type { AccountType } from '../types';

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

export const ACCOUNT_TYPE_META: Record<AccountType, { icon: string; color: string; bg?: string }> = {
  savings: { icon: 'landmark', color: '#3B5B7A', bg: '#EAF0F6' },
  cash: { icon: 'banknote', color: '#4F7D5D', bg: '#EAF3ED' },
  wallet: { icon: 'wallet', color: '#8A6548', bg: '#F2ECE5' },
  investment: { icon: 'trending-up', color: '#6E5A8A', bg: '#EEEAF4' },
  credit: { icon: 'credit-card', color: '#9B4A46', bg: '#F4E8E7' },
  other: { icon: 'circle-dollar-sign', color: '#667085', bg: '#EEF1F5' },
};

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

type CategoryEmojiGroup = {
  name: string;
  emojis: readonly string[];
  keywords: readonly string[];
};

export const CATEGORY_EMOJI_GROUPS: readonly CategoryEmojiGroup[] = [
  {
    name: 'Food & Drink',
    emojis: ['🍽️', '☕', '🍔', '🍕', '🍜', '🍱', '🥗', '🥦', '🍎', '🥛', '🌮', '🍣', '🍦', '🍩', '🍪', '🥑', '🥞', '🥓', '🥪', '🍻', '🍷', '🍹', '🍾', '🥤', '🍵', '🧃', '🍇', '🍉', '🍌', '🍓', '🍒', '🍑', '🥭', '🍍', '🥕', '🌽', '🍚', '🍛', '🍝', '🥟', '🍗', '🍖', '🥘', '🥡', '🍲', '🍿', '🥨', '🥐', '🥯', '🍰', '🍫', '🍮', '🥥', '🍆', '🧅', '🧄', '🥜'],
    keywords: ['food', 'drink', 'coffee', 'tea', 'snack', 'breakfast', 'lunch', 'dinner', 'restaurant', 'cafe', 'grocery', 'groceries', 'meal', 'fruit', 'vegetable'],
  },
  {
    name: 'Shopping',
    emojis: ['🛒', '🛍️', '🎁', '📦', '💳', '🧾', '🏷️', '💎', '👟', '👕', '👗', '🧥', '👖', '👔', '👓', '👒', '💄', '🧴', '👜', '⌚', '💍', '🪞', '🪑', '👠', '👞', '🎒', '🌂', '🧣', '🧤'],
    keywords: ['shopping', 'shop', 'retail', 'mall', 'buy', 'purchase', 'clothes', 'fashion', 'beauty', 'cosmetic', 'gift', 'parcel'],
  },
  {
    name: 'Transport',
    emojis: ['🚗', '🚕', '🚌', '🚆', '✈️', '⛵', '⛽', '🅿️', '🚲', '🏍️', '🚁', '🛴', '🚇', '🚢', '🚙', '🚚', '🚐', '🛺', '🚉', '🛣️', '🛫', '🛬', '🛹', ' canoe', '🚠'],
    keywords: ['transport', 'travel', 'car', 'bike', 'bus', 'train', 'flight', 'fuel', 'gas', 'parking', 'taxi', 'commute', 'metro', 'cab'],
  },
  {
    name: 'Home',
    emojis: ['🏠', '🏡', '🛋️', '🛏️', '🧹', '🧺', '🧽', '🧼', '🧻', '🚽', '🛁', '🚿', '🪴', '💡', '🔦', '🚪', '🪟', '🧯', '🪣', '🗝️', '🖼️', '🧷', '🪜', '🪠'],
    keywords: ['home', 'house', 'rent', 'furniture', 'cleaning', 'household', 'laundry', 'bathroom', 'kitchen', 'appliance', 'light'],
  },
  {
    name: 'Entertainment',
    emojis: ['🎬', '🎵', '🎮', '🎟️', '🎤', '🎧', '🎸', '🎹', '🎨', '🎪', '🎢', '🎡', '🎳', '🎯', '🧩', '🎲', '🎰', '📺', '📸', '📹', '🎭', '🎻', '🥁', '🎼', '🕹️', '🪩', '🔭', '♟️', '🧶', '🧵', '🖍️', '📽️'],
    keywords: ['entertainment', 'fun', 'movie', 'music', 'game', 'gaming', 'ticket', 'show', 'photo', 'camera', 'art', 'hobby', 'streaming'],
  },
  {
    name: 'Health',
    emojis: ['💊', '🏥', '🩺', '🧘', '🏋️', '🚴', '🏃', '🏊', '🧠', '🩸', '🩹', '🦷', '💪', '😴', '🫀', '🩻', '🧗', '🚣', '🤾', '🥋', '🥊', '🛼'],
    keywords: ['health', 'medical', 'doctor', 'hospital', 'medicine', 'fitness', 'gym', 'yoga', 'wellness', 'therapy', 'dental', 'sleep'],
  },
  {
    name: 'Finance',
    emojis: ['💰', '🏦', '🪙', '📈', '📉', '💸', '💴', '💶', '💷', '💵', '🧮', '📊', '📌', '🏧', '⚖️'],
    keywords: ['money', 'finance', 'bank', 'investment', 'saving', 'savings', 'income', 'expense', 'budget', 'loan', 'cash', 'salary', 'tax'],
  },
  {
    name: 'Work & Study',
    emojis: ['💼', '📚', '🏫', '🎓', '✏️', '💻', '🖥️', '🖨️', '📁', '📂', '📋', '📅', '📆', '📎', '✂️', '🖋️', '🧑‍💻', '🧑‍🏫', '🧑‍🔬', '🧑‍⚕️', '📐', '📓', '📗', '📘', '📒', '🖇️', '🖊️'],
    keywords: ['work', 'office', 'business', 'study', 'education', 'school', 'college', 'course', 'software', 'laptop', 'computer', 'stationery'],
  },
  {
    name: 'Pets & Family',
    emojis: ['🐶', '🐱', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐣', '🐤', '🐧', '🐦', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🐁', '🐀', '🐿️', '🦔', '🐾', '🐉', '🐲', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐️', '🌟', '✨', '⚡️', '☄️', '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅️', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '❄️', '🌨️', '⛄️', '🌬️', '💨', '💧', '💦', '🫧', '🌊'],
    keywords: ['pet', 'pets', 'dog', 'cat', 'baby', 'kids', 'child', 'children', 'animal', 'nature'],
  },
  {
    name: 'Travel',
    emojis: ['🏖️', '🏝️', '🏕️', '⛺', '🗺️', '🧭', '🧳', '🏨', '🗽', '🗼', '⛩️', '🏞️', '🌋', '🎒', '🗿', '🌍', '🏔️', '🏜️'],
    keywords: ['trip', 'vacation', 'holiday', 'travel', 'hotel', 'tour', 'camp', 'beach', 'resort', 'outing'],
  },
  {
    name: 'Tech & Utilities',
    emojis: ['⚡', '📱', '🔧', '🧰', '🛠️', '🔨', '⛏️', '🪚', '🔩', '⚙️', '🔗', '🔌', '🔋', '📡', '📞', '☎️', '📮', '✉️', '🗑️', '🌐', '📶', '🔑', '🔓', '🔒', '🛡️'],
    keywords: ['utility', 'utilities', 'service', 'repair', 'internet', 'wifi', 'phone', 'mobile', 'electricity', 'water', 'gas bill', 'maintenance', 'tools'],
  },
  {
    name: 'Government',
    emojis: ['🏛️', '🪪', '📜', '⚖️', '🛡️', '🚨', '🧾', '🏢', '🏗️', '⛪', '🕌', '🕍', '🏰'],
    keywords: ['government', 'legal', 'document', 'insurance', 'compliance', 'fine', 'bill'],
  },
];

export const CATEGORY_EMOJI_OPTIONS = CATEGORY_EMOJI_GROUPS.flatMap((group) =>
  group.emojis.map((emoji) => ({ emoji, keywords: group.keywords })),
);

export const CATEGORY_EMOJIS = CATEGORY_EMOJI_OPTIONS.map((option) => option.emoji) as readonly string[];

function normalizeEmojiSearch(value: string) {
  return value.trim().toLowerCase();
}

export function searchCategoryEmojis(query: string): string[] {
  const normalized = normalizeEmojiSearch(query);
  if (!normalized) return [...CATEGORY_EMOJIS];
  return CATEGORY_EMOJI_OPTIONS
    .filter(
      (option) =>
        option.emoji.includes(normalized) ||
        option.keywords.some((keyword) => keyword.includes(normalized) || normalized.includes(keyword)),
    )
    .map((option) => option.emoji);
}

export function suggestCategoryEmojis(categoryName: string, limit: number = 12): string[] {
  const normalized = normalizeEmojiSearch(categoryName);
  if (!normalized) return [];
  const matches = CATEGORY_EMOJI_OPTIONS.filter((option) =>
    option.keywords.some((keyword) => normalized.includes(keyword)),
  ).map((option) => option.emoji);
  return Array.from(new Set(matches)).slice(0, limit);
}

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
