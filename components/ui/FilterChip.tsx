import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { HOME_RADIUS } from '../../lib/layoutTokens';
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
  style,
}: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: isActive ? palette.brand : palette.inputBg,
          borderColor: isActive ? palette.brand : palette.borderSoft,
        },
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: HOME_RADIUS.pill,
    borderWidth: 1,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
