import { AppChevron } from '@/components/ui/AppChevron';
import { Text } from '@/components/ui/AppText';
import React from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { FONT_WEIGHT } from '../../lib/design';
import { ACTIVITY_LAYOUT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';

interface ActivityPeriodHeaderProps {
  period: string;
  periodLabel: string;
  goPrev: () => void;
  goNext: () => void;
  canGoNext: boolean;
  setShowPeriodSheet: (show: boolean) => void;
  palette: AppThemePalette;
  /** Widen the prev/next arrow hit targets — used on the Export screen where there's
   *  extra horizontal room compared to the Activity filter bar. */
  largeArrows?: boolean;
  /** Override bar height. Defaults to ACTIVITY_LAYOUT.controlHeight. */
  height?: number;
  /** When true, paint a subtle separator behind each arrow so they read as buttons. */
  arrowAccent?: boolean;
  noBackground?: boolean;
}

export function ActivityPeriodHeader({
  period,
  periodLabel,
  goPrev,
  goNext,
  canGoNext,
  setShowPeriodSheet,
  palette,
  largeArrows = false,
  height,
  noBackground = false,
}: ActivityPeriodHeaderProps) {
  const isDisabled = period === 'custom' || period === 'all' || period === 'last30';

  const vHeight = height ?? (ACTIVITY_LAYOUT.controlHeight + 2);
  const hitExtension = 14;
  const totalHeight = vHeight + hitExtension * 2;

  const prevArrowHitSlop = largeArrows
    ? { top: 16, bottom: 16, left: 32, right: 48 }
    : { top: 16, bottom: 16, left: 24, right: 40 };

  const nextArrowHitSlop = largeArrows
    ? { top: 16, bottom: 16, left: 48, right: 32 }
    : { top: 16, bottom: 16, left: 40, right: 24 };

  const prevScale = useSharedValue(1);
  const nextScale = useSharedValue(1);

  const prevAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: prevScale.value }],
  }));

  const nextAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nextScale.value }],
  }));

  return (
    <View
      style={[
        styles.periodBarContainer,
        {
          height: totalHeight,
          marginVertical: -hitExtension,
        },
      ]}
    >
      {/* Shared pill background & border */}
      {!noBackground && (
        <View
          style={[
            styles.periodBarVisual,
            {
              backgroundColor: palette.surface,
              borderColor: palette.borderSoft,
              top: hitExtension,
              bottom: hitExtension,
              borderRadius: ACTIVITY_LAYOUT.controlRadius,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Row containing actual interactive elements */}
      <View style={[styles.periodContentRow, { height: totalHeight }]}>
        <Pressable
          onPress={isDisabled ? undefined : goPrev}
          onPressIn={() => { prevScale.value = withTiming(0.9, { duration: 80 }); }}
          onPressOut={() => { prevScale.value = withTiming(1, { duration: 120 }); }}
          hitSlop={prevArrowHitSlop}
        >
          <Animated.View
            style={[
              styles.periodArrowTouch,
              prevAnimStyle,
              {
                width: 28,
                height: 28,
                opacity: 1,
              }
            ]}
          >
            <AppChevron
              direction="left"
              size={16}
              color={isDisabled ? palette.textMuted : palette.text}
              strokeWidth={2.4}
              palette={palette}
            />
          </Animated.View>
        </Pressable>

        {/* Center — period label + down chevron */}
        <View style={styles.periodCenter}>
          <TouchableOpacity
            delayPressIn={0}
            onPress={() => setShowPeriodSheet(true)}
            style={styles.periodCenterTouch}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Text
              appWeight="medium"
              style={{
                fontSize: 15,
                fontWeight: FONT_WEIGHT.medium,
                color: palette.text,
              }}
              numberOfLines={1}
            >
              {periodLabel}
            </Text>
            <AppChevron
              direction="down"
              size={13}
              tone="primary"
              opacity={1}
              palette={palette}
            />
          </TouchableOpacity>
        </View>

        <Pressable
          onPress={canGoNext ? goNext : undefined}
          onPressIn={() => { nextScale.value = withTiming(0.9, { duration: 80 }); }}
          onPressOut={() => { nextScale.value = withTiming(1, { duration: 120 }); }}
          hitSlop={nextArrowHitSlop}
        >
          <Animated.View
            style={[
              styles.periodArrowTouch,
              nextAnimStyle,
              {
                width: 28,
                height: 28,
                opacity: 1,
              }
            ]}
          >
            <AppChevron
              direction="right"
              size={16}
              color={!canGoNext ? palette.textMuted : palette.text}
              strokeWidth={2.4}
              palette={palette}
            />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  periodBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  periodBarVisual: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderWidth: 1,
  },
  periodContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  periodArrowTouch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodCenterTouch: {
    height: '100%',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
});
