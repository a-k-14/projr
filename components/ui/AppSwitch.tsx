import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { 
  interpolateColor, 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming 
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
}: AppSwitchProps) {
  const trackWidth = width;
  const trackHeight = height;
  
  const translateX = useSharedValue(value ? trackWidth - thumbSize - padding : padding);

  React.useEffect(() => {
    translateX.value = withTiming(value ? trackWidth - thumbSize - padding : padding, {
      duration: 150,
    });
  }, [value, translateX]);

  const animatedTrackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      translateX.value,
      [padding, trackWidth - thumbSize - padding],
      [palette.divider, palette.brand]
    );
    return { backgroundColor };
  });

  const animatedThumbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
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
              backgroundColor: palette.surface,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 2.5,
              elevation: 3
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
