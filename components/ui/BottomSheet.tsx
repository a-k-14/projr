import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
}: {
  title: string;
  subtitle?: string;
  palette: AppThemePalette;
  onClose: () => void;
  children: ReactNode;
}) {
  const { height: screenHeight } = Dimensions.get('window');
  const insets = useSafeAreaInsets();

  const MIN_HEIGHT = screenHeight * 0.5;
  const MAX_HEIGHT = screenHeight * 0.75;

  // translateY: native driver, used for open/close animation & downward drag dismiss
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  // sheetHeight: JS driver, used for expansion drag tracking and capping
  // We initialize to MAX_HEIGHT to allow small content to fit naturally, 
  // but the animation logic will snap it to appropriate points.
  const sheetHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Track whether content needs expansion (set via onContentSizeChange)
  const contentHeight = useRef(0);
  // Track current snap state for gesture logic
  const isExpanded = useRef(false);
  // Track current height value synchronously
  const currentHeight = useRef(MIN_HEIGHT);

  useEffect(() => {
    const sub = sheetHeight.addListener(({ value }) => {
      currentHeight.current = value;
    });
    return () => sheetHeight.removeListener(sub);
  }, [sheetHeight]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: screenHeight, duration: 140, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [screenHeight, onClose, translateY, opacity]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 160, friction: 16 }),
    ]).start();
  }, [translateY, opacity]);

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
              const newH = Math.max(MIN_HEIGHT, MAX_HEIGHT - gs.dy);
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
            // Dragged down while expanded — collapse back to 50%
            isExpanded.current = false;
            Animated.spring(sheetHeight, { toValue: MIN_HEIGHT, useNativeDriver: false, tension: 100, friction: 14 }).start();
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 14 }).start();
          } else if (gs.dy < -40 && contentHeight.current > MIN_HEIGHT) {
            // Dragged up enough — snap to expanded
            isExpanded.current = true;
            Animated.spring(sheetHeight, { toValue: MAX_HEIGHT, useNativeDriver: false, tension: 100, friction: 14 }).start();
            translateY.setValue(0);
          } else {
            // Snap back to current state
            Animated.spring(sheetHeight, {
              toValue: isExpanded.current ? MAX_HEIGHT : MIN_HEIGHT,
              useNativeDriver: false,
              tension: 100,
              friction: 14,
            }).start();
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 14 }).start();
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
          {/* Inner: JS driver — handles smooth height expansion, shrinks to content naturally */}
          <Animated.View
            style={{
              maxHeight: sheetHeight,
              backgroundColor: palette.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              overflow: 'hidden',
            }}
          >
            {/* Header — ONLY this area has panHandlers */}
            <View {...panResponder.panHandlers}>
              {/* Drag handle */}
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: palette.divider,
                    opacity: 0.5,
                  }}
                />
              </View>
              {/* Title */}
              <View style={{ paddingHorizontal: 22, paddingBottom: 12 }}>
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
              style={{ flexShrink: 1, flexGrow: 0 }}
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={(_, h) => {
                const headerH = subtitle ? 84 : 64; 
                const totalH = h + headerH + insets.bottom + 20;
                contentHeight.current = totalH;
                
                // Collapsed state: height is capped at content-size OR 50% screen, whichever is lower.
                // This ensures "hugging" for small lists while maintaining the 50% cap for long ones.
                if (!isExpanded.current) {
                  const targetSnap = Math.min(totalH, MIN_HEIGHT);
                  sheetHeight.setValue(targetSnap);
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

