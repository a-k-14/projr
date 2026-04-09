import React from 'react';
import { View, ViewStyle } from 'react-native';
import { HOME_COLORS } from '../../lib/homeTokens';

interface InlineDotProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function InlineDot({ 
  size = 4, 
  color = HOME_COLORS.textSoft, 
  style 
}: InlineDotProps) {
  return (
    <View
      style={[{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        marginHorizontal: 8,
      }, style]}
    />
  );
}
