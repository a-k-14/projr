export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const SCREEN_GUTTER = 10;
export const SHEET_GUTTER = 18;
export const CARD_PADDING = 16;

// ─── Master card radius — change this one value to restyle the whole app ──────
export const APP_CARD_RADIUS = 16;

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

export const HOME_TEXT = {
  screenTitle: 28,
  subhead: 18,
  heroLabel: 16,
  heroValue: 22,
  heroCardValue: 24,
  rowLabel: 16,
  sectionTitle: 15,
  bodyLarge: 14.5,
  body: 14,
  cardContent: 13.5,
  bodySmall: 13,
  metaSmall: 12.5,
  caption: 12,
  metaTiny: 11.5,
  label: 11,
  tiny: 10,
  tab: 15,
} as const;

export const TYPE = {
  title: HOME_TEXT.screenTitle,
  section: HOME_TEXT.sectionTitle,
  rowLabel: HOME_TEXT.rowLabel,
  rowValue: HOME_TEXT.body,
  body: HOME_TEXT.bodySmall,
  caption: HOME_TEXT.caption,
} as const;

export const BORDER = {
  width: 1,
} as const;

export const FONT_WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
  black: '900',
} as const;
