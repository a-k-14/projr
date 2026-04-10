import { useEffect, useState, useColorScheme } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { SCREEN_GUTTER, SPACING } from '../../lib/design';
import { CardSection, SettingsRow } from '../../components/settings-ui';

type Tab = 'in' | 'out';

export default function CategoriesScreen() {
  const { categories, load, isLoaded } = useCategoriesStore();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('in');

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  const topLevel = categories.filter((c) => !c.parentId);
  const visible = topLevel.filter((c) => c.type === tab || c.type === 'both');

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
      {/* Full-width underline tabs */}
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
        }}
      >
        {(['in', 'out'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              paddingVertical: 14,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: tab === t ? palette.active : 'transparent',
              marginBottom: -1,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: tab === t ? palette.active : palette.textMuted,
              }}
            >
              {t === 'in' ? 'Income' : 'Expense'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: SPACING.md, paddingBottom: 8 }}>
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
              rightElement={<Feather name="chevron-right" size={18} color={palette.textSoft} />}
            />
          ))}
          {visible.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                No {tab === 'in' ? 'income' : 'expense'} categories yet.
              </Text>
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
            router.push({ pathname: '/settings/category-form', params: { type: tab } })
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
            + Add {tab === 'in' ? 'Income' : 'Expense'} Category
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
