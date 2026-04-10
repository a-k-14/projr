import { useEffect, useState, useColorScheme } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { SCREEN_GUTTER, SPACING, RADIUS } from '../../lib/design';
import { CardSection, SettingsRow } from '../../components/settings-ui';

type Tab = 'all' | 'in' | 'out';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in', label: 'In' },
  { key: 'out', label: 'Out' },
];

export default function CategoriesScreen() {
  const { categories, load, isLoaded } = useCategoriesStore();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  const topLevel = categories.filter((c) => !c.parentId);
  const visible =
    tab === 'all'
      ? topLevel
      : topLevel.filter((c) => c.type === tab || c.type === 'both');

  function typeLabel(type: string) {
    if (type === 'in') return 'Income';
    if (type === 'out') return 'Expense';
    return 'Both';
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
      {/* Tab pills */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: SPACING.md,
          paddingBottom: SPACING.sm,
          gap: 8,
        }}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: SPACING.lg,
              paddingVertical: 6,
              borderRadius: RADIUS.sm,
              borderWidth: 1,
              borderColor: tab === t.key ? palette.active : palette.divider,
              backgroundColor: tab === t.key ? palette.active : palette.surface,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: tab === t.key ? '#FFFFFF' : palette.textMuted,
              }}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
        <CardSection palette={palette}>
          {visible.map((cat, index) => (
            <SettingsRow
              key={cat.id}
              icon={(cat.icon as keyof typeof Feather.glyphMap) ?? 'tag'}
              label={cat.name}
              palette={palette}
              onPress={() =>
                router.push({ pathname: '/settings/category-form', params: { id: cat.id } })
              }
              noBorder={index === visible.length - 1}
              rightElement={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: palette.textMuted, fontSize: 13, fontWeight: '500' }}>
                    {typeLabel(cat.type)}
                  </Text>
                  <Feather name="chevron-right" size={18} color={palette.textSoft} />
                </View>
              }
            />
          ))}
          {visible.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted, fontSize: 14 }}>No categories yet.</Text>
            </View>
          )}
        </CardSection>
      </ScrollView>

      {/* Fixed bottom add button */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: palette.divider,
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: SPACING.md,
          paddingBottom: insets.bottom + SPACING.md,
          backgroundColor: palette.background,
        }}
      >
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/settings/category-form',
              params: { type: tab === 'all' ? 'both' : tab },
            })
          }
          activeOpacity={0.7}
          style={{
            minHeight: 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: palette.active,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.active }}>
            + Add Category
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
