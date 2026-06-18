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
  /** When true, use smooth monotone-cubic Bézier curves instead of straight segments. */
  smoothCurves?: boolean;
  /** When true, show "Today" instead of formatted date for the right axis label. */
  endLabelIsToday?: boolean;
  /** When true, omit the balance value from the right axis label. */
  hideEndBalance?: boolean;
  /** Callback fired when the active interactive point changes (e.g. scrubbing). */
  onActivePointChange?: (point: TrendPoint | null) => void;
  /** When true, completely omit the header (title and interactive tooltip row). */
  hideHeader?: boolean;
  /** When true, hide the starting dot at index 0 on the left edge. */
  hideStartDot?: boolean;
  /** When true, removes horizontal insets so the chart spans to the container's edges. */
  flatStyle?: boolean;
  /** When true, completely hide the bottom axis labels. */
  hideAxisLabels?: boolean;
  /** Custom height for the chart line area. Defaults to 110. */
  chartHeight?: number;
}

// ─── Monotone cubic spline helper ────────────────────────────────────────────
// Produces an SVG cubic-Bézier path string through all pts that stays monotone
// in x (no overshoots), giving the smooth, natural look from the reference image.
function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} C ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}, ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}, ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  }

  // Compute slopes using Fritsch-Carlson monotone cubic algorithm
  const n = pts.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = new Array(n).fill(0);

  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
  }

  // Initial slopes: secant lines
  const secant: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    secant[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0;
  }

  // Endpoint slopes
  m[0] = secant[0];
  m[n - 1] = secant[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = (secant[i - 1] + secant[i]) / 2;
  }

  // Monotonicity constraints
  for (let i = 0; i < n - 1; i++) {
    if (secant[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / secant[i];
      const beta = m[i + 1] / secant[i];
      const r = alpha * alpha + beta * beta;
      if (r > 9) {
        const t = 3 / Math.sqrt(r);
        m[i] = t * alpha * secant[i];
        m[i + 1] = t * beta * secant[i];
      }
    }
  }

  // Build cubic-Bézier path
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const xDelta = dx[i] / 3;
    const cp1x = (pts[i].x + xDelta).toFixed(1);
    const cp1y = (pts[i].y + m[i] * xDelta).toFixed(1);
    const cp2x = (pts[i + 1].x - xDelta).toFixed(1);
    const cp2y = (pts[i + 1].y - m[i + 1] * xDelta).toFixed(1);
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pts[i + 1].x.toFixed(1)} ${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

function buildSmoothAreaPath(pts: { x: number; y: number }[], chartH: number): string {
  if (pts.length < 2) return '';
  const linePart = buildSmoothPath(pts);
  return `${linePart} L ${pts[pts.length - 1].x.toFixed(1)} ${chartH} L ${pts[0].x.toFixed(1)} ${chartH} Z`;
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
  smoothCurves = false,
  endLabelIsToday = false,
  hideEndBalance = false,
  onActivePointChange,
  hideHeader = false,
  hideStartDot = false,
  flatStyle = false,
  hideAxisLabels = false,
  chartHeight = 110,
}: TrendLineChartProps) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const chartWidthRef = useRef(Dimensions.get('window').width - 48);
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

  const VB_W = 300; // viewBox width
  const CHART_H = chartHeight;
  const PAD_X = flatStyle ? 1.5 : 4; // viewBox units from SVG edges to line endpoints
  // Vertical band the line occupies inside the viewBox. Breathing room top/bottom.
  // Used both for non-flat point mapping (val → y) and as the centerline for the
  // flat-line case below.
  const PLOT_MIN_Y = flatStyle ? 20 : 20;
  const PLOT_MAX_Y = flatStyle ? CHART_H - 12 : CHART_H - 22;
  const PLOT_HEIGHT = PLOT_MAX_Y - PLOT_MIN_Y;
  const PLOT_MID_Y = (PLOT_MIN_Y + PLOT_MAX_Y) / 2;

  const handleTouch = (locationX: number) => {
    if (points.length < 2) return;
    const w = chartWidthRef.current;
    const lineStartPx = (PAD_X / VB_W) * w;
    const lineEndPx = ((VB_W - PAD_X) / VB_W) * w;
    const ratio = Math.max(0, Math.min(1, (locationX - lineStartPx) / (lineEndPx - lineStartPx)));
    const idx = Math.round(ratio * (points.length - 1));
    const clampedIdx = Math.max(0, Math.min(points.length - 1, idx));
    setActivePointIndex(clampedIdx);
    onActivePointChange?.(points[clampedIdx] ? {
      ...points[clampedIdx],
      prev: clampedIdx > 0 ? points[clampedIdx - 1] : null,
    } : null);
  };

  // SVG Chart path calculation — viewBox coordinate space (0–300 x, 0–CHART_H y)
  const { lineD, areaD, startY, endY, pts } = useMemo(() => {
    const total = points.length;
    if (total === 0) {
      return { lineD: '', areaD: '', startY: CHART_H / 2, endY: CHART_H / 2, minVal: 0, valRange: 1, pts: [] };
    }
    const vals = points.map((p) => p.val);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const valRange = maxVal - minVal || 1;
    // When every value is identical (e.g. a "Today" line with no activity), there's no
    // range to map against — center the flat line vertically instead of pinning it to
    // the bottom of the band.
    const isFlat = maxVal === minVal;

    const startX = PAD_X;
    const endX = VB_W - PAD_X;
    const pts = points.map((p, idx) => {
      const x = total > 1 ? startX + (idx / (total - 1)) * (endX - startX) : VB_W / 2;
      const y = isFlat ? PLOT_MID_Y : PLOT_MAX_Y - ((p.val - minVal) / valRange) * PLOT_HEIGHT;
      return { x, y };
    });

    let lineD: string;
    let areaD: string;
    if (smoothCurves && pts.length >= 2) {
      lineD = buildSmoothPath(pts);
      areaD = buildSmoothAreaPath(pts, CHART_H);
    } else {
      const linePath = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      areaD = total > 1
        ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${CHART_H} L ${pts[0].x.toFixed(1)} ${CHART_H} Z`
        : '';
      lineD = linePath;
    }

    return {
      lineD,
      areaD,
      startY: pts[0]?.y ?? CHART_H / 2,
      endY: pts[pts.length - 1]?.y ?? CHART_H / 2,
      minVal,
      valRange,
      pts,
    };
  }, [points, smoothCurves, CHART_H, PLOT_MID_Y, PLOT_MAX_Y, PLOT_HEIGHT]);

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

  // Check if a date string is today
  const isToday = (isoStr?: string) => {
    if (!isoStr) return false;
    const d = new Date(isoStr.includes('T') ? isoStr : isoStr + 'T00:00:00');
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  };

  const CARD_BASE = {
    marginTop: flatStyle ? 0 : 20,
    borderRadius: HOME_RADIUS.card,
    borderWidth: flatStyle ? 0 : 1,
    borderColor: palette.divider,
    backgroundColor: flatStyle ? 'transparent' : palette.card,
    paddingTop: flatStyle ? 0 : 16,
    paddingBottom: flatStyle ? 0 : 16,
    // No paddingHorizontal — text rows carry their own explicit padding,
    // SVG spans the full card width without any wrapper fighting it.
    height: flatStyle ? undefined : CHART_H + 110,
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
    const rawEnd = endDate ?? fallbackEnd;
    const axisEnd = (endLabelIsToday && isToday(rawEnd)) ? 'Today' : formatAxisDate(rawEnd);
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

        {!hideAxisLabels && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: flatStyle ? -2 : 14, paddingHorizontal: flatStyle ? 0 : 12 }}>
            <Text style={{ fontSize: HOME_TEXT.tiny + 1.0, color: palette.textMuted }}>{axisStart}</Text>
            <Text style={{ fontSize: HOME_TEXT.tiny + 1.0, color: palette.textMuted }}>{axisEnd}</Text>
          </View>
        )}
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

  // Axis label helpers
  const endDateRaw = endDate ?? points[points.length - 1]?.date;
  const endAxisLabel = endLabelIsToday && isToday(endDateRaw)
    ? 'Today'
    : formatAxisDate(endDateRaw);

  // 3. Fully Rendered Interactive Chart State
  return (
    <View style={[CARD_BASE, containerStyle]}>
      {/* Title & Interactive Tooltip Row */}
      {!hideHeader && (
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

          {headerRight && activePointIndex === null && (
            <View>{headerRight}</View>
          )}

          {activePointIndex !== null && points[activePointIndex] && (
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
      )}

      {/* SVG Interactive Chart — 14px side padding, chartWidthRef updated without re-render */}
      <View style={{ paddingHorizontal: flatStyle ? 0 : 10 }}>
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
            onActivePointChange?.(null);
          }}
          onResponderTerminate={() => {
            setActivePointIndex(null);
            onInteractionStateChange?.(false);
            onActivePointChange?.(null);
          }}
          style={{ height: CHART_H }}
        >
          <Svg width="100%" height={CHART_H} viewBox={`0 0 ${VB_W} ${CHART_H}`} style={{ pointerEvents: 'none', overflow: 'visible' }}>
            <Defs>
              <LinearGradient id="reusableChartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={strokeColor} stopOpacity={0.24} />
                <Stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
              </LinearGradient>
            </Defs>
            {/* Horizontal grid lines */}
            {[
              PLOT_MIN_Y,
              PLOT_MIN_Y + 0.5 * PLOT_HEIGHT,
              PLOT_MAX_Y
            ].map((gy, idx) => {
              return <Line key={idx} x1={PAD_X} y1={gy} x2={VB_W - PAD_X} y2={gy} stroke={palette.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'} strokeWidth={1} strokeDasharray="4 5" />;
            })}
            <Path d={areaD} fill="url(#reusableChartAreaGrad)" />
            <Path d={lineD} fill="none" stroke={strokeColor} strokeWidth={flatStyle ? 2.4 : 2.8} strokeLinejoin="round" strokeLinecap="round" />
            {!hideStartDot && <Circle cx={pts[0]?.x ?? PAD_X} cy={startY} r={3.5} fill={strokeColor} stroke="#FFFFFF" strokeWidth={1.2} />}
            <Circle cx={pts[pts.length - 1]?.x ?? VB_W - PAD_X} cy={endY} r={3.5} fill={strokeColor} stroke="#FFFFFF" strokeWidth={1.2} />

            {activePointIndex !== null && points[activePointIndex] && pts[activePointIndex] && (
              (() => {
                const activePt = pts[activePointIndex];
                return (
                  <>
                    <Line x1={activePt.x} y1={activePt.y} x2={activePt.x} y2={CHART_H - 6} stroke={strokeColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
                    <Circle cx={activePt.x} cy={activePt.y} r={9} fill={strokeColor} opacity={0.25} />
                    <Circle cx={activePt.x} cy={activePt.y} r={5.5} fill={strokeColor} stroke="#FFFFFF" strokeWidth={1.5} />
                  </>
                );
              })()
            )}
          </Svg>
        </View>
      </View>

      {/* Axis labels */}
      {!hideAxisLabels && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: flatStyle ? 0 : 10, paddingLeft: 14, paddingRight: 20, paddingBottom: flatStyle ? 8 : 0 }}>
          <Text style={{ fontSize: HOME_TEXT.tiny + 1.0, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
            {formatAxisDate(startDate ?? points[0]?.date)} ({formatSignedCurrency(points[0]?.val, currencySymbol, { zeroPlaceholder: null })})
          </Text>
          <Text style={{ fontSize: HOME_TEXT.tiny + 1.0, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
            {hideEndBalance
              ? endAxisLabel
              : `${endAxisLabel} (${formatSignedCurrency(points[points.length - 1]?.val, currencySymbol, { zeroPlaceholder: null })})`
            }
          </Text>
        </View>
      )}
    </View>
  );
}

export const TrendLineChart = React.memo(TrendLineChartBase);
