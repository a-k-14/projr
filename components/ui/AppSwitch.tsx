import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { 
  interpolateColor, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming 
} from 'react-native-reanimated';
import { AppThemePalette } from '../../lib/theme';

interface AppSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  palette: AppThemePalette;
  disabled?: boolean;
}

export function AppSwitch({ value, onValueChange, palette, disabled }: AppSwitchProps) {
  const trackWidth = 46;
  const trackHeight = 26;
  const thumbSize = 20;
  const padding = 3;
  
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
