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
  positive: string;
  negative: string;
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
      background: '#111111',
      surface: '#1C1C1C',
      card: '#222222',
      border: '#2C2C2C',
      divider: '#282828',
      text: '#F2F2F2',
      textMuted: '#A0A0A0',
      textSoft: '#666666',
      tabActive: '#17673B',
      tabInactive: '#555555',
      iconTint: '#888888',
      statusBarStyle: 'light',
      navigationButtonStyle: 'light',
      positive: '#4ADE80',
      negative: '#F87171',
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
    positive: '#166534',
    negative: '#991B1B',
  };
}
