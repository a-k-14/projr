import { create } from 'zustand';

/**
 * Design Lab — in-memory only (resets on app restart).
 * Lets us A/B test full screen redesigns side-by-side against real data
 * without touching production. Switch variants via a hidden gesture
 * (long-press the account name in the account-detail header).
 *
 * To ship a winning variant: remove this store + the variant branches
 * and inline the chosen JSX into the canonical screen.
 */
export type AccountDetailVariant = 'current' | 'classic' | 'pulse' | 'ledger';

const ORDER: AccountDetailVariant[] = ['current', 'classic', 'pulse', 'ledger'];

export const VARIANT_LABEL: Record<AccountDetailVariant, string> = {
  current: 'Current',
  classic: 'Classic',
  pulse: 'Pulse',
  ledger: 'Ledger',
};

interface DesignLabState {
  accountDetailVariant: AccountDetailVariant;
  setAccountDetailVariant: (v: AccountDetailVariant) => void;
  cycleAccountDetailVariant: () => void;
}

export const useDesignLabStore = create<DesignLabState>((set, get) => ({
  accountDetailVariant: 'current',
  setAccountDetailVariant: (v) => set({ accountDetailVariant: v }),
  cycleAccountDetailVariant: () => {
    const idx = ORDER.indexOf(get().accountDetailVariant);
    const next = ORDER[(idx + 1) % ORDER.length];
    set({ accountDetailVariant: next });
  },
}));
