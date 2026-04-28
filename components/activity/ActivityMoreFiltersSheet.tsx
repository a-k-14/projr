import { AppIcon } from '@/components/ui/AppIcon';
import { AppChevron } from '@/components/ui/AppChevron';
import React from 'react';
import { Text } from '@/components/ui/AppText';
import { StyleSheet, TextInput, View , TouchableOpacity } from 'react-native';
import { FilledButton } from '../ui/AppButton';
import { BottomSheet } from '../ui/BottomSheet';
import { FilterChip } from '../ui/FilterChip';
import { ListHeading } from '../ui/ListHeading';
import { CARD_PADDING } from '../../lib/design';
import { ACTIVITY_LAYOUT, HOME_TEXT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';
import type { Category, Transaction } from '../../types';
import { CategoryIconBadge, Checkbox } from './ActivityUI';

interface ActivityMoreFiltersSheetProps {
  groupByMode: 'date' | 'category';
  setGroupByMode: (mode: 'date' | 'category') => void;
  draftGroupByMode: 'date' | 'category';
  setDraftGroupByMode: (mode: 'date' | 'category') => void;
  selectedCategoryIds: string[];
  toggleCategoryId: (id: string) => void;
  toggleCategoryFamily: (id: string) => void;
  expandedCategoryIds: string[];
  toggleCategoryExpansion: (id: string) => void;
  selectedTagIds: string[];
  toggleTagId: (id: string) => void;
  amountMinStr: string;
  setAmountMinStr: (val: string) => void;
  amountMaxStr: string;
  setAmountMaxStr: (val: string) => void;
  setShowMoreSheet: (show: boolean) => void;
  categories: Category[];
  tags: { id: string; name: string; color: string }[];
  transactions: Transaction[];
  palette: AppThemePalette;
  clearAll: () => void;
}

export function ActivityMoreFiltersSheet({
  groupByMode,
  setGroupByMode,
  draftGroupByMode,
  setDraftGroupByMode,
  selectedCategoryIds,
  toggleCategoryId,
  toggleCategoryFamily,
  expandedCategoryIds,
  toggleCategoryExpansion,
  selectedTagIds,
  toggleTagId,
  amountMinStr,
  setAmountMinStr,
  amountMaxStr,
  setAmountMaxStr,
  setShowMoreSheet,
  categories,
  tags,
  transactions,
  palette,
  clearAll }: ActivityMoreFiltersSheetProps) {
  const topCategories = categories.filter((c) => !c.parentId);
  const childCategoriesByParent = new Map<string, Category[]>();
  categories.forEach((c) => {
    if (c.parentId) {
      if (!childCategoriesByParent.has(c.parentId)) childCategoriesByParent.set(c.parentId, []);
      childCategoriesByParent.get(c.parentId)?.push(c);
    }
  });

  return (
    <BottomSheet
      title="Filters"
      palette={palette}
      onClose={() => setShowMoreSheet(false)}
      hasNavBar
      footer={
        <View style={{ padding: 16 }}>
          <FilledButton
            label="Apply filters"
            onPress={() => {
              setGroupByMode(draftGroupByMode);
              setShowMoreSheet(false);
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
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '600', color: palette.brand }}>Clear all</Text>
        </TouchableOpacity>
      }
    >
      <View style={{ paddingBottom: 12 }}>
        <ListHeading label="Group by" palette={palette} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ACTIVITY_LAYOUT.controlChipGap, paddingHorizontal: CARD_PADDING, paddingBottom: 8 }}>
          <FilterChip
            label="Date"
            isActive={draftGroupByMode === 'date'}
            onPress={() => setDraftGroupByMode('date')}
            palette={palette}
          />
          <FilterChip
            label="Category"
            isActive={draftGroupByMode === 'category'}
            onPress={() => setDraftGroupByMode('category')}
            palette={palette}
          />
        </View>

        <View style={{ height: 1, backgroundColor: palette.divider }} />

        <ListHeading label="Category" palette={palette} />

        <View style={{ paddingTop: 2 }}>
          {topCategories.map((category) => {
            const children = childCategoriesByParent.get(category.id) ?? [];
            const childSelectedCount = children.filter((child) => selectedCategoryIds.includes(child.id)).length;
            const hasChildren = children.length > 0;
            const parentExplicitlySelected = selectedCategoryIds.includes(category.id);
            const allChildrenSelected = hasChildren && childSelectedCount === children.length;
            const isSelected = parentExplicitlySelected || allChildrenSelected;
            const isPartial = hasChildren && childSelectedCount > 0 && childSelectedCount < children.length && !parentExplicitlySelected;
            const isExpanded = expandedCategoryIds.includes(category.id);
            return (
              <View key={category.id}>
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
                        key={child.id}
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
                          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: '400', color: palette.text }}>
                            {child.name}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                  : null}
              </View>
            );
          })}
        </View>

        <View style={{ height: 1, backgroundColor: palette.divider }} />

        <ListHeading label="Tags" palette={palette} />

        {tags.length === 0 ? (
          <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.bodySmall, paddingHorizontal: CARD_PADDING, paddingVertical: 12 }}>
            No tags yet
          </Text>
        ) : (
          tags.map((tag) => {
            const count = transactions.filter((tx) => tx.tags.includes(tag.id)).length;
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <MoreTagRow
                key={tag.id}
                tag={tag}
                count={count}
                selected={isSelected}
                palette={palette}
                onToggleSelected={() => toggleTagId(tag.id)}
              />
            );
          })
        )}

        <View style={{ height: 1, backgroundColor: palette.divider }} />

        <ListHeading label="Amount Range" palette={palette} paddingBottom={12} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: CARD_PADDING }}>
          <TextInput
            value={amountMinStr}
            onChangeText={setAmountMinStr}
            keyboardType="numeric"
            placeholder="Min ₹"
            placeholderTextColor={palette.textMuted}
            style={[styles.amountField, { borderColor: palette.divider, backgroundColor: palette.background, color: palette.text }]}
          />
          <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.rowLabel }}>—</Text>
          <TextInput
            value={amountMaxStr}
            onChangeText={setAmountMaxStr}
            keyboardType="numeric"
            placeholder="Max ₹"
            placeholderTextColor={palette.textMuted}
            style={[styles.amountField, { borderColor: palette.divider, backgroundColor: palette.background, color: palette.text }]}
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
        <CategoryIconBadge icon={category.icon} palette={palette} />
        <Text numberOfLines={1} style={{ marginLeft: 14, flex: 1, fontSize: HOME_TEXT.rowLabel, fontWeight: '400', color: palette.text }}>
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
  count: number;
  selected: boolean;
  palette: AppThemePalette;
  onToggleSelected: () => void;
}

function MoreTagRow({ tag, count, selected, palette, onToggleSelected }: MoreTagRowProps) {
  return (
    <View style={[styles.moreRow, { borderBottomColor: palette.divider, paddingHorizontal: CARD_PADDING }]}>
      <TouchableOpacity delayPressIn={0} onPress={onToggleSelected} activeOpacity={0.75} style={{ marginRight: 12 }}>
        <Checkbox selected={selected} palette={palette} />
      </TouchableOpacity>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tag.color, marginRight: 14 }} />
      <TouchableOpacity delayPressIn={0} onPress={onToggleSelected} activeOpacity={0.75} style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: '400', color: palette.text }}>
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
  amountField: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: HOME_TEXT.body,
    fontWeight: '600' },
  clearAllButton: {
    marginRight: 4 } });
