import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { FONT_WEIGHT } from '../../lib/design';
import { ACTIVITY_LAYOUT, BUTTON_TOKENS, HOME_TEXT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';

interface FilterMoreButtonProps {
  onPress: () => void;
  moreActiveCount: number;
  palette: AppThemePalette;
  flex?: boolean;
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
  marginLeft?: number;
}

export function FilterMoreButton({ onPress, moreActiveCount, palette, flex, iconOnly, style, marginLeft }: FilterMoreButtonProps) {
  const moreActiveBg = palette.brandSoft;
  const moreActiveBorder = palette.brand;

  const defaultMarginLeft = flex ? 0 : ACTIVITY_LAYOUT.moreButtonGap;

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
          marginLeft: marginLeft !== undefined ? marginLeft : defaultMarginLeft,
          flex: flex ? 1 : undefined,
          flexBasis: flex ? 0 : undefined,
          paddingVertical: 6,
          paddingHorizontal: 14,
          justifyContent: 'center',
          borderRadius: ACTIVITY_LAYOUT.chipRadius,
        },
        style,
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
      {/* Badge removed */}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  moreChip: {
    height: ACTIVITY_LAYOUT.controlHeight,
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
    fontSize: HOME_TEXT.tiny,
    fontWeight: FONT_WEIGHT.heavy,
  },
});
