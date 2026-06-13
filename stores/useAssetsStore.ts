import { create } from 'zustand';
import type { Asset, CreateAssetInput } from '../types';
import * as assetsService from '../services/assets';
import { useTransactionsStore } from './useTransactionsStore';

interface AssetsStore {
  assets: Asset[];
  isLoaded: boolean;
  totalValue: number;
  load: () => Promise<void>;
  reset: () => void;
  add: (data: CreateAssetInput) => Promise<Asset>;
  update: (id: string, data: Partial<CreateAssetInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useAssetsStore = create<AssetsStore>((set, get) => ({
  assets: [],
  isLoaded: false,
  totalValue: 0,
  
  load: async () => {
    const list = await assetsService.getAssets();
    const total = list.reduce((sum, a) => sum + a.value, 0);
    set({ assets: list, isLoaded: true, totalValue: total });
  },

  reset: () => {
    set({ assets: [], isLoaded: false, totalValue: 0 });
  },

  add: async (data) => {
    const created = await assetsService.createAsset(data);
    await get().load();
    useTransactionsStore.getState().markMutated();
    return created;
  },

  update: async (id, data) => {
    await assetsService.updateAsset(id, data);
    await get().load();
    useTransactionsStore.getState().markMutated();
  },

  remove: async (id) => {
    await assetsService.deleteAsset(id);
    await get().load();
    useTransactionsStore.getState().markMutated();
  },
}));
