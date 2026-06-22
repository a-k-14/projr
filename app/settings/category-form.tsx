import { AppIcon } from '@/components/ui/AppIcon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { ScrollView, View, TouchableOpacity, Keyboard, Platform } from 'react-native';
import { AnimatedCollapseCard, CollapseHandle } from '../../components/ui/AnimatedCollapseCard';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import {
  ActionButton,
  ChoiceRow,
  FixedBottomActions,
  IconBtn,
  IconGrid,
  InputField,
  SectionLabel,
  SelectTrigger,
  SettingsFormLayout } from '../../components/settings-ui';
import { runAfterKeyboardDismiss } from '../../lib/ui-utils';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { CategoryIconBadge } from '../../components/ui/CategoryTreePicker';
import { CARD_PADDING, SPACING, TYPE , FONT_WEIGHT} from '../../lib/design';
import { HOME_LAYOUT , HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import {
  CATEGORY_EMOJI_GROUPS,
  CATEGORY_ICONS,
  ENTITY_COLORS,
  suggestCategoryEmojis,
} from '../../lib/settings-shared';
import { useAppTheme } from '../../lib/theme';
import { isEmojiIcon } from '../../lib/ui-format';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { STRINGS } from '../../lib/strings';

type SubDraft = {
  id?: string;
  name: string;
  icon?: string;
  color?: string;
  type?: 'in' | 'out' | 'both';
  deleted: boolean;
};

const CATEGORY_TYPE_OPTIONS = [
  { key: 'out', label: 'Expense (Out)' },
  { key: 'in', label: 'Income (In)' },
  { key: 'both', label: 'Both / Mixed' },
] as const;

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
  const { showAlert, showConfirm, dialog } = useAppDialog(palette);
  const router = useRouter();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICONS[0]);
  const [type, setType] = useState<'in' | 'out' | 'both'>(
    (typeParam as 'in' | 'out' | 'both') ?? 'out',
  );
  // Hide type selector if we're explicitly adding a specific type or editing an existing category
  const hideTypePicker = !!typeParam || isEditing;
  const [subs, setSubs] = useState<SubDraft[]>([]);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconPickerTab, setIconPickerTab] = useState<'icons' | 'emojis'>('icons');
  const [, setEmojiQuery] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const formScrollRef = useRef<ScrollView | null>(null);
  const currentScrollYRef = useRef(0);
  const preFocusScrollYRef = useRef<number | null>(null);
  const categoryNameRowRef = useRef<View | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const originalSubsRef = useRef<SubDraft[]>([]);
  const subCardRefs = useRef(new Map<string, CollapseHandle>());
  const subViewRefs = useRef(new Map<string, View>());

  const editingCategory = id ? categories.find((c) => c.id === id) : undefined;
  const isSubcategory = !!editingCategory?.parentId;
  const isSystem = !!editingCategory?.systemKey;

  const shakeOffset = useSharedValue(0);

  const submitShakeOffset = useSharedValue(0);
  const submitShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: submitShakeOffset.value }] }));



  const handleCategoryNameFocus = () => {
    if (isSystem) {
      triggerSystemShake();
      return;
    }
    if (preFocusScrollYRef.current === null) {
      preFocusScrollYRef.current = currentScrollYRef.current;
    }
    const view = categoryNameRowRef.current;
    const scroll = formScrollRef.current;
    if (view && scroll) {
      setTimeout(() => {
        view.measureLayout(
          scroll,
          (_x: number, y: number) => {
            scroll.scrollTo({ y: Math.max(0, y - 100), animated: true });
          },
          () => {}
        );
      }, 180);
    }
  };

  const handleSubFocus = (cardKey: string) => {
    if (preFocusScrollYRef.current === null) {
      preFocusScrollYRef.current = currentScrollYRef.current;
    }
    const view = subViewRefs.current.get(cardKey);
    const scroll = formScrollRef.current;
    if (view && scroll) {
      setTimeout(() => {
        view.measureLayout(
          scroll,
          (_x: number, y: number) => {
            scroll.scrollTo({ y: Math.max(0, y - 100), animated: true });
          },
          () => {}
        );
      }, 180);
    }
  };

  function triggerSystemShake() {
    shakeOffset.value = withSequence(
      withTiming(8, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
    showAlert('System Category', 'This category is used internally to track interest income from deposits and cannot be edited.');
  }

  useEffect(() => {
    if (!isCategoriesLoaded) loadCategories().catch(() => undefined);
  }, [isCategoriesLoaded, loadCategories]);

  useEffect(() => {
    if (id) {
      const cat = categories.find((c) => c.id === id);
      if (cat) {
        setName(cat.name);
        setIcon(cat.icon ?? CATEGORY_ICONS[0]);
        setEmojiQuery(isEmojiIcon(cat.icon) ? cat.icon : '');
        setType(cat.type);
        if (!cat.parentId) {
          const nextSubs = categories
            .filter((c) => c.parentId === id)
            .map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, type: c.type, deleted: false }));
          setSubs(nextSubs);
          originalSubsRef.current = nextSubs.map((sub) => ({ ...sub }));
        }
      }
    }
  }, [id, categories]);

  function addSub() {
    setSubs((s) => [...s, { name: '', deleted: false }]);
    requestAnimationFrame(() => {
      formScrollRef.current?.scrollToEnd({ animated: true });
    });
  }

  function updateSubName(idx: number, value: string) {
    setSubs((s) => s.map((sub, i) => (i === idx ? { ...sub, name: value } : sub)));
    setDuplicateError('');
  }

  function deleteSub(idx: number, cardKey: string) {
    const target = subs[idx];
    if (!target) return;
    const subName = target.name.trim();
    showConfirm({
      title: 'Delete Subcategory',
      message: subName
        ? `"${subName}" will be removed from this category.`
        : 'This subcategory will be removed from this category.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => {
        const card = subCardRefs.current.get(cardKey);
        if (card) {
          card.collapse();
        } else {
          setSubs((current) => current.map((sub, i) => (i === idx ? { ...sub, deleted: true } : sub)));
        }
      },
    });
  }

  async function onSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setAttemptedSubmit(true);
      submitShakeOffset.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      return;
    }

    const hasDuplicate = isSubcategory
      ? categories.some(
          (c) =>
            c.parentId === editingCategory?.parentId &&
            c.id !== id &&
            c.name.trim().toLowerCase() === trimmed.toLowerCase()
        )
      : categories.some(
          (c) =>
            c.parentId == null &&
            c.id !== id &&
            c.name.trim().toLowerCase() === trimmed.toLowerCase() &&
            (type === 'both' || c.type === 'both' || c.type === type)
        );

    if (hasDuplicate) {
      setAttemptedSubmit(true);
      submitShakeOffset.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      if (isSubcategory) {
        setDuplicateError(STRINGS.duplicate.subcategory(trimmed));
      } else {
        const typeLabel = type === 'both' ? 'Income or Expense' : type === 'in' ? 'Income' : 'Expense';
        setDuplicateError(STRINGS.duplicate.category(trimmed, typeLabel));
      }
      return;
    }

    if (!isSubcategory) {
      const activeSubs = subs.filter((sub) => !sub.deleted && sub.name.trim().length > 0);
      const subNames = activeSubs.map((s) => s.name.trim().toLowerCase());
      const hasDuplicateInForm = subNames.some((val, i) => subNames.indexOf(val) !== i);
      if (hasDuplicateInForm) {
        setAttemptedSubmit(true);
        submitShakeOffset.value = withSequence(
          withTiming(10, { duration: 50 }),
          withTiming(-10, { duration: 50 }),
          withTiming(10, { duration: 50 }),
          withTiming(0, { duration: 50 })
        );
        setDuplicateError('Subcategories cannot have duplicate names.');
        return;
      }
    }

    // A top-level category must have at least one subcategory. This guarantees every
    // selectable category resolves to a parent + subcategory (so transactions always
    // carry both), and prevents blank-subcategory rows in analysis/exports.
    if (!isSubcategory) {
      const hasValidSub = subs.some((sub) => !sub.deleted && sub.name.trim().length > 0);
      if (!hasValidSub) {
        setAttemptedSubmit(true);
        submitShakeOffset.value = withSequence(
          withTiming(10, { duration: 50 }),
          withTiming(-10, { duration: 50 }),
          withTiming(10, { duration: 50 }),
          withTiming(0, { duration: 50 })
        );
        return;
      }
    }

    const work = async () => {
      let parentCategoryId = id;
      const color = editingCategory?.color ?? ENTITY_COLORS[0];

      if (isEditing && id) {
        await updateCategory(id, {
          name: trimmed,
          type,
          icon,
          color,
          parentId: editingCategory?.parentId ?? undefined });
      } else {
        const created = await addCategory({ name: trimmed, type, icon, color: ENTITY_COLORS[0] });
        parentCategoryId = created.id;
      }

      if (!isSubcategory && parentCategoryId) {
        const originalById = new Map(originalSubsRef.current.filter((sub): sub is SubDraft & { id: string } => !!sub.id).map((sub) => [sub.id!, sub]));
        const subOps: Promise<unknown>[] = [];
        for (const sub of subs) {
          if (sub.deleted && sub.id) {
            subOps.push(removeCategory(sub.id));
            continue;
          }
          if (sub.deleted) continue;

          const trimmedSubName = sub.name.trim();
          if (!trimmedSubName) continue;

          if (!sub.id) {
            subOps.push(addCategory({
              name: trimmedSubName,
              type: sub.type ?? type,
              icon: sub.icon ?? icon,
              color: sub.color ?? ENTITY_COLORS[0],
              parentId: parentCategoryId,
            }));
            continue;
          }

          const original = originalById.get(sub.id);
          const changed =
            !original ||
            original.name !== trimmedSubName ||
            (sub.type ?? type) !== original.type ||
            (sub.icon ?? icon) !== original.icon ||
            (sub.color ?? color) !== original.color ||
            original.deleted;

          if (!changed) continue;

          subOps.push(updateCategory(sub.id, {
            name: trimmedSubName,
            type: sub.type ?? type,
            icon: sub.icon ?? icon,
            color: sub.color ?? color,
            parentId: parentCategoryId,
          }));
        }
        await Promise.all(subOps);
      }
    };

    try {
      await work();
      router.back();
    } catch (error) {
      showAlert('Could Not Update All Subcategories', error instanceof Error ? error.message : 'An error occurred during save.');
    }
  }

  function onDelete() {
    if (!id) return;
    const cat = categories.find((c) => c.id === id);
    const childCount = subs.filter((s) => !s.deleted && s.id).length;
    const childNote =
      childCount > 0
        ? ` It has ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'} that will also be removed.`
        : '';
    showConfirm({
      title: 'Delete Category',
      message: `"${cat?.name}" will be permanently removed.${childNote} This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await removeCategory(id);
          router.back();
        } catch (error) {
          showAlert('Unable To Delete', error instanceof Error ? error.message : 'Could not delete.');
        }
      },
    });
  }

  const visibleSubs = subs
    .map((sub, originalIdx) => ({ ...sub, originalIdx }))
    .filter((sub) => !sub.deleted);

  const selectedType = CATEGORY_TYPE_OPTIONS.find((o) => o.key === type);
  const suggestedEmojis = useMemo(() => suggestCategoryEmojis(name), [name]);

  return (
    <>
      <SettingsFormLayout
        palette={palette}
        scrollRef={formScrollRef}
        preFocusScrollYRef={preFocusScrollYRef}
        onScroll={(e) => {
          currentScrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          preFocusScrollYRef.current = null;
        }}
        bottomActions={
          <FixedBottomActions palette={palette}>
            {duplicateError ? (
              <Text
                style={{
                  color: palette.negative,
                  fontSize: HOME_TEXT.bodySmall,
                  fontWeight: FONT_WEIGHT.semibold,
                  marginBottom: 8,
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {duplicateError}
              </Text>
            ) : null}
            {!isSystem && (
              <Animated.View style={[submitShakeStyle, { width: '100%' }]}>
                <ActionButton
                  label={isEditing ? 'Save' : 'Create Category'}
                  variant="primary"
                  palette={palette}
                  onPress={onSave}
                />
              </Animated.View>
            )}
            {isEditing && !isSystem ? (
              <ActionButton
                label="Delete Category"
                variant="danger"
                palette={palette}
                onPress={onDelete}
              />
            ) : null}
          </FixedBottomActions>
        }
      >
        <View style={{ gap: SPACING.md }}>
          <SectionLabel label="General Info" palette={palette} />
          {isSystem && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: HOME_RADIUS.small, backgroundColor: `${palette.brand}14`, marginBottom: 4 }}>
              <AppIcon name="lock" size={14} color={palette.brand} strokeWidth={2} />
              <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.brand, flex: 1 }}>
                System category — used to track interest income from deposits.
              </Text>
            </View>
          )}
          <View ref={categoryNameRowRef} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md }}>
            <TouchableOpacity
              delayPressIn={0}
              onPress={() => isSystem ? triggerSystemShake() : runAfterKeyboardDismiss(() => setShowIconPicker(true))}
              activeOpacity={0.7}
              style={{
                width: 56,
                height: 56,
                borderRadius: HOME_RADIUS.pill,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CategoryIconBadge
                icon={icon}
                size={HOME_LAYOUT.listIconInnerSize}
                bgSize={42}
                palette={palette}
                backgroundColor="transparent"
              />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
               <InputField
                palette={palette}
                value={name}
                onChangeText={isSystem ? () => triggerSystemShake() : (val) => { setName(val); setDuplicateError(''); }}
                onFocus={handleCategoryNameFocus}
                placeholder="Category name"
                autoFocus={!isEditing && !isSystem}
                editable={!isSystem}
                hasError={attemptedSubmit && !name.trim()}
              />
            </View>
          </View>

          {!hideTypePicker && (
            <SelectTrigger
              label="Transaction Type"
              valueLabel={selectedType?.label}
              onPress={() => runAfterKeyboardDismiss(() => setShowTypePicker(true))}
              palette={palette}
            />
          )}

          {!isSubcategory && (
            <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 2 }}
              >
                <SectionLabel label="Subcategories" palette={palette} />
                <TouchableOpacity delayPressIn={0}
                  onPress={addSub}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <AppIcon name="plus" size={14} color={palette.brand} />
                  <Text
                    appWeight="medium"
                    style={{
                      fontSize: TYPE.rowValue,
                      fontWeight: FONT_WEIGHT.semibold,
                      color: palette.brand,
                      letterSpacing: 0.2 }}
                  >
                    Add
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 8 }}>
                {visibleSubs.length === 0 && (
                  <Text
                    style={{
                      fontSize: TYPE.rowValue,
                      color: attemptedSubmit ? palette.negative : palette.textSecondary,
                      paddingHorizontal: CARD_PADDING,
                      paddingVertical: 12,
                      fontStyle: 'italic' }}
                  >
                    {attemptedSubmit
                      ? 'Add at least one subcategory before saving.'
                      : 'No subcategories yet. Tap Add to create one.'}
                  </Text>
                )}
                {visibleSubs.map((sub, renderIdx) => {
                  const cardKey = sub.id ?? `new-${sub.originalIdx}`;
                  return (
                    <View
                      key={cardKey}
                      ref={(el) => {
                        if (el) subViewRefs.current.set(cardKey, el);
                        else subViewRefs.current.delete(cardKey);
                      }}
                    >
                      <AnimatedCollapseCard
                        ref={(handle) => { if (handle) subCardRefs.current.set(cardKey, handle); else subCardRefs.current.delete(cardKey); }}
                        onRemoved={() => setSubs((current) => current.map((s, i) => (i === sub.originalIdx ? { ...s, deleted: true } : s)))}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ flex: 1 }}>
                            <InputField
                              palette={palette}
                              value={sub.name}
                              onChangeText={(v) => updateSubName(sub.originalIdx, v)}
                              placeholder={`Subcategory ${renderIdx + 1}`}
                              autoFocus={!sub.id && renderIdx === visibleSubs.length - 1}
                              onFocus={() => handleSubFocus(cardKey)}
                            />
                          </View>
                          <IconBtn
                            onPress={() => deleteSub(sub.originalIdx, cardKey)}
                            palette={palette}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                          >
                            <AppIcon name="trash-2" size={18} color={palette.negative} />
                          </IconBtn>
                        </View>
                      </AnimatedCollapseCard>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </SettingsFormLayout>

      {/* Root-level BottomSheets avoid clipping in SettingsFormLayout ScrollView */}
      {showTypePicker && (
        <BottomSheet
          title="Category Type"
          palette={palette}
          onClose={() => setShowTypePicker(false)}
        >
          {CATEGORY_TYPE_OPTIONS.map((opt, i) => (
            <ChoiceRow
              key={opt.key}
              title={opt.label}
              selected={type === opt.key}
              palette={palette}
              noBorder={i === CATEGORY_TYPE_OPTIONS.length - 1}
              onPress={() => {
                setType(opt.key);
                setDuplicateError('');
                setShowTypePicker(false);
              }}
            />
          ))}
        </BottomSheet>
      )}

      {showIconPicker && (
        <BottomSheet
          title="Choose Icon"
          palette={palette}
          onClose={() => setShowIconPicker(false)}
        >
          <View style={{ padding: SPACING.md }}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['icons', 'emojis'] as const).map((tab) => {
                const selected = iconPickerTab === tab;
                return (
                  <TouchableOpacity
                    delayPressIn={0}
                    key={tab}
                    onPress={() => setIconPickerTab(tab)}
                    style={{
                      flex: 1,
                      minHeight: 38,
                      borderRadius: HOME_RADIUS.chip,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: selected ? palette.tabActive : palette.border,
                      backgroundColor: selected ? palette.brandSoft : palette.surface,
                    }}
                  >
                    <Text appWeight="medium" style={{ fontSize: TYPE.body, fontWeight: FONT_WEIGHT.bold, color: selected ? palette.tabActive : palette.textMuted }}>
                      {tab === 'icons' ? 'Icons' : 'Emojis'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {iconPickerTab === 'emojis' ? (
              <>
                {suggestedEmojis.length > 0 && (
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    <Text style={{ fontSize: TYPE.body, fontWeight: FONT_WEIGHT.bold, color: palette.textMuted }}>
                      Suggested For "{name.trim()}"
                    </Text>
                    <IconGrid
                      icons={suggestedEmojis}
                      selectedIcon={icon}
                      onSelect={(ic) => {
                        setIcon(ic);
                        setShowIconPicker(false);
                      }}
                      palette={palette}
                    />
                  </View>
                )}
                {CATEGORY_EMOJI_GROUPS.map((group) => (
                  <View key={group.name} style={{ gap: 8, marginBottom: 16 }}>
                    <Text style={{ fontSize: TYPE.body, fontWeight: FONT_WEIGHT.bold, color: palette.textMuted }}>
                      {group.name}
                    </Text>
                    <IconGrid
                      icons={group.emojis}
                      selectedIcon={icon}
                      onSelect={(ic) => {
                        setIcon(ic);
                        setShowIconPicker(false);
                      }}
                      palette={palette}
                    />
                  </View>
                ))}
              </>
            ) : (
              <IconGrid
                icons={CATEGORY_ICONS}
                selectedIcon={icon}
                onSelect={(ic) => {
                  setIcon(ic);
                  setShowIconPicker(false);
                }}
                palette={palette}
              />
            )}
          </View>
        </BottomSheet>
      )}
      {dialog}
    </>
  );
}
