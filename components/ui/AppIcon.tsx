import React from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleProp, ViewStyle } from 'react-native';

export type IconName = keyof typeof Feather.glyphMap;

interface AppIconProps {
  name: string; // Use string to allow for library-specific names during transition
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Centralized Icon component for the app.
 * Fallback to Feather for now due to environment constraints.
 */
export function AppIcon({ name, size = 20, color, style }: AppIconProps) {
  // Safe name check for Feather
  const safeName = (isValidIcon(name) ? name : 'help-circle') as IconName;
  
  return (
    <Feather
      name={safeName}
      size={size}
      color={color}
      style={style}
    />
  );
}

/**
 * Helper to check if an icon name is valid in the current library.
 */
export function isValidIcon(name: any): name is IconName {
  return typeof name === 'string' && name in Feather.glyphMap;
}
