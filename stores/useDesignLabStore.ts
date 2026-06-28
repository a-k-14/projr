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
export type ActivityVariant = 'current' | 'card2' | 'premium';

const ORDER: AccountDetailVariant[] = ['current', 'classic', 'pulse', 'ledger'];
const ACTIVITY_ORDER: ActivityVariant[] = ['current', 'card2', 'premium'];

export const VARIANT_LABEL: Record<AccountDetailVariant, string> = {
  current: 'Current',
  classic: 'Classic',
  pulse: 'Pulse',
  ledger: 'Ledger',
};

export const ACTIVITY_VARIANT_LABEL: Record<ActivityVariant, string> = {
  current: 'Current',
  card2: 'Card 2',
  premium: 'Premium',
};

interface DesignLabState {
  accountDetailVariant: AccountDetailVariant;
  setAccountDetailVariant: (v: AccountDetailVariant) => void;
  cycleAccountDetailVariant: () => void;

  activityVariant: ActivityVariant;
  setActivityVariant: (v: ActivityVariant) => void;
  cycleActivityVariant: () => void;
}

export const useDesignLabStore = create<DesignLabState>((set, get) => ({
  accountDetailVariant: 'current',
  setAccountDetailVariant: (v) => set({ accountDetailVariant: v }),
  cycleAccountDetailVariant: () => {
    const idx = ORDER.indexOf(get().accountDetailVariant);
    const next = ORDER[(idx + 1) % ORDER.length];
    set({ accountDetailVariant: next });
  },

  activityVariant: 'current',
  setActivityVariant: (v) => set({ activityVariant: v }),
  cycleActivityVariant: () => {
    const idx = ACTIVITY_ORDER.indexOf(get().activityVariant || 'current');
    const next = ACTIVITY_ORDER[(idx + 1) % ACTIVITY_ORDER.length];
    set({ activityVariant: next });
  },
}));
