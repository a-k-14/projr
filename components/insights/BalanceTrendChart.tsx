import React, { useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Text } from '../ui/AppText';
import { AppIcon } from '../ui/AppIcon';
import type { AppThemePalette } from '../../lib/theme';
import { HOME_RADIUS, SCREEN_GUTTER } from '../../lib/layoutTokens';
import { CARD_PADDING, HOME_TEXT, FONT_WEIGHT } from '../../lib/design';
import { formatCompactCurrency } from '../../lib/derived';
import { formatDateShort } from '../../lib/dateUtils';

interface Props {
  data: { date: string; balance: number }[];
  palette: AppThemePalette;
  sym: string;
  period: string;
}

const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type XLabel = { label: string; position: number };

function getXLabels(data: { date: string }[], period: string): XLabel[] {
  const total = data.length;
  if (total < 2) return [];

  if (period === 'week') {
    return data.map((d, i) => {
      const date = new Date(d.date.slice(0, 10) + 'T12:00:00');
      return { label: DAY_ABBR[date.getDay()], position: i / (total - 1) };
    });
  }
  if (period === 'month') {
    const labels: XLabel[] = [];
    data.forEach((d, i) => {
      if (i % 7 === 0) labels.push({ label: `W${Math.floor(i / 7) + 1}`, position: i / (total - 1) });
    });
    return labels;
  }
  if (period === 'year') {
    const labels: XLabel[] = [];
    data.forEach((d, i) => {
      const date = new Date(d.date.slice(0, 10) + 'T12:00:00');
      if (date.getDate() === 1) labels.push({ label: MONTH_ABBR[date.getMonth()], position: i / (total - 1) });
    });
    return labels;
  }
  return [
    { label: formatDateShort(data[0].date), position: 0 },
    { label: formatDateShort(data[total - 1].date), position: 1 },
  ];
}

const CHART_H = 110;
const LABEL_W = 26;

export function BalanceTrendChart({ data, palette, sym, period }: Props): React.ReactElement | null {
  const { width } = useWindowDimensions();
  const [activePoint, setActivePoint] = useState<{ balance: number; date: string } | null>(null);
  // Tracks last set value to prevent calling setState when pointer hasn't moved to a new data point
  const lastActiveKey = useRef('');

  if (data.length < 2) return null;

  const chartWidth = width - SCREEN_GUTTER * 2 - CARD_PADDING * 2;
  const balances = data.map((d) => d.balance);
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances);
  const buffer = Math.max((maxBal - minBal) * 0.15, 100);

  // Normalize values so the y-axis floor is 0. This avoids mostNegativeValue entirely,
  // which has a known bug where the pointer dot position ignores the offset.
  const yFloor = minBal - buffer;
  const yCeil = maxBal + buffer;

  const endBalance = data[data.length - 1].balance;
  const startBalance = data[0].balance;
  const change = endBalance - startBalance;
  const changePct = startBalance !== 0 ? (change / Math.abs(startBalance)) * 100 : 0;
  const isPositive = change >= 0;
  const changeColor = isPositive ? palette.numberPositive : palette.numberNegative;

  // Store original balance alongside the normalized value for tooltip use
  const lineData = data.map((d) => ({
    value: d.balance - yFloor,
    originalBalance: d.balance,
    customDate: d.date,
  } as any));

  const xLabels = getXLabels(data, period);

  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: HOME_RADIUS.card,
        padding: CARD_PADDING,
        borderWidth: 1,
        borderColor: palette.divider,
        marginBottom: 12,
      }}
    >
      {/* Title row with live hover chip */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
          Net Worth
        </Text>

        {activePoint ? (
          <View style={{
            backgroundColor: palette.brand + '18',
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            alignItems: 'flex-end',
          }}>
            <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: palette.brand }}>
              {formatCompactCurrency(activePoint.balance, sym)}
            </Text>
            <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.brand, opacity: 0.7, marginTop: 1 }}>
              {formatDateShort(activePoint.date)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Current NW value + period change */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Text style={{ fontSize: HOME_TEXT.heroValue, fontWeight: FONT_WEIGHT.bold, color: palette.text, letterSpacing: -0.5 }}>
          {formatCompactCurrency(endBalance, sym)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <AppIcon name={isPositive ? 'trending-up' : 'trending-down'} size={12} color={changeColor} strokeWidth={2.5} />
          <Text style={{ fontSize: HOME_TEXT.caption, color: changeColor, fontWeight: FONT_WEIGHT.semibold }}>
            {Math.abs(changePct).toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Chart */}
      <LineChart
        areaChart
        curved
        animateOnDataChange
        animationDuration={800}
        data={lineData}
        width={chartWidth}
        height={CHART_H}
        color={palette.brand}
        thickness={2.5}
        startFillColor={palette.brand}
        endFillColor={palette.brand}
        startOpacity={0.28}
        endOpacity={0.02}
        hideDataPoints
        hideYAxisText
        yAxisThickness={0}
        yAxisLabelWidth={0}
        xAxisColor="transparent"
        noOfSections={3}
        rulesType="solid"
        rulesColor={`${palette.divider}50`}
        initialSpacing={0}
        endSpacing={0}
        maxValue={yCeil - yFloor}
        pointerConfig={{
          pointerStripHeight: CHART_H,
          pointerStripColor: `${palette.brand}30`,
          pointerStripWidth: 1.5,
          pointerColor: palette.brand,
          radius: 5,
          pointerLabelWidth: 1,
          pointerLabelHeight: 1,
          activatePointersOnLongPress: false,
          autoAdjustPointerLabelPosition: false,
          pointerLabelComponent: (items: any[]) => {
            const item = items[0];
            if (item) {
              const key = `${item.originalBalance}:${item.customDate}`;
              if (lastActiveKey.current !== key) {
                lastActiveKey.current = key;
                requestAnimationFrame(() => {
                  setActivePoint({ balance: item.originalBalance ?? 0, date: item.customDate ?? '' });
                });
              }
            }
            return <View style={{ width: 1, height: 1 }} />;
          },
        }}
      />

      {/* X-axis labels */}
      <View style={{ position: 'relative', height: 14, marginTop: 3 }}>
        {xLabels.map(({ label, position }, i) => (
          <Text
            key={i}
            style={{
              position: 'absolute',
              left: Math.min(Math.max(position * chartWidth - LABEL_W / 2, 0), chartWidth - LABEL_W),
              width: LABEL_W,
              textAlign: 'center',
              fontSize: HOME_TEXT.tiny,
              fontWeight: FONT_WEIGHT.medium,
              color: palette.text,
              opacity: 0.45,
            }}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
