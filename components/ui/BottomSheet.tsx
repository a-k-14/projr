import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { BackHandler, Dimensions, View } from 'react-native';
import { Easing, ReduceMotion } from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHEET_GUTTER, FONT_WEIGHT } from '../../lib/design';
import { SCREEN_HEADER, HOME_RADIUS } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';
import { getSheetBottomPadding } from './safeBottom';

const BACKDROP_OPACITY = 0.4;

// Snappier than the default spring (which oscillates for ~350 ms). 200 ms
// timing with a decelerate curve feels instant but still smooth.
const SHEET_ANIMATION_CONFIGS = {
  duration: 200,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};
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
const SHEET_RADIUS = HOME_RADIUS.large;
const HEADER_TITLE_SIZE = SCREEN_HEADER.titleSize;
const HEADER_SUBTITLE_SIZE = 13;
const HEADER_SUBTITLE_MARGIN = 3;
const SHADOW_COLOR = '#000';
const MIN_NAV_FLOOR_HEIGHT = 24;

// Tab bar visible height in (tabs)/_layout.tsx (tabHeight=64 + safe-area bottom inset).
const TAB_BAR_BASE_HEIGHT = 64;

/**
 * BottomSheet — Centralized app sheet wrapper around @gorhom/bottom-sheet.
 *
 * Layout rules:
 * - hasNavBar=true: sheet floats *above* the tab bar (bottomInset = tab-bar height).
 *   Tab bar stays visible and tappable beneath the sheet.
 * - hasNavBar=false: sheet extends to the very bottom of the screen, with its
 *   `backgroundColor` filling the OS gesture-bar region. Scrollable content
 *   gets `paddingBottom = safeAreaBottom + extra` so the last row clears
 *   the gesture bar but the sheet *visually* continues behind it.
 *
 * Height rules:
 * - No `fixedHeightRatio` → enableDynamicSizing: sheet grows to fit content,
 *   capped at `maxDynamicContentSize = maxHeightRatio * screen (default 0.75)`.
 * - `fixedHeightRatio` set → single snap point at that % of available height.
 */
