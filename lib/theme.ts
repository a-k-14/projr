import { ColorSchemeName } from 'react-native';
import type { Theme } from '../types';
import { CATEGORY_COLORS } from './categoryColors';
import { ASSET_BG, ASSET_TONE } from './assetVisuals';

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

const CHART_INCOME_LIGHT = '#0D9488';
const CHART_INCOME_DARK = '#2DD4BF';
const CHART_EXPENSE_LIGHT = '#F87171';
const CHART_EXPENSE_DARK = '#FF6B6B';

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

export interface ElevationStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

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
  chartIncome: string;
  chartExpense: string;

  // New Structured namespaces
  layers: {
    background: string;
    surface: string;
    surfaceRaised: string;
    surfaceOverlay: string;
    surfaceHero: string;
    surfaceSunken: string;
    chartWell: string;
    insightsInputBg: string;
  };
  ink: {
    text: string;
    textSecondary: string;
    textMuted: string;
    textSoft: string;
    onAccent: string;
    onHero: string;
    onHeroMuted: string;
    onHeroSoft: string;
    listText: string;
  };
  lines: {
    border: string;
    borderSoft: string;
    borderStrong: string;
    divider: string;
    cardBorder: string;
    chartBorder: string;
  };
  states: {
    hoverBg: string;
    selectedBg: string;
    focusRing: string;
    scrim: string;
    scrimHeavy: string;
    pressedBg: string;
    todayDot: string;
    active: string;
    inactive: string;
    tabActive: string;
    tabInactive: string;
    iconTint: string;
    warning: string;
    neutral: string;
    badgePositiveBg: string;
    badgeNegativeBg: string;
    badgeNeutralBg: string;
    tabFabBg: string;
    tabFabIcon: string;
    tagBgOpacity: number;
    tagBorderOpacity: number;
    switchTrackOff: string;
    switchThumb: string;
    interactiveChipBg: string;
    securityOverlay: string;
    segmentedBg: string;
    segmentedPill: string;
    segmentedBorder: string;
    activitySegmentedBg: string;
    progressTrack: string;
    cardShadow: ElevationStyle;
    progressBarTrackBg: string;
    rowSubtleBg: string;
    calcBorder: string;
    calcPressOverlay: string;
    grainMetricBg: string;
    tabShadow: ElevationStyle;
    cardSoftShadow: ElevationStyle;
  };
  brandFamily: {
    brand: {
      base: string;
      soft: string;
      on: string;
    };
    loan: {
      base: string;
      soft: string;
      on: string;
      bg: string;
    };
    budget: {
      base: string;
      soft: string;
      on: string;
      bg: string;
    };
    transactions: {
      inBg: string;
      outBg: string;
      transferBg: string;
      transferText: string;
    };
    deposits: {
      base: string;
      bg: string;
    };
    assets: {
      base: string;
      bg: string;
    };
  };
  gradients: {
    homeHero: readonly string[] | string[];
    cardGradient: readonly string[] | string[];
    tabShadow: readonly [string, string];
  };
  chart: {
    bar: string;
    barMuted: string;
    income: string;
    expense: string;
  };
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

    const layers = {
      background: APP_DARK_BACKGROUND,
      surface: '#0C1018',
      surfaceRaised: SURFACE_RAISED_DARK,
      surfaceOverlay: '#0C1018',
      surfaceHero: HERO_BAR_DARK,
      surfaceSunken: '#070A12',
      chartWell: '#1F2937',
      insightsInputBg: '#111827',
    };

    const ink = {
      text: '#D8DDE5',
      textSecondary: '#A6ADB8',
      textMuted: '#98A0AD',
      textSoft: '#66707D',
      onAccent: ON_DARK_ACCENT,
      onHero: WHITE,
      onHeroMuted: 'rgba(255, 255, 255, 0.75)',
      onHeroSoft: 'rgba(255, 255, 255, 0.52)',
      listText: '#C9D0DA',
    };

    const lines = {
      border: '#1A1E28',
      borderSoft: BORDER_SOFT_DARK,
      borderStrong: '#2E3547',
      divider: '#161A22',
      cardBorder: 'rgba(255, 255, 255, 0.10)',
      chartBorder: '#374151',
    };

    const states = {
      hoverBg: 'rgba(255,255,255,0.03)',
      selectedBg: 'rgba(255, 255, 255, 0.08)',
      focusRing: BRAND_DARK,
      scrim: SCRIM,
      scrimHeavy: SCRIM_HEAVY,
      pressedBg: PRESSED_BG_DARK,
      todayDot: TODAY_DOT_DARK,
      active: BRAND_DARK,
      inactive: INACTIVE_DARK,
      tabActive: BRAND_DARK,
      tabInactive: TAB_INACTIVE_DARK,
      iconTint: ICON_TINT_DARK,
      warning: '#F2B84B',
      neutral: '#D8DDE5',
      badgePositiveBg: tint(POSITIVE_DARK, 0.06, 0.1, mode),
      badgeNegativeBg: tint(NEGATIVE_DARK, 0.06, 0.1, mode),
      badgeNeutralBg: 'rgba(255,255,255,0.06)',
      tabFabBg: SURFACE_RAISED_DARK,
      tabFabIcon: ink.listText,
      tagBgOpacity: 0.07,
      tagBorderOpacity: 0.15,
      switchTrackOff: 'rgba(255,255,255,0.12)',
      switchThumb: '#F1F5F9',
      interactiveChipBg: 'rgba(255, 255, 255, 0.04)',
      securityOverlay: '#050505',
      segmentedBg: 'rgba(255, 255, 255, 0.08)',
      segmentedPill: '#0C1018',
      segmentedBorder: 'transparent',
      activitySegmentedBg: 'rgba(255, 255, 255, 0.06)',
      progressTrack: '#374151',
      cardShadow: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 6,
      },
      tabShadow: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
        elevation: 12,
      },
      cardSoftShadow: {
        shadowColor: '#94A3B8',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.13,
        shadowRadius: 10,
        elevation: 6,
      },
      progressBarTrackBg: 'rgba(255, 255, 255, 0.10)',
      rowSubtleBg: 'rgba(255, 255, 255, 0.02)',
      calcBorder: 'rgba(255, 255, 255, 0.18)',
      calcPressOverlay: 'rgba(255, 255, 255, 0.1)',
      grainMetricBg: 'rgba(255, 255, 255, 0.05)',
    };

    const brandFamily = {
      brand: {
        base: BRAND_DARK,
        soft: tint(BRAND_DARK, 0.1, 0.14, mode),
        on: ON_DARK_ACCENT,
      },
      loan: {
        base: '#8CB0C5',
        soft: 'rgba(140, 176, 197, 0.15)',
        on: ON_BUDGET,
        bg: 'rgba(140, 176, 197, 0.1)',
      },
      budget: {
        base: BUDGET_DARK,
        soft: budgetSoft,
        on: ON_BUDGET,
        bg: budgetBg,
      },
      transactions: {
        inBg: tint(POSITIVE_DARK, 0.06, 0.1, mode),
        outBg: tint(NEGATIVE_DARK, 0.06, 0.1, mode),
        transferBg: tint(TRANSFER_TEXT_DARK, 0.06, 0.1, mode),
        transferText: '#F1F5F9',
      },
      deposits: {
        base: '#EE90A5',
        bg: 'rgba(238, 144, 165, 0.12)',
      },
      assets: {
        base: '#DCAE70',
        bg: 'rgba(220, 174, 112, 0.12)',
      },
    };

    const gradients = {
      homeHero: ['#16192A', '#1A1E30'] as const,
      cardGradient: ['#0C1018', '#0C1018'] as const,
      tabShadow: ['transparent', 'rgba(0,0,0,0.22)'] as const,
    };

    const chart = {
      bar: POSITIVE_DARK,
      barMuted: CHART_BAR_MUTED_DARK,
      income: CHART_INCOME_DARK,
      expense: CHART_EXPENSE_DARK,
    };

    return {
      isDark: true,

      // Flat Backward-Compatible Mappings
      background: layers.background,
      surface: layers.surface,
      card: layers.surface,
      border: lines.border,
      divider: lines.divider,
      text: ink.text,
      listText: ink.listText,
      textMuted: ink.textMuted,
      textSoft: ink.textSoft,
      brand: brandFamily.brand.base,
      onBrand: brandFamily.brand.on,
      positive: POSITIVE_DARK,
      active: states.active,
      tabActive: states.tabActive,
      chartBar: chart.bar,
      negative: NEGATIVE_DARK,
      uiPositive: POSITIVE_DARK,
      uiNegative: NEGATIVE_DARK,
      numberPositive: NUMBER_POSITIVE_DARK,
      numberNegative: NUMBER_NEGATIVE_DARK,
      warning: states.warning,
      brandSoft: brandFamily.brand.soft,
      loan: brandFamily.loan.base,
      loanSoft: brandFamily.loan.soft,
      onLoan: brandFamily.loan.on,
      budget: brandFamily.budget.base,
      budgetSoft: brandFamily.budget.soft,
      onBudget: brandFamily.budget.on,
      tabInactive: states.tabInactive,
      iconTint: states.iconTint,
      statusBarStyle: 'light',
      navigationButtonStyle: 'light',
      surfaceRaised: layers.surfaceRaised,
      textSecondary: ink.textSecondary,
      borderSoft: lines.borderSoft,
      inactive: states.inactive,
      neutral: states.neutral,
      chartBarMuted: chart.barMuted,
      heroBar: layers.surfaceHero,
      todayDot: states.todayDot,
      inBg: brandFamily.transactions.inBg,
      outBg: brandFamily.transactions.outBg,
      transferBg: brandFamily.transactions.transferBg,
      loanBg: brandFamily.loan.bg,
      budgetBg: brandFamily.budget.bg,
      transferText: brandFamily.transactions.transferText,
      inputBg: INPUT_BG_DARK,
      scrim: states.scrim,
      scrimHeavy: states.scrimHeavy,
      pressedBg: states.pressedBg,
      stripBg: layers.surfaceSunken,
      chartIncome: chart.income,
      chartExpense: chart.expense,

      // Structured Namespaces
      layers,
      ink,
      lines,
      states,
      brandFamily,
      gradients,
      chart,
    };
  }

  // Light Theme Palette
  const layers = {
    background: '#EEF1F7',
    surface: '#F8FAFD',
    surfaceRaised: SURFACE_RAISED_LIGHT,
    surfaceOverlay: '#FFFFFF',
    surfaceHero: HERO_BAR_LIGHT,
    surfaceSunken: '#E5E8F0',
    chartWell: '#E2E8F0',
    insightsInputBg: '#FFFFFF',
  };

  const ink = {
    text: '#1F2A44',
    textSecondary: TEXT_SECONDARY_LIGHT,
    textMuted: '#8C94AF',
    textSoft: '#C8CDD9',
    onAccent: WHITE,
    onHero: '#FFFFFF',
    onHeroMuted: 'rgba(255, 255, 255, 0.75)',
    onHeroSoft: 'rgba(255, 255, 255, 0.52)',
    listText: '#344054',
  };

  const lines = {
    border: '#E2E6EE',
    borderSoft: BORDER_SOFT_LIGHT,
    borderStrong: '#C0CADB',
    divider: '#E8EBF0',
    cardBorder: '#E2E7F0',
    chartBorder: '#CBD5E1',
  };

  const states = {
    hoverBg: 'rgba(0, 0, 0, 0.02)',
    selectedBg: 'rgba(0, 0, 0, 0.04)',
    focusRing: BRAND_LIGHT,
    scrim: SCRIM,
    scrimHeavy: SCRIM_HEAVY,
    pressedBg: PRESSED_BG_LIGHT,
    todayDot: TODAY_DOT_LIGHT,
    active: BRAND_LIGHT,
    inactive: INACTIVE_LIGHT,
    tabActive: BRAND_LIGHT,
    tabInactive: TAB_INACTIVE_LIGHT,
    iconTint: ICON_TINT_LIGHT,
    warning: '#B45309',
    neutral: '#0A0A0A',
    badgePositiveBg: tint(POSITIVE_LIGHT, 0.08, 0.16, mode),
    badgeNegativeBg: tint(NEGATIVE_LIGHT, 0.08, 0.16, mode),
    badgeNeutralBg: 'rgba(0, 0, 0, 0.038)',
    tabFabBg: '#1F2A44',
    tabFabIcon: '#F8FAFD',
    tagBgOpacity: 0.04,
    tagBorderOpacity: 0.09,
    switchTrackOff: lines.divider,
    switchThumb: WHITE,
    interactiveChipBg: layers.background,
    securityOverlay: layers.background,
    segmentedBg: '#EEF2F8',
    segmentedPill: '#FFFFFF',
    segmentedBorder: '#DFE5EF',
    activitySegmentedBg: '#F0F3F9',
    progressTrack: '#DDE4F0',
    cardShadow: {
      shadowColor: '#94A3B8',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.13,
      shadowRadius: 10,
      elevation: 6,
    },
    tabShadow: {
      shadowColor: '#94A3B8',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
    },
    cardSoftShadow: {
      shadowColor: '#94A3B8',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.13,
      shadowRadius: 10,
      elevation: 6,
    },
    progressBarTrackBg: '#E7ECF3',
    rowSubtleBg: 'rgba(0,0,0,0.012)',
    calcBorder: 'rgba(0, 0, 0, 0.13)',
    calcPressOverlay: 'rgba(0, 0, 0, 0.07)',
    grainMetricBg: 'rgba(242, 242, 242, 0.45)',
  };

  const brandFamily = {
    brand: {
      brand: BRAND_LIGHT,
      base: BRAND_LIGHT,
      soft: tint(BRAND_LIGHT, 0.12, 0.18, mode),
      on: WHITE,
    },
    loan: {
      base: '#4F6B7A',
      soft: '#E8F0F3',
      on: WHITE,
      bg: '#E8F0F3',
    },
    budget: {
      base: BUDGET_LIGHT,
      soft: tint(BUDGET_LIGHT, 0.12, 0.18, mode),
      on: WHITE,
      bg: tint(BUDGET_LIGHT, 0.08, 0.16, mode),
    },
    transactions: {
      inBg: tint(POSITIVE_LIGHT, 0.08, 0.16, mode),
      outBg: tint(NEGATIVE_LIGHT, 0.08, 0.16, mode),
      transferBg: tint(TRANSFER_TEXT_LIGHT, 0.08, 0.14, mode),
      transferText: '#334155',
    },
    deposits: {
      base: CATEGORY_COLORS.deposits.surface,
      bg: CATEGORY_COLORS.deposits.tile,
    },
    assets: {
      base: ASSET_TONE,
      bg: ASSET_BG,
    },
  };

  const gradients = {
    homeHero: ['#1B2F47', '#2F4A6B'] as const,
    cardGradient: ['#E8EFFC', '#F8FAFF'] as const,
    tabShadow: ['transparent', 'rgba(148,163,184,0.15)'] as const,
  };

  const chart = {
    bar: POSITIVE_LIGHT,
    barMuted: CHART_BAR_MUTED_LIGHT,
    income: CHART_INCOME_LIGHT,
    expense: CHART_EXPENSE_LIGHT,
  };

  return {
    isDark: false,

    // Flat Backward-Compatible Mappings
    background: layers.background,
    surface: layers.surface,
    card: layers.surface,
    border: lines.border,
    divider: lines.divider,
    text: ink.text,
    listText: ink.listText,
    textMuted: ink.textMuted,
    textSoft: ink.textSoft,
    brand: brandFamily.brand.base,
    onBrand: brandFamily.brand.on,
    positive: POSITIVE_LIGHT,
    active: states.active,
    tabActive: states.tabActive,
    chartBar: chart.bar,
    negative: NEGATIVE_LIGHT,
    uiPositive: POSITIVE_LIGHT,
    uiNegative: NEGATIVE_LIGHT,
    numberPositive: NUMBER_POSITIVE_LIGHT,
    numberNegative: NUMBER_NEGATIVE_LIGHT,
    warning: states.warning,
    brandSoft: brandFamily.brand.soft,
    loan: brandFamily.loan.base,
    loanSoft: brandFamily.loan.soft,
    onLoan: brandFamily.loan.on,
    budget: brandFamily.budget.base,
    budgetSoft: brandFamily.budget.soft,
    onBudget: brandFamily.budget.on,
    tabInactive: states.tabInactive,
    iconTint: states.iconTint,
    statusBarStyle: 'dark',
    navigationButtonStyle: 'dark',
    surfaceRaised: layers.surfaceRaised,
    textSecondary: ink.textSecondary,
    borderSoft: lines.borderSoft,
    inactive: states.inactive,
    neutral: states.neutral,
    chartBarMuted: chart.barMuted,
    heroBar: layers.surfaceHero,
    todayDot: states.todayDot,
    inBg: brandFamily.transactions.inBg,
    outBg: brandFamily.transactions.outBg,
    transferBg: brandFamily.transactions.transferBg,
    loanBg: brandFamily.loan.bg,
    budgetBg: brandFamily.budget.bg,
    transferText: brandFamily.transactions.transferText,
    inputBg: INPUT_BG_LIGHT,
    scrim: states.scrim,
    scrimHeavy: states.scrimHeavy,
    pressedBg: states.pressedBg,
    stripBg: layers.surfaceSunken,
    chartIncome: chart.income,
    chartExpense: chart.expense,

    // Structured Namespaces
    layers,
    ink,
    lines,
    states,
    brandFamily,
    gradients,
    chart,
  };
}

