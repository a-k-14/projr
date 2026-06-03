import { Text } from '@/components/ui/AppText';
import { AppChevron } from '@/components/ui/AppChevron';
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
}: ActivityPeriodHeaderProps) {
  const isDisabled = period === 'custom' || period === 'all' || period === 'last30';
  const arrowStyle = largeArrows ? styles.periodArrowLarge : styles.periodArrow;
  const arrowHitSlop = largeArrows
    ? { top: 18, bottom: 18, left: 18, right: 18 }
    : { top: 12, bottom: 12, left: 12, right: 12 };
  // In the wide variant, sit the chevrons close to the bar's outer edges instead of
  // centering them inside the (wider) hit columns.
  const prevArrowAlign = largeArrows ? { alignItems: 'flex-start' as const, paddingLeft: 14 } : null;
  const nextArrowAlign = largeArrows ? { alignItems: 'flex-end' as const, paddingRight: 14 } : null;
  return (
    <View
      style={[
        styles.periodBar,
        {
          backgroundColor: palette.surface,
          borderColor: palette.divider,
          flex: 1
        },
      ]}
    >
      <TouchableOpacity delayPressIn={0}
        onPress={isDisabled ? undefined : goPrev}
        style={[arrowStyle, prevArrowAlign, { borderRightColor: palette.divider }]}
        hitSlop={arrowHitSlop}
      >
        <AppChevron
          direction="left"
          size={16}
          tone={isDisabled ? 'subtle' : 'primary'}
          opacity={1}
          palette={palette}
        />
      </TouchableOpacity>

      <View style={styles.periodCenter}>
        <TouchableOpacity delayPressIn={0}
          onPress={() => setShowPeriodSheet(true)}
          style={styles.periodCenterTouch}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
        >
          <Text
            appWeight="medium"
            style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}
            numberOfLines={1}
          >
            {periodLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity delayPressIn={0}
        onPress={canGoNext ? goNext : undefined}
        style={[arrowStyle, nextArrowAlign, { borderLeftColor: palette.divider }]}
        hitSlop={arrowHitSlop}
      >
        <AppChevron
          direction="right"
          size={16}
          tone={canGoNext ? 'primary' : 'subtle'}
          opacity={1}
          palette={palette}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  periodBar: {
    height: ACTIVITY_LAYOUT.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ACTIVITY_LAYOUT.controlRadius,
    borderWidth: 1,
    overflow: 'hidden'
  },
  periodArrow: {
    width: ACTIVITY_LAYOUT.periodArrowWidth,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  periodArrowLarge: {
    width: ACTIVITY_LAYOUT.periodArrowWidth + 24,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  periodCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  periodCenterTouch: {
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  }
});
