import React from 'react';
import { FONT_WEIGHT } from "../../lib/design";
import { Text as RNText, TextProps } from 'react-native';
import Animated from 'react-native-reanimated';

type AppTextProps = TextProps & {
  appWeight?: 'regular' | 'medium';
};

export function Text({ style, appWeight, ...props }: AppTextProps) {
  return <RNText {...props} style={[appWeight === 'medium' ? { fontWeight: FONT_WEIGHT.medium } : null, style]} />;
}

export const AnimatedText = Animated.createAnimatedComponent(Text);
