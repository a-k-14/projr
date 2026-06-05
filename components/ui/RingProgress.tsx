/**
 * RingProgress — circular SVG progress ring with reanimated mount fill-in.
 *
 * Animates the stroke from 0 → `percent` once on mount (subtle 700ms ease-out).
 * Re-renders triggered by a new `percent` value re-animate from the previous
 * value (so a hero updating after a refresh tweens cleanly).
 *
 * Designed to drop into hero cards. Render any centered content via `children`
 * (typically a small label + number stacked).
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RingProgressProps {
  size: number;
  strokeWidth: number;
  /** 0–100 (clamped). */
  percent: number;
  color: string;
  trackColor: string;
  /** Centered content (label + value). */
  children?: React.ReactNode;
  /** Defaults to 700ms. Pass 0 to disable the mount animation. */
  durationMs?: number;
}

export function RingProgress({
  size,
  strokeWidth,
  percent,
  color,
  trackColor,
  children,
  durationMs = 700,
}: RingProgressProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(clamped / 100, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, durationMs, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>
      {children ? (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</View>
      ) : null}
    </View>
  );
}
