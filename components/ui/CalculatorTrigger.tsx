import React from 'react';
import { Pressable, View } from 'react-native';
import { AppIcon } from './AppIcon';
import type { AppThemePalette } from '../../lib/theme';
import { HOME_RADIUS } from '../../lib/layoutTokens';

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
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      style={({ pressed }) => ({
        width: width ?? height ?? (isLarge ? 48 : 36),
        height: height ?? (isLarge ? 48 : 36),
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        borderRadius: isLarge ? HOME_RADIUS.button : HOME_RADIUS.chip,
        backgroundColor: pressed ? palette.surface : 'transparent',
      })}
    >
      <View
        style={{
          width: width ?? height ?? (isLarge ? 44 : 30),
          height: height ?? (isLarge ? 44 : 30),
          borderRadius: isLarge ? HOME_RADIUS.button : HOME_RADIUS.chip,
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
          strokeWidth={1.9}
        />
      </View>
    </Pressable>
  );
}
