import { useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { TAG_COLORS, SettingsScreenShell } from '../../lib/settings-shared';
import {
  ActionButton,
  CardSection,
  FieldLabel,
  InputField,
  SectionLabel,
  SettingsRow,
  ColorGrid,
} from '../../components/settings-ui';

type Draft = {
  name: string;
  color: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  color: TAG_COLORS[0],
};

export default function TagsScreen() {
  const { tags, load, isLoaded, addTag, updateTag, removeTag } = useCategoriesStore();
  const theme = useUIStore((s) => s.settings.theme);
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    if (!isLoaded) {
      load().catch(() => undefined);
    }
  }, [isLoaded, load]);

  useEffect(() => {
    if (!creating && !selectedId && tags[0]) {
      setSelectedId(tags[0].id);
    }
  }, [creating, selectedId, tags]);

  useEffect(() => {
    if (creating || !selectedId) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    const tag = tags.find((item) => item.id === selectedId);
    if (!tag) return;
    setDraft({
      name: tag.name,
      color: tag.color,
    });
  }, [creating, selectedId, tags]);

  async function onSave() {
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('Missing name', 'Please enter a tag name.');
      return;
    }

    const payload = {
      name,
      color: draft.color,
    };

    if (creating || !selectedId) {
      const created = await addTag(payload);
      setCreating(false);
      setSelectedId(created.id);
      return;
    }

    await updateTag(selectedId, payload as any);
  }

  async function onDelete() {
    if (!selectedId) return;
    Alert.alert('Delete tag?', 'This will remove the tag from the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeTag(selectedId);
            setSelectedId(tags[0]?.id ?? null);
            setCreating(!tags[0]);
          } catch (error) {
            Alert.alert(
              'Unable to delete',
              error instanceof Error ? error.message : 'This tag could not be deleted.'
            );
          }
        },
      },
    ]);
  }

  return (
    <SettingsScreenShell palette={palette}>
      <SectionLabel label="Transaction Tags" palette={palette} />
      <CardSection palette={palette}>
        {tags.map((tag, index) => {
          const selected = selectedId === tag.id && !creating;
          return (
            <SettingsRow
              key={tag.id}
              icon="tag"
              label={tag.name}
              palette={palette}
              onPress={() => {
                setCreating(false);
                setSelectedId(tag.id);
              }}
              noBorder={index === tags.length - 1}
              rightElement={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: tag.color,
                    }}
                  />
                  {selected ? (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: palette.tabActive, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="check" size={12} color="#FFFFFF" />
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={18} color={palette.divider} />
                  )}
                </View>
              }
            />
          );
        })}
        {!tags.length ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: palette.textMuted, fontSize: 14 }}>No tags created yet.</Text>
          </View>
        ) : null}
      </CardSection>

      <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
        <ActionButton
          label="Add New Tag"
          variant="secondary"
          palette={palette}
          onPress={() => {
            setSelectedId(null);
            setCreating(true);
          }}
        />
      </View>

      <SectionLabel label={creating ? 'CREATE NEW TAG' : 'EDIT TAG'} palette={palette} />
      <CardSection palette={palette}>
        <View style={{ padding: 20 }}>
          <View style={{ marginBottom: 20 }}>
            <FieldLabel label="Tag Name" palette={palette} />
            <InputField
              palette={palette}
              value={draft.name}
              onChangeText={(value) => setDraft((state) => ({ ...state, name: value }))}
              placeholder="e.g. Travel"
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <FieldLabel label="Select Tag Color" palette={palette} />
            <ColorGrid
              colors={TAG_COLORS}
              selectedColor={draft.color}
              onSelect={(color) => setDraft((state) => ({ ...state, color }))}
              palette={palette}
            />
          </View>

          <View style={{ gap: 12 }}>
            <ActionButton
              label={creating ? 'Create Tag' : 'Update Tag'}
              variant="primary"
              palette={palette}
              onPress={onSave}
            />
            {selectedId && !creating ? (
              <ActionButton label="Remove Tag" variant="danger" palette={palette} onPress={onDelete} />
            ) : null}
          </View>
        </View>
      </CardSection>
    </SettingsScreenShell>
  );
}
