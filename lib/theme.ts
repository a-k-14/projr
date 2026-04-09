import { ColorSchemeName } from 'react-native';
import type { Theme } from '../types';

export type AppThemeMode = 'light' | 'dark';

export interface AppThemePalette {
  background: string;
  surface: string;
  card: string;
  border: string;
  divider: string;
  text: string;
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
  loan: string;
  inBg: string;
  outBg: string;
  transferBg: string;
  loanBg: string;
  transferText: string;
  inputBg: string;
}

export function resolveTheme(theme: Theme, systemScheme: ColorSchemeName): AppThemeMode {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function getThemePalette(mode: AppThemeMode): AppThemePalette {
  if (mode === 'dark') {
    return {
      background: '#000000',
      surface: '#121214',
      card: '#18181A',
      border: '#232327',
      divider: '#1F1F23',
      text: '#F5F5F7',
      textMuted: '#A1A1A6',
      textSoft: '#6E6E73',
      tabActive: '#17673B',
      tabInactive: '#555555',
      iconTint: '#8E8E93',
      statusBarStyle: 'light',
      navigationButtonStyle: 'light',
      positive: '#17673B',
      negative: '#8A2424',
      surfaceRaised: '#202024',
      textSecondary: '#A1A1A6',
      borderSoft: '#303033',
      active: '#17673B',
      inactive: '#555555',
      neutral: '#F5F5F7',
      chartBar: '#22C55E',
      chartBarMuted: '#2F2F31',
      heroBar: '#202020',
      todayDot: '#F5F5F7',
      loan: '#D97706',
      inBg: '#1B4332',
      outBg: '#451212',
      transferBg: '#1E293B',
      loanBg: '#78350F',
      transferText: '#E2E8F0',
      inputBg: '#222224',
    };
  }

  return {
    background: '#F0F0F5',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E5E7EB',
    divider: '#E5E7EB',
    text: '#1F2A44',
    textMuted: '#8C94AF',
    textSoft: '#C8CDD9',
    tabActive: '#17673B',
    tabInactive: '#8C94AF',
    iconTint: '#8C94AF',
    statusBarStyle: 'dark',
    navigationButtonStyle: 'dark',
    positive: '#17673B',
    negative: '#8A2424',
    surfaceRaised: '#202845',
    textSecondary: '#6B7280',
    borderSoft: '#D8DDE8',
    active: '#17673B',
    inactive: '#B2B8C2',
    neutral: '#0A0A0A',
    chartBar: '#17673B',
    chartBarMuted: '#D9DDE7',
    heroBar: '#202845',
    todayDot: '#1F2A44',
    loan: '#92400E',
    inBg: '#DCFCE7',
    outBg: '#FCEAEA',
    transferBg: '#F1F5F9',
    loanBg: '#FEF3C7',
    transferText: '#1E293B',
    inputBg: '#F3F4F6',
  };
}
