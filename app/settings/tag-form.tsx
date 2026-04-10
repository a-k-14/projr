import { useEffect, useState } from 'react';
import { Alert, ScrollView, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { SCREEN_GUTTER, SPACING } from '../../lib/design';
import { ENTITY_COLORS } from '../../lib/settings-shared';
import { ActionButton, ColorGrid, FieldLabel, InputField } from '../../components/settings-ui';

type Draft = {
  name: string;
  color: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  color: ENTITY_COLORS[0],
};

export default function TagFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const { tags, load, isLoaded, addTag, updateTag, removeTag } = useCategoriesStore();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  useEffect(() => {
    if (id) {
      const tag = tags.find((t) => t.id === id);
      if (tag) setDraft({ name: tag.name, color: tag.color });
    } else {
      setDraft(EMPTY_DRAFT);
    }
  }, [id, tags]);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? (draft.name || 'Edit Tag') : 'New Tag',
    });
  }, [draft.name, isEditing, navigation]);

  async function onSave() {
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('Missing name', 'Please enter a tag name.');
      return;
    }
    if (isEditing && id) {
      await updateTag(id, { name, color: draft.color });
    } else {
      await addTag({ name, color: draft.color });
    }
    router.back();
  }

  async function onDelete() {
    if (!id) return;
    const tag = tags.find((t) => t.id === id);
    Alert.alert(
      'Delete tag?',
      `"${tag?.name}" will be removed from all transactions. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeTag(id);
              router.back();
            } catch (error) {
              Alert.alert(
                'Unable to delete',
                error instanceof Error ? error.message : 'This tag could not be deleted.',
              );
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SCREEN_GUTTER, paddingBottom: SPACING.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Tag Name" palette={palette} />
          <InputField
            palette={palette}
            value={draft.name}
            onChangeText={(v) => setDraft((s) => ({ ...s, name: v }))}
            placeholder="e.g. Travel"
            autoFocus={!isEditing}
          />
        </View>

        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Color" palette={palette} />
          <ColorGrid
            colors={ENTITY_COLORS}
            selectedColor={draft.color}
            onSelect={(color) => setDraft((s) => ({ ...s, color }))}
            palette={palette}
          />
        </View>
      </ScrollView>

      {/* Fixed bottom actions */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: palette.divider,
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: SPACING.md,
          paddingBottom: insets.bottom + SPACING.md,
          backgroundColor: palette.background,
          gap: SPACING.sm,
        }}
      >
        <ActionButton
          label={isEditing ? 'Save Tag' : 'Create Tag'}
          variant="primary"
          palette={palette}
          onPress={onSave}
        />
        {isEditing && (
          <ActionButton
            label="Delete Tag"
            variant="danger"
            palette={palette}
            onPress={onDelete}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
