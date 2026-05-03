import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import * as icons from 'lucide-react-native';

export type IconName = string;

interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

function kebabToPascal(str: string) {
  return str.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

/**
 * Centralized Icon component for the app.
 */
export function AppIcon({ name, size = 20, color, strokeWidth, style }: AppIconProps) {
  const pascalName = kebabToPascal(name);
  const IconComponent = (icons as any)[pascalName] || icons.HelpCircle;
  
  return (
    <IconComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      style={style}
    />
  );
}

/**
 * Helper to check if an icon name is valid.
 */
export function isValidIcon(name: any): name is IconName {
  if (typeof name !== 'string') return false;
  const pascalName = kebabToPascal(name);
  return !!(icons as any)[pascalName];
}
