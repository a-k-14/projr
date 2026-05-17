import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { 
  interpolateColor, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated';
import { AppThemePalette } from '../../lib/theme';

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
  activeBorderColor?: string;
  inactiveBorderColor?: string;
  activeThumbColor?: string;
  inactiveThumbColor?: string;
}

export function AppSwitch({
  value,
  onValueChange,
  palette,
  disabled,
  width = 46,
  height = 26,
  thumbSize = 20,
  padding = 3,
  activeTrackColor,
  inactiveTrackColor,
  activeBorderColor,
  inactiveBorderColor,
  activeThumbColor,
  inactiveThumbColor,
}: AppSwitchProps) {
  const trackWidth = width;
  const trackHeight = height;
  
  const translateX = useSharedValue(value ? trackWidth - thumbSize - padding : padding);

  React.useEffect(() => {
    translateX.value = withSpring(value ? trackWidth - thumbSize - padding : padding, {
      damping: 22,
      stiffness: 300,
      mass: 0.6,
    });
  }, [value, translateX, trackWidth, thumbSize, padding]);

  const animatedTrackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      translateX.value,
      [padding, trackWidth - thumbSize - padding],
      [inactiveTrackColor ?? palette.divider, activeTrackColor ?? palette.brand]
    );
    const borderColor = interpolateColor(
      translateX.value,
      [padding, trackWidth - thumbSize - padding],
      [inactiveBorderColor ?? 'transparent', activeBorderColor ?? 'transparent']
    );
    return { 
      backgroundColor,
      borderColor,
      borderWidth: (inactiveBorderColor || activeBorderColor) ? 1 : 0
    };
  });

  const animatedThumbStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      translateX.value,
      [padding, trackWidth - thumbSize - padding],
      [inactiveThumbColor ?? palette.textSoft, activeThumbColor ?? '#FFFFFF']
    );
    return {
      transform: [{ translateX: translateX.value }],
      backgroundColor,
    };
  });

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.container, { width: trackWidth, height: trackHeight, opacity: disabled ? 0.5 : 1 }]}
    >
      <Animated.View style={[styles.track, animatedTrackStyle, { borderRadius: trackHeight / 2 }]}>
        <Animated.View 
          style={[
            styles.thumb, 
            animatedThumbStyle, 
            { 
              width: thumbSize, 
              height: thumbSize, 
              borderRadius: thumbSize / 2, 
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1.5 },
              shadowOpacity: 0.12,
              shadowRadius: 2.0,
              elevation: 2
            }
          ]} 
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  track: {
    flex: 1,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
  },
});
