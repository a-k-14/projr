import { CARD_PADDING, SCREEN_GUTTER, SHEET_GUTTER, SPACING } from './design';

// ─── Colour tokens ────────────────────────────────────────────────────────────
// Previously HOME_COLORS. Now unified into AppThemePalette in lib/theme.ts.

// ─── Transaction-type config (single source of truth) ─────────────────────────
import { AppThemePalette } from './theme';

export function getTxTypeConfig(palette: AppThemePalette): Record<
  'in' | 'out' | 'transfer' | 'loan',
  { label: string; color: string; bg: string; borderColor: string; iconName: string }
> {
  return {
    in: {
      label: 'In',
      color: palette.positive,
      bg: palette.inBg,
      borderColor: palette.positive,
      iconName: 'arrow-down',
    },
    out: {
      label: 'Out',
      color: palette.negative,
      bg: palette.outBg,
      borderColor: palette.negative,
      iconName: 'arrow-up',
    },
    transfer: {
      label: 'Transfer',
      color: palette.transferText,
      bg: palette.transferBg,
      borderColor: palette.transferText,
      iconName: 'swap-horizontal',
    },
    loan: {
      label: 'Loan',
      color: palette.loan,
      bg: palette.loanBg,
      borderColor: palette.loan,
      iconName: 'cash',
    },
  };
}

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

// ─── Home surface tokens ─────────────────────────────────────────────────────
export const HOME_SURFACE = {
  cardPaddingX: CARD_PADDING,
  cardPaddingY: 14,
  cardPaddingBottom: 10,
  cardGap: SPACING.md,
  sectionGap: SPACING.sm,
  heroTop: 14,
  heroBottom: 2,
  heroDividerTop: 18,
  heroDividerBottom: 14,
  summaryColumnPaddingX: 8,
  summaryColumnPaddingY: 16,
  summaryCardBottom: 16,
  recentCardBottom: 24,
  chartCardBottom: 14,
  listMaxHeight: 260,
  tableMaxHeight: 310,
} as const;

// ─── Spacing tokens ────────────────────────────────────────────────────────────
export const HOME_SPACE = {
  screen: SCREEN_GUTTER,
  sheet: SHEET_GUTTER,
  xs: SPACING.xs,
  sm: SPACING.sm,
  md: SPACING.md,
  lg: SPACING.lg,
  xl: SPACING.xl,
  xxl: SPACING.xxl,
  xxxl: SPACING.xxl + 4, // 28
  sectionGap: SPACING.md,
  cardGap: SPACING.md,
  pageBottom: HOME_SURFACE.recentCardBottom,
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
  tabHeight: 48,
  tabItemPaddingX: 8,
  tabItemPaddingY: 10,
  tabUnderlineHeight: 2,
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
