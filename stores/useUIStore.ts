import { create } from 'zustand';
import type { Settings } from '../types';
import * as settingsService from '../services/settings';
import { DEFAULT_SETTINGS } from '../services/settings';

interface UIStore {
  settings: Settings;
  isLoaded: boolean;
  loadError: string | null;
  load: () => Promise<void>;
  updateSettings: (data: Partial<Settings>) => Promise<void>;
}

export const useUIStore = create<UIStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  loadError: null,

  load: async () => {
    try {
      const settings = await settingsService.getSettings();
      set({ settings, isLoaded: true, loadError: null });
    } catch (e) {
      set({ loadError: String(e) });
    }
  },

  updateSettings: async (data) => {
    // Apply optimistically so the UI responds instantly
    set((state) => ({ settings: { ...state.settings, ...data } }));
    // Persist and reconcile (handles type coercions from DB)
    const updated = await settingsService.updateSettings(data);
    set({ settings: updated });
  },
}));
