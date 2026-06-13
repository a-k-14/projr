import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from './AppText';
import { AppIcon } from './AppIcon';
import { FONT_WEIGHT } from '../../lib/design';
import { hexToRGBA } from '../../lib/ui-utils';
import type { AppThemePalette } from '../../lib/theme';

export interface TagBadgeProps {
  name: string;
  color?: string;
  palette: AppThemePalette;
  size?: 'small' | 'normal';
  neutral?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function TagBadge({
  name,
  color,
  palette,
  size = 'normal',
  neutral = false,
  style,
}: TagBadgeProps) {
  const isSmall = size === 'small';
  const fontSize = isSmall ? 11 : 11.5;
  const iconSize = isSmall ? 8.5 : 9.5;

  const bg = neutral
    ? palette.states.badgeNeutralBg
    : hexToRGBA(color || '#7f8c8d', palette.states.tagBgOpacity);
  const border = neutral
    ? palette.borderSoft
    : hexToRGBA(color || '#7f8c8d', palette.states.tagBorderOpacity);
  const strokeColor = neutral ? palette.textSecondary : (color || '#7f8c8d');

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 0.5,
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: 2.5,
        },
        style,
      ]}
    >
      <AppIcon name="tag" size={iconSize} color={strokeColor} strokeWidth={2.1} />
      <Text
        style={{
          fontSize,
          fontWeight: FONT_WEIGHT.regular,
          color: palette.textSecondary,
        }}
      >
        {name}
      </Text>
    </View>
  );
}
