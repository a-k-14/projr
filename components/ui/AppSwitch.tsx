import React, { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { AppThemePalette } from '../../lib/theme';

interface AppSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  palette: AppThemePalette;
  disabled?: boolean;
  width?: number;
  height?: number;
  thumbSize?: number;
  padding?: number;
  activeTrackColor?: string;
  inactiveTrackColor?: string;
}

const SPRING = { damping: 18, stiffness: 280, mass: 0.5 } as const;

export function AppSwitch({
  value,
  onValueChange,
  palette,
  disabled,
  width = 43,
  height = 25,
  thumbSize = 19,
  padding = 3,
  activeTrackColor,
  inactiveTrackColor,
}: AppSwitchProps) {
  const offX = padding;
  const onX = width - thumbSize - padding;

  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, SPRING);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const trackColor = activeTrackColor ?? palette.brand;
  const offColor = inactiveTrackColor ?? (palette.isDark ? 'rgba(255,255,255,0.12)' : palette.divider);

  const animatedTrack = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [offColor, trackColor]),
  }));

  const animatedThumb = useAnimatedStyle(() => ({
    transform: [{ translateX: offX + progress.value * (onX - offX) }],
  }));

  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={{ opacity: disabled ? 0.45 : 1 }}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
    >
      <Animated.View
        style={[
          {
            width,
            height,
            borderRadius: height / 2,
            justifyContent: 'center',
          },
          animatedTrack,
        ]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: '#FFFFFF',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.18,
              shadowRadius: 2,
              elevation: 2,
            },
            animatedThumb,
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}
