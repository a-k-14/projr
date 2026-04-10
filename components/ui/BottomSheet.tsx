import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHEET_GUTTER } from '../../lib/design';
import type { AppThemePalette } from '../../lib/theme';

/**
 * BottomSheet — Centralised bottom sheet for any picker/selection UI.
 *
 * Behaviour:
 * - Opens at natural content height, capped at 50% of screen.
 * - Swipe UP on header → smoothly expands to 75% (only if content is taller than 50%).
 * - Swipe DOWN on header → dismisses.
 * - Tap backdrop → dismisses.
 * - The drag follows your finger in both directions.
 *
 * Usage anywhere: import { BottomSheet } from '../../components/ui/BottomSheet'
 */
export function BottomSheet({
  title,
  subtitle,
  palette,
  onClose,
  children,
  horizontalPadding = SHEET_GUTTER,
}: {
  title: string;
  subtitle?: string;
  palette: AppThemePalette;
  onClose: () => void;
  children: ReactNode;
  horizontalPadding?: number;
}) {
  const { height: screenHeight } = Dimensions.get('window');
  const insets = useSafeAreaInsets();

  const MIN_HEIGHT = screenHeight * 0.5;
  const MAX_HEIGHT = screenHeight * 0.75;

  // translateY: native driver, used for open/close animation & downward drag dismiss
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  // sheetHeight: JS driver — starts at MIN_HEIGHT (off-screen), snapped to content before reveal
  const sheetHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Track whether content needs expansion (set via onContentSizeChange)
  const contentHeight = useRef(0);
  // Track current snap state for gesture logic
  const isExpanded = useRef(false);
  // Track current height value synchronously
  const currentHeight = useRef(MIN_HEIGHT);
  // Actual collapsed height (content-based, capped at MIN_HEIGHT). Used for gesture snap-back.
  const collapsedHeight = useRef(MIN_HEIGHT);
  // Whether the open animation has been triggered (deferred until first content measurement)
  const hasAnimatedOpen = useRef(false);
  // Measured real header height from onLayout (avoids hardcoded 84/64px guess)
  const headerHeightRef = useRef(0);

  useEffect(() => {
    const sub = sheetHeight.addListener(({ value }) => {
      currentHeight.current = value;
    });
    return () => sheetHeight.removeListener(sub);
  }, [sheetHeight]);

  const startOpenAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 160, friction: 16 }),
    ]).start();
  }, [opacity, translateY]);

  // Fallback: if onContentSizeChange hasn't fired within 150ms, open at MIN_HEIGHT.
  // This guards against edge cases (empty children, very slow layout pass).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasAnimatedOpen.current) {
        hasAnimatedOpen.current = true;
        collapsedHeight.current = MIN_HEIGHT;
        startOpenAnimation();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [MIN_HEIGHT, startOpenAnimation]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: screenHeight, duration: 140, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [screenHeight, onClose, translateY, opacity]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSheet();
      return true;
    });
    return () => subscription.remove();
  }, [closeSheet]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
        onPanResponderMove: (_, gs) => {
          if (gs.dy > 0) {
            // Dragging DOWN → move sheet away from bottom (dismiss feel)
            translateY.setValue(gs.dy);
            // Also shrink height back if we were expanded
            if (isExpanded.current) {
              const newH = Math.max(collapsedHeight.current, MAX_HEIGHT - gs.dy);
              sheetHeight.setValue(newH);
            }
          } else {
            // Dragging UP → only expand if content is tall enough
            if (contentHeight.current > MIN_HEIGHT) {
              const base = isExpanded.current ? MAX_HEIGHT : MIN_HEIGHT;
              const newH = Math.min(MAX_HEIGHT, base + (-gs.dy));
              sheetHeight.setValue(newH);
            }
            // Keep translateY at 0 so sheet stays anchored to bottom
            translateY.setValue(0);
          }
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dy > 80 || gs.vy > 0.5) {
            // Dismiss
            closeSheet();
          } else if (gs.dy > 0 && isExpanded.current) {
            // Dragged down while expanded — collapse back to content height
            isExpanded.current = false;
            Animated.spring(sheetHeight, {
              toValue: collapsedHeight.current,
              useNativeDriver: false,
              tension: 100,
              friction: 14,
            }).start();
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 14,
            }).start();
          } else if (gs.dy < -40 && contentHeight.current > MIN_HEIGHT) {
            // Dragged up enough — snap to expanded
            isExpanded.current = true;
            Animated.spring(sheetHeight, {
              toValue: MAX_HEIGHT,
              useNativeDriver: false,
              tension: 100,
              friction: 14,
            }).start();
            translateY.setValue(0);
          } else {
            // Snap back to current state
            Animated.spring(sheetHeight, {
              toValue: isExpanded.current ? MAX_HEIGHT : collapsedHeight.current,
              useNativeDriver: false,
              tension: 100,
              friction: 14,
            }).start();
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 14,
            }).start();
          }
        },
      }),
    [closeSheet, translateY, sheetHeight, MIN_HEIGHT, MAX_HEIGHT],
  );

  return (
    <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 1000 }}>
      {/* Dimmed backdrop — content behind is still visible */}
      <Animated.View
        style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', opacity }}
      >
        <Pressable style={{ flex: 1 }} onPress={closeSheet} />
      </Animated.View>

      {/* Sheet anchored to bottom */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        {/* Outer: native driver — handles open/close slide & dismiss drag */}
        <Animated.View
          style={{
            transform: [{ translateY }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 24,
          }}
        >
          {/* Inner: JS driver — height is set to exact content size (capped at 50%) */}
          <Animated.View
            style={{
              height: sheetHeight,
              backgroundColor: palette.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              overflow: 'hidden',
            }}
          >
            {/* Header — ONLY this area has panHandlers; onLayout measures real height */}
            <View
              {...panResponder.panHandlers}
              onLayout={(e) => {
                headerHeightRef.current = e.nativeEvent.layout.height;
              }}
            >
              {/* Drag handle */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                <View
                  style={{
                    width: 42,
                    height: 5,
                    borderRadius: 999,
                    backgroundColor: palette.divider,
                    opacity: 0.65,
                  }}
                />
              </View>
              {/* Title */}
              <View style={{ paddingHorizontal: horizontalPadding, paddingBottom: 12 }}>
                <Text
                  style={{ fontSize: 20, fontWeight: '600', color: palette.text, letterSpacing: -0.3 }}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    style={{ fontSize: 13, color: palette.textMuted, marginTop: 3, fontWeight: '400' }}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Scrollable content — no panHandlers, taps are instant */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={(_, h) => {
                // Use measured header height; fall back to estimate if onLayout hasn't fired yet
                const headerH = headerHeightRef.current > 0
                  ? headerHeightRef.current
                  : subtitle ? 84 : 64;
                const totalH = h + headerH + insets.bottom + 20;
                contentHeight.current = totalH;

                if (!isExpanded.current) {
                  const targetSnap = Math.min(totalH, MIN_HEIGHT);
                  collapsedHeight.current = targetSnap;

                  if (!hasAnimatedOpen.current) {
                    // First measurement: set correct height while sheet is still off-screen,
                    // then start the reveal animation. This prevents any height flash.
                    hasAnimatedOpen.current = true;
                    sheetHeight.setValue(targetSnap);
                    startOpenAnimation();
                  } else {
                    // Content changed while sheet is open — snap instantly
                    sheetHeight.setValue(targetSnap);
                  }
                }
              }}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}
