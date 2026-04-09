import { SCREEN_GUTTER } from './design';

// ─── Colour tokens ────────────────────────────────────────────────────────────
// Used by main-app screens (Home, Activity, Budgets, Loans, modals).
// Settings screens use AppThemePalette from lib/theme.ts instead.
export const HOME_COLORS = {
  background: '#F0F0F5',
  surface: '#FFFFFF',
  surfaceRaised: '#202845',
  text: '#1F2A44',
  textMuted: '#8C94AF',
  textSoft: '#9CA3AF',
  textSecondary: '#6B7280',
  divider: '#E5E7EB',
  borderSoft: '#D8DDE8',
  active: '#17673B',
  inactive: '#B2B8C2',
  positive: '#16A34A',
  // Keep in sync with tailwind.config.js expense & ActionButton danger in settings-ui.tsx
  negative: '#DC2626',
  neutral: '#0A0A0A',
  chartBar: '#17673B',
  chartBarMuted: '#D9DDE7',
  heroBar: '#202845',
  todayDot: '#1F2A44',
  // Loan accent
  loan: '#B45309',
  // Transaction-type icon backgrounds
  inBg: '#DCFCE7',
  outBg: '#FEE2E2',
  transferBg: '#F1F5F9',
  loanBg: '#FEF3C7',
  // Transfer foreground (dark slate, not green/red)
  transferText: '#1E293B',
  // Inner picker / input backgrounds
  inputBg: '#F3F4F6',
} as const;

// ─── Transaction-type config (single source of truth) ─────────────────────────
// Import this everywhere instead of repeating inline.
export const TX_TYPE_CONFIG: Record<
  'in' | 'out' | 'transfer' | 'loan',
  { label: string; color: string; bg: string; borderColor: string; iconName: string }
> = {
  in: {
    label: 'In',
    color: HOME_COLORS.positive,
    bg: HOME_COLORS.inBg,
    borderColor: HOME_COLORS.positive,
    iconName: 'arrow-down',
  },
  out: {
    label: 'Out',
    color: HOME_COLORS.negative,
    bg: HOME_COLORS.outBg,
    borderColor: HOME_COLORS.negative,
    iconName: 'arrow-up',
  },
  transfer: {
    label: 'Transfer',
    color: HOME_COLORS.transferText,
    bg: HOME_COLORS.transferBg,
    borderColor: HOME_COLORS.transferText,
    iconName: 'swap-horizontal',
  },
  loan: {
    label: 'Loan',
    color: HOME_COLORS.loan,
    bg: HOME_COLORS.loanBg,
    borderColor: HOME_COLORS.loan,
    iconName: 'cash',
  },
};

// ─── Border-radius tokens ──────────────────────────────────────────────────────
export const HOME_RADIUS = {
  card: 16,
  pill: 14,
  tab: 14,
  fab: 28,
  chartBar: 6,
  small: 10,
  large: 24,
  xl: 28,
  full: 999,
} as const;

// ─── Spacing tokens ────────────────────────────────────────────────────────────
// Note: xs/sm/md match SPACING in design.ts. lg/xl differ intentionally —
// home screens use tighter spacing (lg=14) than settings screens (SPACING.lg=16).
export const HOME_SPACE = {
  screen: SCREEN_GUTTER,
  xs: 4,   // == SPACING.xs
  sm: 8,   // == SPACING.sm
  md: 12,  // == SPACING.md
  lg: 14,  // home-specific tight spacing (settings uses SPACING.lg = 16)
  xl: 16,
  xxl: 18,
  xxxl: 20,
  sectionGap: 14,
  cardGap: 18,
  pageBottom: 32,
} as const;

// ─── Typography tokens ─────────────────────────────────────────────────────────
export const HOME_TEXT = {
  screenTitle: 28,
  heroLabel: 16,
  heroValue: 22,
  sectionTitle: 15,
  body: 14,
  bodySmall: 13,
  caption: 12,
  tiny: 10,
  tab: 15,
} as const;

// ─── Layout tokens ─────────────────────────────────────────────────────────────
export const HOME_LAYOUT = {
  tabMinWidth: 54,
  tabMaxWidth: 118,
  tabGap: 8,
  tabHeight: 52,
  periodHeight: 36,
  periodButtonWidth: 48,
  chartHeight: 116,
  chartBarHeight: 74,
  fabSize: 56,
  handleWidth: 42,
  handleHeight: 4,
} as const;

// ─── Shadow preset ─────────────────────────────────────────────────────────────
// Spread this into a style object: { ...HOME_SHADOW.card }
export const HOME_SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.18 as number,
    shadowRadius: 10,
    elevation: 6,
  },
} as const;

// ─── Shared page size ─────────────────────────────────────────────────────────
// Used by useTransactionsStore and activity.tsx so both stay in sync.
export const TRANSACTIONS_PAGE_SIZE = 50;
