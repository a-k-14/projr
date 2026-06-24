import { useEffect, useRef } from 'react';
import { Animated, Easing, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { AppIcon } from './AppIcon';
import type { AppThemePalette } from '../../lib/theme';

interface HeaderResetButtonProps {
  visible: boolean;
  onPress: () => void;
  palette: AppThemePalette;
  size?: number;
  style?: StyleProp<ViewStyle>;
  isFocused?: boolean;
}

export function HeaderResetButton({
  visible,
  onPress,
  palette,
  size = 17,
  style,
  isFocused = true,
}: HeaderResetButtonProps) {
  const presence = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const lastVisibleRef = useRef<boolean | null>(null);
  const lastFocusedRef = useRef(isFocused);

  useEffect(() => {
    const isInitialMount = lastVisibleRef.current === null;
    const visibleChanged = !isInitialMount && visible !== lastVisibleRef.current;
    const focusGained = !isInitialMount && isFocused && !lastFocusedRef.current;

    lastVisibleRef.current = visible;
    lastFocusedRef.current = isFocused;

    if (isInitialMount) {
      presence.setValue(visible ? 1 : 0);
      spin.setValue(visible ? 1 : 0);
      return;
    }

    if (!visible) {
      if (visibleChanged) {
        Animated.parallel([
          Animated.timing(presence, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(spin, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      }
      return;
    }

    if (visibleChanged) {
      Animated.parallel([
        Animated.spring(presence, {
          toValue: 1,
          damping: 12,
          stiffness: 260,
          useNativeDriver: true,
        }),
        Animated.timing(spin, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (focusGained) {
      spin.setValue(0);
      Animated.timing(spin, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, isFocused, presence, spin]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        {
          alignSelf: 'center',
          opacity: presence,
          transform: [
            { scale: presence.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
            {
              rotate: spin.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        },
        style,
      ]}
    >
      <TouchableOpacity
        delayPressIn={0}
        activeOpacity={0.5}
        onPress={onPress}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <AppIcon name="rotate-ccw" size={size} color={palette.brand} strokeWidth={2.4} />
      </TouchableOpacity>
    </Animated.View>
  );
}
