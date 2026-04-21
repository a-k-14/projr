import { Text } from '@/components/ui/AppText';
import { useEffect, useMemo, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { SCREEN_GUTTER } from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';
import type { Category, TransactionType } from '../../types';
import { BottomSheet } from './BottomSheet';
import { buildCategoryPickerSections, CategorySearchBox, CategoryTreeList } from './CategoryTreePicker';

export function CategoryPickerSheet({
  title = 'Select Category',
  categories,
  transactionType,
  selectedCategoryId,
  palette,
  onClose,
  onManage,
  onSelect,
}: {
  title?: string;
  categories: Category[];
  transactionType?: TransactionType;
  selectedCategoryId?: string;
  palette: AppThemePalette;
  onClose: () => void;
  onManage: () => void;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());

  const sections = useMemo(() => {
    return buildCategoryPickerSections({
      categories,
      search,
      parentFilter: (category) => {
        if (transactionType === undefined || transactionType === 'transfer' || transactionType === 'loan') return true;
        return category.type === transactionType || category.type === 'both';
      },
    });
  }, [categories, search, transactionType]);

  useEffect(() => {
    if (search.trim()) {
      setExpandedParentIds(new Set(sections.map((section) => section.parent.id)));
    } else if (sections.length === 1) {
      setExpandedParentIds(new Set([sections[0].parent.id]));
    }
  }, [search, sections]);

  return (
    <BottomSheet
      title={title}
      palette={palette}
      onClose={onClose}
      scrollEnabled={true}
      fixedHeightRatio={0.85}
      horizontalPadding={SCREEN_GUTTER}
      headerBottom={
        <CategorySearchBox
          search={search}
          onSearchChange={setSearch}
          placeholder="Search"
          palette={palette}
        />
      }
      headerRight={
        <TouchableOpacity delayPressIn={0} onPress={onManage} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.brand }}>Manage</Text>
        </TouchableOpacity>
      }
    >
      <CategoryTreeList
        sections={sections}
        selectedCategoryId={selectedCategoryId}
        expandedParentIds={expandedParentIds}
        setExpandedParentIds={setExpandedParentIds}
        onSelect={onSelect}
        palette={palette}
      />
    </BottomSheet>
  );
}