const ELEVATION_NONE: ElevationStyle = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};

const elevationCache = new Map<string, ElevationStyle>();

/**
 * Generates theme-aware shadow stylings for cards, panels, and sheets.
 * Returned objects are cached per (mode, level) so repeated spreads share
 * referentially-stable style objects.
 */
export function getElevation(
  palette: AppThemePalette,
  level: 'none' | 'sm' | 'md' | 'lg',
): ElevationStyle {
  if (level === 'none') return ELEVATION_NONE;
  const key = `${palette.isDark ? 'd' : 'l'}|${level}`;
  const cached = elevationCache.get(key);
  if (cached) return cached;
  const built = buildElevation(palette.isDark, level);
  elevationCache.set(key, built);
  return built;
}

function buildElevation(_isDark: boolean, level: 'sm' | 'md' | 'lg'): ElevationStyle {
  // Both light and dark modes use standard dark shadows mapping to historical values
  switch (level) {
    case 'sm':
      return {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.10,
        shadowRadius: 2,
        elevation: 2,
      };
    case 'md':
      return {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
      };
    case 'lg':
      return {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 10,
      };
  }
}

const heroGradientCache = new Map<string, readonly [string, string]>();
const HERO_GRADIENT_FALLBACK_DARK = ['#16192A', '#1A1E30'] as const;
const HERO_GRADIENT_FALLBACK_LIGHT = ['#1B2F47', '#2F4A6B'] as const;

