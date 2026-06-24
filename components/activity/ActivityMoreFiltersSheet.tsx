import { useState, useEffect } from 'react';
import { AppChevron } from '@/components/ui/AppChevron';
import { AppIcon } from '@/components/ui/AppIcon';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { FilledButton } from '../ui/AppButton';
import { BottomSheet } from '../ui/BottomSheet';
import { ListHeading } from '../ui/ListHeading';
import { AppSwitch } from '../ui/AppSwitch';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CARD_PADDING, FONT_WEIGHT } from '../../lib/design';
import { HOME_TEXT, BOTTOM_SHEET_TOKENS, HOME_LAYOUT, HELP_TEXTS } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';
import type { Category } from '../../types';
import { CategoryIconBadge, Checkbox } from './ActivityUI';
import { MoreFiltersAmountRange } from '../ui/MoreFiltersAmountRange';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

interface ActivityMoreFiltersSheetProps {
  selectedCategoryIds: string[];
  selectedTagIds: string[];
  amountMinStr: string;
  amountMaxStr: string;
  categories: Category[];
  tags: { id: string; name: string; color: string }[];
  palette: AppThemePalette;
  cashflowBucket: 'all' | 'in' | 'out' | 'net';
  onApply: (data: {
    selectedCategoryIds: string[];
    selectedTagIds: string[];
    amountMinStr: string;
    amountMaxStr: string;
    cashflowBucket: 'all' | 'in' | 'out' | 'net';
  }) => void;
  onClose: () => void;
}

