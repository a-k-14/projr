import { useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { TAG_COLORS, SettingsScreenShell } from './_shared';
import {
  ActionButton,
  CardSection,
  FieldLabel,
  InputField,
  SectionLabel,
  SettingsRow,
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
      <SectionLabel label="Tags help you filter and group transactions" palette={palette} />
      <CardSection palette={palette}>
        {tags.map((tag, index) => {
          const selected = selectedId === tag.id && !creating;
          return (
            <SettingsRow
              key={tag.id}
              icon="tag"
              label={tag.name}
              value={selected ? undefined : 'Tag'}
              palette={palette}
              onPress={() => {
                setCreating(false);
                setSelectedId(tag.id);
              }}
              noBorder={index === tags.length - 1}
              rightElement={
                selected ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: tag.color,
                      }}
                    />
                    <Text style={{ color: palette.textMuted, fontSize: 13 }}>Tag</Text>
                    <Feather name="check" size={18} color={palette.tabActive} />
                  </View>
                ) : (
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: tag.color,
                      marginRight: 2,
                    }}
                  />
                )
              }
            />
          );
        })}
      </CardSection>

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <ActionButton
          label="Add new tag"
          variant="secondary"
          palette={palette}
          onPress={() => {
            setSelectedId(null);
            setCreating(true);
          }}
        />
      </View>

      <SectionLabel label={creating ? 'NEW TAG' : 'EDIT TAG'} palette={palette} />
      <CardSection palette={palette}>
        <View style={{ padding: 16 }}>
          <FieldLabel label="Name" palette={palette} />
          <InputField
            palette={palette}
            value={draft.name}
            onChangeText={(value) => setDraft((state) => ({ ...state, name: value }))}
            placeholder="Groceries"
          />

          <FieldLabel label="Color" palette={palette} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {TAG_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => setDraft((state) => ({ ...state, color }))}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: color,
                  borderWidth: draft.color === color ? 3 : 1,
                  borderColor: draft.color === color ? palette.text : palette.border,
                }}
              />
            ))}
          </View>

          <View style={{ marginTop: 16, gap: 10 }}>
            <ActionButton label="Save tag" variant="primary" palette={palette} onPress={onSave} />
            {selectedId && !creating ? (
              <ActionButton label="Delete tag" variant="danger" palette={palette} onPress={onDelete} />
            ) : null}
          </View>
        </View>
      </CardSection>
    </SettingsScreenShell>
  );
}
