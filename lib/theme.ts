import { ColorSchemeName } from 'react-native';
import type { Theme } from '../types';

export type AppThemeMode = 'light' | 'dark';

const BRAND_LIGHT = '#1E293B';
const BRAND_DARK = '#CBD5E1';

// Yesterday's Emerald/Crimson for UI elements
const POSITIVE_LIGHT = '#047857';
const POSITIVE_DARK = '#34D399';
const NEGATIVE_LIGHT = '#B32020';
const NEGATIVE_DARK = '#FCA5A5';

// Current Teal/Rose for numbers only
const NUMBER_POSITIVE_LIGHT = '#0D9488';
const NUMBER_POSITIVE_DARK = '#2DD4BF';
const NUMBER_NEGATIVE_LIGHT = '#C4607A';
const NUMBER_NEGATIVE_DARK = '#EE90A5';
const WHITE = '#FFFFFF';
const ON_DARK_ACCENT = '#07100B';
const ON_BUDGET = '#111827';
const BUDGET_LIGHT = '#1E293B';
const BUDGET_DARK = '#E2E8F0';
const TRANSFER_TEXT_LIGHT = '#1E293B';
const TRANSFER_TEXT_DARK = '#AAB3C2';
const INPUT_BG_LIGHT = '#FFFFFF';
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
const SURFACE_RAISED_DARK = '#25252A';
const TEXT_SECONDARY_LIGHT = '#6B7280';
const BORDER_SOFT_LIGHT = '#DFE4ED';
const BORDER_SOFT_DARK = '#1E2330';
const INACTIVE_LIGHT = '#B2B8C2';
const INACTIVE_DARK = '#555555';
const CHART_BAR_MUTED_LIGHT = '#D9DDE7';
const CHART_BAR_MUTED_DARK = '#34343A';
const HERO_BAR_LIGHT = '#202845';
const HERO_BAR_DARK = '#4A5563';
const TODAY_DOT_LIGHT = '#1F2A44';
const TODAY_DOT_DARK = '#D5DAE2';

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
export const APP_LIGHT_BACKGROUND = '#F5F7FB';
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
  uiPositive: string;
  uiNegative: string;
  numberPositive: string;
  numberNegative: string;
  warning: string;
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
  stripBg: string;
}

export function resolveTheme(theme: Theme, systemScheme: ColorSchemeName): AppThemeMode {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function getThemePalette(mode: AppThemeMode): AppThemePalette {
  if (mode === 'dark') {
    const budgetSoft = tint(BUDGET_DARK, 0.1, 0.14, mode);
    const budgetBg = tint(BUDGET_DARK, 0.06, 0.1, mode);

    return {
      isDark: true,
      background: APP_DARK_BACKGROUND,
      surface: '#0C1018',
      card: '#0C1018',
      border: '#1A1E28',
      divider: '#161A22',
      text: '#D8DDE5',
      listText: '#C9D0DA',
      textMuted: '#98A0AD',
      textSoft: '#66707D',
      brand: BRAND_DARK,
      onBrand: ON_DARK_ACCENT,
      positive: POSITIVE_DARK,
      active: BRAND_DARK,
      tabActive: BRAND_DARK,
      chartBar: POSITIVE_DARK,
      negative: NEGATIVE_DARK,
      uiPositive: POSITIVE_DARK,
      uiNegative: NEGATIVE_DARK,
      numberPositive: NUMBER_POSITIVE_DARK,
      numberNegative: NUMBER_NEGATIVE_DARK,
      warning: '#F2B84B',
      brandSoft: tint(BRAND_DARK, 0.1, 0.14, mode),
      loan: '#8CB0C5',
      loanSoft: 'rgba(140, 176, 197, 0.15)',
      onLoan: ON_BUDGET,
      budget: BUDGET_DARK,
      budgetSoft,
      onBudget: ON_BUDGET,
      tabInactive: TAB_INACTIVE_DARK,
      iconTint: ICON_TINT_DARK,
      statusBarStyle: 'light',
      navigationButtonStyle: 'light',
      surfaceRaised: SURFACE_RAISED_DARK,
      textSecondary: '#A6ADB8',
      borderSoft: BORDER_SOFT_DARK,
      inactive: INACTIVE_DARK,
      neutral: '#D8DDE5',
      chartBarMuted: CHART_BAR_MUTED_DARK,
      heroBar: HERO_BAR_DARK,
      todayDot: TODAY_DOT_DARK,
      inBg: tint(POSITIVE_DARK, 0.06, 0.1, mode),
      outBg: tint(NEGATIVE_DARK, 0.06, 0.1, mode),
      transferBg: tint(TRANSFER_TEXT_DARK, 0.06, 0.1, mode),
      loanBg: 'rgba(140, 176, 197, 0.1)',
      budgetBg,
      transferText: '#F1F5F9',
      inputBg: INPUT_BG_DARK,
      scrim: SCRIM,
      scrimHeavy: SCRIM_HEAVY,
      pressedBg: PRESSED_BG_DARK,
      stripBg: '#070A12',
    };
  }

  return {
    isDark: false,
    background: '#EEF1F7',
    surface: '#F8FAFD',
    card: '#F8FAFD',
    border: '#E2E6EE',
    divider: '#E8EBF0',
    text: '#1F2A44',
    listText: '#344054',
    textMuted: '#8C94AF',
    textSoft: '#C8CDD9',
    brand: BRAND_LIGHT,
    onBrand: WHITE,
    positive: POSITIVE_LIGHT,
    active: BRAND_LIGHT,
    tabActive: BRAND_LIGHT,
    chartBar: POSITIVE_LIGHT,
    negative: NEGATIVE_LIGHT,
    uiPositive: POSITIVE_LIGHT,
    uiNegative: NEGATIVE_LIGHT,
    numberPositive: NUMBER_POSITIVE_LIGHT,
    numberNegative: NUMBER_NEGATIVE_LIGHT,
    warning: '#B45309',
    brandSoft: tint(BRAND_LIGHT, 0.12, 0.18, mode),
    loan: '#4F6B7A',
    loanSoft: '#E8F0F3',
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
    inBg: tint(POSITIVE_LIGHT, 0.08, 0.16, mode),
    outBg: tint(NEGATIVE_LIGHT, 0.08, 0.16, mode),
    transferBg: tint(TRANSFER_TEXT_LIGHT, 0.08, 0.14, mode),
    loanBg: '#E8F0F3',
    budgetBg: tint(BUDGET_LIGHT, 0.08, 0.16, mode),
    transferText: '#334155',
    inputBg: INPUT_BG_LIGHT,
    scrim: SCRIM,
    scrimHeavy: SCRIM_HEAVY,
    pressedBg: PRESSED_BG_LIGHT,
    stripBg: '#E5E8F0',
  };
}

/**
 * A critical render-scope optimization wrapper.
 * By globally memoizing the generated palette structure per mode string, 
 * this perfectly stable object reference guarantees `React.memo` survival 
 * preventing massive catastrophic DOM cascade teardowns across the application.
 */
import { useMemo } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import { useUIStore } from '../stores/useUIStore';

export function useAppTheme(): { mode: AppThemeMode; palette: AppThemePalette } {
  const theme = useUIStore((state) => state.settings.theme);
  const systemScheme = useColorScheme() || Appearance.getColorScheme();
  const mode = resolveTheme(theme, systemScheme);

  const palette = useMemo(() => getThemePalette(mode), [mode]);

  return { mode, palette };
}


