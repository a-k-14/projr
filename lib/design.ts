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

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

export const HOME_TEXT = {
  screenTitle: 28,
  heroLabel: 16,
  heroValue: 22,
  rowLabel: 16,
  sectionTitle: 15,
  body: 14,
  bodySmall: 13,
  caption: 12,
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
