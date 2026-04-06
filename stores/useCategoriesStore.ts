import { create } from 'zustand';
import type { Category, Tag } from '../types';
import * as categoriesService from '../services/categories';
import * as tagsService from '../services/tags';

interface CategoriesStore {
  categories: Category[];
  tags: Tag[];
  isLoaded: boolean;
  load: () => Promise<void>;
  addCategory: (data: Omit<Category, 'id'>) => Promise<Category>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  addTag: (data: Omit<Tag, 'id'>) => Promise<Tag>;
  updateTag: (id: string, data: Partial<Tag>) => Promise<void>;
  removeTag: (id: string) => Promise<void>;
  getCategoryById: (id: string) => Category | undefined;
  getTagById: (id: string) => Tag | undefined;
  getCategoryDisplayName: (id: string) => string;
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
    await categoriesService.deleteCategory(id);
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
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
}));
