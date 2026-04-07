import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  SettingsScreenShell,
} from '../../lib/settings-shared';
import {
  ActionButton,
  CardSection,
  FieldLabel,
  InputField,
  PickerChip,
  SectionLabel,
  SettingsRow,
} from '../../components/settings-ui';

type Draft = {
  name: string;
  parentId: string;
  type: 'in' | 'out' | 'both';
  icon: string;
  color: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  parentId: '',
  type: 'both',
  icon: CATEGORY_ICONS[0],
  color: CATEGORY_COLORS[0],
};

const CATEGORY_TYPES: Array<{ key: Draft['type']; label: string }> = [
  { key: 'in', label: 'Income' },
  { key: 'out', label: 'Expense' },
  { key: 'both', label: 'Both' },
];

export default function CategoriesScreen() {
  const { categories, load, isLoaded, addCategory, updateCategory, removeCategory } =
    useCategoriesStore();
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
    if (!creating && !selectedId && categories[0]) {
      setSelectedId(categories[0].id);
    }
  }, [categories, creating, selectedId]);

  useEffect(() => {
    if (creating || !selectedId) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    const category = categories.find((item) => item.id === selectedId);
    if (!category) return;
    setDraft({
      name: category.name,
      parentId: category.parentId ?? '',
      type: category.type,
      icon: category.icon,
      color: category.color,
    });
  }, [categories, creating, selectedId]);

  const topLevelCategories = useMemo(
    () => categories.filter((item) => !item.parentId),
    [categories]
  );

  async function onSave() {
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('Missing name', 'Please enter a category name.');
      return;
    }

    const payload = {
      name,
      parentId: draft.parentId || undefined,
      type: draft.type,
      icon: draft.icon,
      color: draft.color,
    };

    if (creating || !selectedId) {
      const created = await addCategory(payload);
      setCreating(false);
      setSelectedId(created.id);
      return;
    }

    await updateCategory(selectedId, payload as any);
  }

  async function onDelete() {
    if (!selectedId) return;
    Alert.alert('Delete category?', 'This will remove the category from the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeCategory(selectedId);
            setSelectedId(categories[0]?.id ?? null);
            setCreating(!categories[0]);
          } catch (error) {
            Alert.alert(
              'Unable to delete',
              error instanceof Error ? error.message : 'This category could not be deleted.'
            );
          }
        },
      },
    ]);
  }

  const rows = useMemo(() => {
    return [...topLevelCategories, ...categories.filter((item) => item.parentId)];
  }, [categories, topLevelCategories]);

  return (
    <SettingsScreenShell palette={palette}>
      <SectionLabel label="Two-level hierarchy: parent categories and subcategories" palette={palette} />
      <CardSection palette={palette}>
        {rows.map((category, index) => {
          const selected = selectedId === category.id && !creating;
          const display = category.parentId
            ? `${parentName(category.parentId, categories)} › ${category.name}`
            : category.name;
          return (
            <SettingsRow
              key={category.id}
              icon={(category.icon as keyof typeof Feather.glyphMap) ?? 'tag'}
              label={display}
              value={
                selected
                  ? undefined
                  : category.type === 'both'
                    ? 'Both'
                    : category.type === 'in'
                      ? 'Income'
                      : 'Expense'
              }
              palette={palette}
              onPress={() => {
                setCreating(false);
                setSelectedId(category.id);
              }}
              noBorder={index === rows.length - 1}
              rightElement={
                selected ? <Feather name="check" size={18} color={palette.tabActive} /> : undefined
              }
            />
          );
        })}
      </CardSection>

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <ActionButton
          label="Add new category"
          variant="secondary"
          palette={palette}
          onPress={() => {
            setSelectedId(null);
            setCreating(true);
          }}
        />
      </View>

      <SectionLabel label={creating ? 'NEW CATEGORY' : 'EDIT CATEGORY'} palette={palette} />
      <CardSection palette={palette}>
        <View style={{ padding: 16 }}>
          <FieldLabel label="Name" palette={palette} />
          <InputField
            palette={palette}
            value={draft.name}
            onChangeText={(value) => setDraft((state) => ({ ...state, name: value }))}
            placeholder="Groceries"
          />

          <FieldLabel label="Parent" palette={palette} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <View style={{ width: '48%' }}>
              <PickerChip
                label="None"
                selected={!draft.parentId}
                palette={palette}
                onPress={() => setDraft((state) => ({ ...state, parentId: '' }))}
              />
            </View>
            {topLevelCategories.map((category) => (
              <View key={category.id} style={{ width: '48%' }}>
                <PickerChip
                  label={category.name}
                  selected={draft.parentId === category.id}
                  palette={palette}
                  onPress={() => setDraft((state) => ({ ...state, parentId: category.id }))}
                />
              </View>
            ))}
          </View>

          <FieldLabel label="Type" palette={palette} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {CATEGORY_TYPES.map((item) => (
              <View key={item.key} style={{ width: '31%' }}>
                <PickerChip
                  label={item.label}
                  selected={draft.type === item.key}
                  palette={palette}
                  onPress={() => setDraft((state) => ({ ...state, type: item.key }))}
                />
              </View>
            ))}
          </View>

          <FieldLabel label="Icon" palette={palette} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {CATEGORY_ICONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                onPress={() => setDraft((state) => ({ ...state, icon }))}
                style={{
                  width: '18%',
                  minHeight: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: draft.icon === icon ? palette.tabActive : palette.border,
                  backgroundColor:
                    draft.icon === icon
                      ? palette.background === '#11161F'
                        ? '#182131'
                        : '#E8F3EC'
                      : palette.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather
                  name={icon as keyof typeof Feather.glyphMap}
                  size={16}
                  color={draft.icon === icon ? palette.tabActive : palette.iconTint}
                />
              </TouchableOpacity>
            ))}
          </View>

          <FieldLabel label="Color" palette={palette} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {CATEGORY_COLORS.map((color) => (
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
            <ActionButton label="Save category" variant="primary" palette={palette} onPress={onSave} />
            {selectedId && !creating ? (
              <ActionButton label="Delete category" variant="danger" palette={palette} onPress={onDelete} />
            ) : null}
          </View>
        </View>
      </CardSection>
    </SettingsScreenShell>
  );
}

function parentName(parentId: string, categories: Array<{ id: string; name: string }>) {
  return categories.find((item) => item.id === parentId)?.name ?? 'Parent';
}
