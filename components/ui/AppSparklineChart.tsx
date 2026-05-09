import React, { useRef, useState, useCallback } from 'react';
import { View, Dimensions, PanResponder } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Text } from '@/components/ui/AppText';
import { formatCurrency } from '@/lib/derived';

export type SparklineItem = { value: number; date?: string };

export function AppSparklineChart({
  data,
  color = '#22C55E',
  height = 100,
  currencySymbol = '$',
  onPointerChange,
  onPointerIndexChange,
}: {
  data: SparklineItem[];
  color?: string;
  height?: number;
  currencySymbol?: string;
  onPointerChange?: (item: SparklineItem | null) => void;
  onPointerIndexChange?: (index: number | null) => void;
}) {
  const screenWidth = Dimensions.get('window').width;
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolve = useCallback((x: number) => {
    const spacing = screenWidth / Math.max(data.length - 1, 1);
    const idx = Math.round(x / spacing);
    return Math.max(0, Math.min(data.length - 1, idx));
  }, [data.length, screenWidth]);

  const touch = useCallback((x: number) => {
    if (lingerTimer.current) { clearTimeout(lingerTimer.current); lingerTimer.current = null; }
    const idx = resolve(x);
    onPointerChange?.(data[idx]);
    onPointerIndexChange?.(idx);
  }, [data, resolve, onPointerChange, onPointerIndexChange]);

  const release = useCallback(() => {
    lingerTimer.current = setTimeout(() => {
      onPointerChange?.(null);
      onPointerIndexChange?.(null);
    }, 700);
  }, [onPointerChange, onPointerIndexChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => touch(e.nativeEvent.locationX),
      onPanResponderMove: (e) => touch(e.nativeEvent.locationX),
      onPanResponderRelease: release,
      onPanResponderTerminate: release,
    })
  ).current;

  if (!data || data.length === 0) return null;

  return (
    <View style={{ overflow: 'hidden' }} {...panResponder.panHandlers}>
      <LineChart
        areaChart
        data={data}
        height={height}
        width={screenWidth}
        hideDataPoints
        spacing={screenWidth / Math.max(data.length - 1, 1)}
        initialSpacing={0}
        endSpacing={0}
        adjustToWidth
        color={color}
        thickness={2}
        startFillColor={color}
        endFillColor={'transparent'}
        startOpacity={0.4}
        endOpacity={0}
        yAxisThickness={0}
        xAxisThickness={0}
        yAxisLabelWidth={0}
        hideYAxisText
        hideRules
        // No pointerConfig — we handle scrubbing via PanResponder above
        // so the tooltip is always correctly positioned outside this component
      />
    </View>
  );
}
