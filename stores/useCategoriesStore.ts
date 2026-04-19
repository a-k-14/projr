import { create } from 'zustand';
import type { Category, Tag } from '../types';
import * as categoriesService from '../services/categories';
import * as tagsService from '../services/tags';
import { countByCategory, countByTag } from '../services/transactions';

interface CategoriesStore {
  categories: Category[];
  tags: Tag[];
  isLoaded: boolean;
  load: () => Promise<void>;
  reset: () => void;
  addCategory: (data: Omit<Category, 'id'>) => Promise<Category>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  addTag: (data: Omit<Tag, 'id'>) => Promise<Tag>;
  updateTag: (id: string, data: Partial<Tag>) => Promise<void>;
  removeTag: (id: string) => Promise<void>;
  getCategoryById: (id: string) => Category | undefined;
  getTagById: (id: string) => Tag | undefined;
  getCategoryDisplayName: (id: string) => string;
  getCategoryFullDisplayName: (id: string, separator?: string) => string;
}

export const useCategoriesStore = create<CategoriesStore>((set, get) => ({
  categories: [],
  tags: [],
  isLoaded: false,

  load: async () => {
    const [categories, tags] = await Promise.all([
      categoriesService.getCategories(),
      tagsService.getTags(),
    ]);
    set({ categories, tags, isLoaded: true });
  },

  reset: () => {
    set({ categories: [], tags: [], isLoaded: false });
  },

  addCategory: async (data) => {
    const cat = await categoriesService.createCategory(data);
    set((state) => ({ categories: [...state.categories, cat] }));
    return cat;
  },

  updateCategory: async (id, data) => {
    const updated = await categoriesService.updateCategory(id, data);
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? updated : c)),
    }));
  },

  removeCategory: async (id) => {
    // Check if this category (or any of its subcategories) has linked transactions
    const { categories } = get();
    const idsToCheck = [id, ...categories.filter((c) => c.parentId === id).map((c) => c.id)];
    let totalCount = 0;
    for (const cid of idsToCheck) {
      totalCount += await countByCategory(cid);
    }
    if (totalCount > 0) {
      throw new Error(
        `This category has ${totalCount} transaction${totalCount === 1 ? '' : 's'} and cannot be deleted.`
      );
    }
    // Delete subcategories first, then the parent
    for (const cid of idsToCheck.filter((cid) => cid !== id)) {
      await categoriesService.deleteCategory(cid);
    }
    await categoriesService.deleteCategory(id);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id && c.parentId !== id),
    }));
  },

  addTag: async (data) => {
    const tag = await tagsService.createTag(data);
    set((state) => ({ tags: [...state.tags, tag] }));
    return tag;
  },

  updateTag: async (id, data) => {
    const updated = await tagsService.updateTag(id, data);
    set((state) => ({
      tags: state.tags.map((t) => (t.id === id ? updated : t)),
    }));
  },

  removeTag: async (id) => {
    const count = await countByTag(id);
    if (count > 0) {
      throw new Error(
        `This tag is used in ${count} transaction${count === 1 ? '' : 's'} and cannot be deleted.`
      );
    }
    await tagsService.deleteTag(id);
    set((state) => ({ tags: state.tags.filter((t) => t.id !== id) }));
  },

  getCategoryById: (id) => get().categories.find((c) => c.id === id),
  getTagById: (id) => get().tags.find((t) => t.id === id),

  getCategoryDisplayName: (id) => {
    const { categories } = get();
    const cat = categories.find((c) => c.id === id);
    if (!cat) return 'Unknown';
    return categoriesService.getCategoryDisplayName(cat, categories);
  },

  getCategoryFullDisplayName: (id: string, separator: string = ' · ') => {
    const { categories } = get();
    const cat = categories.find((c) => c.id === id);
    if (!cat) return 'Unknown';
    if (cat.parentId) {
      const parent = categories.find((c) => c.id === cat.parentId);
      if (parent) return `${parent.name}${separator}${cat.name}`;
    }
    return cat.name;
  },
}));