export function BottomSheet({
  title,
  subtitle,
  headerRight,
  showHeaderTitle = true,
  footer,
  palette,
  onClose,
  children,
  horizontalPadding = SHEET_GUTTER,
  hasNavBar = false,
  extraBottomPadding = 0,
  scrollEnabled = true,
  disableModalHeightBoost: _disableModalHeightBoost = false,
  headerBottom,
  maxHeightRatio,
  fixedHeightRatio,
  disableShadow = false,
  backgroundColor,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  showHeaderTitle?: boolean;
  footer?: ReactNode;
  palette: AppThemePalette;
  onClose: () => void;
  children: ReactNode;
  horizontalPadding?: number;
  hasNavBar?: boolean;
  extraBottomPadding?: number;
  scrollEnabled?: boolean;
  disableModalHeightBoost?: boolean;
  headerBottom?: ReactNode;
  maxHeightRatio?: number;
  fixedHeightRatio?: number;
  disableShadow?: boolean;
  backgroundColor?: string;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { height: screenHeight } = Dimensions.get('window');
  const [footerHeight, setFooterHeight] = useState(0);

  // When the sheet is rendered over a tabs screen, lift the sheet up so it sits
  // *above* the tab bar (tab bar remains visible & tappable).
  const bottomInset = hasNavBar ? TAB_BAR_BASE_HEIGHT + insets.bottom : 0;

  // For full-screen sheets (no nav bar), the sheet bottom edge IS the screen bottom.
  // Inner content needs extra padding so the last row clears the OS gesture area —
  // the sheet's backgroundColor naturally fills that area behind the gesture bar.
  const innerSafePadding = hasNavBar
    ? extraBottomPadding
    : getSheetBottomPadding(insets, extraBottomPadding + 3);

  const maxSheetHeight = screenHeight * (maxHeightRatio ?? 0.75);

  const snapPoints = useMemo(() => {
    if (!fixedHeightRatio) return undefined;
    const ratio = Math.min(fixedHeightRatio, maxHeightRatio ?? 0.95);
    return [`${Math.round(ratio * 100)}%`];
  }, [fixedHeightRatio, maxHeightRatio]);

  // Present once on mount.
  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  // Auto-dismiss when the underlying screen loses focus.
  useEffect(() => {
    if (!isFocused) {
      sheetRef.current?.dismiss();
    }
  }, [isFocused]);

  // Android hardware back: dismiss the sheet instead of letting it propagate to
  // navigation (which would pop the underlying screen while the sheet is open).
  // gorhom v5 doesn't wire this up internally, so we do it the same way the
  // original hand-rolled BottomSheet did.
  useEffect(() => {
    if (!isFocused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      sheetRef.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [isFocused]);

  const sheetFillColor = backgroundColor ?? palette.card;

  // Custom backdrop: when hasNavBar=true, the dim overlay is clipped at the tab-bar's
  // top edge so the tab bar isn't covered by the grey backdrop.
  const navBarOverlap = TAB_BAR_BASE_HEIGHT + insets.bottom;
  const floorHeight = Math.max(insets.bottom, MIN_NAV_FLOOR_HEIGHT);
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        style={[
          props.style,
          hasNavBar ? { bottom: navBarOverlap } : null,
        ]}
        opacity={BACKDROP_OPACITY}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [hasNavBar, navBarOverlap],
  );

  const renderHandle = useCallback(
    () => (
      <View
        style={{
          alignItems: 'center',
          paddingTop: HEADER_HANDLE_TOP_PADDING,
          paddingBottom: HEADER_HANDLE_BOTTOM_PADDING,
        }}
      >
        <View
          style={{
            width: HEADER_HANDLE_WIDTH,
            height: HEADER_HANDLE_HEIGHT,
            borderRadius: HOME_RADIUS.full,
            backgroundColor: palette.divider,
            opacity: 0.65,
          }}
        />
      </View>
    ),
    [palette.divider],
  );

  // Footer renderer:
  //   - When the consumer passes a `footer` node, render it with paddingBottom
  //     for the safe-area gesture region (so the buttons sit above the gesture bar
  //     but the sheet's background extends behind it).
  //   - When there's no consumer footer AND no nav bar, synthesize a "safe-area
  //     floor" — a footer made of nothing but `floorHeight` of sheet bg. This
  //     guarantees the OS gesture-bar zone has the sheet's background color,
  //     matching the original hand-rolled BottomSheet's `floor` View behavior.
  // The same safe-area floor used in the no-footer path is appended *below* the
  // consumer's footer so the OS gesture-bar zone is always covered by sheet bg,
  // matching `renderSafeAreaFloor`. (Previously this path used `innerSafePadding`,
  // which could collapse to ~3px on devices without a gesture inset.)
  const footerFloorPadding = hasNavBar ? innerSafePadding : floorHeight;
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View
          onLayout={(event) => {
            const h = Math.round(event.nativeEvent.layout.height);
            if (h !== footerHeight) setFooterHeight(h);
          }}
          style={{
            backgroundColor: sheetFillColor,
            paddingBottom: footerFloorPadding,
          }}
        >
          {footer}
        </View>
      </BottomSheetFooter>
    ),
    [footer, sheetFillColor, footerFloorPadding, footerHeight],
  );

  const renderSafeAreaFloor = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View
          pointerEvents="none"
          style={{ height: floorHeight, backgroundColor: sheetFillColor }}
        />
      </BottomSheetFooter>
    ),
    [floorHeight, sheetFillColor],
  );

  const showFloorFooter = !footer && !hasNavBar && floorHeight > 0;

  // Content needs to clear the floating footer (real or synthesized) so the last row
  // isn't hidden behind it.
  const contentBottomPadding = footer
    ? footerHeight + CONTENT_PADDING_BOTTOM
    : showFloorFooter
      ? floorHeight + CONTENT_PADDING_BOTTOM
      : innerSafePadding + CONTENT_PADDING_BOTTOM;

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      animationConfigs={SHEET_ANIMATION_CONFIGS}
      enableDynamicSizing={!fixedHeightRatio}
      maxDynamicContentSize={maxSheetHeight}
      bottomInset={bottomInset}
      enablePanDownToClose
      enableDismissOnClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      footerComponent={footer ? renderFooter : showFloorFooter ? renderSafeAreaFloor : undefined}
      onDismiss={onClose}
      backgroundStyle={{
        backgroundColor: sheetFillColor,
        borderTopLeftRadius: SHEET_RADIUS,
        borderTopRightRadius: SHEET_RADIUS,
      }}
      style={{
        shadowColor: SHADOW_COLOR,
        shadowOffset: { width: 0, height: SHADOW_OFFSET_Y },
        shadowOpacity: disableShadow ? 0 : SHADOW_OPACITY,
        shadowRadius: disableShadow ? 0 : SHADOW_RADIUS,
        elevation: disableShadow ? 0 : ELEVATION,
      }}
    >
      {/* Sticky header rendered inside standard children flow to prevent unmounting */}
      {showHeaderTitle || headerRight || headerBottom ? (
        <View style={{ backgroundColor: sheetFillColor }}>
          {showHeaderTitle || headerRight ? (
            <View style={{ paddingHorizontal: horizontalPadding, paddingBottom: HEADER_TITLE_PADDING_BOTTOM }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {showHeaderTitle ? (
                  <Text style={{ fontSize: HEADER_TITLE_SIZE, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text }}>
                    {title}
                  </Text>
                ) : (
                  <View />
                )}
                {headerRight ? <View style={{ marginLeft: 12 }}>{headerRight}</View> : null}
              </View>
              {showHeaderTitle && subtitle ? (
                <Text
                  style={{
                    fontSize: HEADER_SUBTITLE_SIZE,
                    color: palette.textMuted,
                    marginTop: HEADER_SUBTITLE_MARGIN,
                    fontWeight: FONT_WEIGHT.regular,
                  }}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          {headerBottom}
        </View>
      ) : null}

      {scrollEnabled ? (
        <BottomSheetScrollView
          contentContainerStyle={[
            { paddingBottom: contentBottomPadding },
            fixedHeightRatio ? { flexGrow: 1 } : null,
          ]}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="always"
        >
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView
          style={[
            { paddingBottom: contentBottomPadding },
            fixedHeightRatio ? { flex: 1 } : null,
          ]}
        >
          {children}
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}
