import React from 'react';
import Svg, { G, Path } from 'react-native-svg';
import { donutPath } from '@/lib/svg-utils';

export type DonutSlice = {
  id: string;
  percent: number;
  color: string;
  minAngle?: number;
};

type RenderSlice = DonutSlice & {
  displayAngle: number;
  minVisibleAngle: number;
};

interface AppDonutChartProps {
  slices: DonutSlice[];
  size?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  bgHex: string;
  baseGap?: number;
  outerRadius?: number;
  innerRadius?: number;
  activeOuterRadius?: number;
  activeInnerRadius?: number;
  strokeWidth?: number;
  activeStrokeWidth?: number;
}

export function AppDonutChart({
  slices,
  size = 300,
  selectedId,
  onSelect,
  bgHex,
  baseGap = 2.2,
  outerRadius = 116,
  innerRadius = 80,
  activeOuterRadius = 126,
  activeInnerRadius = 73,
  strokeWidth = 2,
  activeStrokeWidth = 4,
}: AppDonutChartProps) {
  let angle = 0;
  const cx = size / 2;
  const cy = size / 2;
  const renderSlices = React.useMemo<RenderSlice[]>(() => {
    const visible = slices.filter((slice) => slice.percent > 0);
    if (visible.length === 0) return [];

    const withAngles = visible.map((slice) => {
      const rawAngle = slice.percent * 360;
      const isSelected = slice.id === selectedId;
      const minAngle = slice.minAngle ?? (isSelected ? 3.5 : 1.5);
      return { ...slice, rawAngle, minAngle, minVisibleAngle: minAngle };
    });

    const minTotal = withAngles.reduce((sum, slice) => sum + Math.min(slice.rawAngle, slice.minAngle), 0);
    if (minTotal >= 360) {
      const fallbackAngle = 360 / withAngles.length;
      return withAngles.map((slice) => ({ ...slice, displayAngle: fallbackAngle, minVisibleAngle: Math.min(slice.minVisibleAngle, fallbackAngle) }));
    }

    const extraNeeded = withAngles.reduce((sum, slice) => (
      slice.rawAngle < slice.minAngle ? sum + (slice.minAngle - slice.rawAngle) : sum
    ), 0);
    const shrinkable = withAngles.reduce((sum, slice) => (
      slice.rawAngle > slice.minAngle ? sum + (slice.rawAngle - slice.minAngle) : sum
    ), 0);

    return withAngles.map((slice) => {
      if (slice.rawAngle <= slice.minAngle) {
        return { ...slice, displayAngle: slice.minAngle, minVisibleAngle: slice.minAngle };
      }
      const shrink = shrinkable > 0 ? ((slice.rawAngle - slice.minAngle) / shrinkable) * extraNeeded : 0;
      return { ...slice, displayAngle: Math.max(slice.minAngle, slice.rawAngle - shrink), minVisibleAngle: slice.minAngle };
    });
  }, [selectedId, slices]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G>
        {renderSlices.map((slice) => {
          const sliceAngle = slice.displayAngle;
          const isSelected = slice.id === selectedId;
          const isAnySelected = selectedId !== undefined && selectedId !== null;
          const isActive = !isAnySelected || isSelected;

          const gap = sliceAngle <= slice.minVisibleAngle + baseGap * 2
            ? 0
            : sliceAngle < 10
              ? Math.min(baseGap, sliceAngle * 0.15)
              : baseGap;
          const start = angle + gap;
          const end = angle + sliceAngle - gap;
          angle += sliceAngle;

          const outer = isSelected ? activeOuterRadius : outerRadius;
          const inner = isSelected ? activeInnerRadius : innerRadius;

          const visiblePath = donutPath(cx, cy, outer, inner, start, end);
          
          // The touch path is larger to make small slices easier to hit
          const touchPath = donutPath(cx, cy, size * 0.47, size * 0.15, start, end);

          return (
            <G 
              key={slice.id} 
              onPress={() => onSelect?.(slice.id)} 
              onPressIn={() => onSelect?.(slice.id)}
            >
              <Path d={touchPath} fill={bgHex} opacity={0.01} />
              <Path
                d={visiblePath}
                fill={slice.color}
                opacity={isActive ? 1 : 0.42}
                stroke={bgHex}
                strokeWidth={isSelected ? (sliceAngle < 5 ? activeStrokeWidth * 0.6 : activeStrokeWidth) : strokeWidth}
              />
            </G>
          );
        })}
      </G>
    </Svg>
  );
}
