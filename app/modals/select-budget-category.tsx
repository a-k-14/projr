import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { CategoryTreePicker } from '../../components/ui/CategoryTreePicker';
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

  const sections = useMemo(() => {
    const parents = categories
      .filter((category) => !category.parentId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

    return parents
      .map((parent) => {
        const children = categories
          .filter((category) => category.parentId === parent.id && category.type === 'out')
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
        const filteredChildren = children.filter((child) => {
          if (!search.trim()) return true;
          const haystack = `${parent.name} ${child.name}`.toLowerCase();
          return haystack.includes(search.trim().toLowerCase());
        });
        return {
          parent,
          children,
          filteredChildren,
          hasSearchMatch: filteredChildren.length > 0 || parent.name.toLowerCase().includes(search.trim().toLowerCase()),
        };
      })
      .filter((section) => section.children.length > 0)
      .filter((section) => search.trim() === '' || section.hasSearchMatch);
  }, [categories, search]);

  useEffect(() => {
    if (search.trim().length > 0) {
      setExpandedParentIds(new Set(sections.map((section) => section.parent.id)));
    }
  }, [search, sections]);

  return (
    <CategoryTreePicker
      title="Select subcategory"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search budget subcategories..."
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
