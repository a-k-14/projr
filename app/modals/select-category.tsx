import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { CategoryTreePicker } from '../../components/ui/CategoryTreePicker';
import { useAppTheme } from '../../lib/theme';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import type { TransactionType } from '../../types';

export default function SelectCategoryScreen() {
  const { type, splitRowId } = useLocalSearchParams<{ type?: TransactionType; splitRowId?: string }>();
  const categories = useCategoriesStore((s) => s.categories);
  const splitRows = useTransactionDraftStore((s) => s.splitRows);
  const selectedCategoryId = splitRowId 
    ? (splitRows.find(r => r.id === splitRowId)?.categoryId || '')
    : useTransactionDraftStore((s) => s.categoryId);
  
  const setCategoryId = useTransactionDraftStore((s) => s.setCategoryId);
  const updateSplitRow = useTransactionDraftStore((s) => s.updateSplitRow);
  const { palette } = useAppTheme();
  const [search, setSearch] = useState('');
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());

  // Build hierarchical sections with strict type filtering
  const sections = useMemo(() => {
    // Filter top-level parents first based on transaction type
    const parents = categories
      .filter((c) => c.parentId == null && (type === undefined || c.type === type || c.type === 'both'))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

    return parents.map((parent) => {
      const children = categories
        .filter((c) => c.parentId === parent.id)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
      const filteredChildren = children.filter((child) => {
        if (!search.trim()) return true;
        const haystack = `${parent.name} ${child.name}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      });

      return {
        parent,
        children: children,
        filteredChildren: filteredChildren,
        hasSearchMatch: filteredChildren.length > 0 || parent.name.toLowerCase().includes(search.trim().toLowerCase()),
      };
    }).filter(s => search.trim() === '' || s.hasSearchMatch);
  }, [categories, search, type]);

  // Auto-expand parents when searching
  useEffect(() => {
    if (search.trim().length > 0) {
      setExpandedParentIds(new Set(sections.map((s) => s.parent.id)));
    }
  }, [search, sections]);

  const onSelect = (id: string) => {
    if (splitRowId) {
      updateSplitRow(splitRowId, { categoryId: id });
    } else {
      setCategoryId(id);
    }
    router.back();
  };

  return (
    <CategoryTreePicker
      title="Select category"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={`Search ${type || ''} categories...`}
      sections={sections}
      selectedCategoryId={selectedCategoryId}
      expandedParentIds={expandedParentIds}
      setExpandedParentIds={setExpandedParentIds}
      onBack={() => router.back()}
      onSelect={onSelect}
      palette={palette}
    />
  );
}
