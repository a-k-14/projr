import React from 'react';
import { View, ViewStyle } from 'react-native';

interface InlineDotProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function InlineDot({ 
  size = 4, 
  color = '#9CA3AF', 
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
