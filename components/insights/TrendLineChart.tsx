import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Dimensions, Animated } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { Text } from '../ui/AppText';
import { formatCurrency } from '../../lib/derived';
import { FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

interface TrendPoint {
  date: string;
  val: number;
}

interface TrendLineChartProps {
  points: TrendPoint[];
  palette: AppThemePalette;
  currencySymbol: string;
  title: string;
  subtitle?: string;
  lineColor?: string;
  onInteractionStateChange?: (interacting: boolean) => void;
  headerRight?: React.ReactNode;
  containerStyle?: any;
  isLoading?: boolean;
  startDate?: string;
  endDate?: string;
}

export function TrendLineChart({
  points,
  palette,
  currencySymbol,
  title,
  subtitle,
  lineColor,
  onInteractionStateChange,
  headerRight,
  containerStyle,
  isLoading = false,
  startDate,
  endDate,
}: TrendLineChartProps) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(Dimensions.get('window').width - 48);
  const chartLeftRef = useRef(0);
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  const strokeColor = lineColor ?? palette.brand;

  useEffect(() => {
    if (isLoading) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.7,
            duration: 850,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 850,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [isLoading, fadeAnim]);

  const handleTouch = (locationX: number) => {
    if (points.length < 2) return;
    const ratio = Math.max(0, Math.min(1, locationX / chartWidth));
    const idx = Math.round(ratio * (points.length - 1));
    if (idx >= 0 && idx < points.length) {
      setActivePointIndex(idx);
    }
  };

  // SVG Chart path calculation
  const { lineD, areaD, startY, endY, minVal, valRange, pts } = useMemo(() => {
    const total = points.length;
    if (total === 0) {
      return { lineD: '', areaD: '', startY: 60, endY: 60, minVal: 0, valRange: 1, pts: [] };
    }
    const vals = points.map((p) => p.val);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const valRange = maxVal - minVal || 1;

    const startX = 12;
    const endX = 288;
    const pts = points.map((p, idx) => {
      const x = total > 1 ? startX + (idx / (total - 1)) * (endX - startX) : 150;
      // Pad by keeping y within [28, 92] instead of [22, 98], leaving 28px breathing room at bottom/top
      const y = 92 - ((p.val - minVal) / valRange) * 64;
      return { x, y };
    });

    const linePath = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = total > 1 
      ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} 120 L ${pts[0].x.toFixed(1)} 120 Z`
      : '';

    return {
      lineD: linePath,
      areaD: areaPath,
      startY: pts[0]?.y ?? 60,
      endY: pts[pts.length - 1]?.y ?? 60,
      minVal,
      valRange,
      pts,
    };
  }, [points]);

  // Format tooltip date as dd mmm yyyy
  const formattedTooltipDate = useMemo(() => {
    if (activePointIndex === null || !points[activePointIndex]) return '';
    const p = points[activePointIndex];
    const d = new Date(p.date + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
  }, [activePointIndex, points]);

  // Format axis dates
  const formatAxisDate = (isoStr?: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr.includes('T') ? isoStr : isoStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
  };

  // 1. Loading/Skeleton State (prevents layout shifts completely)
  if (isLoading) {
    return (
      <View style={[{
        marginTop: 20,
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        borderColor: palette.divider,
        backgroundColor: palette.card,
        paddingVertical: 16,
        paddingHorizontal: 10,
        height: 220,
      }, containerStyle]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, minHeight: 20, paddingHorizontal: 4 }}>
          <View style={{ gap: 6 }}>
            <Animated.View style={{ width: 110, height: 12, borderRadius: 6, backgroundColor: palette.isDark ? '#374151' : '#E2E8F0', opacity: fadeAnim }} />
            {subtitle && (
              <Animated.View style={{ width: 68, height: 8, borderRadius: 4, backgroundColor: palette.isDark ? '#1F2937' : '#EEF2F8', opacity: fadeAnim }} />
            )}
          </View>
        </View>

        <View style={{ height: 110, marginHorizontal: -4, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View style={{ width: '92%', height: 2.8, borderRadius: 1.4, backgroundColor: strokeColor, opacity: Animated.multiply(fadeAnim, 0.45) }} />
          <Animated.View style={{ position: 'absolute', bottom: 0, left: 16, right: 16, height: 42, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: strokeColor, opacity: Animated.multiply(fadeAnim, 0.1) }} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 4 }}>
          <Animated.View style={{ width: 75, height: 9, borderRadius: 4, backgroundColor: palette.isDark ? '#374151' : '#E2E8F0', opacity: fadeAnim }} />
          <Animated.View style={{ width: 75, height: 9, borderRadius: 4, backgroundColor: palette.isDark ? '#374151' : '#E2E8F0', opacity: fadeAnim }} />
        </View>
      </View>
    );
  }

  // 2. Empty State
  if (points.length < 2) {
    return (
      <View style={[{
        marginTop: 20,
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        borderColor: palette.divider,
        backgroundColor: palette.card,
        paddingVertical: 16,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        height: 220,
      }, containerStyle]}>
        <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
          Not enough trend data for this period
        </Text>
      </View>
    );
  }

  // 3. Fully Rendered Interactive Chart State
  return (
    <View style={[{
      marginTop: 20,
      borderRadius: HOME_RADIUS.card,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.card,
      paddingVertical: 16,
      paddingHorizontal: 10,
      height: 220,
    }, containerStyle]}>
      {/* Title & Interactive Tooltip Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, minHeight: 20, paddingHorizontal: 4 }}>
        <View>
          <Text style={{ fontSize: HOME_TEXT.bodySmall - 0.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
            {title}
          </Text>
          {subtitle && (
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 2 }}>
              {subtitle}
            </Text>
          )}
        </View>

        {headerRight && activePointIndex === null && (
          <View style={{ marginRight: -4 }}>
            {headerRight}
          </View>
        )}

        {activePointIndex !== null && points[activePointIndex] && (
          <View style={{ position: 'absolute', right: 4, top: -2, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: HOME_TEXT.caption + 0.5, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
              {formatCurrency(points[activePointIndex].val, currencySymbol)}
            </Text>
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 1 }}>
              {formattedTooltipDate}
            </Text>
          </View>
        )}
      </View>

      {/* SVG Interactive Chart */}
      <View
        onLayout={(evt) => {
          setChartWidth(evt.nativeEvent.layout.width || 300);
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
          const relativeX = pageX - chartLeftRef.current;
          handleTouch(relativeX);
        }}
        onResponderRelease={() => {
          setActivePointIndex(null);
          onInteractionStateChange?.(false);
        }}
        onResponderTerminate={() => {
          setActivePointIndex(null);
          onInteractionStateChange?.(false);
        }}
        style={{ height: 110, marginHorizontal: -4 }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 300 120" style={{ pointerEvents: 'none' }}>
          <Defs>
            <LinearGradient id="reusableChartAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={strokeColor} stopOpacity={0.24} />
              <Stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>
          <Path d={areaD} fill="url(#reusableChartAreaGrad)" />
          <Path d={lineD} fill="none" stroke={strokeColor} strokeWidth={2.8} />
          <Circle cx={pts[0]?.x ?? 12} cy={startY} r={3.5} fill={strokeColor} stroke="#FFFFFF" strokeWidth={1.2} />
          <Circle cx={pts[pts.length - 1]?.x ?? 288} cy={endY} r={3.5} fill={strokeColor} stroke="#FFFFFF" strokeWidth={1.2} />

          {/* Touch guide line & circle */}
          {activePointIndex !== null && points[activePointIndex] && pts[activePointIndex] && (
            (() => {
              const activePt = pts[activePointIndex];
              const activePtX = activePt.x;
              const activePtY = activePt.y;
              return (
                <>
                  <Line
                    x1={activePtX}
                    y1={activePtY}
                    x2={activePtX}
                    y2={114}
                    stroke={strokeColor}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.7}
                  />
                  <Circle
                    cx={activePtX}
                    cy={activePtY}
                    r={9}
                    fill={strokeColor}
                    opacity={0.25}
                  />
                  <Circle
                    cx={activePtX}
                    cy={activePtY}
                    r={5.5}
                    fill={strokeColor}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                  />
                </>
              );
            })()
          )}
        </Svg>
      </View>

      {/* Axis dates */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: '600', color: palette.text }}>
          {formatAxisDate(startDate ?? points[0]?.date)} ({formatCurrency(points[0]?.val, currencySymbol)})
        </Text>
        <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: '600', color: palette.text }}>
          {formatAxisDate(endDate ?? points[points.length - 1]?.date)} ({formatCurrency(points[points.length - 1]?.val, currencySymbol)})
        </Text>
      </View>
    </View>
  );
}