export function ActivityMoreFiltersSheet({
  selectedCategoryIds: initialCategoryIds,
  selectedTagIds: initialTagIds,
  amountMinStr: initialAmountMinStr,
  amountMaxStr: initialAmountMaxStr,
  categories,
  tags,
  palette,
  cashflowBucket: initialCashflowBucket,
  onApply,
  onClose }: ActivityMoreFiltersSheetProps) {
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(initialCategoryIds);
  const [selectedTagIds, setSelectedTagIds] = useState(initialTagIds);
  const [amountMinStr, setAmountMinStr] = useState(initialAmountMinStr);
  const [amountMaxStr, setAmountMaxStr] = useState(initialAmountMaxStr);
  const [cashflowBucket, setCashflowBucket] = useState(initialCashflowBucket);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);

  const isCashflow = cashflowBucket === 'net';
  const noteProgress = useSharedValue(isCashflow ? 1 : 0);

  useEffect(() => {
    noteProgress.value = withTiming(isCashflow ? 1 : 0, { duration: 220 });
  }, [isCashflow]); // eslint-disable-line react-hooks/exhaustive-deps

  const noteStyle = useAnimatedStyle(() => ({
    height: noteProgress.value * 30,
    opacity: noteProgress.value,
  }));

  const toggleCategoryId = (id: string) => {
    const category = categories.find((c) => c.id === id);
    setSelectedCategoryIds((prev) => {
      const exists = prev.includes(id);
      if (!category?.parentId) {
        return exists ? prev.filter((value) => value !== id) : [...prev, id];
      }
      const withoutParent = prev.filter((value) => value !== category.parentId);
      return exists ? withoutParent.filter((value) => value !== id) : [...withoutParent, id];
    });
  };

  const toggleCategoryFamily = (categoryId: string) => {
    const childIds = (childCategoriesByParent.get(categoryId) ?? []).map((child) => child.id);
    const familyIds = [categoryId, ...childIds];
    const hasAnySelected = familyIds.some((id) => selectedCategoryIds.includes(id));
    setSelectedCategoryIds((prev) => {
      if (hasAnySelected) {
        return prev.filter((id) => !familyIds.includes(id));
      }
      return Array.from(new Set([...prev, ...familyIds]));
    });
  };

  const toggleCategoryExpansion = (id: string) => {
    setExpandedCategoryIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const toggleTagId = (id: string) => {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const clearAll = () => {
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    setAmountMinStr('');
    setAmountMaxStr('');
    setCashflowBucket('all');
  };

  const topCategories = categories.filter((c) => !c.parentId);
  const incomeCategories = topCategories.filter(c => c.type === 'in' || c.type === 'both');
  const expenseCategories = topCategories.filter(c => c.type === 'out' || c.type === 'both');
  const childCategoriesByParent = new Map<string, Category[]>();
  categories.forEach((c) => {
    if (c.parentId) {
      if (!childCategoriesByParent.has(c.parentId)) childCategoriesByParent.set(c.parentId, []);
      childCategoriesByParent.get(c.parentId)?.push(c);
    }
  });

  const renderCategoryTree = (category: Category, prefix: string) => {
    const children = childCategoriesByParent.get(category.id) ?? [];
    const childSelectedCount = children.filter((child) => selectedCategoryIds.includes(child.id)).length;
    const hasChildren = children.length > 0;
    const parentExplicitlySelected = selectedCategoryIds.includes(category.id);
    const allChildrenSelected = hasChildren && childSelectedCount === children.length;
    const isSelected = parentExplicitlySelected || allChildrenSelected;
    const isPartial = hasChildren && childSelectedCount > 0 && childSelectedCount < children.length && !parentExplicitlySelected;
    const isExpanded = expandedCategoryIds.includes(category.id);

    return (
      <View key={`${prefix}-${category.id}`}>
        <MoreCategoryRow
          category={category}
          selected={isSelected}
          partial={isPartial}
          expanded={isExpanded}
          hasChildren={hasChildren}
          palette={palette}
          onToggleSelected={() => toggleCategoryFamily(category.id)}
          onToggleExpanded={() => toggleCategoryExpansion(category.id)}
        />
        {isExpanded
          ? children.map((child) => {
              const childSelected = selectedCategoryIds.includes(child.id);
              return (
                <View
                  key={`${prefix}-${child.id}`}
                  style={[
                    styles.moreSubRow,
                    {
                      borderBottomColor: palette.divider,
                      paddingHorizontal: CARD_PADDING + 34,
                      backgroundColor: palette.inputBg,
                      minHeight: 56,
                      flexDirection: 'row',
                      alignItems: 'center' },
                  ]}
                >
                  <TouchableOpacity delayPressIn={0}
                    onPress={() => toggleCategoryId(child.id)}
                    activeOpacity={0.75}
                    style={{ marginRight: 12 }}
                  >
                    <Checkbox selected={childSelected} palette={palette} />
                  </TouchableOpacity>
                  <TouchableOpacity delayPressIn={0}
                    onPress={() => toggleCategoryId(child.id)}
                    activeOpacity={0.75}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>
                      {child.name}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          : null}
      </View>
    );
  };

  return (
    <BottomSheet
      title="Filters"
      palette={palette}
      onClose={onClose}
      hasNavBar
      maxHeightRatio={BOTTOM_SHEET_TOKENS.filterWithNavBarMaxHeight}
      keyboardBehavior="fillParent"
      footer={
        <View style={{ padding: 16 }}>
          <FilledButton
            label="Apply"
            onPress={() => {
              onApply({
                selectedCategoryIds,
                selectedTagIds,
                amountMinStr,
                amountMaxStr,
                cashflowBucket,
              });
            }}
            palette={palette}
          />
        </View>
      }
      headerRight={
        <TouchableOpacity delayPressIn={0}
          onPress={clearAll}
          hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
          style={styles.clearAllButton}
        >
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.brand }}>Clear All</Text>
        </TouchableOpacity>
      }
    >
      <View style={{ paddingBottom: 12 }}>
        <View style={{ paddingHorizontal: CARD_PADDING, paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
              Cashflow
            </Text>
            <AppSwitch
              value={isCashflow}
              onValueChange={(v) => setCashflowBucket(v ? 'net' : 'all')}
              palette={palette}
              width={36}
              height={21}
              thumbSize={15}
              padding={3}
            />
          </View>
          <Animated.View style={noteStyle}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 8 }}>
              <AppIcon name="info" size={11} color={palette.textMuted} strokeWidth={1.8} />
              <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, letterSpacing: 0.1 }}>
                {HELP_TEXTS.cashflowNote}
              </Text>
            </View>
          </Animated.View>
        </View>

        <View style={{ height: 1, backgroundColor: palette.divider }} />

        <ListHeading label="Income Categories" palette={palette} />
        <View style={{ paddingTop: 2 }}>
          {incomeCategories.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.bodySmall, paddingHorizontal: CARD_PADDING, paddingVertical: 12 }}>
              No income categories
            </Text>
          ) : (
            incomeCategories.map((category) => renderCategoryTree(category, 'in'))
          )}
        </View>

        <View style={{ height: 1, backgroundColor: palette.divider }} />

        <ListHeading label="Expense Categories" palette={palette} />
        <View style={{ paddingTop: 2 }}>
          {expenseCategories.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.bodySmall, paddingHorizontal: CARD_PADDING, paddingVertical: 12 }}>
              No expense categories
            </Text>
          ) : (
            expenseCategories.map((category) => renderCategoryTree(category, 'out'))
          )}
        </View>

        <View style={{ height: 1, backgroundColor: palette.divider }} />

        <ListHeading label="Tags" palette={palette} />

        {tags.length === 0 ? (
          <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.bodySmall, paddingHorizontal: CARD_PADDING, paddingVertical: 12 }}>
            No tags yet
          </Text>
        ) : (
          tags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <MoreTagRow
                key={tag.id}
                tag={tag}
                selected={isSelected}
                palette={palette}
                onToggleSelected={() => toggleTagId(tag.id)}
              />
            );
          })
        )}

        <View style={{ height: 1, backgroundColor: palette.divider }} />

        <ListHeading label="Amount Range" subtitle="Filters by transaction amount" palette={palette} paddingBottom={12} />
        <View style={{ paddingHorizontal: CARD_PADDING }}>
          <MoreFiltersAmountRange
            amountMinStr={amountMinStr}
            setAmountMinStr={setAmountMinStr}
            amountMaxStr={amountMaxStr}
            setAmountMaxStr={setAmountMaxStr}
            palette={palette}
            TextInputComponent={BottomSheetTextInput as any}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

