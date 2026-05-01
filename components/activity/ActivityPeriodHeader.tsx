import { Text } from '@/components/ui/AppText';
import { AppChevron } from '@/components/ui/AppChevron';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
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
}

export function ActivityPeriodHeader({
  period,
  periodLabel,
  goPrev,
  goNext,
  canGoNext,
  setShowPeriodSheet,
  palette }: ActivityPeriodHeaderProps) {
  const isDisabled = period === 'custom' || period === 'all';

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
        style={[styles.periodArrow, { borderRightColor: palette.divider }]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <AppChevron
          direction="left"
          size={16}
          tone={isDisabled ? 'secondary' : 'primary'}
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
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '600', color: palette.text }} numberOfLines={1}>
            {periodLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity delayPressIn={0}
        onPress={canGoNext ? goNext : undefined}
        style={[styles.periodArrow, { borderLeftColor: palette.divider }]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <AppChevron
          direction="right"
          size={16}
          tone={canGoNext ? 'primary' : 'secondary'}
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
  periodCenter: {
    flex: 1,
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
