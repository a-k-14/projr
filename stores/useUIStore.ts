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
    // Optimistic Update: instantly update the UI without waiting for DB/Disk I/O
    set((state) => ({ settings: { ...state.settings, ...data } }));
    
    // Background validation and physical saving
    const updated = await settingsService.updateSettings(data);
    
    // Re-sync with actual saved defaults if necessary
    set({ settings: updated });
  },
}));
