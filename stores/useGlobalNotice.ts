import { create } from 'zustand';

type NoticeTone = 'error' | 'info';

type GlobalNoticeState = {
  message: string | null;
  tone: NoticeTone;
  show: (message: string, tone?: NoticeTone) => void;
  dismiss: () => void;
};

// App-wide notice surfaced from anywhere. The add-transaction modal can close
// before background work finishes, so this banner lives at the app root and is
// always visible regardless of which screen the user landed on.
export const useGlobalNotice = create<GlobalNoticeState>((set) => ({
  message: null,
  tone: 'error',
  show: (message, tone = 'error') => set({ message, tone }),
  dismiss: () => set({ message: null }),
}));
