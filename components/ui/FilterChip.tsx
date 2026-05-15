import React from 'react';
import { Text } from '@/components/ui/AppText';
import { StyleSheet, ViewStyle , TouchableOpacity } from 'react-native';
import { FONT_WEIGHT } from '../../lib/design';
import { ACTIVITY_LAYOUT, HOME_TEXT } from '../../lib/layoutTokens';
import { AppThemePalette } from '../../lib/theme';

interface FilterChipProps {
  palette: AppThemePalette;
  label: string;
  isActive: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export function FilterChip({
  palette,
  label,
  isActive,
  onPress,
  style }: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      delayPressIn={0}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={[
        styles.chip,
        {
          backgroundColor: isActive ? palette.brand : palette.surface,
          borderColor: isActive ? palette.brand : palette.divider },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: isActive ? palette.onBrand : palette.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1.0,
    alignItems: 'center',
    justifyContent: 'center' },
  text: {
    fontSize: HOME_TEXT.caption,
    fontWeight: FONT_WEIGHT.semibold } });
