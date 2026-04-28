import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { AppIcon } from './AppIcon';
import type { AppThemePalette } from '../../lib/theme';

type ChevronDirection = 'left' | 'right' | 'up' | 'down';
type ChevronTone = 'subtle' | 'secondary' | 'primary';

interface AppChevronProps {
  direction: ChevronDirection;
  palette: AppThemePalette;
  size?: number;
  tone?: ChevronTone;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

function getChevronColor(palette: AppThemePalette, tone: ChevronTone) {
  if (tone === 'primary') return palette.text;
  if (tone === 'secondary') return palette.textSecondary;
  return palette.textSoft;
}

export function AppChevron({
  direction,
  palette,
  size = 18,
  tone = 'secondary',
  color,
  opacity,
  style,
}: AppChevronProps) {
  return (
    <AppIcon
      name={`chevron-${direction}`}
      size={size}
      color={color ?? getChevronColor(palette, tone)}
      style={[opacity !== undefined ? { opacity } : null, style]}
    />
  );
}
