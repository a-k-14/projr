import { create } from 'zustand';
import type { Settings } from '../types';
import * as settingsService from '../services/settings';
import { DEFAULT_SETTINGS } from '../services/settings';

interface UIStore {
  settings: Settings;
  isLoaded: boolean;
  loadError: string | null;
  privacyGraceUntil: number;
  load: () => Promise<void>;
  reset: () => void;
  beginPrivacyGrace: (durationMs: number) => void;
  updateSettings: (data: Partial<Settings>, metricContext?: string) => Promise<void>;
}

export const useUIStore = create<UIStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  loadError: null,
  privacyGraceUntil: 0,

  load: async () => {
    try {
      const settings = await settingsService.getSettings();
      set({ settings, isLoaded: true, loadError: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ isLoaded: false, loadError: message });
      throw e;
    }
  },

  reset: () => {
    set({ settings: DEFAULT_SETTINGS, isLoaded: false, loadError: null, privacyGraceUntil: 0 });
  },

  beginPrivacyGrace: (durationMs) => {
    set({ privacyGraceUntil: Date.now() + durationMs });
  },

  updateSettings: async (data, metricContext) => {
    const traceStart = Date.now();
    const previousSettings = get().settings;
    const nextEntries = Object.entries(data) as [keyof Settings, Settings[keyof Settings]][];
    const hasChanges = nextEntries.some(([key, value]) => previousSettings[key] !== value);
    if (!hasChanges) {
      return;
    }
    const newSettings = { ...previousSettings, ...data };
    
    // Apply Optimistic UI update instantly
    set({ settings: newSettings });
    
    const uiRepaintMS = Date.now() - traceStart;

    try {
      // Persist in background after optimistic state update
      await settingsService.updateSettings(data);
    } catch (error) {
      // Restore previous state if persistence fails
      set({ settings: previousSettings });
    }
  },
}));
