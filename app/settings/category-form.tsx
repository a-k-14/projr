import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import {
  ActionButton,
  FixedBottomActions,
  InputField,
  SectionLabel,
  SettingsFormLayout,
} from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { CARD_PADDING, SPACING } from '../../lib/design';
import { CATEGORY_ICONS, ENTITY_COLORS } from '../../lib/settings-shared';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';

function isEmoji(icon: string) {
  return !/^[a-z-]+$/.test(icon);
}

type SubDraft = {
  id?: string;
  name: string;
  deleted: boolean;
};

function IconBadge({
  icon,
  size,
  bgSize,
  palette,
  onPress,
}: {
  icon: string;
  size: number;
  bgSize: number;
  palette: any;
  onPress?: () => void;
}) {
  const inner = (
    <View
      style={{
        width: bgSize,
        height: bgSize,
        borderRadius: bgSize * 0.28,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isEmoji(icon) ? (
        <Text style={{ fontSize: size * 0.9 }}>{icon}</Text>
      ) : (
        <Feather name={icon as any} size={size} color={palette.iconTint} />
      )}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

export default function CategoryFormScreen() {
  const { id, type: typeParam } = useLocalSearchParams<{ id?: string; type?: string }>();
  const isEditing = !!id;

  const {
    categories,
    load,
    isLoaded,
    addCategory,
    updateCategory,
    removeCategory,
  } = useCategoriesStore();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const router = useRouter();
  const navigation = useNavigation();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICONS[0]);
  const [type, setType] = useState<'in' | 'out' | 'both'>(
    (typeParam as 'in' | 'out' | 'both') ?? 'both',
  );
  const [subs, setSubs] = useState<SubDraft[]>([]);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const editingCategory = id ? categories.find((c) => c.id === id) : undefined;
  const isSubcategory = !!editingCategory?.parentId;

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  useEffect(() => {
    if (id) {
      const cat = categories.find((c) => c.id === id);
      if (cat) {
        setName(cat.name);
        setIcon(cat.icon ?? CATEGORY_ICONS[0]);
        setType(cat.type);
        if (!cat.parentId) {
          setSubs(
            categories
              .filter((c) => c.parentId === id)
              .map((c) => ({ id: c.id, name: c.name, deleted: false })),
          );
        }
      }
    }
  }, [id, categories]);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? name || 'Edit Category' : 'New Category',
    });
  }, [name, isEditing, navigation]);

  function addSub() {
    setSubs((s) => [...s, { name: '', deleted: false }]);
  }

  function updateSubName(idx: number, value: string) {
    setSubs((s) => s.map((sub, i) => (i === idx ? { ...sub, name: value } : sub)));
  }

  function deleteSub(idx: number) {
    setSubs((s) => s.map((sub, i) => (i === idx ? { ...sub, deleted: true } : sub)));
  }

  async function onSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Missing name', 'Please enter a category name.');
      return;
    }

    let parentCategoryId = id;
    const color = editingCategory?.color ?? ENTITY_COLORS[0];

    if (isEditing && id) {
      await updateCategory(id, {
        name: trimmed,
        type,
        icon,
        color,
        parentId: editingCategory?.parentId ?? undefined,
      });
    } else {
      const created = await addCategory({ name: trimmed, type, icon, color: ENTITY_COLORS[0] });
      parentCategoryId = created.id;
    }

    if (!isSubcategory && parentCategoryId) {
      for (const sub of subs) {
        if (sub.deleted && sub.id) {
          await removeCategory(sub.id);
        } else if (!sub.deleted && sub.id && sub.name.trim()) {
          await updateCategory(sub.id, {
            name: sub.name.trim(),
            type,
            icon,
            color,
            parentId: parentCategoryId,
          });
        } else if (!sub.deleted && !sub.id && sub.name.trim()) {
          await addCategory({
            name: sub.name.trim(),
            type,
            icon,
            color: ENTITY_COLORS[0],
            parentId: parentCategoryId,
          });
        }
      }
    }

    router.back();
  }

  async function onDelete() {
    if (!id) return;
    const cat = categories.find((c) => c.id === id);
    const childCount = subs.filter((s) => !s.deleted && s.id).length;
    const childNote =
      childCount > 0
        ? ` It has ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'} that will also be removed.`
        : '';
    Alert.alert(
      'Delete category?',
      `"${cat?.name}" will be permanently removed.${childNote} This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCategory(id);
              router.back();
            } catch (error) {
              Alert.alert(
                'Unable to delete',
                error instanceof Error ? error.message : 'Could not delete.',
              );
            }
          },
        },
      ],
    );
  }

  const visibleSubs = subs
    .map((sub, originalIdx) => ({ ...sub, originalIdx }))
    .filter((sub) => !sub.deleted);

  return (
    <SettingsFormLayout
      palette={palette}
      bottomAction={
        <FixedBottomActions palette={palette}>
          <ActionButton
            label={isEditing ? 'Save' : 'Create Category'}
            variant="primary"
            palette={palette}
            onPress={onSave}
          />
        </FixedBottomActions>
      }
    >
      <View style={{ gap: SPACING.md }}>
        <SectionLabel label="General Info" palette={palette} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBadge
            icon={icon}
            size={22}
            bgSize={52}
            palette={palette}
            onPress={() => setShowIconPicker(true)}
          />
          <View style={{ flex: 1 }}>
            <InputField
              palette={palette}
              value={name}
              onChangeText={setName}
              placeholder="Category name"
              autoFocus={!isEditing}
            />
          </View>
          {isEditing && (
            <TouchableOpacity
              onPress={onDelete}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={{
                width: 46,
                height: 56,
                borderRadius: 10,
                backgroundColor: palette.inputBg,
                borderWidth: 1,
                borderColor: palette.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="trash-2" size={18} color={palette.negative} />
            </TouchableOpacity>
          )}
        </View>

        {!isSubcategory && (
          <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
            {/* Section header row: label on left, "+ Add" button on right */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 2,
              }}
            >
              <SectionLabel label="Subcategories" palette={palette} />
              <TouchableOpacity
                onPress={addSub}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Feather name="plus" size={14} color={palette.active} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: palette.active,
                    letterSpacing: 0.2,
                  }}
                >
                  Add
                </Text>
              </TouchableOpacity>
            </View>

            {/* Subcategory rows */}
            <View style={{ gap: 8 }}>
              {visibleSubs.length === 0 && (
                <Text
                  style={{
                    fontSize: 14,
                    color: palette.secondaryText,
                    paddingHorizontal: CARD_PADDING,
                    paddingVertical: 12,
                    fontStyle: 'italic',
                  }}
                >
                  No subcategories yet. Tap Add to create one.
                </Text>
              )}
              {visibleSubs.map((sub, renderIdx) => (
                <View
                  key={sub.id ?? `new-${sub.originalIdx}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <View style={{ flex: 1 }}>
                    <InputField
                      palette={palette}
                      value={sub.name}
                      onChangeText={(v) => updateSubName(sub.originalIdx, v)}
                      placeholder={`Subcategory ${renderIdx + 1}`}
                      autoFocus={!sub.id && renderIdx === visibleSubs.length - 1}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteSub(sub.originalIdx)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    style={{
                      width: 46,
                      height: 56,
                      borderRadius: 10,
                      backgroundColor: palette.inputBg,
                      borderWidth: 1,
                      borderColor: palette.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="trash-2" size={18} color={palette.negative} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {showIconPicker && (
        <BottomSheet
          title="Choose Icon"
          palette={palette}
          onClose={() => setShowIconPicker(false)}
          hasNavBar
        >
          <View style={{ padding: SPACING.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {CATEGORY_ICONS.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  onPress={() => {
                    setIcon(ic);
                    setShowIconPicker(false);
                  }}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    borderWidth: icon === ic ? 2 : 1,
                    borderColor: icon === ic ? palette.tabActive : palette.border,
                    backgroundColor: icon === ic ? palette.inputBg : palette.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather
                    name={ic as any}
                    size={22}
                    color={icon === ic ? palette.tabActive : palette.iconTint}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </BottomSheet>
      )}
    </SettingsFormLayout>
  );
}
