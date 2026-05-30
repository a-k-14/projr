import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { useGlobalNotice } from '../../stores/useGlobalNotice';

const AUTO_DISMISS_MS = 6000;
const ENTER_OFFSET = -24;
const SWIPE_DISMISS_DISTANCE = 36;
const SWIPE_DISMISS_VELOCITY = -0.5;

export function GlobalNotice() {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const message = useGlobalNotice((s) => s.message);
  const tone = useGlobalNotice((s) => s.tone);
  const dismiss = useGlobalNotice((s) => s.dismiss);

  // Keep the banner rendered through its exit animation: `rendered` stays true
  // until the slide-up finishes, after which we clear the store message.
  const [rendered, setRendered] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(ENTER_OFFSET)).current;

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: ENTER_OFFSET,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setRendered(false);
        dismiss();
      }
    });
  }, [opacity, translateY, dismiss]);

  const springBack = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 16,
      stiffness: 220,
    }).start();
  }, [translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) =>
          Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_evt, g) => {
          // Track upward drags; resist downward pulls so it stays near the top.
          translateY.setValue(g.dy < 0 ? g.dy : g.dy * 0.25);
        },
        onPanResponderRelease: (_evt, g) => {
          if (g.dy < -SWIPE_DISMISS_DISTANCE || g.vy < SWIPE_DISMISS_VELOCITY) {
            close();
          } else {
            springBack();
          }
        },
        onPanResponderTerminate: () => springBack(),
      }),
    [translateY, close, springBack]
  );

  useEffect(() => {
    if (!message) return;
    setRendered(true);
    opacity.setValue(0);
    translateY.setValue(ENTER_OFFSET);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 16,
        stiffness: 200,
      }),
    ]).start();

    const timer = setTimeout(close, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, opacity, translateY, close]);

  if (!rendered) return null;

  const isError = tone === 'error';

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Pressable
        onPress={close}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderRadius: HOME_RADIUS.tab,
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.divider,
          paddingVertical: HOME_SPACE.md,
          paddingHorizontal: HOME_SPACE.lg,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: HOME_RADIUS.full,
            backgroundColor: isError ? palette.outBg : palette.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppIcon
            name={isError ? 'alert-circle' : 'info'}
            size={16}
            color={isError ? palette.uiNegative : palette.brand}
          />
        </View>
        <Text
          style={{
            flex: 1,
            fontSize: HOME_TEXT.body,
            lineHeight: 19,
            fontWeight: FONT_WEIGHT.medium,
            color: palette.text,
          }}
        >
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
