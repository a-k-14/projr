import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { AppIcon } from './AppIcon';
import type { AppThemePalette } from '../../lib/theme';

interface CalculatorTriggerProps {
  palette: AppThemePalette;
  onPress: () => void;
  size?: 'compact' | 'large';
  hitSlop?: { top: number; bottom: number; left: number; right: number };
  height?: number;
  width?: number;
}

export function CalculatorTrigger({
  palette,
  onPress,
  size = 'large',
  hitSlop,
  height,
  width,
}: CalculatorTriggerProps) {
  const isLarge = size === 'large';

  return (
    <TouchableOpacity
      delayPressIn={0}
      onPress={onPress}
      hitSlop={hitSlop}
      style={{
        width: width ?? height ?? (isLarge ? 48 : 36),
        height: height ?? (isLarge ? 48 : 36),
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <View
        style={{
          width: width ?? height ?? (isLarge ? 44 : 30),
          height: height ?? (isLarge ? 44 : 30),
          borderRadius: isLarge ? 14 : 12,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.divider,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppIcon
          name="calculator"
          size={isLarge ? 22 : 18}
          color={isLarge ? palette.textSecondary : palette.textMuted}
        />
      </View>
    </TouchableOpacity>
  );
}
