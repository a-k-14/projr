import React from 'react';
import { Text as RNText, TextProps } from 'react-native';
import Animated from 'react-native-reanimated';

type AppTextProps = TextProps & {
  appWeight?: 'regular' | 'medium';
};

export function Text({ style, appWeight, ...props }: AppTextProps) {
  return <RNText {...props} style={[style, appWeight === 'medium' ? { fontWeight: '500' } : null]} />;
}

export const AnimatedText = Animated.createAnimatedComponent(Text);
