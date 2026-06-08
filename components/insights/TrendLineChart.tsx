import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { APP_LOCALE, toLocalDateKey } from '../../lib/dateUtils';
import { formatSignedCurrency } from '../../lib/derived';
import { FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';
import { Text } from '../ui/AppText';

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
  /** When true, drops the chart's outer card styling (border, top margin,
   *  background) so it can be embedded inside another card without showing
   *  a nested border. Padding and chart geometry are unchanged. */
  embedded?: boolean;
  /** When true, render title + subtitle on a single line separated by a dot. */
  inlineTitle?: boolean;
  /** When true, don't render the chart's internal value/date tooltip overlay
   *  while dragging. The caller is expected to render its own tooltip somewhere
   *  else (typically via `onActivePointChange`). */
  suppressTooltip?: boolean;
  /** Fires while the user drags the chart, reporting the currently-active point.
   *  Null when the drag ends or no point is active. */
  onActivePointChange?: (point: { date: string; val: number } | null) => void;
}

function TrendLineChartBase({
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
  embedded = false,
  inlineTitle = false,
  suppressTooltip = false,
  onActivePointChange,
}: TrendLineChartProps) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const chartWidthRef = useRef(Dimensions.get('window').width - 48);
  const chartLeftRef = useRef(0);
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  // Forward the active point to the caller (used by V2 hero to render its own
  // tooltip in the gradient top-right).
  useEffect(() => {
    if (!onActivePointChange) return;
    if (activePointIndex === null || !points[activePointIndex]) {
      onActivePointChange(null);
    } else {
      const p = points[activePointIndex];
      onActivePointChange({ date: p.date, val: p.val });
    }
  }, [activePointIndex, points, onActivePointChange]);

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

  const PAD_X = 2; // viewBox units from SVG edges to line endpoints (active dot r=9, fits with overflow:visible)
  // When embedded, the whole chart area is ~32% shorter so the V2 hero card feels
  // better proportioned (gradient + trend instead of one tall section). All vertical
  // coordinates are scaled to keep the line's relative shape identical.
  const CHART_H = embedded ? 75 : 110;
  const VB_W = 300; // viewBox width
  // Vertical band the line occupies inside the viewBox. Breathing room top/bottom.
  // Used both for non-flat point mapping (val → y) and as the centerline for the
  // flat-line case below.
  const PLOT_MIN_Y = embedded ? 11 : 20;
  // Embedded variant gets extra bottom breathing room so the line's minimum point
  // doesn't visually kiss the x-axis label row (chart is shorter overall so the
  // proportional bottom gap was too tight at 80%).
  const PLOT_MAX_Y = embedded ? 52 : 88;
  // y-coordinate the active-point's dashed vertical line drops to (just above
  // the SVG's bottom edge). Scaled with CHART_H so it stays in the same
  // proportional spot as before.
  const ACTIVE_LINE_BOTTOM_Y = embedded ? 71 : 104;
  const PLOT_HEIGHT = PLOT_MAX_Y - PLOT_MIN_Y; // 68
  const PLOT_MID_Y = (PLOT_MIN_Y + PLOT_MAX_Y) / 2; // 54

  const handleTouch = (locationX: number) => {
    if (points.length < 2) return;
    const w = chartWidthRef.current;
    const lineStartPx = (PAD_X / VB_W) * w;
    const lineEndPx = ((VB_W - PAD_X) / VB_W) * w;
    const ratio = Math.max(0, Math.min(1, (locationX - lineStartPx) / (lineEndPx - lineStartPx)));
    const idx = Math.round(ratio * (points.length - 1));
    setActivePointIndex(Math.max(0, Math.min(points.length - 1, idx)));
  };

  // SVG Chart path calculation — viewBox coordinate space (0–300 x, 0–110 y)
  const { lineD, areaD, startY, endY, pts } = useMemo(() => {
    const total = points.length;
    if (total === 0) {
      return { lineD: '', areaD: '', startY: CHART_H / 2, endY: CHART_H / 2, minVal: 0, valRange: 1, pts: [] };
    }
    const vals = points.map((p) => p.val);
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const rawRange = rawMax - rawMin;
    const isFlat = rawRange === 0;

    // Enforce a minimum visual amplitude so near-flat data (tiny balance
    // variation relative to the account size) still renders as a readable curve
    // rather than a ruler-straight line. We expand the domain symmetrically
    // around the midpoint by at least 4% of |midpoint| (floor: 1 unit).
    // Truly flat data (isFlat) is handled separately and stays centered.
    const midVal = (rawMin + rawMax) / 2;
    const minAmplitude = Math.max(Math.abs(midVal) * 0.04, 1);
    const domainMin = (!isFlat && rawRange < minAmplitude * 2) ? midVal - minAmplitude : rawMin;
    const domainMax = (!isFlat && rawRange < minAmplitude * 2) ? midVal + minAmplitude : rawMax;
    const valRange = domainMax - domainMin || 1;

    const startX = PAD_X;
    const endX = VB_W - PAD_X;
    const pts = points.map((p, idx) => {
      const x = total > 1 ? startX + (idx / (total - 1)) * (endX - startX) : VB_W / 2;
      const y = isFlat ? PLOT_MID_Y : PLOT_MAX_Y - ((p.val - domainMin) / valRange) * PLOT_HEIGHT;
      return { x, y };
    });

    // Build a smooth cubic Bézier path through all points.
    let linePath = '';
    if (pts.length === 1) {
      linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    } else {
      linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        // Tension 0.42 (up from 0.30) gives more pronounced S-curves on
        // direction changes — makes the line feel more alive on real data.
        const tension = 0.2;
        const dx = (p1.x - p0.x) * tension;
        const cp1x = p0.x + dx;
        const cp1y = p0.y;
        const cp2x = p1.x - dx;
        const cp2y = p1.y;
        linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      }
    }
    const areaPath = total > 1
      ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${CHART_H} L ${pts[0].x.toFixed(1)} ${CHART_H} Z`
      : '';

    return {
      lineD: linePath,
      areaD: areaPath,
      startY: pts[0]?.y ?? CHART_H / 2,
      endY: pts[pts.length - 1]?.y ?? CHART_H / 2,
      minVal: domainMin,
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
    return `${d.getDate()} ${d.toLocaleDateString(APP_LOCALE, { month: 'short' })} ${d.getFullYear()}`;
  }, [activePointIndex, points]);

  // Format axis dates
  const formatAxisDate = (isoStr?: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr.includes('T') ? isoStr : isoStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${d.toLocaleDateString(APP_LOCALE, { month: 'short' })}`;
  };

  const CARD_BASE = embedded
    ? {
      marginTop: 0,
      borderRadius: 0,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      paddingTop: 10,
      paddingBottom: 10,
      // No fixed height when embedded — let the chart size to its actual content
      // (title + chart-110 + axis row). The non-embedded `height: 220` had ~30px
      // of extra space at the bottom that showed up as a visible gap.
    } as const
    : {
      marginTop: 20,
      borderRadius: HOME_RADIUS.card,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.card,
      paddingTop: 16,
      paddingBottom: 16,
      // No paddingHorizontal — text rows carry their own explicit padding,
      // SVG spans the full card width without any wrapper fighting it.
      height: 220,
    } as const;

  // 1. Loading/Skeleton State — only the chart line area is a placeholder.
  // Title, subtitle, and x-axis date labels render as their real values immediately
  // (they're either props or derivable from the date range, no DB needed).
  if (isLoading) {
    // Default to the standard 30-day window if caller didn't pass explicit dates.
    const today = new Date();
    const fallbackEnd = toLocalDateKey(today.toISOString());
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 29);
    const fallbackStart = toLocalDateKey(thirtyDaysAgo.toISOString());
    const axisStart = formatAxisDate(startDate ?? fallbackStart);
    const axisEnd = formatAxisDate(endDate ?? fallbackEnd);
    return (
      <View style={[CARD_BASE, containerStyle]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, minHeight: 20, paddingHorizontal: 12 }}>
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
        </View>

        <View style={{ height: CHART_H, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View style={{ width: '96%', height: 2.8, borderRadius: 1.4, backgroundColor: strokeColor, opacity: Animated.multiply(fadeAnim, 0.45) }} />
          <Animated.View style={{ position: 'absolute', bottom: 0, left: 8, right: 8, height: 42, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: strokeColor, opacity: Animated.multiply(fadeAnim, 0.1) }} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted }}>{axisStart}</Text>
          <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted }}>{axisEnd}</Text>
        </View>
      </View>
    );
  }

  // 2. Empty State
  if (points.length < 2) {
    return (
      <View style={[CARD_BASE, { alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
        <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
          Not enough trend data for this period
        </Text>
      </View>
    );
  }

  // 3. Fully Rendered Interactive Chart State
  // Strip parens around subtitle when rendering inline ("(Last 30 Days)" → "Last 30 Days").
  const inlineSubtitle = subtitle ? subtitle.replace(/^\(|\)$/g, '') : '';
  return (
    <View style={[CARD_BASE, containerStyle]}>
      {/* Title & Interactive Tooltip Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: embedded ? 8 : 12, minHeight: 20, paddingHorizontal: 12 }}>
        <View style={inlineTitle ? { flexDirection: 'row', alignItems: 'baseline', gap: 6 } : undefined}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall - 0.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
            {title}
          </Text>
          {subtitle && inlineTitle && (
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted }}>
              · {inlineSubtitle}
            </Text>
          )}
          {subtitle && !inlineTitle && (
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 2 }}>
              {subtitle}
            </Text>
          )}
        </View>

        {headerRight && activePointIndex === null && (
          <View>{headerRight}</View>
        )}

        {!suppressTooltip && activePointIndex !== null && points[activePointIndex] && (
          <View style={{ position: 'absolute', right: 12, top: -2, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: HOME_TEXT.caption + 0.5, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
              {formatSignedCurrency(points[activePointIndex].val, currencySymbol, { zeroPlaceholder: null })}
            </Text>
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 1 }}>
              {formattedTooltipDate}
            </Text>
          </View>
        )}
      </View>

      {/* SVG Interactive Chart — 14px side padding, chartWidthRef updated without re-render */}
      <View style={{ paddingHorizontal: 4, overflow: 'visible' }}>
        <View
          onLayout={(evt) => {
            chartWidthRef.current = evt.nativeEvent.layout.width || chartWidthRef.current;
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
            setActivePointIndex(null);
            onInteractionStateChange?.(false);
          }}
          onResponderTerminate={() => {
            setActivePointIndex(null);
            onInteractionStateChange?.(false);
          }}
          style={{ height: CHART_H, overflow: 'visible' }}
        >
          <Svg width="100%" height={CHART_H} viewBox={`0 0 ${VB_W} ${CHART_H}`} style={{ pointerEvents: 'none', overflow: 'visible' }}>
            <Defs>
              <LinearGradient id="reusableChartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={strokeColor} stopOpacity={0.24} />
                <Stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
              </LinearGradient>
            </Defs>
            <Path d={areaD} fill="url(#reusableChartAreaGrad)" />
            <Path d={lineD} fill="none" stroke={strokeColor} strokeWidth={2.8} />
            <Circle cx={pts[0]?.x ?? PAD_X} cy={startY} r={3.5} fill={strokeColor} stroke="#FFFFFF" strokeWidth={1.2} />
            <Circle cx={pts[pts.length - 1]?.x ?? VB_W - PAD_X} cy={endY} r={3.5} fill={strokeColor} stroke="#FFFFFF" strokeWidth={1.2} />

            {activePointIndex !== null && points[activePointIndex] && pts[activePointIndex] && (
              (() => {
                const activePt = pts[activePointIndex];
                return (
                  <>
                    <Line x1={activePt.x} y1={activePt.y} x2={activePt.x} y2={ACTIVE_LINE_BOTTOM_Y} stroke={strokeColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
                    <Circle cx={activePt.x} cy={activePt.y} r={9} fill={strokeColor} opacity={0.25} />
                    <Circle cx={activePt.x} cy={activePt.y} r={5.5} fill={strokeColor} stroke="#FFFFFF" strokeWidth={1.5} />
                  </>
                );
              })()
            )}
          </Svg>
        </View>
      </View>

      {/* Axis dates */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: embedded ? 2 : 14, paddingHorizontal: 14 }}>
        <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
          {formatAxisDate(startDate ?? points[0]?.date)} ({formatSignedCurrency(points[0]?.val, currencySymbol, { zeroPlaceholder: null })})
        </Text>
        <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
          {formatAxisDate(endDate ?? points[points.length - 1]?.date)} ({formatSignedCurrency(points[points.length - 1]?.val, currencySymbol, { zeroPlaceholder: null })})
        </Text>
      </View>
    </View>
  );
}

export const TrendLineChart = React.memo(TrendLineChartBase);
