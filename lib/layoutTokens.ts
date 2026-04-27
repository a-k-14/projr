import { CARD_PADDING, RADIUS as DESIGN_RADIUS, HOME_TEXT, SCREEN_GUTTER, SHEET_GUTTER, SPACING } from './design';

export { CARD_PADDING, HOME_TEXT, SCREEN_GUTTER, SHEET_GUTTER, SPACING };

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
      iconName: 'arrow-right-left',
    },
    loan: {
      label: 'Loan',
      color: palette.loan,
      bg: palette.loanBg,
      borderColor: palette.loan,
      iconName: 'credit-card',
    },
  };
}

// ─── Border-radius tokens ──────────────────────────────────────────────────────
export const HOME_RADIUS = {
  card: DESIGN_RADIUS.md,
  pill: DESIGN_RADIUS.md - 2,
  tab: DESIGN_RADIUS.md - 2,
  fab: DESIGN_RADIUS.xl + 4,
  chartBar: 6,
  small: DESIGN_RADIUS.sm - 2,
  large: DESIGN_RADIUS.xl,
  xl: DESIGN_RADIUS.xl + 4,
  full: 999,
} as const;

// ─── Home surface tokens ─────────────────────────────────────────────────────
export const HOME_SURFACE = {
  cardPaddingX: CARD_PADDING,
  cardPaddingY: 18,
  cardPaddingBottom: 10,
  cardGap: SPACING.md,
  sectionGap: SPACING.sm,
  heroTop: 4,
  heroBottom: 0,
  heroDividerTop: 10,
  heroDividerBottom: 8,
  summaryColumnPaddingX: 8,
  summaryColumnPaddingY: 10,
  summaryCardBottom: 16,
  chartCardBottom: 14,
  panelHeaderGap: 14,
  panelSubheaderGap: 4,
  tableHeaderPaddingBottom: 10,
  tableRowHeight: 52,
  tableColumnGap: 12,
  chartTopGap: 14,
  chartBottomGap: 10,
  listMaxHeight: 400,
  tableMaxHeight: 310,
} as const;

// ─── Card row tokens ─────────────────────────────────────────────────────────────
export const CARD_TEXT = {
  line1: 13.5,
  line2: 13.5,
  tertiary: 12.5,
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
  pageBottom: SPACING.lg,
} as const;

// ─── Layout tokens ─────────────────────────────────────────────────────────────
export const HOME_LAYOUT = {
  tabMinWidth: 52,
  tabMaxWidth: 118,
  tabGap: 8,
  tabHeight: 48,
  tabItemPaddingX: 8,
  tabItemPaddingY: 10,
  tabUnderlineHeight: 2.5,
  tabWidthBase: 30,
  tabWidthPerChar: 8.5,
  listRowPaddingX: 12,
  listRowPaddingY: 16,
  listIconSize: 40,
  periodHeight: 36,
  periodButtonWidth: 48,
  chartHeight: 116,
  chartBarHeight: 74,
  fabSize: 56,
  fabRightOffset: 20,
  fabBottomOffset: -24,
  fabContentBottomPadding: 20,
  handleWidth: 42,
  handleHeight: 4,
} as const;

export const BUTTON_TOKENS = {
  filled: {
    height: 48,
    radius: 22,
    labelSize: HOME_TEXT.sectionTitle,
    labelWeight: '400' as const,
  },
  text: {
    labelWeight: '600' as const,
    labelSize: HOME_TEXT.sectionTitle,
    compactLabelSize: HOME_TEXT.body,
    compactLabelWeight: '600' as const,
  },
} as const;

export const PRIMARY_ACTION = BUTTON_TOKENS.filled;

export const SCREEN_HEADER = {
  titleSize: 18,
  titleWeight: '500' as const,
  iconTitleGap: HOME_SPACE.md,
} as const;

export const ACTIVITY_LAYOUT = {
  headerPaddingX: SCREEN_GUTTER,
  headerPaddingTop: 4,
  headerPaddingBottom: 10,
  headerRowGap: 8,
  controlRadius: 22,
  controlRowGap: 6,
  controlHeight: 40,
  controlChipPaddingX: 14,
  controlChipPaddingY: 7,
  controlChipGap: 6,
  chipRadius: 22,
  accountChipMinWidth: 92,
  accountChipMaxWidth: 148,
  accountChipHeight: 38,
  accountChipGap: 8,
  accountChipHorizontalPadding: 13,
  accountChipScrollPaddingRight: 4,
  accountPickerWidth: '37%',
  filterChipHeight: 38,
  filterChipHorizontalPadding: 12,
  filterChipVerticalPadding: 7,
  filterChipGap: 6,
  moreButtonGap: 8,
  periodArrowWidth: 36,
  summaryPaddingTop: 6,
  summaryPaddingBottom: 14,
  groupHeaderPaddingX: 12,
  groupHeaderBottom: 8,
  groupCardMarginBottom: 16,
  groupCardRadius: HOME_RADIUS.card,
  listBottomPadding: 80,
  periodSheetBottomOffset: -12,
} as const;

export const PROGRESS_LAYOUT = {
  cardHeight: 4,
  heroHeight: 4,
  radius: 2,
} as const;

export const getFabBottomOffset = (insetsBottom: number) =>
  insetsBottom + HOME_LAYOUT.fabBottomOffset;

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

export const RADIUS = HOME_RADIUS;
export const SURFACE = HOME_SURFACE;
export const SPACE = HOME_SPACE;
export const TEXT = HOME_TEXT;
export const LAYOUT = HOME_LAYOUT;
export const SHADOW = HOME_SHADOW;
export const PROGRESS = PROGRESS_LAYOUT;

// ─── Shared page size ─────────────────────────────────────────────────────────
// Used by useTransactionsStore and activity.tsx so both stay in sync.
export const TRANSACTIONS_PAGE_SIZE = 50;
