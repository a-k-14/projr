import { ColorSchemeName } from 'react-native';
import type { Theme } from '../types';

export type AppThemeMode = 'light' | 'dark';

const BRAND_LIGHT = '#17673B';
const BRAND_DARK = '#5FA878';
const NEGATIVE_LIGHT = '#8A2424';
const NEGATIVE_DARK = '#C8655F';
const WHITE = '#FFFFFF';
const ON_DARK_ACCENT = '#07100B';
const ON_BUDGET = '#111827';
const BUDGET_LIGHT = '#1E293B';
const BUDGET_DARK = '#E2E8F0';
const TRANSFER_TEXT_LIGHT = '#1E293B';
const TRANSFER_TEXT_DARK = '#AAB3C2';
const INPUT_BG_LIGHT = '#F3F4F6';
const INPUT_BG_DARK = '#222224';
const SCRIM = 'rgba(0, 0, 0, 0.4)';
const SCRIM_HEAVY = 'rgba(0, 0, 0, 0.55)';
const PRESSED_BG_LIGHT = 'rgba(0, 0, 0, 0.04)';
const PRESSED_BG_DARK = 'rgba(255, 255, 255, 0.06)';
const TAB_INACTIVE_LIGHT = '#8C94AF';
const TAB_INACTIVE_DARK = '#555555';
const ICON_TINT_LIGHT = '#8C94AF';
const ICON_TINT_DARK = '#8E8E93';
const SURFACE_RAISED_LIGHT = '#202845';
const SURFACE_RAISED_DARK = '#202024';
const TEXT_SECONDARY_LIGHT = '#6B7280';
const TEXT_SECONDARY_DARK = '#A1A1A6';
const BORDER_SOFT_LIGHT = '#D8DDE8';
const BORDER_SOFT_DARK = '#303033';
const INACTIVE_LIGHT = '#B2B8C2';
const INACTIVE_DARK = '#555555';
const CHART_BAR_MUTED_LIGHT = '#D9DDE7';
const CHART_BAR_MUTED_DARK = '#2F2F31';
const HERO_BAR_LIGHT = '#202845';
const HERO_BAR_DARK = '#202020';
const TODAY_DOT_LIGHT = '#1F2A44';
const TODAY_DOT_DARK = '#F5F5F7';

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;
  const int = Number.parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tint(hex: string, lightAlpha: number, darkAlpha: number, mode: AppThemeMode) {
  return rgba(hex, mode === 'dark' ? darkAlpha : lightAlpha);
}

export const APP_BRAND = BRAND_LIGHT;
export const APP_LIGHT_BACKGROUND = '#F0F0F5';
export const APP_DARK_BACKGROUND = '#000000';

export interface AppThemePalette {
  isDark: boolean;
  background: string;
  surface: string;
  card: string;
  border: string;
  divider: string;
  text: string;
  listText: string;
  textMuted: string;
  textSoft: string;
  tabActive: string;
  tabInactive: string;
  iconTint: string;
  statusBarStyle: 'light' | 'dark';
  positive: string;
  negative: string;
  navigationButtonStyle: 'light' | 'dark';
  surfaceRaised: string;
  textSecondary: string;
  borderSoft: string;
  active: string;
  inactive: string;
  neutral: string;
  chartBar: string;
  chartBarMuted: string;
  heroBar: string;
  todayDot: string;
  brand: string;
  brandSoft: string;
  onBrand: string;
  loan: string;
  loanSoft: string;
  onLoan: string;
  budget: string;
  budgetSoft: string;
  onBudget: string;
  inBg: string;
  outBg: string;
  transferBg: string;
  loanBg: string;
  budgetBg: string;
  transferText: string;
  inputBg: string;
  scrim: string;
  scrimHeavy: string;
  pressedBg: string;
}

