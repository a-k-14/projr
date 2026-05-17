import { create } from 'zustand';

interface ActivityFiltersState {
  hasActiveFilters: boolean;
  setHasActiveFilters: (v: boolean) => void;
}

export const useActivityFiltersStore = create<ActivityFiltersState>((set) => ({
  hasActiveFilters: false,
  setHasActiveFilters: (hasActiveFilters) => set({ hasActiveFilters }),
}));
