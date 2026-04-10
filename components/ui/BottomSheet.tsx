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
 *
 * hasNavBar: pass true when the sheet is rendered inside a tab screen.
 * The tab bar already lifts the sheet, so only a small bottom gap is needed.
 * Without a navbar (modals) the sheet sits at the device edge and needs the
 * full safe-area inset to clear the OS gesture bar.
 */
export function BottomSheet({
  title,
  subtitle,
  palette,
  onClose,
  children,
  horizontalPadding = SHEET_GUTTER,
  hasNavBar = false,
}: {
  title: string;
  subtitle?: string;
  palette: AppThemePalette;
  onClose: () => void;
  children: ReactNode;
  horizontalPadding?: number;
  hasNavBar?: boolean;
}) {
  const { height: screenHeight } = Dimensions.get('window');
  const insets = useSafeAreaInsets();

  const MIN_HEIGHT = screenHeight * 0.5;
  const MAX_HEIGHT = screenHeight * 0.75;

  // translateY: native driver — slide in/out & dismiss drag
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  // sheetHeight: JS driver — snapped to content size, animated during expand gesture
  const sheetHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const contentHeight = useRef(0);
  const isExpanded = useRef(false);
  const collapsedHeight = useRef(MIN_HEIGHT);

  // Open animation starts immediately. onContentSizeChange fires within the first
  // frame (~16 ms), which is long before the spring reaches the visible area
  // (~200 ms), so sheetHeight is always correct before the sheet appears.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 160, friction: 16 }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: screenHeight, duration: 140, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [screenHeight, onClose, translateY, opacity]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSheet();
      return true;
    });
    return () => sub.remove();
  }, [closeSheet]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
        onPanResponderMove: (_, gs) => {
          if (gs.dy > 0) {
            // Dragging DOWN — follow finger; shrink if expanded
            translateY.setValue(gs.dy);
            if (isExpanded.current) {
              sheetHeight.setValue(Math.max(collapsedHeight.current, MAX_HEIGHT - gs.dy));
            }
          } else {
            // Dragging UP — only expand when content exceeds 50%
            if (contentHeight.current > MIN_HEIGHT) {
              const base = isExpanded.current ? MAX_HEIGHT : MIN_HEIGHT;
              sheetHeight.setValue(Math.min(MAX_HEIGHT, base + -gs.dy));
            }
            translateY.setValue(0);
          }
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dy > 80 || gs.vy > 0.5) {
            closeSheet();
          } else if (gs.dy > 0 && isExpanded.current) {
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
            isExpanded.current = true;
            Animated.spring(sheetHeight, {
              toValue: MAX_HEIGHT,
              useNativeDriver: false,
              tension: 100,
              friction: 14,
            }).start();
            translateY.setValue(0);
          } else {
            // Snap back
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

  // Tab screens: sheet sits above the navbar, just needs a small visual gap.
  // Modal screens: sheet reaches the device edge, needs full safe-area clearance.
  const bottomPad = hasNavBar ? 20 : insets.bottom + 20;

  // Approximate header height used for total-height calculation in onContentSizeChange.
  // Drag handle = 25 px, title row ≈ 40 px, subtitle row ≈ 21 px when present.
  const headerH = subtitle ? 86 : 65;

  return (
    <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 1000 }}>
      {/* Dimmed backdrop */}
      <Animated.View
        style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', opacity }}
      >
        <Pressable style={{ flex: 1 }} onPress={closeSheet} />
      </Animated.View>

      {/* Sheet anchored to bottom */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        {/* Outer: native driver — slide & dismiss */}
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
          {/* Inner: JS driver — exact content height, capped at 50% */}
          <Animated.View
            style={{
              height: sheetHeight,
              backgroundColor: palette.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              overflow: 'hidden',
            }}
          >
            {/* Header — only this area handles pan gestures */}
            <View {...panResponder.panHandlers}>
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

            {/* Scrollable content */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: bottomPad }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={(_, h) => {
                // h includes contentContainerStyle paddingBottom — no need to add it again
                const totalH = h + headerH;
                contentHeight.current = totalH;

                if (!isExpanded.current) {
                  const target = Math.min(totalH, MIN_HEIGHT);
                  collapsedHeight.current = target;
                  sheetHeight.setValue(target);
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
