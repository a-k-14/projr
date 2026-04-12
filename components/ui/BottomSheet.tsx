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
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHEET_GUTTER } from '../../lib/design';
import type { AppThemePalette } from '../../lib/theme';

const MAX_HEIGHT_RATIO = 0.75;
const OPEN_ANIMATION_DURATION_MS = 150;
const CLOSE_ANIMATION_DURATION_MS = 140;
const BACKDROP_COLOR = 'rgb(0,0,0)';
const BACKDROP_OPACITY = 0.4;
const HEADER_HANDLE_WIDTH = 42;
const HEADER_HANDLE_HEIGHT = 5;
const HEADER_HANDLE_TOP_PADDING = 8;
const HEADER_HANDLE_BOTTOM_PADDING = 6;
const HEADER_TITLE_PADDING_BOTTOM = 10;
const CONTENT_PADDING_BOTTOM = 8;
const SHADOW_OFFSET_Y = -2;
const SHADOW_OPACITY = 0.08;
const SHADOW_RADIUS = 8;
const ELEVATION = 20;
const SHEET_RADIUS = 24;
const SWIPE_ACTIVATION_THRESHOLD = 8;
const SWIPE_DISMISS_DISTANCE = 80;
const SWIPE_DISMISS_VELOCITY = 0.5;
const HEADER_TITLE_SIZE = 20;
const HEADER_SUBTITLE_SIZE = 13;
const HEADER_TITLE_TRACKING = -0.3;
const HEADER_SUBTITLE_MARGIN = 3;
const SHADOW_COLOR = '#000';
const MODAL_HEIGHT_BOOST = 72;

/**
 * BottomSheet — Centralised bottom sheet for any picker/selection UI.
 *
 * Behaviour:
 * - Opens at natural content height, capped at 75% of screen.
 * - Swipe DOWN on header → dismisses.
 * - Tap backdrop → dismisses.
 */
export function BottomSheet({
  title,
  subtitle,
  headerRight,
  footer,
  palette,
  onClose,
  children,
  horizontalPadding = SHEET_GUTTER,
  hasNavBar = false,
  extraBottomPadding = 0,
  scrollEnabled = true,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
  palette: AppThemePalette;
  onClose: () => void;
  children: ReactNode;
  horizontalPadding?: number;
  hasNavBar?: boolean;
  extraBottomPadding?: number;
  scrollEnabled?: boolean;
}) {
  const { height: screenHeight } = Dimensions.get('window');
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const maxSheetHeight = screenHeight * MAX_HEIGHT_RATIO;
  const bottomInset = hasNavBar ? 0 : insets.bottom;
  const bottomOffset = extraBottomPadding + bottomInset;
  const modalHeightBoost = hasNavBar ? 0 : bottomInset + MODAL_HEIGHT_BOOST;

  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(new Animated.Value(0)).current;
  const contentHeight = useRef(0);
  const headerHeight = useRef(0);

  const commitHeight = useCallback(() => {
    const nextHeight = Math.min(headerHeight.current + contentHeight.current + modalHeightBoost, maxSheetHeight);
    if (nextHeight > 0) {
      sheetHeight.setValue(nextHeight);
    }
  }, [maxSheetHeight, modalHeightBoost, sheetHeight]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: BACKDROP_OPACITY, duration: OPEN_ANIMATION_DURATION_MS, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 160, friction: 16 }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: CLOSE_ANIMATION_DURATION_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: screenHeight, duration: CLOSE_ANIMATION_DURATION_MS, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [opacity, onClose, screenHeight, translateY]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSheet();
      return true;
    });
    return () => sub.remove();
  }, [closeSheet]);

  useEffect(() => {
    if (!isFocused) {
      closeSheet();
    }
  }, [closeSheet, isFocused]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dy) > SWIPE_ACTIVATION_THRESHOLD && Math.abs(gs.dy) > Math.abs(gs.dx),
        onPanResponderMove: (_, gs) => {
          translateY.setValue(gs.dy > 0 ? gs.dy : 0);
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dy > SWIPE_DISMISS_DISTANCE || gs.vy > SWIPE_DISMISS_VELOCITY) {
            closeSheet();
            return;
          }

          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 14,
          }).start();
        },
      }),
    [closeSheet, translateY],
  );

  return (
    <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 1000 }}>
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: BACKDROP_COLOR,
          opacity,
          bottom: bottomInset,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={closeSheet} />
      </Animated.View>

      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View
          style={{
            transform: [{ translateY }],
            shadowColor: SHADOW_COLOR,
            shadowOffset: { width: 0, height: SHADOW_OFFSET_Y },
            shadowOpacity: SHADOW_OPACITY,
            shadowRadius: SHADOW_RADIUS,
            elevation: ELEVATION,
            marginBottom: bottomOffset,
          }}
        >
          <Animated.View
            style={{
              height: sheetHeight,
              backgroundColor: palette.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              overflow: 'hidden',
            }}
          >
            <View
              {...panResponder.panHandlers}
              onLayout={(event) => {
                const next = Math.round(event.nativeEvent.layout.height);
                if (next !== headerHeight.current) {
                  headerHeight.current = next;
                  commitHeight();
                }
              }}
            >
              <View style={{ alignItems: 'center', paddingTop: HEADER_HANDLE_TOP_PADDING, paddingBottom: HEADER_HANDLE_BOTTOM_PADDING }}>
                <View
                  style={{
                    width: HEADER_HANDLE_WIDTH,
                    height: HEADER_HANDLE_HEIGHT,
                    borderRadius: 999,
                    backgroundColor: palette.divider,
                    opacity: 0.65,
                  }}
                />
              </View>
              <View style={{ paddingHorizontal: horizontalPadding, paddingBottom: HEADER_TITLE_PADDING_BOTTOM }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: HEADER_TITLE_SIZE, fontWeight: '600', color: palette.text, letterSpacing: HEADER_TITLE_TRACKING }}>
                    {title}
                  </Text>
                  {headerRight ? <View style={{ marginLeft: 12 }}>{headerRight}</View> : null}
                </View>
                {subtitle ? (
                  <Text style={{ fontSize: HEADER_SUBTITLE_SIZE, color: palette.textMuted, marginTop: HEADER_SUBTITLE_MARGIN, fontWeight: '400' }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>

            {scrollEnabled ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={(_, h) => {
                  contentHeight.current = h;
                  commitHeight();
                }}
              >
                {children}
              </ScrollView>
            ) : (
              <View
                style={{ width: '100%' }}
                collapsable={false}
                onLayout={(event) => {
                  const next = Math.round(event.nativeEvent.layout.height);
                  if (next !== contentHeight.current) {
                    contentHeight.current = next;
                    commitHeight();
                  }
                }}
              >
                {children}
              </View>
            )}
            {footer ? <View>{footer}</View> : null}
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}
