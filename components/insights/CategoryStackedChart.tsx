import React, { useMemo, useState, useRef } from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { Text } from '../ui/AppText';
import type { AppThemePalette } from '../../lib/theme';
import { HOME_RADIUS, SCREEN_GUTTER } from '../../lib/layoutTokens';
import { CARD_PADDING, HOME_TEXT, FONT_WEIGHT } from '../../lib/design';
import { formatCompactCurrency } from '../../lib/derived';

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
  onInteractionStateChange?: (interacting: boolean) => void;
}

export function CategoryStackedChart({ data, palette, sym, topCategories, onInteractionStateChange }: Props): React.ReactElement | null {
  const { width } = useWindowDimensions();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const chartWidthRef = useRef(0);
  const chartLeftRef = useRef(0);

  const allZero = data.every((b) => b.categoryTotals.every((c) => c.amount === 0));
  const chartWidth = width - SCREEN_GUTTER * 2 - CARD_PADDING * 2;

  // Compute absolute maximum bucket total to scale stack heights
  const bucketTotals = useMemo(() => {
    return data.map((bucket) => bucket.categoryTotals.reduce((s, c) => s + c.amount, 0));
  }, [data]);

  const maxBucketTotal = useMemo(() => {
    return Math.max(...bucketTotals, 1);
  }, [bucketTotals]);

  const handleTouch = (locationX: number) => {
    if (data.length === 0) return;
    const w = chartWidthRef.current || chartWidth;
    const ratio = Math.max(0, Math.min(0.999, locationX / w));
    const idx = Math.floor(ratio * data.length);
    setActiveIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const activeItem = activeIdx !== null ? data[activeIdx] : null;
  const activeTotal = activeIdx !== null ? bucketTotals[activeIdx] : 0;

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
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, minHeight: 40 }}>
        <View>
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>Spending by Category</Text>
          {activeItem && (
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 2 }}>
              Period: {activeItem.label}
            </Text>
          )}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          {activeItem ? (
            <>
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                {formatCompactCurrency(activeTotal, sym)}
              </Text>
              <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 2 }}>
                Spent In Period
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                {formatCompactCurrency(bucketTotals.reduce((s, v) => s + v, 0), sym)}
              </Text>
              <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 2 }}>
                Total Spending
              </Text>
            </>
          )}
        </View>
      </View>

      {allZero ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>No spending data for this period</Text>
        </View>
      ) : (
        <>
          {/* Interactive Stacked Bar Chart */}
          <View
            onLayout={(evt) => {
              chartWidthRef.current = evt.nativeEvent.layout.width || chartWidth;
            }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(evt) => {
              const { pageX, locationX } = evt.nativeEvent;
              chartLeftRef.current = pageX - locationX;
              onInteractionStateChange?.(true);
              handleTouch(locationX);
            }}
            onResponderMove={(evt) => {
              const { pageX } = evt.nativeEvent;
              handleTouch(pageX - chartLeftRef.current);
            }}
            onResponderRelease={() => {
              setActiveIdx(null);
              onInteractionStateChange?.(false);
            }}
            onResponderTerminate={() => {
              setActiveIdx(null);
              onInteractionStateChange?.(false);
            }}
            style={{
              height: 120,
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            {data.map((bucket, i) => {
              const isSelected = activeIdx === i;
              const anySelected = activeIdx !== null;
              const opacity = anySelected ? (isSelected ? 1 : 0.4) : 1;
              const total = bucketTotals[i];

              return (
                <View
                  key={bucket.label + i}
                  style={{
                    flex: 1,
                    height: '100%',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    opacity,
                    paddingHorizontal: 6,
                  }}
                >
                  {/* Selection capsule background */}
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

                  {/* Stack segments */}
                  <View
                    style={{
                      width: '60%',
                      height: Math.max(4, Math.round((total / maxBucketTotal) * 110)),
                      borderRadius: 4,
                      overflow: 'hidden',
                      backgroundColor: palette.divider,
                      zIndex: 1,
                    }}
                  >
                    {bucket.categoryTotals
                      .filter((c) => c.amount > 0)
                      .map((ct, idx) => {
                        const topIdx = topCategories.findIndex((tc) => tc.categoryId === ct.categoryId);
                        const color = ct.categoryId === '__others__'
                          ? OTHERS_COLOR
                          : topIdx >= 0
                            ? STACK_COLORS[topIdx % STACK_COLORS.length]
                            : OTHERS_COLOR;
                        const segmentHeight = `${(ct.amount / total) * 100}%`;

                        return (
                          <View
                            key={ct.categoryId + idx}
                            style={{
                              width: '100%',
                              height: segmentHeight,
                              backgroundColor: color,
                            }}
                          />
                        );
                      })}
                  </View>

                  <Text
                    style={{
                      fontSize: HOME_TEXT.tiny,
                      color: isSelected ? palette.text : palette.textMuted,
                      fontWeight: isSelected ? '700' : '400',
                      marginTop: 6,
                    }}
                  >
                    {bucket.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Dynamic Legend / Breakdown */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 16 }}
            contentContainerStyle={{ gap: 12, paddingRight: 4 }}
          >
            {topCategories.map((cat, idx) => {
              const activeCatAmount = activeItem?.categoryTotals.find((c) => c.categoryId === cat.categoryId)?.amount;
              const hasActiveAmount = activeCatAmount !== undefined && activeCatAmount > 0;

              return (
                <View key={cat.categoryId} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: STACK_COLORS[idx % STACK_COLORS.length],
                    }}
                  />
                  <Text style={{ fontSize: HOME_TEXT.caption, color: hasActiveAmount ? palette.text : palette.textMuted, fontWeight: hasActiveAmount ? '600' : '400' }}>
                    {cat.name}
                    {hasActiveAmount && ` (${formatCompactCurrency(activeCatAmount, sym)})`}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
}
