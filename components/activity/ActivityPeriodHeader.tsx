import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View , TouchableOpacity} from 'react-native';
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
          flex: 1 },
      ]}
    >
      <TouchableOpacity delayPressIn={0}
        onPress={goPrev}
        disabled={isDisabled}
        style={[styles.periodArrow, { borderRightColor: palette.divider }]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons
          name="chevron-back"
          size={14}
          color={palette.text}
          style={{ opacity: isDisabled ? 0.2 : 1 }}
        />
      </TouchableOpacity>

      <View style={styles.periodCenter}>
        <TouchableOpacity delayPressIn={0}
          onPress={() => setShowPeriodSheet(true)}
          style={styles.periodCenterTouch}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '600', color: palette.text }} numberOfLines={1}>
            {periodLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity delayPressIn={0}
        onPress={goNext}
        disabled={!canGoNext}
        style={[styles.periodArrow, { borderLeftColor: palette.divider }]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons
          name="chevron-forward"
          size={14}
          color={palette.text}
          style={{ opacity: canGoNext ? 1 : 0.2 }}
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
    borderWidth: 1.5,
    overflow: 'hidden' },
  periodArrow: {
    width: ACTIVITY_LAYOUT.periodArrowWidth,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center' },
  periodCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center' },
  periodCenterTouch: {
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8 } });
