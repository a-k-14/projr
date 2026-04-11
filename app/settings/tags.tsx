import { useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { SCREEN_GUTTER, SPACING } from '../../lib/design';
import { CardSection, SettingsRow } from '../../components/settings-ui';

export default function TagsScreen() {
  const { tags, load, isLoaded } = useCategoriesStore();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: SPACING.lg, paddingBottom: 8 }}>
        <CardSection palette={palette}>
          {tags.map((tag, index) => (
            <SettingsRow
              key={tag.id}
              icon="tag"
              label={tag.name}
              palette={palette}
              onPress={() =>
                router.push({ pathname: '/settings/tag-form', params: { id: tag.id } })
              }
              noBorder={index === tags.length - 1}
              rightElement={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: tag.color,
                    }}
                  />
                </View>
              }
            />
          ))}
          {tags.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted, fontSize: 14 }}>No tags yet.</Text>
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
          onPress={() => router.push('/settings/tag-form')}
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
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.active }}>+ Add Tag</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
