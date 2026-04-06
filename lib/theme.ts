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
  navigationButtonStyle: 'light' | 'dark';
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
      background: '#11161F',
      surface: '#161D28',
      card: '#19212E',
      border: '#263042',
      divider: '#232D3E',
      text: '#F9FAFB',
      textMuted: '#B6C0D4',
      textSoft: '#7F8AA3',
      tabActive: '#4ADE80',
      tabInactive: '#8A94AA',
      iconTint: '#A7B0C3',
      statusBarStyle: 'light',
      navigationButtonStyle: 'light',
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
  };
}
