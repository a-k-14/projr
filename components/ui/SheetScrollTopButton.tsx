import { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { AppIcon } from './AppIcon';
import type { AppThemePalette } from '../../lib/theme';

/** Small "scroll to top" pill that fades + lifts in when a sheet is scrolled down,
 *  and back out when at the top. Mounted next to the sheet title (headerRight). */
export function SheetScrollTopButton({
  visible,
  onPress,
  palette,
  color,
}: {
  visible: boolean;
  onPress: () => void;
  palette: AppThemePalette;
  color?: string;
}) {
  const opacity = useSharedValue(visible ? 1 : 0);
  const scale = useSharedValue(visible ? 1 : 0.8);
  const translateY = useSharedValue(visible ? 0 : 10);

  useEffect(() => {
    if (visible) {
      // Enter: animate from below (10) up to the normal position (0)
      translateY.value = withTiming(0, {
        duration: 250,
        easing: Easing.out(Easing.quad),
      });
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withTiming(1, { duration: 200 });
    } else {
      // Exit: animate from normal position (0) further up (-10) and fade out
      translateY.value = withTiming(
        -10,
        {
          duration: 200,
          easing: Easing.in(Easing.quad),
        },
        (finished) => {
          if (finished) {
            // Once fully invisible, reset the starting position back to below (10) for the next entry
            translateY.value = 10;
          }
        }
      );
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.8, { duration: 200 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View style={animatedStyle} pointerEvents={visible ? 'auto' : 'none'}>
      <TouchableOpacity
        delayPressIn={0}
        activeOpacity={0.5}
        onPress={onPress}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <AppIcon name="arrow-up-circle" size={20} color={color ?? palette.brand} strokeWidth={2} />
      </TouchableOpacity>
    </Animated.View>
  );
}
