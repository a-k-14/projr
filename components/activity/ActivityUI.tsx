import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HOME_TEXT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';

/**
 * Common Category Icon Badge used across the Activity screens and filter sheets.
 */
interface CategoryIconBadgeProps {
  icon?: string;
  ioniconName?: string;
  palette: AppThemePalette;
  iconColor?: string;
  size?: number;
}

export function CategoryIconBadge({
  icon,
  ioniconName,
  palette,
  iconColor,
  size = 34,
}: CategoryIconBadgeProps) {
  const isEmoji = icon ? !/^[a-z-]+$/.test(icon) : false;
  const badgeSize = size;
  const iconSize = Math.floor(size * 0.47); // ~16 for 34

  return (
    <View
      style={{
        width: badgeSize,
        height: badgeSize,
        borderRadius: 10,
        backgroundColor: palette.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {ioniconName ? (
        <Ionicons name={ioniconName as any} size={iconSize} color={iconColor ?? palette.iconTint} />
      ) : isEmoji ? (
        <Text style={{ fontSize: HOME_TEXT.rowLabel }}>{icon}</Text>
      ) : (
        <Feather
          name={(icon ?? 'tag') as keyof typeof Feather.glyphMap}
          size={iconSize}
          color={iconColor ?? palette.iconTint}
        />
      )}
    </View>
  );
}

/**
 * Common Checkbox component for multi-select filters.
 */
interface CheckboxProps {
  selected: boolean;
  partial?: boolean;
  palette: AppThemePalette;
}

export function Checkbox({ selected, partial = false, palette }: CheckboxProps) {
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: selected || partial ? palette.brand : palette.border,
        backgroundColor: selected ? palette.brand : partial ? palette.brandSoft : palette.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected && <Ionicons name="checkmark" size={15} color={palette.onBrand} />}
      {partial && <View style={{ width: 10, height: 2.5, borderRadius: 99, backgroundColor: palette.brand }} />}
    </View>
  );
}
