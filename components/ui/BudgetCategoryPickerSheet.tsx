import { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Text } from '@/components/ui/AppText';
import { AppChevron } from '@/components/ui/AppChevron';
import { Checkbox } from '../activity/ActivityUI';
import { CategoryIconBadge } from './CategoryTreePicker';
import { FilledButton } from './AppButton';
import { CARD_PADDING, FONT_WEIGHT } from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';
import type { Category } from '../../types';

interface BudgetCategoryPickerSheetProps {
  categories: Category[];
  selectedCategoryId: string;
  selectedSubCategoryIds: string[] | null;
  palette: AppThemePalette;
  onClose: () => void;
  onApply: (data: { categoryId: string; subCategoryIds: string[] | null }) => void;
}

export function BudgetCategoryPickerSheet({
  categories,
  selectedCategoryId: initialCategoryId,
  selectedSubCategoryIds: initialSubCategoryIds,
  palette,
  onClose,
  onApply,
}: BudgetCategoryPickerSheetProps) {
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [subCategoryIds, setSubCategoryIds] = useState<string[] | null>(initialSubCategoryIds);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const parents = useMemo(() => {
    return categories
      .filter((c) => !c.parentId && !c.systemKey && (c.type === 'out' || c.type === 'both'))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  }, [categories]);

  const childCategoriesByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    categories.forEach((c) => {
      if (c.parentId) {
        if (!map.has(c.parentId)) map.set(c.parentId, []);
        map.get(c.parentId)?.push(c);
      }
    });
    return map;
  }, [categories]);

  const toggleParent = (pId: string) => {
    setExpandedIds((prev) =>
      prev.includes(pId) ? prev.filter((id) => id !== pId) : [...prev, pId]
    );
  };

  const handleToggleParentCheckbox = (pId: string) => {
    if (categoryId === pId && subCategoryIds === null) {
      // Unselect if already fully selected
      setCategoryId('');
      setSubCategoryIds(null);
    } else {
      // Fully select this parent
      setCategoryId(pId);
      setSubCategoryIds(null);
    }
  };

  const handleToggleChildCheckbox = (parent: Category, childId: string) => {
    const pId = parent.id;
    const children = childCategoriesByParent.get(pId) ?? [];
    const allChildIds = children.map((c) => c.id);

    if (categoryId !== pId) {
      // Switch parent, select only this child
      setCategoryId(pId);
      setSubCategoryIds([childId]);
    } else {
      // Toggle child on currently selected parent
      const current = subCategoryIds || allChildIds;
      const isSelected = current.includes(childId);
      let next: string[];
      if (isSelected) {
        next = current.filter((id) => id !== childId);
      } else {
        next = [...current, childId];
      }

      if (next.length === children.length || next.length === 0) {
        // If all selected or none selected, treat as parent all selected / unselected
        if (next.length === 0) {
          setCategoryId('');
          setSubCategoryIds(null);
        } else {
          setSubCategoryIds(null);
        }
      } else {
        setSubCategoryIds(next);
      }
    }
  };

  const renderParentRow = (parent: Category) => {
    const children = childCategoriesByParent.get(parent.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.includes(parent.id);

    const isSelected = categoryId === parent.id;
    const isFullyChecked = isSelected && subCategoryIds === null;
    const isPartiallyChecked = isSelected && subCategoryIds !== null;

    return (
      <View key={parent.id}>
        <TouchableOpacity
          delayPressIn={0}
          onPress={() => (hasChildren ? toggleParent(parent.id) : handleToggleParentCheckbox(parent.id))}
          style={[styles.row, { borderBottomColor: palette.divider }]}
        >
          <TouchableOpacity
            delayPressIn={0}
            onPress={() => handleToggleParentCheckbox(parent.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 12 }}
          >
            <Checkbox selected={isFullyChecked} partial={isPartiallyChecked} palette={palette} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <CategoryIconBadge
              icon={parent.icon || 'tag'}
              palette={palette}
              iconColor={palette.brand}
              size={19}
              bgSize={36}
              backgroundColor="transparent"
            />
            <Text
              numberOfLines={1}
              style={{
                marginLeft: 14,
                flex: 1,
                fontSize: HOME_TEXT.rowLabel,
                fontWeight: isSelected ? FONT_WEIGHT.medium : FONT_WEIGHT.regular,
                color: palette.text,
              }}
            >
              {parent.name}
            </Text>
          </View>
          {hasChildren ? (
            <AppChevron
              direction={isExpanded ? 'up' : 'down'}
              size={18}
              tone="secondary"
              palette={palette}
              style={{ marginLeft: 8 }}
            />
          ) : (
            <View style={{ width: 26 }} />
          )}
        </TouchableOpacity>

        {isExpanded && hasChildren
          ? children.map((child) => {
              const childSelected = isSelected && (subCategoryIds === null || subCategoryIds.includes(child.id));
              return (
                <TouchableOpacity
                  key={child.id}
                  delayPressIn={0}
                  onPress={() => handleToggleChildCheckbox(parent, child.id)}
                  style={[
                    styles.subRow,
                    {
                      borderBottomColor: palette.divider,
                      backgroundColor: palette.inputBg,
                    },
                  ]}
                >
                  <TouchableOpacity
                    delayPressIn={0}
                    onPress={() => handleToggleChildCheckbox(parent, child.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginRight: 12 }}
                  >
                    <Checkbox selected={childSelected} palette={palette} />
                  </TouchableOpacity>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: HOME_TEXT.rowLabel,
                      fontWeight: childSelected ? FONT_WEIGHT.medium : FONT_WEIGHT.regular,
                      color: palette.text,
                    }}
                  >
                    {child.name}
                  </Text>
                </TouchableOpacity>
              );
            })
          : null}
      </View>
    );
  };

  return (
    <BottomSheet
      title="Select Category"
      palette={palette}
      onClose={onClose}
      fixedHeightRatio={0.80}
      footer={
        <View style={{ padding: 16 }}>
          <FilledButton
            label="Apply"
            onPress={() => onApply({ categoryId, subCategoryIds })}
            palette={palette}
            tone="brand"
            disabled={!categoryId}
          />
        </View>
      }
    >
      <View style={{ paddingBottom: 16 }}>
        {parents.map(renderParentRow)}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: CARD_PADDING,
    minHeight: 56,
    borderBottomWidth: 1,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: CARD_PADDING + 48,
    paddingRight: CARD_PADDING,
    minHeight: 52,
    borderBottomWidth: 1,
  },
});
