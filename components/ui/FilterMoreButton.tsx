import { AppIcon } from '@/components/ui/AppIcon';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { ACTIVITY_LAYOUT, BUTTON_TOKENS, HOME_TEXT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';

interface FilterMoreButtonProps {
  onPress: () => void;
  moreActiveCount: number;
  palette: AppThemePalette;
  flex?: boolean;
  iconOnly?: boolean;
}

export function FilterMoreButton({ onPress, moreActiveCount, palette, flex, iconOnly }: FilterMoreButtonProps) {
  const moreActiveBg = palette.brandSoft;
  const moreActiveBorder = palette.brand;

  return (
    <TouchableOpacity
      delayPressIn={0}
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.moreChip,
        {
          backgroundColor: moreActiveCount > 0 ? moreActiveBg : palette.surface,
          borderColor: moreActiveCount > 0 ? moreActiveBorder : palette.divider,
          marginLeft: flex ? 0 : ACTIVITY_LAYOUT.moreButtonGap,
          flex: flex ? 1 : undefined,
          flexBasis: flex ? 0 : undefined,
          minWidth: flex ? 0 : iconOnly ? 38 : 84,
          width: iconOnly ? 38 : undefined,
          paddingHorizontal: iconOnly ? 0 : 12,
          justifyContent: iconOnly ? 'center' : 'flex-start',
        },
      ]}
    >
      {iconOnly ? null : (
        <Text
          appWeight="medium"
          numberOfLines={1}
          style={{
            flex: flex ? 1 : undefined,
            fontSize: HOME_TEXT.bodySmall,
            fontWeight: BUTTON_TOKENS.text.labelWeight,
            color: moreActiveCount > 0 ? palette.brand : palette.text
          }}
        >
          More
        </Text>
      )}
      <AppIcon name="filter"
        size={17}
        color={moreActiveCount > 0 ? palette.tabActive : palette.textMuted}
      />
      {iconOnly && moreActiveCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: palette.brand }]}>
          <Text appWeight="medium" style={[styles.badgeText, { color: palette.onBrand }]}>
            {moreActiveCount}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  moreChip: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1,
    flexShrink: 0,
    gap: 6
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
