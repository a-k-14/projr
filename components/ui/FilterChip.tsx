import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { ACTIVITY_LAYOUT } from '../../lib/layoutTokens';
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
          backgroundColor: isActive ? palette.brand : palette.surface,
          borderColor: isActive ? palette.brand : palette.divider,
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
    // minHeight: 34,
    // minWidth: 52,
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
