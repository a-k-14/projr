import { AppChevron } from '@/components/ui/AppChevron';
import { Text } from '@/components/ui/AppText';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { FONT_WEIGHT } from '../../lib/design';
import { ACTIVITY_LAYOUT, HOME_TEXT } from '../../lib/layoutTokens';
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
  arrowAccent = false,
}: ActivityPeriodHeaderProps) {
  const isDisabled = period === 'custom' || period === 'all' || period === 'last30';

  const vHeight = height ?? ACTIVITY_LAYOUT.controlHeight;
  const hitExtension = 14;
  const totalHeight = vHeight + hitExtension * 2;

  // Arrow touchable width (40px standard visual width, 56px large)
  const arrowWidth = largeArrows ? (ACTIVITY_LAYOUT.periodArrowWidth + 24) : 40;

  // In the wide variant, sit the chevrons close to the bar's outer edges instead of
  // centering them inside the (wider) hit columns.
  const prevArrowAlign = largeArrows ? { alignItems: 'flex-start' as const, paddingLeft: 14 } : null;
  const nextArrowAlign = largeArrows ? { alignItems: 'flex-end' as const, paddingRight: 14 } : null;

  // We can still use a hitSlop for extra horizontal padding (iOS-safe since container covers it)
  const arrowHitSlop = largeArrows
    ? { top: 0, bottom: 0, left: 18, right: 18 }
    : { top: 0, bottom: 0, left: 16, right: 12 };

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
      {/* Visual pill background & border */}
      <View
        style={[
          styles.periodBarVisual,
          {
            backgroundColor: palette.surface,
            borderColor: palette.divider,
            top: hitExtension,
            bottom: hitExtension,
            borderRadius: ACTIVITY_LAYOUT.controlRadius,
          },
        ]}
        pointerEvents="none"
      />

      {/* Row containing actual interactive elements */}
      <View style={[styles.periodContentRow, { height: totalHeight }]}>
        <TouchableOpacity
          delayPressIn={0}
          onPress={isDisabled ? undefined : goPrev}
          style={[
            styles.periodArrowTouch,
            { width: arrowWidth },
            prevArrowAlign,
          ]}
          hitSlop={arrowHitSlop}
        >
          <AppChevron
            direction="left"
            size={16}
            tone={isDisabled ? 'subtle' : 'primary'}
            opacity={1}
            palette={palette}
          />
          {arrowAccent && (
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: hitExtension,
                bottom: hitExtension,
                width: 1,
                backgroundColor: palette.divider,
              }}
            />
          )}
        </TouchableOpacity>

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
                fontSize: HOME_TEXT.bodySmall,
                fontWeight: FONT_WEIGHT.medium,
                color: palette.text,
              }}
              numberOfLines={1}
            >
              {periodLabel}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          delayPressIn={0}
          onPress={canGoNext ? goNext : undefined}
          style={[
            styles.periodArrowTouch,
            { width: arrowWidth },
            nextArrowAlign,
          ]}
          hitSlop={arrowHitSlop}
        >
          <AppChevron
            direction="right"
            size={16}
            tone={canGoNext ? 'primary' : 'subtle'}
            opacity={1}
            palette={palette}
          />
          {arrowAccent && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: hitExtension,
                bottom: hitExtension,
                width: 1,
                backgroundColor: palette.divider,
              }}
            />
          )}
        </TouchableOpacity>
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
  },
  periodArrowTouch: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodCenterTouch: {
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
