import React, { useEffect, useState } from 'react';
import { View, useWindowDimensions, Pressable, ScrollView } from 'react-native';
import { Text } from '../ui/AppText';
import type { AppThemePalette } from '../../lib/theme';
import { HOME_RADIUS, SCREEN_GUTTER } from '../../lib/layoutTokens';
import { CARD_PADDING, HOME_TEXT, FONT_WEIGHT } from '../../lib/design';
import { formatCurrency } from '../../lib/derived';
import { toLocalDateKey } from '../../lib/dateUtils';

interface Props {
  data: { label: string; income: number; expense: number; from?: string; to?: string }[];
  palette: AppThemePalette;
  sym: string;
  period?: string;
  title: string;
  subtitle?: string;
  onInteractionStateChange?: (interacting: boolean) => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function IncomeExpenseChart({
  data,
  palette,
  sym,
  title,
  subtitle,
  period
}: Props): React.ReactElement | null {
  const { width } = useWindowDimensions();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Clear focus whenever the data or period changes
  useEffect(() => {
    setActiveIdx(null);
  }, [data, period]);

  const allZero = data.every((d) => d.income === 0 && d.expense === 0);

  const incomeColor = '#0D9488';
  const expenseColor = '#F87171';

  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalExpense = data.reduce((s, d) => s + d.expense, 0);
  const net = totalIncome - totalExpense;
  const netColor = net >= 0 ? palette.numberPositive : palette.numberNegative;

  const maxValue = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);

  const activeItem = activeIdx !== null ? data[activeIdx] : null;

  // Resilient timezone-safe parser
  const parseLocalParts = (isoStr?: string) => {
    if (!isoStr) return { y: '', m: '', d: '', monthAbbrev: '', monthFull: '' };
    const dateKey = toLocalDateKey(isoStr);
    const [y, mStr, dStr] = dateKey.split('-');
    const mIdx = parseInt(mStr) - 1;
    return {
      y,
      m: mStr,
      d: parseInt(dStr).toString(),
      monthAbbrev: MONTH_NAMES[mIdx] ?? '',
      monthFull: MONTH_FULL_NAMES[mIdx] ?? ''
    };
  };

  const formatBucketLabel = (item: typeof data[0]) => {
    if (!item.from || !item.to) return item.label;
    const fromParts = parseLocalParts(item.from);
    const toParts = parseLocalParts(item.to);
    const sameDay = toLocalDateKey(item.from) === toLocalDateKey(item.to);

    if (period === 'today' || sameDay) {
      const fullDayName = new Date(item.from).toLocaleDateString('en-IN', { weekday: 'long' });
      return `${fullDayName} (${fromParts.d} ${fromParts.monthAbbrev} ${fromParts.y})`;
    }
    if (period === 'week') {
      const fullDayName = new Date(item.from).toLocaleDateString('en-IN', { weekday: 'long' });
      return `${fullDayName} (${fromParts.d} ${fromParts.monthAbbrev} ${fromParts.y})`;
    }
    if (item.label.startsWith('W') || period === 'month') {
      // W1 (dd mmm - dd mmm) -> NO YEAR!
      return `${item.label} (${fromParts.d} ${fromParts.monthAbbrev} - ${toParts.d} ${toParts.monthAbbrev})`;
    }
    if (period === 'year') {
      // mmm-yyyy
      return `${fromParts.monthAbbrev}-${fromParts.y}`;
    }
    // Custom period range
    return `${fromParts.d} ${fromParts.monthAbbrev} ${fromParts.y} - ${toParts.d} ${toParts.monthAbbrev} ${toParts.y}`;
  };

  const formatBottomLabel = (item: typeof data[0]) => {
    if (!item.from) return item.label;
    const parts = parseLocalParts(item.from);

    if (period === 'today') {
      return new Date(item.from).toLocaleDateString('en-IN', { weekday: 'long' });
    }
    if (period === 'week') {
      return new Date(item.from).toLocaleDateString('en-IN', { weekday: 'short' });
    }
    if (period === 'month') {
      return item.label;
    }
    if (period === 'year') {
      return parts.monthAbbrev;
    }
    // Custom: show dd mmm
    return `${parts.d} ${parts.monthAbbrev}`;
  };

