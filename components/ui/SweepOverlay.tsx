import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import Animated, { AnimatedStyle } from 'react-native-reanimated';
import { ViewStyle } from 'react-native';

export function SweepOverlay({
  style,
  width = 80,
  alpha = 0.2,
}: {
  style: AnimatedStyle<ViewStyle>;
  width?: number;
  alpha?: number;
}) {
  const hi = `rgba(255,255,255,${alpha})`;
  return (
    <Animated.View
      pointerEvents="none"
      style={[style, { position: 'absolute', top: 0, bottom: 0, left: 0, width }]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', hi, 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}
