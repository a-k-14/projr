import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, Dimensions, PanResponder } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export type SparklineItem = { value: number; date?: string };

export function AppSparklineChart({
  data,
  color = '#22C55E',
  height = 100,
  currencySymbol = '$',
  onPointerChange,
  onPointerIndexChange,
  onChartWidthChange,
}: {
  data: SparklineItem[];
  color?: string;
  height?: number;
  currencySymbol?: string;
  onPointerChange?: (item: SparklineItem | null) => void;
  onPointerIndexChange?: (index: number | null) => void;
  onChartWidthChange?: (width: number) => void;
}) {
  const screenWidth = Dimensions.get('window').width;
  const [chartWidth, setChartWidth] = useState(screenWidth);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chart = useMemo(() => buildSparklinePaths(data, chartWidth, height), [chartWidth, data, height]);

  const resolve = useCallback((x: number) => {
    const sidePad = 16;
    const width = Math.max(chartWidth, 1);
    const usableWidth = Math.max(width - sidePad * 2, 1);
    const spacing = usableWidth / Math.max(data.length - 1, 1);
    const adjustedX = Math.max(0, Math.min(usableWidth, x - sidePad));
    const idx = Math.round(adjustedX / spacing);
    return Math.max(0, Math.min(data.length - 1, idx));
  }, [chartWidth, data.length]);

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

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => touch(e.nativeEvent.locationX),
      onPanResponderMove: (e) => touch(e.nativeEvent.locationX),
      onPanResponderRelease: release,
      onPanResponderTerminate: release,
    }),
    [release, touch],
  );

  if (!data || data.length === 0) return null;

  return (
    <View
      style={{ overflow: 'hidden' }}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth <= 0) return;
        setChartWidth(nextWidth);
        onChartWidthChange?.(nextWidth);
      }}
      {...panResponder.panHandlers}
    >
      <Svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
        <Defs>
          <LinearGradient id="sparklineFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.18" />
            <Stop offset="0.5" stopColor={color} stopOpacity="0.06" />
            <Stop offset="1" stopColor={color} stopOpacity="0.04" />
          </LinearGradient>
        </Defs>
        <Path d={chart.areaPath} fill="url(#sparklineFill)" />
        <Path d={chart.linePath} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function buildSparklinePaths(data: SparklineItem[], width: number, height: number) {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const values = data.map((item) => item.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);
  const topPad = 10;
  const bottomPad = 10;
  const sidePad = 16;
  const usableWidth = Math.max(safeWidth - sidePad * 2, 1);
  const usableHeight = Math.max(safeHeight - topPad - bottomPad, 1);

  const points = data.map((item, index) => {
    const x = data.length <= 1 ? safeWidth / 2 : sidePad + (index / (data.length - 1)) * usableWidth;
    const y = topPad + (1 - (item.value - minValue) / range) * usableHeight;
    return { x, y };
  });

  if (points.length === 1) {
    const y = points[0].y;
    return {
      linePath: `M 0 ${y} L ${safeWidth} ${y}`,
      areaPath: `M 0 ${y} L ${safeWidth} ${y} L ${safeWidth} ${safeHeight} L 0 ${safeHeight} Z`,
    };
  }

  const first = points[0];
  const last = points[points.length - 1];

  const curvedPath = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const controlX = previous.x + (point.x - previous.x) * 0.5;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');

  const linePath = `M 0 ${first.y} L ${first.x} ${first.y} ` + 
                   curvedPath.replace(`M ${first.x} ${first.y}`, '').trim() + 
                   ` L ${safeWidth} ${last.y}`;

  const areaPath = `${linePath} L ${safeWidth} ${safeHeight} L 0 ${safeHeight} Z`;

  return { linePath, areaPath };
}
