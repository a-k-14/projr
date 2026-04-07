import { SCREEN_GUTTER } from './design';

export const HOME_COLORS = {
  background: '#F0F0F5',
  surface: '#FFFFFF',
  surfaceRaised: '#202845',
  text: '#1F2A44',
  textMuted: '#8C94AF',
  textSoft: '#9CA3AF',
  divider: '#E5E7EB',
  borderSoft: '#D8DDE8',
  active: '#17673B',
  inactive: '#B2B8C2',
  positive: '#16A34A',
  negative: '#CC3B2D',
  neutral: '#0A0A0A',
  chartBar: '#17673B',
  chartBarMuted: '#D9DDE7',
  heroBar: '#202845',
  todayDot: '#1F2A44',
} as const;

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

export const HOME_SPACE = {
  screen: SCREEN_GUTTER,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 18,
  xxxl: 20,
  sectionGap: 14,
  cardGap: 18,
  pageBottom: 32,
} as const;

export const HOME_TEXT = {
  heroLabel: 16,
  heroValue: 24,
  sectionTitle: 15,
  body: 14,
  bodySmall: 13,
  caption: 12,
  tiny: 10,
  tab: 15,
} as const;

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