/**
 * Dynamically builds a premium vertical gradient based on a starting hex color.
 */
export function getHeroGradient(baseColor: string, isDark: boolean): readonly [string, string] {
  const key = `${isDark ? 'd' : 'l'}|${baseColor}`;
  const cached = heroGradientCache.get(key);
  if (cached) return cached;

  const built = buildHeroGradient(baseColor, isDark);
  heroGradientCache.set(key, built);
  return built;
}

function buildHeroGradient(baseColor: string, isDark: boolean): readonly [string, string] {
  if (!baseColor.startsWith('#') || baseColor.length < 7) {
    return isDark ? HERO_GRADIENT_FALLBACK_DARK : HERO_GRADIENT_FALLBACK_LIGHT;
  }
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);

  if (isDark) {
    // Dark mode: start at brand base, darken bottom by 32%
    const f = 0.68;
    return [baseColor, toHex(r * f, g * f, b * f)] as const;
  }
  // Light mode: start at brand base, soften bottom slightly to blend beautifully
  const f = 0.85;
  return [
    baseColor,
    toHex(r + (255 - r) * (1 - f), g + (255 - g) * (1 - f), b + (255 - b) * (1 - f)),
  ] as const;
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

const paletteCache = new Map<AppThemeMode, AppThemePalette>();

function getCachedPalette(mode: AppThemeMode): AppThemePalette {
  const cached = paletteCache.get(mode);
  if (cached) return cached;
  const built = getThemePalette(mode);
  paletteCache.set(mode, built);
  return built;
}

import { useColorScheme, Appearance } from 'react-native';
import { useUIStore } from '../stores/useUIStore';

export function useAppTheme(): { mode: AppThemeMode; palette: AppThemePalette } {
  const theme = useUIStore((state) => state.settings.theme);
  const systemScheme = useColorScheme() || Appearance.getColorScheme();
  const mode = resolveTheme(theme, systemScheme);

  return { mode, palette: getCachedPalette(mode) };
}
