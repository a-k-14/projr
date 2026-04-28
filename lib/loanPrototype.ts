import { useFonts } from 'expo-font';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';

export type PrototypeLoanDirection = 'lent' | 'borrowed';
export type PrototypeLoanStatus = 'open' | 'watch' | 'closed';
export type PrototypeFormMode = 'new' | 'settlement' | 'edit';

export type PrototypeTimelineEntry = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  kind: 'origin' | 'payment' | 'interest' | 'note';
  date: string;
};

export type PrototypeLoan = {
  id: string;
  personName: string;
  direction: PrototypeLoanDirection;
  status: PrototypeLoanStatus;
  accountName: string;
  principal: number;
  pending: number;
  settled: number;
  collectionRate: number;
  dueLabel: string;
  accent: string;
  note: string;
  tags: string[];
  city: string;
  apr: string;
  schedule: string;
  trustScore: number;
  timeline: PrototypeTimelineEntry[];
};

export const loanPrototypeTheme = {
  bg: '#F4F7FB',
  text: '#13203A',
  textSoft: '#6E7A91',
  textFaint: '#96A0B4',
  card: 'rgba(255,255,255,0.80)',
  cardStrong: 'rgba(255,255,255,0.94)',
  border: 'rgba(24,43,82,0.08)',
  borderStrong: 'rgba(24,43,82,0.14)',
  blurTint: 'light' as const,
  shadow: '#112348',
  track: '#DBE4F0',
  success: '#0FA968',
  warning: '#F59E0B',
  danger: '#EB5757',
  accent: '#2457FF',
  accentSoft: '#EAF0FF',
  mint: '#0FB9A8',
  coral: '#FF6B6B',
  violet: '#7C5CFF',
  sky: '#34A4FF',
};

export const prototypeLoans: PrototypeLoan[] = [
  {
    id: 'maya',
    personName: 'Maya S.',
    direction: 'lent',
    status: 'open',
    accountName: 'HDFC Platinum',
    principal: 240000,
    pending: 94000,
    settled: 146000,
    collectionRate: 61,
    dueLabel: 'Next reminder in 3 days',
    accent: '#2457FF',
    note: 'Short-term bridge for studio expansion. Wants a smoother monthly settlement rhythm.',
    tags: ['Studio', 'Priority', 'Secured'],
    city: 'Bengaluru',
    apr: '11.8%',
    schedule: 'Monthly',
    trustScore: 92,
    timeline: [
      { id: 'm1', title: 'Origin transfer', subtitle: 'Sent to Maya • HDFC Platinum', amount: 240000, kind: 'origin', date: 'Apr 03' },
      { id: 'm2', title: 'Receipt', subtitle: 'Primary settlement', amount: 56000, kind: 'payment', date: 'Apr 10' },
      { id: 'm3', title: 'Interest', subtitle: 'Cycle 1 interest cleared', amount: 12000, kind: 'interest', date: 'Apr 19' },
      { id: 'm4', title: 'Receipt', subtitle: 'Secondary settlement', amount: 78000, kind: 'payment', date: 'Apr 24' },
    ],
  },
  {
    id: 'rohan',
    personName: 'Rohan P.',
    direction: 'borrowed',
    status: 'watch',
    accountName: 'Axis Reserve',
    principal: 180000,
    pending: 132000,
    settled: 48000,
    collectionRate: 27,
    dueLabel: 'Installment due tomorrow',
    accent: '#FF7A59',
    note: 'Emergency working-capital line. Keep payment cadence visible and tighter.',
    tags: ['High touch', 'Watchlist'],
    city: 'Mumbai',
    apr: '14.2%',
    schedule: 'Bi-weekly',
    trustScore: 64,
    timeline: [
      { id: 'r1', title: 'Borrowed', subtitle: 'Received from Rohan • Axis Reserve', amount: 180000, kind: 'origin', date: 'Apr 01' },
      { id: 'r2', title: 'Payment', subtitle: 'Installment 1', amount: 24000, kind: 'payment', date: 'Apr 08' },
      { id: 'r3', title: 'Payment', subtitle: 'Installment 2', amount: 24000, kind: 'payment', date: 'Apr 21' },
      { id: 'r4', title: 'Note', subtitle: 'Requested 4-day buffer for next cycle', amount: 0, kind: 'note', date: 'Apr 26' },
    ],
  },
  {
    id: 'anika',
    personName: 'Anika K.',
    direction: 'lent',
    status: 'closed',
    accountName: 'ICICI Coral',
    principal: 90000,
    pending: 0,
    settled: 90000,
    collectionRate: 100,
    dueLabel: 'Closed last week',
    accent: '#0FB9A8',
    note: 'Fully settled. Keeping this around as a polished closed-state reference.',
    tags: ['Closed', 'Clean'],
    city: 'Pune',
    apr: '9.5%',
    schedule: 'One-time',
    trustScore: 98,
    timeline: [
      { id: 'a1', title: 'Origin transfer', subtitle: 'Sent to Anika • ICICI Coral', amount: 90000, kind: 'origin', date: 'Mar 14' },
      { id: 'a2', title: 'Receipt', subtitle: 'Full settlement', amount: 90000, kind: 'payment', date: 'Apr 22' },
    ],
  },
];

export function useLoanPrototypeFonts() {
  return useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
}

export function formatPrototypeMoney(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

export function getPrototypeLoan(id?: string | string[]) {
  if (!id) return prototypeLoans[0];
  const match = prototypeLoans.find((loan) => loan.id === id);
  return match ?? prototypeLoans[0];
}

export function getDirectionCopy(direction: PrototypeLoanDirection) {
  return direction === 'lent'
    ? { noun: 'You lent', action: 'Record receipt', amountTone: loanPrototypeTheme.accent }
    : { noun: 'You borrowed', action: 'Record payment', amountTone: loanPrototypeTheme.coral };
}

export function getStatusLabel(status: PrototypeLoanStatus) {
  if (status === 'watch') return 'Watch';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getStatusTone(status: PrototypeLoanStatus) {
  if (status === 'closed') return { bg: '#EAF8F2', fg: loanPrototypeTheme.success };
  if (status === 'watch') return { bg: '#FFF1E8', fg: '#E46A43' };
  return { bg: loanPrototypeTheme.accentSoft, fg: loanPrototypeTheme.accent };
}

export function getPortfolioMetrics() {
  const openLoans = prototypeLoans.filter((loan) => loan.status !== 'closed');
  const receivables = openLoans
    .filter((loan) => loan.direction === 'lent')
    .reduce((sum, loan) => sum + loan.pending, 0);
  const payables = openLoans
    .filter((loan) => loan.direction === 'borrowed')
    .reduce((sum, loan) => sum + loan.pending, 0);
  const deployed = openLoans.reduce((sum, loan) => sum + loan.principal, 0);
  return { receivables, payables, deployed };
}

