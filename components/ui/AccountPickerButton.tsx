import { AppChevron } from '@/components/ui/AppChevron';
import { Text } from '@/components/ui/AppText';
import { StyleSheet, TouchableOpacity, StyleProp, ViewStyle, DimensionValue } from 'react-native';
import { FONT_WEIGHT } from '../../lib/design';
import { ACTIVITY_LAYOUT, HOME_TEXT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';

export interface AccountPickerButtonProps {
  label: string;
  onPress: () => void;
  palette: AppThemePalette;
  compact?: boolean;
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
}

export function AccountPickerButton({
  label,
  onPress,
  palette,
  compact = false,
  width,
  style,
}: AccountPickerButtonProps) {
  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        compact ? styles.compactPicker : styles.standardPicker,
        {
          backgroundColor: palette.surface,
          borderColor: palette.divider,
          width: width,
        },
        style,
      ]}
    >
      <Text
        appWeight="medium"
        numberOfLines={1}
        style={{
          fontSize: HOME_TEXT.bodySmall,
          fontWeight: FONT_WEIGHT.semibold,
          color: palette.text,
          flex: 1,
        }}
      >
        {label}
      </Text>
      <AppChevron
        direction="down"
        size={15}
        tone="secondary"
        palette={palette}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  standardPicker: {
    height: ACTIVITY_LAYOUT.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ACTIVITY_LAYOUT.accountChipHorizontalPadding,
    borderRadius: ACTIVITY_LAYOUT.controlRadius,
    borderWidth: 1,
  },
  compactPicker: {
    height: ACTIVITY_LAYOUT.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1.0,
    gap: 6,
  },
});
