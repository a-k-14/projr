import type { Category } from '../types';

export function getCategoryDisplayIcon(
  categoriesById: Map<string, Category>,
  categoryId?: string | null,
): string {
  if (!categoryId) return 'tag';
  const category = categoriesById.get(categoryId);
  if (!category) return 'tag';
  if (category.parentId) {
    const parent = categoriesById.get(category.parentId);
    return parent?.icon || category.icon || 'tag';
  }
  return category.icon || 'tag';
}
