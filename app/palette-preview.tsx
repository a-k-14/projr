import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenScaffold } from '../components/ui/ScreenScaffold';
import { DEPOSIT_VISUAL } from '../lib/depositVisuals';
import { FONT_WEIGHT, HOME_TEXT, SCREEN_GUTTER } from '../lib/design';
import { ASSET_BG, ASSET_TONE } from '../lib/assetVisuals';
import { HOME_RADIUS, HOME_SPACE } from '../lib/layoutTokens';
import { ACCOUNT_TYPE_META } from '../lib/settings-shared';
import { useAppTheme, type AppThemePalette } from '../lib/theme';

const ACCOUNT_COLORS = [
  { label: 'Savings', icon: ACCOUNT_TYPE_META.savings.icon, tone: ACCOUNT_TYPE_META.savings.color, bg: ACCOUNT_TYPE_META.savings.bg ?? '#EAF0F6' },
  { label: 'Cash', icon: ACCOUNT_TYPE_META.cash.icon, tone: ACCOUNT_TYPE_META.cash.color, bg: ACCOUNT_TYPE_META.cash.bg ?? '#EAF3ED' },
  { label: 'Wallet', icon: ACCOUNT_TYPE_META.wallet.icon, tone: ACCOUNT_TYPE_META.wallet.color, bg: ACCOUNT_TYPE_META.wallet.bg ?? '#F2ECE5' },
  { label: 'Investment', icon: ACCOUNT_TYPE_META.investment.icon, tone: ACCOUNT_TYPE_META.investment.color, bg: ACCOUNT_TYPE_META.investment.bg ?? '#EEEAF4' },
  { label: 'Credit', icon: ACCOUNT_TYPE_META.credit.icon, tone: ACCOUNT_TYPE_META.credit.color, bg: ACCOUNT_TYPE_META.credit.bg ?? '#F4E8E7' },
  { label: 'Other', icon: ACCOUNT_TYPE_META.other.icon, tone: ACCOUNT_TYPE_META.other.color, bg: ACCOUNT_TYPE_META.other.bg ?? '#EEF1F5' },
] as const;

const FEATURE_COLORS = [
  { label: 'Deposits', icon: DEPOSIT_VISUAL.icon, tone: DEPOSIT_VISUAL.tone, bg: DEPOSIT_VISUAL.bg },
  { label: 'Loans', icon: 'hand-coins', tone: '#4F6B7A', bg: '#E8F0F3' },
  { label: 'Budgets', icon: 'pie-chart', tone: '#5A56A3', bg: '#F0EFFA' },
  { label: 'Assets', icon: 'gem', tone: ASSET_TONE, bg: ASSET_BG },
] as const;

const BRAND_SAMPLES = [
  { label: 'Brand', tone: '#1E293B', bg: '#E8ECF4' },
  { label: 'FAB', tone: '#24324F', bg: '#E8ECF4' },
  { label: 'Positive', tone: '#047857', bg: '#E8F7EF' },
  { label: 'Negative', tone: '#B32020', bg: '#F7EAEB' },
] as const;

export default function PalettePreviewScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Palette Preview" palette={palette} showBack onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <IntroCard palette={palette} />
        <Section title="App Colors" palette={palette}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {BRAND_SAMPLES.map((item) => (
              <ColorSample key={item.label} label={item.label} tone={item.tone} bg={item.bg} palette={palette} />
            ))}
          </View>
          <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: '#24324F',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="plus" size={22} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.text }}>
                Current FAB direction
              </Text>
              <Text style={{ marginTop: 3, fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>
                Dark neutral action color keeps feature/account icons from competing with primary actions.
              </Text>
            </View>
          </View>
        </Section>

        <PaletteSection title="Account Icons" items={ACCOUNT_COLORS} palette={palette} />

        <PaletteSection title="More Cards" items={FEATURE_COLORS} palette={palette} />
      </ScrollView>
    </ScreenScaffold>
  );
}

function IntroCard({ palette }: { palette: AppThemePalette }) {
  return (
    <View
      style={{
        marginTop: 10,
        marginBottom: HOME_SPACE.md,
        padding: HOME_SPACE.lg,
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        borderColor: palette.borderSoft,
        backgroundColor: palette.card,
      }}
    >
      <Text style={{ fontSize: HOME_TEXT.bodyLarge, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
        Visual check board
      </Text>
      <Text style={{ marginTop: 5, fontSize: HOME_TEXT.caption, color: palette.textSecondary, lineHeight: 18 }}>
        Compare current colors against quieter suggestions in real app cards, icon chips, and text.
      </Text>
    </View>
  );
}

function Section({
  title,
  palette,
  children,
}: {
  title: string;
  palette: AppThemePalette;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: HOME_SPACE.lg }}>
      <Text style={{ marginBottom: 10, fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
        {title}
      </Text>
      <View
        style={{
          padding: HOME_SPACE.lg,
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderColor: palette.borderSoft,
          backgroundColor: palette.card,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function PaletteSection({
  title,
  items,
  palette,
}: {
  title: string;
  items: readonly ColorItem[];
  palette: AppThemePalette;
}) {
  return (
    <Section title={title} palette={palette}>
      <View style={{ gap: 8 }}>
        {items.map((item) => (
          <PaletteRow key={item.label} item={item} palette={palette} />
        ))}
      </View>
    </Section>
  );
}

type ColorItem = {
  label: string;
  icon: string;
  tone: string;
  bg: string;
};

function PaletteRow({ item, palette }: { item: ColorItem; palette: AppThemePalette }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: HOME_RADIUS.chip,
        backgroundColor: palette.surface,
      }}
    >
      <IconChip item={item} />
      <Text appWeight="medium" style={{ flex: 1, fontSize: HOME_TEXT.body, color: palette.text }}>
        {item.label}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Swatch color={item.tone} />
        <Swatch color={item.bg} borderColor={palette.divider} />
      </View>
    </View>
  );
}

function ColorSample({
  label,
  tone,
  bg,
  palette,
}: {
  label: string;
  tone: string;
  bg: string;
  palette: AppThemePalette;
}) {
  return (
    <View style={{ width: '47%', minWidth: 130 }}>
      <View style={{ height: 48, borderRadius: HOME_RADIUS.chip, backgroundColor: tone }} />
      <View style={{ height: 18, marginTop: 4, borderRadius: 9, backgroundColor: bg, borderWidth: 1, borderColor: palette.divider }} />
      <Text style={{ marginTop: 5, fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>{label}</Text>
    </View>
  );
}

function IconChip({ item }: { item: ColorItem }) {
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: HOME_RADIUS.chip,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: item.bg,
      }}
    >
      <AppIcon name={item.icon} size={18} color={item.tone} strokeWidth={1.8} />
    </View>
  );
}

function Swatch({ color, borderColor }: { color: string; borderColor?: string }) {
  return (
    <View
      style={{
        width: 30,
        height: 22,
        borderRadius: 7,
        backgroundColor: color,
        borderWidth: borderColor ? 1 : 0,
        borderColor,
      }}
    />
  );
}
