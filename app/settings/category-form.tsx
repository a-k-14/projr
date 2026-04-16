import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  ActionButton,
  FixedBottomActions,
  IconBtn,
  IconGrid,
  InputField,
  SectionLabel,
  SettingsFormLayout,
} from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { CategoryIconBadge } from '../../components/ui/CategoryTreePicker';
import { CARD_PADDING, SPACING } from '../../lib/design';
import { CATEGORY_ICONS, ENTITY_COLORS } from '../../lib/settings-shared';
import { useAppTheme } from '../../lib/theme';
import { useCategoriesStore } from '../../stores/useCategoriesStore';

type SubDraft = {
  id?: string;
  name: string;
  deleted: boolean;
};

export default function CategoryFormScreen() {
  const { id, type: typeParam } = useLocalSearchParams<{ id?: string; type?: string }>();
  const isEditing = !!id;

  const categories = useCategoriesStore((s) => s.categories);
  const loadCategories = useCategoriesStore((s) => s.load);
  const isCategoriesLoaded = useCategoriesStore((s) => s.isLoaded);
  const addCategory = useCategoriesStore((s) => s.addCategory);
  const updateCategory = useCategoriesStore((s) => s.updateCategory);
  const removeCategory = useCategoriesStore((s) => s.removeCategory);
  const { palette } = useAppTheme();
  const router = useRouter();
  const navigation = useNavigation();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICONS[0]);
  const [type, setType] = useState<'in' | 'out' | 'both'>(
    (typeParam as 'in' | 'out' | 'both') ?? 'both',
  );
  const [subs, setSubs] = useState<SubDraft[]>([]);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const formScrollRef = useRef<ScrollView | null>(null);

  const editingCategory = id ? categories.find((c) => c.id === id) : undefined;
  const isSubcategory = !!editingCategory?.parentId;

  useEffect(() => {
    if (!isCategoriesLoaded) loadCategories().catch(() => undefined);
  }, [isCategoriesLoaded, loadCategories]);

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
    requestAnimationFrame(() => {
      formScrollRef.current?.scrollToEnd({ animated: true });
    });
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
    <>
      <SettingsFormLayout
        palette={palette}
        scrollRef={formScrollRef}
        bottomActions={
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity onPress={() => setShowIconPicker(true)} activeOpacity={0.7}>
            <CategoryIconBadge
              icon={icon}
              size={22}
              bgSize={52}
              palette={palette}
              backgroundColor={palette.surface}
              borderColor={palette.border}
              showBorder
            />
          </TouchableOpacity>
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
            <IconBtn
              onPress={onDelete}
              variant="danger"
              palette={palette}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Feather name="trash-2" size={18} color={palette.negative} />
            </IconBtn>
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
                <Feather name="plus" size={14} color={palette.brand} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: palette.brand,
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
                    color: palette.textSecondary,
                    paddingHorizontal: CARD_PADDING,
                    paddingVertical: 12,
                    fontStyle: 'italic',
                  }}
                >
                  No subcategories yet. Tap Add to create one.
                </Text>
              )}
              {visibleSubs.map((sub, renderIdx) => (
                <View key={sub.id ?? `new-${sub.originalIdx}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <View style={{ flex: 1 }}>
                    <InputField
                      palette={palette}
                      value={sub.name}
                      onChangeText={(v) => updateSubName(sub.originalIdx, v)}
                      placeholder={`Subcategory ${renderIdx + 1}`}
                      autoFocus={!sub.id && renderIdx === visibleSubs.length - 1}
                      onFocus={() => requestAnimationFrame(() => formScrollRef.current?.scrollToEnd({ animated: true }))}
                    />
                  </View>
                  <IconBtn
                    onPress={() => deleteSub(sub.originalIdx)}
                    variant="danger"
                    palette={palette}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Feather name="trash-2" size={18} color={palette.negative} />
                  </IconBtn>
                </View>
              ))}
            </View>
          </View>
        )}
        </View>
      </SettingsFormLayout>

      {showIconPicker ? (
        <BottomSheet
          title="Choose Icon"
          palette={palette}
          onClose={() => setShowIconPicker(false)}
        >
          <View style={{ padding: SPACING.md }}>
            <IconGrid
              icons={CATEGORY_ICONS}
              selectedIcon={icon}
              onSelect={(ic) => {
                setIcon(ic);
                setShowIconPicker(false);
              }}
              palette={palette}
            />
          </View>
        </BottomSheet>
      ) : null}
    </>
  );
}
