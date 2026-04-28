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
}

export function CalculatorTrigger({
  palette,
  onPress,
  size = 'large',
  hitSlop,
  height,
}: CalculatorTriggerProps) {
  const isLarge = size === 'large';

  return (
    <TouchableOpacity
      delayPressIn={0}
      onPress={onPress}
      hitSlop={hitSlop}
      style={{
        width: height ?? (isLarge ? 48 : 40),
        height: height ?? (isLarge ? 48 : 40),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: height ?? (isLarge ? 44 : 34),
          height: height ?? (isLarge ? 44 : 34),
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
