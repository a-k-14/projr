import { Text } from '@/components/ui/AppText';
import { useEffect, useMemo, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { SCREEN_GUTTER , FONT_WEIGHT} from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';
import type { Category, TransactionType } from '../../types';
import { BottomSheet } from './BottomSheet';
import { buildCategoryPickerSections, CategorySearchBox, CategoryTreeList } from './CategoryTreePicker';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

export function CategoryPickerSheet({
  title = 'Select Category',
  categories,
  transactionType,
  selectedCategoryId,
  palette,
  onClose,
  onManage,
  onSelect,
  onlyParents = false,
}: {
  title?: string;
  categories: Category[];
  transactionType?: TransactionType;
  selectedCategoryId?: string;
  palette: AppThemePalette;
  onClose: () => void;
  onManage: () => void;
  onSelect: (id: string) => void;
  onlyParents?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());
  // Defer the (relatively heavy) category tree render by one frame so the sheet's
  // open animation starts unblocked — rendering the whole tree + icon badges
  // synchronously on mount collides with `present()` and causes a visible stutter.
  const [contentReady, setContentReady] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setContentReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId),
    [categories, selectedCategoryId],
  );
  const selectedParentId = selectedCategory?.parentId ?? selectedCategory?.id;

  const sections = useMemo(() => {
    return buildCategoryPickerSections({
      categories,
      search,
      parentFilter: (category) => {
        if (category.systemKey) return false;
        if (transactionType === undefined || transactionType === 'transfer' || transactionType === 'loan') return true;
        return category.type === transactionType || category.type === 'both';
      },
      childFilter: onlyParents ? () => false : undefined,
    });
  }, [categories, search, transactionType, onlyParents]);

  useEffect(() => {
    if (search.trim()) {
      setExpandedParentIds(new Set(sections.map((section) => section.parent.id)));
    } else if (sections.length === 1) {
      setExpandedParentIds(new Set([sections[0].parent.id]));
    } else if (selectedParentId) {
      setExpandedParentIds(new Set([selectedParentId]));
    }
  }, [search, sections, selectedParentId]);

  return (
    <BottomSheet
      title={title}
      palette={palette}
      onClose={onClose}
      scrollEnabled={true}
      fixedHeightRatio={0.80}
      horizontalPadding={SCREEN_GUTTER}
      headerBottom={
        <CategorySearchBox
          search={search}
          onSearchChange={setSearch}
          placeholder="Search"
          palette={palette}
          TextInputComponent={BottomSheetTextInput}
        />
      }
      headerRight={
        <TouchableOpacity delayPressIn={0} onPress={onManage} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.brand }}>Manage</Text>
        </TouchableOpacity>
      }
    >
      {contentReady ? (
        <CategoryTreeList
          sections={sections}
          selectedCategoryId={selectedCategoryId}
          expandedParentIds={expandedParentIds}
          setExpandedParentIds={setExpandedParentIds}
          onSelect={onSelect}
          palette={palette}
        />
      ) : null}
    </BottomSheet>
  );
}
