import { create } from 'zustand';
import type { Settings } from '../types';
import * as settingsService from '../services/settings';

const defaultSettings: Settings = {
  defaultAccountId: '',
  currency: 'INR',
  currencySymbol: '₹',
  theme: 'auto',
  yearStart: 3,
  cloudBackupEnabled: false,
};

interface UIStore {
  settings: Settings;
  isLoaded: boolean;
  load: () => Promise<void>;
  updateSettings: (data: Partial<Settings>) => Promise<void>;
}

export const useUIStore = create<UIStore>((set) => ({
  settings: defaultSettings,
  isLoaded: false,

  load: async () => {
    const settings = await settingsService.getSettings();
    set({ settings, isLoaded: true });
  },

  updateSettings: async (data) => {
    const updated = await settingsService.updateSettings(data);
    set({ settings: updated });
  },
}));