interface MoreCategoryRowProps {
  category: Category;
  selected: boolean;
  partial: boolean;
  expanded: boolean;
  hasChildren: boolean;
  palette: AppThemePalette;
  onToggleSelected: () => void;
  onToggleExpanded: () => void;
}

function MoreCategoryRow({
  category,
  selected,
  partial,
  expanded,
  hasChildren,
  palette,
  onToggleSelected,
  onToggleExpanded }: MoreCategoryRowProps) {
  return (
    <TouchableOpacity delayPressIn={0}
      onPress={hasChildren ? onToggleExpanded : onToggleSelected}
      style={[styles.moreRow, { borderBottomColor: palette.divider, paddingHorizontal: CARD_PADDING }]}
    >
      <TouchableOpacity delayPressIn={0} onPress={onToggleSelected} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginRight: 12 }}>
        <Checkbox selected={selected} partial={partial} palette={palette} />
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <CategoryIconBadge
          icon={category.icon}
          palette={palette}
          iconColor={palette.brand}
          size={36}
          iconSize={19}
          strokeWidth={HOME_LAYOUT.listIconStrokeWidth}
          noBackground
        />
        <Text numberOfLines={1} style={{ marginLeft: 14, flex: 1, fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>
          {category.name}
        </Text>
      </View>
      {hasChildren ? (
        <AppChevron direction={expanded ? 'up' : 'down'} size={18} tone="secondary" palette={palette} style={{ marginLeft: 8 }} />
      ) : (
        <View style={{ width: 26 }} />
      )}
    </TouchableOpacity>
  );
}

interface MoreTagRowProps {
  tag: { id: string; name: string; color: string };
  selected: boolean;
  palette: AppThemePalette;
  onToggleSelected: () => void;
}

function MoreTagRow({ tag, selected, palette, onToggleSelected }: MoreTagRowProps) {
  return (
    <View style={[styles.moreRow, { borderBottomColor: palette.divider, paddingHorizontal: CARD_PADDING }]}>
      <TouchableOpacity delayPressIn={0} onPress={onToggleSelected} activeOpacity={0.75} style={{ marginRight: 12 }}>
        <Checkbox selected={selected} palette={palette} />
      </TouchableOpacity>
      <AppIcon name="tag" size={18} color={tag.color} strokeWidth={2} style={{ marginRight: 14 }} />
      <TouchableOpacity delayPressIn={0} onPress={onToggleSelected} activeOpacity={0.75} style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>
          {tag.name}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    borderBottomWidth: 1 },
  moreSubRow: {
    borderBottomWidth: 1 },
  clearAllButton: {
    marginRight: 4 } });
