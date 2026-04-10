import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { SCREEN_GUTTER, CARD_PADDING, RADIUS, SPACING } from '../../lib/design';
import { CATEGORY_ICONS, ENTITY_COLORS } from '../../lib/settings-shared';
import {
  ActionButton,
  CardSection,
  ChoiceRow,
  ColorGrid,
  FieldLabel,
  IconGrid,
  InputField,
  SectionLabel,
  SettingsRow,
} from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';

type Draft = {
  name: string;
  type: 'in' | 'out' | 'both';
  icon: string;
  color: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  type: 'both',
  icon: CATEGORY_ICONS[0],
  color: ENTITY_COLORS[0],
};

const CATEGORY_TYPES: { key: Draft['type']; label: string; subtitle: string }[] = [
  { key: 'in', label: 'Income', subtitle: 'Money coming in' },
  { key: 'out', label: 'Expense', subtitle: 'Money going out' },
  { key: 'both', label: 'Both', subtitle: 'Used for either direction' },
];

export default function CategoryFormScreen() {
  const { id, parentId, type: typeParam } = useLocalSearchParams<{
    id?: string;
    parentId?: string;
    type?: string;
  }>();
  const isEditing = !!id;
  const isSubcategory = !!parentId || false;

  const { categories, load, isLoaded, addCategory, updateCategory, removeCategory } =
    useCategoriesStore();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Determine if this category (when editing) has a parentId
  const editingCategory = id ? categories.find((c) => c.id === id) : undefined;
  const isEditingSubcategory = editingCategory ? !!editingCategory.parentId : isSubcategory;

  // Subcategories of this category (only relevant for parent categories)
  const subcategories = isEditing && !isEditingSubcategory
    ? categories.filter((c) => c.parentId === id)
    : [];

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  useEffect(() => {
    if (id) {
      const cat = categories.find((c) => c.id === id);
      if (cat) {
        setDraft({ name: cat.name, type: cat.type, icon: cat.icon, color: cat.color });
      }
    } else {
      const preType = (typeParam as Draft['type']) ?? 'both';
      setDraft({ ...EMPTY_DRAFT, type: preType });
    }
  }, [id, typeParam, categories]);

  useEffect(() => {
    if (isEditing) {
      navigation.setOptions({ title: draft.name || 'Edit Category' });
    } else if (isSubcategory) {
      navigation.setOptions({ title: 'New Subcategory' });
    } else {
      navigation.setOptions({ title: 'New Category' });
    }
  }, [draft.name, isEditing, isSubcategory, navigation]);

  async function onSave() {
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('Missing name', 'Please enter a category name.');
      return;
    }
    const payload = {
      name,
      type: draft.type,
      icon: draft.icon,
      color: draft.color,
      parentId: isEditing
        ? (editingCategory?.parentId ?? undefined)
        : (parentId ?? undefined),
    };
    if (isEditing && id) {
      await updateCategory(id, payload);
    } else {
      await addCategory(payload);
    }
    router.back();
  }

  async function onDelete() {
    if (!id) return;
    const cat = categories.find((c) => c.id === id);
    const childCount = categories.filter((c) => c.parentId === id).length;
    const childNote =
      childCount > 0
        ? ` It has ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'} that will also be removed.`
        : '';
    Alert.alert(
      'Delete category?',
      `"${cat?.name}" will be permanently removed from all transactions.${childNote} This cannot be undone.`,
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
                error instanceof Error ? error.message : 'This category could not be deleted.',
              );
            }
          },
        },
      ],
    );
  }

  const selectedType = CATEGORY_TYPES.find((t) => t.key === draft.type);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: SPACING.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ padding: SCREEN_GUTTER }}>
          <View style={{ marginBottom: SPACING.lg }}>
            <FieldLabel label="Name" palette={palette} />
            <InputField
              palette={palette}
              value={draft.name}
              onChangeText={(v) => setDraft((s) => ({ ...s, name: v }))}
              placeholder={isEditingSubcategory ? 'e.g. Restaurants' : 'e.g. Food & Dining'}
              autoFocus={!isEditing}
            />
          </View>

          <View style={{ marginBottom: SPACING.lg }}>
            <FieldLabel label="Transaction Type" palette={palette} />
            <TouchableOpacity
              onPress={() => setShowTypePicker(true)}
              activeOpacity={0.7}
              style={{
                minHeight: 46,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                paddingHorizontal: CARD_PADDING,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: palette.text, fontSize: 15 }}>
                {selectedType?.label ?? ''}
              </Text>
              <Feather name="chevron-right" size={16} color={palette.textSoft} />
            </TouchableOpacity>
          </View>

          <View style={{ marginBottom: SPACING.lg }}>
            <FieldLabel label="Icon" palette={palette} />
            <IconGrid
              icons={CATEGORY_ICONS}
              selectedIcon={draft.icon}
              onSelect={(icon) => setDraft((s) => ({ ...s, icon }))}
              palette={palette}
            />
          </View>

          <View style={{ marginBottom: SPACING.xl }}>
            <FieldLabel label="Color" palette={palette} />
            <ColorGrid
              colors={ENTITY_COLORS}
              selectedColor={draft.color}
              onSelect={(color) => setDraft((s) => ({ ...s, color }))}
              palette={palette}
            />
          </View>
        </View>

        {/* Subcategory list — only shown when editing an existing parent category */}
        {isEditing && !isEditingSubcategory && (
          <>
            <SectionLabel label="Subcategories" palette={palette} />
            <CardSection palette={palette}>
              {subcategories.map((sub, index) => (
                <SettingsRow
                  key={sub.id}
                  icon={(sub.icon as keyof typeof Feather.glyphMap) ?? 'tag'}
                  label={sub.name}
                  palette={palette}
                  onPress={() =>
                    router.push({ pathname: '/settings/category-form', params: { id: sub.id } })
                  }
                  noBorder={index === subcategories.length - 1}
                  rightElement={
                    <Feather name="chevron-right" size={18} color={palette.textSoft} />
                  }
                />
              ))}
              {/* Add subcategory row */}
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/settings/category-form',
                    params: { parentId: id, type: draft.type },
                  })
                }
                activeOpacity={0.7}
                style={{
                  minHeight: 52,
                  paddingHorizontal: CARD_PADDING,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderTopWidth: subcategories.length > 0 ? 1 : 0,
                  borderTopColor: palette.divider,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: palette.active }}>
                  + Add Subcategory
                </Text>
              </TouchableOpacity>
            </CardSection>
          </>
        )}
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
          label={isEditing ? 'Save Category' : 'Create Category'}
          variant="primary"
          palette={palette}
          onPress={onSave}
        />
        {isEditing && (
          <ActionButton
            label="Delete Category"
            variant="danger"
            palette={palette}
            onPress={onDelete}
          />
        )}
      </View>

      {showTypePicker && (
        <BottomSheet
          title="Transaction Type"
          palette={palette}
          onClose={() => setShowTypePicker(false)}
          hasNavBar
        >
          {CATEGORY_TYPES.map((t, i) => (
            <ChoiceRow
              key={t.key}
              title={t.label}
              subtitle={t.subtitle}
              selected={draft.type === t.key}
              palette={palette}
              noBorder={i === CATEGORY_TYPES.length - 1}
              onPress={() => {
                setDraft((s) => ({ ...s, type: t.key }));
                setShowTypePicker(false);
              }}
            />
          ))}
        </BottomSheet>
      )}
    </SafeAreaView>
  );
}
