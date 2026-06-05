/**
 * PressableScale — the app's single source of truth for tap feedback.
 *
 * Wraps children in a Pressable that springs down to `activeScale` (default 0.985)
 * on press-in and back to 1 on release. Replaces the older `TouchableOpacity
 * activeOpacity` dip everywhere we want the modern tactile feel.
 *
 * Tune the spring/scale here once and every consumer (AppCard, FilterChip, …)
 * inherits it.
 */
import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const PRESS_IN = { damping: 20, stiffness: 360, mass: 0.5 } as const;
const PRESS_OUT = { damping: 18, stiffness: 320, mass: 0.6 } as const;

interface PressableScaleProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
  disabled?: boolean;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  /** Forwarded so callers can stop row presses from firing on inner taps, etc. */
  onLongPress?: () => void;
}

export function PressableScale({
  onPress,
  children,
  style,
  activeScale = 0.985,
  disabled,
  hitSlop,
  onLongPress,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => {
        scale.value = withSpring(activeScale, PRESS_IN);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_OUT);
      }}
    >
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
