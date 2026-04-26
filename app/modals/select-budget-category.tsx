import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { buildCategoryPickerSections, CategoryTreePicker } from '../../components/ui/CategoryTreePicker';
import { useAppTheme } from '../../lib/theme';
import { useBudgetDraftStore } from '../../stores/useBudgetDraftStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';

export default function SelectBudgetCategoryScreen() {
  const categories = useCategoriesStore((s) => s.categories);
  const selectedCategoryId = useBudgetDraftStore((s) => s.categoryId);
  const setCategoryId = useBudgetDraftStore((s) => s.setCategoryId);
  const { palette } = useAppTheme();
  const [search, setSearch] = useState('');
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId),
    [categories, selectedCategoryId],
  );
  const selectedParentId = selectedCategory?.parentId ?? selectedCategory?.id;

  const sections = useMemo(() => {
    return buildCategoryPickerSections({
      categories,
      search,
      childFilter: (category) => category.type === 'out',
      requireChildren: true,
    });
  }, [categories, search]);

  useEffect(() => {
    if (search.trim().length > 0) {
      setExpandedParentIds(new Set(sections.map((section) => section.parent.id)));
    } else if (selectedParentId) {
      setExpandedParentIds(new Set([selectedParentId]));
    }
  }, [search, sections, selectedParentId]);

  return (
    <CategoryTreePicker
      title="Select Category"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search"
      sections={sections}
      selectedCategoryId={selectedCategoryId}
      expandedParentIds={expandedParentIds}
      setExpandedParentIds={setExpandedParentIds}
      onBack={() => router.back()}
      onSelect={(id) => {
        setCategoryId(id);
        router.back();
      }}
      palette={palette}
      emptyMessage="No categories found"
    />
  );
}
