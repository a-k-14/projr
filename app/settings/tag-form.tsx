import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  ActionButton,
  ColorGrid,
  FieldLabel,
  FixedBottomActions,
  InputField,
  SettingsFormLayout,
} from '../../components/settings-ui';
import { ENTITY_COLORS } from '../../lib/settings-shared';
import { useAppTheme } from '../../lib/theme';
import { useCategoriesStore } from '../../stores/useCategoriesStore';

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
  const tags = useCategoriesStore((s) => s.tags);
  const loadCategories = useCategoriesStore((s) => s.load);
  const isCategoriesLoaded = useCategoriesStore((s) => s.isLoaded);
  const addTag = useCategoriesStore((s) => s.addTag);
  const updateTag = useCategoriesStore((s) => s.updateTag);
  const removeTag = useCategoriesStore((s) => s.removeTag);
  const { palette } = useAppTheme();
  const router = useRouter();
  const navigation = useNavigation();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    if (!isCategoriesLoaded) loadCategories().catch(() => undefined);
  }, [isCategoriesLoaded, loadCategories]);

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
    <SettingsFormLayout
      palette={palette}
      bottomActions={
        <FixedBottomActions palette={palette}>
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
        </FixedBottomActions>
      }
    >
      <View style={{ marginBottom: 16 }}>
        <FieldLabel label="Tag Name" palette={palette} />
        <InputField
          palette={palette}
          value={draft.name}
          onChangeText={(v) => setDraft((s) => ({ ...s, name: v }))}
          placeholder="e.g. Travel"
          autoFocus={!isEditing}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <FieldLabel label="Color" palette={palette} />
        <ColorGrid
          colors={ENTITY_COLORS}
          selectedColor={draft.color}
          onSelect={(color) => setDraft((s) => ({ ...s, color }))}
          palette={palette}
        />
      </View>
    </SettingsFormLayout>
  );
}