  const isScrollable = data.length > 7;

  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: HOME_RADIUS.card,
        padding: CARD_PADDING,
        borderWidth: 1,
        borderColor: palette.divider,
        marginBottom: 24,
        overflow: 'hidden',
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, minHeight: 75 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall - 0.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
            {title}
          </Text>
          {activeItem ? (
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 2, fontWeight: '500' }}>
              {formatBucketLabel(activeItem)}
            </Text>
          ) : (
            subtitle && (
              <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 2 }}>
                {subtitle}
              </Text>
            )
          )}
        </View>

        {activeItem ? (
          <View style={{ alignItems: 'flex-end', minWidth: 140 }}>
            <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted, marginBottom: 2 }}>
              Income: <Text style={{ color: incomeColor, fontWeight: '600' }}>+{formatCurrency(activeItem.income, sym)}</Text>
            </Text>
            <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted, marginBottom: 2 }}>
              Expense: <Text style={{ color: expenseColor, fontWeight: '600' }}>-{formatCurrency(activeItem.expense, sym)}</Text>
            </Text>
            <View style={{ height: 1, width: 90, alignSelf: 'flex-end', backgroundColor: palette.divider, marginVertical: 3 }} />
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted }}>
              Net: <Text style={{ color: (activeItem.income - activeItem.expense) >= 0 ? palette.numberPositive : palette.numberNegative, fontWeight: '700' }}>{formatCurrency(activeItem.income - activeItem.expense, sym)}</Text>
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: netColor }}>
              {formatCurrency(net, sym)}
            </Text>
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 2 }}>
              Net
            </Text>
          </View>
        )}
      </View>

      {allZero ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>No data for this period</Text>
        </View>
      ) : (
        <>
          {/* Chart Area */}
          {isScrollable ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                alignItems: 'flex-end',
                height: 120,
                paddingHorizontal: 4,
                gap: 6,
              }}
            >
              {data.map((bucket, i) => {
                const isSelected = activeIdx === i;
                const anySelected = activeIdx !== null;
                const opacity = anySelected ? (isSelected ? 1 : 0.4) : 1;

                const incHeight = Math.max(4, Math.round((bucket.income / maxValue) * 90));
                const expHeight = Math.max(4, Math.round((bucket.expense / maxValue) * 90));

                return (
                  <Pressable
                    key={bucket.label + i}
                    onPress={() => setActiveIdx(activeIdx === i ? null : i)}
                    style={{
                      width: 48,
                      height: '100%',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      opacity,
                    }}
                  >
                    {/* Visual selection capsule background */}
                    {isSelected && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 0,
                          right: 0,
                          backgroundColor: palette.divider,
                          borderRadius: 8,
                          opacity: 0.25,
                        }}
                      />
                    )}

                    {/* Grouped Bars Container */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, zIndex: 1 }}>
                      {/* Income Bar */}
                      <View
                        style={{
                          width: 14,
                          height: incHeight,
                          backgroundColor: incomeColor,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                        }}
                      />
                      {/* Expense Bar */}
                      <View
                        style={{
                          width: 14,
                          height: expHeight,
                          backgroundColor: expenseColor,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                        }}
                      />
                    </View>

                    {/* Mini-label below each group */}
                    <Text
                      style={{
                        fontSize: HOME_TEXT.tiny,
                        color: isSelected ? palette.text : palette.textMuted,
                        fontWeight: isSelected ? '700' : '400',
                        marginTop: 6,
                      }}
                    >
                      {formatBottomLabel(bucket)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View
              style={{
                height: 120,
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-around',
              }}
            >
              {data.map((bucket, i) => {
                const isSelected = activeIdx === i;
                const anySelected = activeIdx !== null;
                const opacity = anySelected ? (isSelected ? 1 : 0.4) : 1;

                const incHeight = Math.max(4, Math.round((bucket.income / maxValue) * 90));
                const expHeight = Math.max(4, Math.round((bucket.expense / maxValue) * 90));

                return (
                  <Pressable
                    key={bucket.label + i}
                    onPress={() => setActiveIdx(activeIdx === i ? null : i)}
                    style={{
                      flex: 1,
                      maxWidth: 64,
                      height: '100%',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      opacity,
                    }}
                  >
                    {/* Visual selection capsule background */}
                    {isSelected && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 2,
                          right: 2,
                          backgroundColor: palette.divider,
                          borderRadius: 8,
                          opacity: 0.25,
                        }}
                      />
                    )}

                    {/* Grouped Bars Container */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, zIndex: 1 }}>
                      {/* Income Bar */}
                      <View
                        style={{
                          width: '38%',
                          height: incHeight,
                          backgroundColor: incomeColor,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                        }}
                      />
                      {/* Expense Bar */}
                      <View
                        style={{
                          width: '38%',
                          height: expHeight,
                          backgroundColor: expenseColor,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                        }}
                      />
                    </View>

                    {/* Mini-label below each group */}
                    <Text
                      style={{
                        fontSize: HOME_TEXT.tiny,
                        color: isSelected ? palette.text : palette.textMuted,
                        fontWeight: isSelected ? '700' : '400',
                        marginTop: 6,
                      }}
                    >
                      {formatBottomLabel(bucket)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Legend */}
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
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
