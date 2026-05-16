import { AppIcon, isValidIcon } from '@/components/ui/AppIcon';
import React from 'react';
import { Text } from '@/components/ui/AppText';
import { View } from 'react-native';
import { HOME_RADIUS } from '../../lib/layoutTokens';
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
  iconSize?: number;
  noBackground?: boolean;
  strokeWidth?: number;
}

export function CategoryIconBadge({
  icon,
  ioniconName,
  palette,
  iconColor,
  size = 34,
  iconSize,
  noBackground = false,
  strokeWidth,
}: CategoryIconBadgeProps) {
  const isEmoji = icon ? !/^[a-z-]+$/.test(icon) : false;
  const badgeSize = size;
  const effectiveIconSize = iconSize ?? Math.floor(size * 0.47); // ~16 for 34

  return (
    <View
      style={{
        width: badgeSize,
        height: badgeSize,
        borderRadius: HOME_RADIUS.small,
        backgroundColor: noBackground ? 'transparent' : palette.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {ioniconName && isValidIcon(ioniconName) ? (
        <AppIcon name={ioniconName} size={effectiveIconSize} color={iconColor ?? palette.iconTint} strokeWidth={strokeWidth} />
      ) : isEmoji ? (
        <Text style={{ fontSize: effectiveIconSize }}>{icon}</Text>
      ) : icon && isValidIcon(icon) ? (
        <AppIcon name={icon}
          size={effectiveIconSize}
          color={iconColor ?? palette.iconTint}
          strokeWidth={strokeWidth}
        />
      ) : (
        <AppIcon name="tag"
          size={effectiveIconSize}
          color={iconColor ?? palette.iconTint}
          strokeWidth={strokeWidth}
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
      {selected && <AppIcon name="check" size={15} color={palette.onBrand} />}
      {partial && <View style={{ width: 10, height: 2.5, borderRadius: HOME_RADIUS.full, backgroundColor: palette.brand }} />}
    </View>
  );
}
