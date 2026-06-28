import React from 'react';
import { View } from 'react-native';
import { Text } from '../ui/AppText';
import { AppIcon } from '../ui/AppIcon';
import { FONT_WEIGHT } from '../../lib/design';
import type { AppThemePalette } from '../../lib/theme';

interface ChartTooltipProps {
  palette: AppThemePalette;
  dateLabel: string;
  valueLabel: string;
  hasPrev?: boolean | null;
  prevDateLabel?: string;
  diffLabel?: string;
  isPositive?: boolean;
  topOffset?: number;
}

export function ChartTooltip({
  palette,
  dateLabel,
  valueLabel,
  hasPrev,
  prevDateLabel,
  diffLabel,
  isPositive,
  topOffset = 28,
}: ChartTooltipProps) {
  const tooltipBg = palette.background;
  const textMainColor = palette.text;
  const textMutedColor = palette.textSecondary;
  const dividerColor = palette.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';

  return (
    <View
      style={{
        position: 'absolute',
        top: topOffset,
        alignSelf: 'center',
        backgroundColor: tooltipBg,
        borderRadius: 12,
        borderWidth: 0.8,
        borderColor: palette.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        paddingVertical: 8,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        zIndex: 100,
        shadowColor: palette.isDark ? '#000000' : '#94A3B8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: palette.isDark ? 0.3 : 0.15,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      {/* Column 1: Dates */}
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ fontSize: 11, color: textMutedColor, fontWeight: FONT_WEIGHT.semibold }}>
          {dateLabel}
        </Text>
        {hasPrev && prevDateLabel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 9.5, color: palette.textMuted, marginRight: 3 }}>vs</Text>
            <Text style={{ fontSize: 10, color: textMutedColor, fontWeight: FONT_WEIGHT.medium }}>
              {prevDateLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Divider */}
      <View style={{ width: 1, height: hasPrev ? 26 : 14, backgroundColor: dividerColor }} />

      {/* Column 2: Amounts */}
      <View style={{ alignItems: 'flex-start', gap: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.semibold, color: textMainColor }}>
          {valueLabel}
        </Text>
        {hasPrev && diffLabel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <AppIcon
              name={isPositive ? 'trending-up' : 'trending-down'}
              size={12}
              color={isPositive ? palette.numberPositive : palette.numberNegative}
              strokeWidth={2.5}
            />
            <Text
              style={{
                fontSize: 10,
                color: isPositive ? palette.numberPositive : palette.numberNegative,
                fontWeight: FONT_WEIGHT.bold,
              }}
            >
              {diffLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
