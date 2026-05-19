import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Text } from '../ui/AppText';
import type { AppThemePalette } from '../../lib/theme';
import { HOME_RADIUS, SCREEN_GUTTER } from '../../lib/layoutTokens';
import { CARD_PADDING, HOME_TEXT, FONT_WEIGHT } from '../../lib/design';
import { formatCompactCurrency } from '../../lib/derived';

interface Props {
  data: { label: string; income: number; expense: number }[];
  palette: AppThemePalette;
  sym: string;
  period?: string;
}

export function IncomeExpenseChart({ data, palette, sym }: Props): React.ReactElement | null {
  const { width } = useWindowDimensions();

  const allZero = data.every((d) => d.income === 0 && d.expense === 0);

  const chartWidth = width - SCREEN_GUTTER * 2 - CARD_PADDING * 2;
  const groupSpacing = 12;

  const incomeColor = palette.numberPositive;
  const expenseColor = palette.numberNegative;

  // 2 bars per bucket, income then expense
  const barWidth = Math.max(8, Math.floor((chartWidth - data.length * (2 + groupSpacing)) / (data.length * 2 + 1)));

  const barData = data.flatMap((bucket, i) => [
    {
      value: bucket.income,
      frontColor: incomeColor,
      spacing: 2,
      barWidth,
      capRadius: 6,
    },
    {
      value: bucket.expense,
      frontColor: expenseColor,
      spacing: i < data.length - 1 ? groupSpacing : 0,
      barWidth,
      capRadius: 6,
    },
  ]);

  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalExpense = data.reduce((s, d) => s + d.expense, 0);
  const net = totalIncome - totalExpense;
  const netColor = net >= 0 ? palette.numberPositive : palette.numberNegative;

  const maxValue = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);

  // Compute pixel offset for each group label to align with bar group center
  const groupWidth = barWidth * 2 + 2 + groupSpacing;
  const firstGroupCenter = 6 + barWidth; // initialSpacing + half of first bar

  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: HOME_RADIUS.card,
        padding: CARD_PADDING,
        borderWidth: 1,
        borderColor: palette.divider,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>Income vs Expense</Text>
        <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: netColor }}>
          {formatCompactCurrency(net, sym)}
        </Text>
      </View>

      {allZero ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>No data for this period</Text>
        </View>
      ) : (
        <>
          <View style={{ marginLeft: -4 }}>
            <BarChart
              data={barData}
              barBorderRadius={6}
              isAnimated
              animationDuration={700}
              hideYAxisText
              yAxisThickness={0}
              xAxisColor={palette.divider}
              noOfSections={3}
              rulesColor={palette.divider + '50'}
              initialSpacing={6}
              endSpacing={0}
              maxValue={maxValue * 1.15}
              width={chartWidth}
              height={120}
              xAxisLabelsHeight={0}
            />
          </View>

          {/* X-axis labels aligned to each group center */}
          <View style={{ position: 'relative', height: 14, marginTop: 3, marginLeft: -4 }}>
            {data.map((bucket, i) => {
              const center = firstGroupCenter + i * groupWidth + barWidth / 2;
              const labelW = 24;
              const left = Math.min(Math.max(center - labelW / 2, 0), chartWidth - labelW);
              return (
                <Text
                  key={bucket.label + i}
                  style={{
                    position: 'absolute',
                    left,
                    width: labelW,
                    textAlign: 'center',
                    fontSize: HOME_TEXT.tiny,
                    color: palette.textMuted,
                  }}
                >
                  {bucket.label}
                </Text>
              );
            })}
          </View>

          {/* Legend */}
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: incomeColor }} />
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Income</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: expenseColor }} />
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Expense</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
