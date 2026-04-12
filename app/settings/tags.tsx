import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import {
  CardSection,
  FixedBottomActions,
  SettingsRow,
  SettingsScreenLayout,
} from '../../components/settings-ui';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';

export default function TagsScreen() {
  const { tags, load, isLoaded } = useCategoriesStore();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  return (
    <SettingsScreenLayout
      palette={palette}
      bottomAction={
        <FixedBottomActions palette={palette}>
          <TouchableOpacity
            onPress={() => router.push('/settings/tag-form')}
            activeOpacity={0.7}
            style={{
              minHeight: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: palette.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: palette.brand }}>+ Add Tag</Text>
          </TouchableOpacity>
        </FixedBottomActions>
      }
    >
      <CardSection palette={palette}>
        {tags.map((tag, index) => (
          <SettingsRow
            key={tag.id}
            icon="tag"
            label={tag.name}
            palette={palette}
            onPress={() => router.push({ pathname: '/settings/tag-form', params: { id: tag.id } })}
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
    </SettingsScreenLayout>
  );
}
