// Design tokens for settings screens (consumed by components/settings-ui.tsx).
// Main-app screens (Home, Activity, Budgets, Loans, modals) use lib/homeTokens.ts instead.
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const SCREEN_GUTTER = SPACING.lg - 6;
export const SHEET_GUTTER = SPACING.lg + 2;

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

export const TYPE = {
  title: 28,
  section: 11,
  rowLabel: 16,
  rowValue: 14,
  body: 13,
  caption: 12,
} as const;

export const BORDER = {
  width: 1,
} as const;
