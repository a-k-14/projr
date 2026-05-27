import React from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

/**
 * Wraps children in an overflow-clipped container. When `value` changes,
 * the old content rolls out upward and the new content rolls in from below.
 */
export function RollingNumber({
  value,
  children,
  style,
}: {
  value: string | number;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <Animated.View
        key={String(value)}
        entering={FadeInUp.duration(300)}
        exiting={FadeOutUp.duration(220)}
      >
        {children}
      </Animated.View>
    </View>
  );
}
