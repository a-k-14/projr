import React from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Text } from '../ui/AppText';
import type { AppThemePalette } from '../../lib/theme';
import { HOME_RADIUS, SCREEN_GUTTER } from '../../lib/layoutTokens';
import { CARD_PADDING, HOME_TEXT } from '../../lib/design';

const STACK_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6'];
const OTHERS_COLOR = '#94A3B8';

interface CategoryTotal {
  categoryId: string;
  name: string;
  amount: number;
}

interface BucketData {
  label: string;
  categoryTotals: CategoryTotal[];
}

interface Props {
  data: BucketData[];
  palette: AppThemePalette;
  sym: string;
  topCategories: { categoryId: string; name: string }[];
}

export function CategoryStackedChart({ data, palette, topCategories }: Props): React.ReactElement | null {
  const { width } = useWindowDimensions();

  const allZero = data.every((b) => b.categoryTotals.every((c) => c.amount === 0));

  const chartWidth = width - SCREEN_GUTTER * 2 - CARD_PADDING * 2;
  const spacing = 8;
  const barWidth = Math.max(12, Math.floor((chartWidth - (data.length - 1) * spacing - 16) / data.length));

  // Build stackData
  const stackData = data.map((bucket) => {
    const stacks = bucket.categoryTotals
      .filter((ct) => ct.amount > 0)
      .map((ct) => {
        const topIdx = topCategories.findIndex((tc) => tc.categoryId === ct.categoryId);
        const color = ct.categoryId === '__others__'
          ? OTHERS_COLOR
          : topIdx >= 0
            ? STACK_COLORS[topIdx % STACK_COLORS.length]
            : OTHERS_COLOR;
        return { value: ct.amount, color };
      });

    // gifted-charts needs at least one stack item; provide zero placeholder if empty
    const stackItems = stacks.length > 0 ? stacks : [{ value: 0, color: palette.divider }];

    return {
      stacks: stackItems,
      label: bucket.label,
      labelTextStyle: { fontSize: HOME_TEXT.tiny, color: palette.textMuted },
      barWidth,
      spacing: spacing,
    };
  });

  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: HOME_RADIUS.card,
        padding: CARD_PADDING,
        borderWidth: 1,
        borderColor: palette.divider,
        marginBottom: 20,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>Spending by Category</Text>
      </View>

      {allZero ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>No spending data for this period</Text>
        </View>
      ) : (
        <>
          <View style={{ marginLeft: -4 }}>
            <BarChart
              stackData={stackData}
              isAnimated
              animationDuration={700}
              hideYAxisText
              yAxisThickness={0}
              xAxisColor={palette.divider}
              noOfSections={3}
              rulesColor={palette.divider + '50'}
              barBorderRadius={3}
              initialSpacing={8}
              width={chartWidth}
              height={120}
            />
          </View>

          {/* Legend */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 8 }}
            contentContainerStyle={{ gap: 12, paddingRight: 4 }}
          >
            {topCategories.map((cat, idx) => (
              <View key={cat.categoryId} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: STACK_COLORS[idx % STACK_COLORS.length],
                  }}
                />
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>{cat.name}</Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}