export function resolveTheme(theme: Theme, systemScheme: ColorSchemeName): AppThemeMode {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function getThemePalette(mode: AppThemeMode): AppThemePalette {
  if (mode === 'dark') {
    const budgetSoft = tint(BUDGET_DARK, 0.12, 0.2, mode);
    const budgetBg = tint(BUDGET_DARK, 0.08, 0.16, mode);

    return {
      isDark: true,
      background: APP_DARK_BACKGROUND,
      surface: '#121214',
      card: '#18181A',
      border: '#232327',
      divider: '#1F1F23',
      text: '#E8EAEE',
      listText: '#D5DAE2',
      textMuted: '#9AA3B2',
      textSoft: '#667085',
      brand: BRAND_DARK,
      onBrand: ON_DARK_ACCENT,
      positive: BRAND_DARK,
      active: BRAND_DARK,
      tabActive: BRAND_DARK,
      chartBar: BRAND_DARK,
      negative: NEGATIVE_DARK,
      brandSoft: tint(BRAND_DARK, 0.12, 0.2, mode),
      loan: BUDGET_DARK,
      loanSoft: budgetSoft,
      onLoan: ON_BUDGET,
      budget: BUDGET_DARK,
      budgetSoft,
      onBudget: ON_BUDGET,
      tabInactive: TAB_INACTIVE_DARK,
      iconTint: ICON_TINT_DARK,
      statusBarStyle: 'light',
      navigationButtonStyle: 'light',
      surfaceRaised: SURFACE_RAISED_DARK,
      textSecondary: TEXT_SECONDARY_DARK,
      borderSoft: BORDER_SOFT_DARK,
      inactive: INACTIVE_DARK,
      neutral: '#E8EAEE',
      chartBarMuted: CHART_BAR_MUTED_DARK,
      heroBar: HERO_BAR_DARK,
      todayDot: TODAY_DOT_DARK,
      inBg: tint(BRAND_DARK, 0.08, 0.16, mode),
      outBg: tint(NEGATIVE_DARK, 0.08, 0.16, mode),
      transferBg: tint(TRANSFER_TEXT_DARK, 0.08, 0.14, mode),
      loanBg: budgetBg,
      budgetBg,
      transferText: TRANSFER_TEXT_DARK,
      inputBg: INPUT_BG_DARK,
      scrim: SCRIM,
      scrimHeavy: SCRIM_HEAVY,
      pressedBg: PRESSED_BG_DARK,
    };
  }

  return {
    isDark: false,
    background: '#F0F0F5',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E5E7EB',
    divider: '#E5E7EB',
    text: '#1F2A44',
    listText: '#344054',
    textMuted: '#8C94AF',
    textSoft: '#C8CDD9',
    brand: BRAND_LIGHT,
    onBrand: WHITE,
    positive: BRAND_LIGHT,
    active: BRAND_LIGHT,
    tabActive: BRAND_LIGHT,
    chartBar: BRAND_LIGHT,
    negative: NEGATIVE_LIGHT,
    brandSoft: tint(BRAND_LIGHT, 0.12, 0.18, mode),
    loan: BUDGET_LIGHT,
    loanSoft: tint(BUDGET_LIGHT, 0.12, 0.18, mode),
    onLoan: WHITE,
    budget: BUDGET_LIGHT,
    budgetSoft: tint(BUDGET_LIGHT, 0.12, 0.18, mode),
    onBudget: WHITE,
    tabInactive: TAB_INACTIVE_LIGHT,
    iconTint: ICON_TINT_LIGHT,
    statusBarStyle: 'dark',
    navigationButtonStyle: 'dark',
    surfaceRaised: SURFACE_RAISED_LIGHT,
    textSecondary: TEXT_SECONDARY_LIGHT,
    borderSoft: BORDER_SOFT_LIGHT,
    inactive: INACTIVE_LIGHT,
    neutral: '#0A0A0A',
    chartBarMuted: CHART_BAR_MUTED_LIGHT,
    heroBar: HERO_BAR_LIGHT,
    todayDot: TODAY_DOT_LIGHT,
    inBg: tint(BRAND_LIGHT, 0.08, 0.16, mode),
    outBg: tint(NEGATIVE_LIGHT, 0.08, 0.16, mode),
    transferBg: tint(TRANSFER_TEXT_LIGHT, 0.08, 0.14, mode),
    loanBg: tint(BUDGET_LIGHT, 0.08, 0.16, mode),
    budgetBg: tint(BUDGET_LIGHT, 0.08, 0.16, mode),
    transferText: TRANSFER_TEXT_LIGHT,
    inputBg: INPUT_BG_LIGHT,
    scrim: SCRIM,
    scrimHeavy: SCRIM_HEAVY,
    pressedBg: PRESSED_BG_LIGHT,
  };
}

/**
 * A critical render-scope optimization wrapper.
 * By globally memoizing the generated palette structure per mode string, 
 * this perfectly stable object reference guarantees `React.memo` survival 
 * preventing massive catastrophic DOM cascade teardowns across the application.
 */
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useUIStore } from '../stores/useUIStore';

export function useAppTheme(): { mode: AppThemeMode; palette: AppThemePalette } {
  const theme = useUIStore((state) => state.settings.theme);
  const systemScheme = useColorScheme();
  const mode = resolveTheme(theme, systemScheme);

  const palette = useMemo(() => getThemePalette(mode), [mode]);

  return { mode, palette };
}
