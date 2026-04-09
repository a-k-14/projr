import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { HOME_COLORS, HOME_RADIUS } from '../../lib/homeTokens';

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  activeColor?: string;
  inactiveColor?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
  style?: ViewStyle;
}

export function FilterChip({
  label,
  isActive,
  onPress,
  activeColor = HOME_COLORS.active,
  inactiveColor = HOME_COLORS.surface,
  activeTextColor = HOME_COLORS.surface,
  inactiveTextColor = HOME_COLORS.textMuted,
  style,
}: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: isActive ? activeColor : inactiveColor,
          borderColor: isActive ? activeColor : HOME_COLORS.divider,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: isActive ? activeTextColor : inactiveTextColor,
          },
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
    borderRadius: HOME_RADIUS.tab,
    borderWidth: 1,
    marginRight: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
  },
});
