import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, TouchableOpacity, View } from 'react-native';
// Gesture-handler ScrollView (not RN's) so the horizontal bar strip still scrolls
// when the chart is nested inside a @gorhom/bottom-sheet (expanded mode) — RNGH
// bottom sheets don't release horizontal pans to a plain RN ScrollView. Works in
// the inline (non-sheet) context too.
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { BucketType, ChartGranularity } from '../../lib/chartUtils';
import { APP_LOCALE, toLocalDateKey } from '../../lib/dateUtils';
import { formatCurrency } from '../../lib/derived';
import { CARD_PADDING, FONT_WEIGHT, HOME_TEXT } from '../../lib/design';
import { HOME_RADIUS } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';
import { AppIcon } from '../ui/AppIcon';
import { Text } from '../ui/AppText';
import { FilterChip } from '../ui/FilterChip';

interface Props {
  data: { label: string; income: number; expense: number; from?: string; to?: string; type?: BucketType }[];
  palette: AppThemePalette;
  sym: string;
  period?: string;
  title?: string;
  subtitle?: string;
  onInteractionStateChange?: (interacting: boolean) => void;
  granularity?: ChartGranularity;
  onGranularityChange?: (g: ChartGranularity) => void;
  /** Whitelist of chips to show. Empty array → hide the chip toggle icon entirely. */
  availableGranularities?: ChartGranularity[];
  /** The bucket type Auto produces for the current period — used to relabel the 'auto' chip. */
  autoBucketType?: BucketType;
  /** Increment to force the granularity panel closed (e.g. on screen reset). */
  panelCloseToken?: number;
  /** When true, dims the bars area + shows "Updating…" so the chip change has immediate feedback. */
  isLoading?: boolean;
  /** Called when the expand icon is tapped. When omitted the icon is hidden. */
  onExpand?: () => void;
  /** Called when a bar is tapped. Null means the bar was deselected (same bar tapped again). */
  onBucketPress?: (bucket: { label: string; income: number; expense: number; from?: string; to?: string; type?: BucketType } | null) => void;
}

const GRANULARITY_OPTIONS: { key: ChartGranularity; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

// Visual sort order for chips — always Day → Week → Month → Year (Auto's slot is wherever its bucket type lands).
const BUCKET_SORT: Record<BucketType, number> = { day: 0, week: 1, month: 2, year: 3 };
const BUCKET_LABEL: Record<BucketType, string> = { day: 'Day', week: 'Week', month: 'Month', year: 'Year' };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function IncomeExpenseChart({
  data,
  palette,
  sym,
  title,
  subtitle,
  period,
  granularity,
  onGranularityChange,
  availableGranularities,
  autoBucketType,
  panelCloseToken,
  isLoading,
  onExpand,
  onBucketPress,
}: Props): React.ReactElement | null {
  // Compute once: which chips to render (sorted Day → Week → Month → Year), and whether the toggle icon shows.
  const visibleGranularities = availableGranularities ?? GRANULARITY_OPTIONS.map((o) => o.key);
  const chipsToRender = GRANULARITY_OPTIONS
    .filter((o) => visibleGranularities.includes(o.key))
    .map((o) => {
      // The 'auto' chip displays as its actual bucket type for this period (e.g. "Week" for Month period).
      const effectiveType: BucketType | undefined = o.key === 'auto' ? autoBucketType : o.key as BucketType;
      return {
        key: o.key,
        label: o.key === 'auto' && autoBucketType ? BUCKET_LABEL[autoBucketType] : o.label,
        sort: effectiveType ? BUCKET_SORT[effectiveType] : 99,
      };
    })
    .sort((a, b) => a.sort - b.sort);
  const hideToggleIcon = visibleGranularities.length === 0;
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [granularityOpen, setGranularityOpen] = useState(false);
  const panelProgress = useSharedValue(0);
  const barsScrollRef = React.useRef<ScrollView | null>(null);

  // When the data changes (granularity switch, new period, etc.), reset the horizontal scroll
  // so the user always sees bars from the start instead of a stale scrolled-right empty area.
  useEffect(() => {
    barsScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [data]);

  const toggleGranularityPanel = () => {
    const next = !granularityOpen;
    setGranularityOpen(next);
    panelProgress.value = withTiming(next ? 1 : 0, { duration: 220 });
  };

  // Force-close the granularity panel and clear any selected bar when the parent bumps the token
  // (e.g. on tab reset, or when a bsheet opens/closes over the chart).
  useEffect(() => {
    if (panelCloseToken === undefined) return;
    setGranularityOpen(false);
    setActiveIdx(null);
    panelProgress.value = withTiming(0, { duration: 220 });
  }, [panelCloseToken, panelProgress]);

  const panelAnimatedStyle = useAnimatedStyle(() => ({
    height: panelProgress.value * 52,
    // Negative bottom margin overlaps the card's bottom padding so the chip area
    // sits closer to the card's bottom edge instead of stranded above 16px of whitespace.
    marginBottom: panelProgress.value * -CARD_PADDING,
    opacity: panelProgress.value,
  }));

  const currentGranularity: ChartGranularity = granularity ?? 'auto';

  // Clear focus whenever the data or period changes
  useEffect(() => {
    setActiveIdx(null);
  }, [data, period]);

  const allZero = data.every((d) => d.income === 0 && d.expense === 0);

  // Same surface tint used for the donut breadcrumb strip and subcat highlight.
  // '66' = 40 % opacity baked into the hex so child views are unaffected.
  const surfaceColor = palette.layers.chartWell;

  const incomeColor = '#28c3a4'; // Sleek mint green (slightly deeper/greener than teal)
  const expenseColor = '#fb7478'; // Sleek neon coral-red (slightly lighter/brighter than coral)

  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalExpense = data.reduce((s, d) => s + d.expense, 0);
  const net = totalIncome - totalExpense;
  const netColor = net >= 0 ? palette.numberPositive : palette.numberNegative;

  const maxValue = Math.max(...data.flatMap((d) => [Math.abs(d.income), Math.abs(d.expense)]), 1);

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
      const fullDayName = new Date(item.from).toLocaleDateString(APP_LOCALE, { weekday: 'long' });
      return `${fullDayName} (${fromParts.d} ${fromParts.monthAbbrev} ${fromParts.y})`;
    }
    if (period === 'week') {
      const fullDayName = new Date(item.from).toLocaleDateString(APP_LOCALE, { weekday: 'long' });
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

  // Detect once whether monthly buckets in this data set span >1 calendar year.
  // If yes, every monthly label gets a year suffix to disambiguate (e.g. Dec '25 vs Dec '26).
  const monthlyBucketsSpanYears = useMemo(() => {
    const years = new Set<string>();
    for (const item of data) {
      if (item.type === 'month' && item.from) {
        const [y] = toLocalDateKey(item.from).split('-');
        years.add(y);
        if (years.size > 1) return true;
      }
    }
    return false;
  }, [data]);

  // Stable across renders that don't change data → keeps the bars memo cache valid.
  const formatBottomLabel = useCallback((item: typeof data[0]) => {
    if (!item.from) return item.label;
    const dateKey = toLocalDateKey(item.from);
    const [y, mStr, dStr] = dateKey.split('-');
    const mIdx = parseInt(mStr) - 1;
    const d = parseInt(dStr).toString();
    const monthAbbrev = MONTH_NAMES[mIdx] ?? '';
    // One rule per bucket type. The bucket already knows what kind it is.
    if (item.type === 'day') {
      const weekday = new Date(item.from).toLocaleDateString(APP_LOCALE, { weekday: 'short' });
      return `${d} ${weekday}`;                                                   // "12 Mon"
    }
    if (item.type === 'week') return item.label;                                // "W1"
    if (item.type === 'month') {
      return monthlyBucketsSpanYears
        ? `${monthAbbrev} '${y.slice(-2)}`                                       // "Dec '25"
        : monthAbbrev;                                                            // "May"
    }
    if (item.type === 'year') return y;                                         // "2026"
    return item.label;                                                            // fallback (shouldn't hit)
  }, [monthlyBucketsSpanYears, data]);

  const isScrollable = data.length > 6;

  // Memoise the heavy bars JSX. It only depends on data + activeIdx + palette + formatBottomLabel —
  // NOT on granularity/isLoading/period. So tapping a chip skips re-rendering all the bars,
  // which is what makes the chip + mask appear instantly.
  const barsContent = useMemo(() => {
    const renderBucket = (bucket: typeof data[0], i: number) => {
      const isSelected = activeIdx === i;
      const anySelected = activeIdx !== null;
      const opacity = anySelected ? (isSelected ? 1 : 0.65) : 1;
      const incAbs = Math.abs(bucket.income);
      const expAbs = Math.abs(bucket.expense);
      const incOutlined = bucket.income < 0;
      const expOutlined = bucket.expense < 0;
      const incHeight = incAbs > 0 ? Math.max(2, Math.round((incAbs / maxValue) * 90)) : 0;
      const expHeight = expAbs > 0 ? Math.max(2, Math.round((expAbs / maxValue) * 90)) : 0;

      // Adjust these constants to customize bar thickness and spacing:
      // - BUCKET_W: The total width of each day/week/month column
      // - BAR_W: The width/thickness of each individual bar (Income / Expense)
      // - BAR_GAP: The space between the income and expense bars
      const BUCKET_W = 48;
      const BAR_W = 16;
      const BAR_GAP = 2;

      return (
        <Pressable
          key={bucket.label + i}
          onPress={() => {
            const next = activeIdx === i ? null : i;
            setActiveIdx(next);
            onBucketPress?.(next !== null ? bucket : null);
          }}
          style={{ width: BUCKET_W, height: '100%', alignItems: 'center', opacity, paddingBottom: 6 }}
        >
          {isSelected && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: surfaceColor + '66',
                borderRadius: 8,
              }}
            />
          )}
          <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: BAR_GAP, zIndex: 1 }}>
              {incHeight > 0 && (
                <View style={{
                  width: BAR_W,
                  height: incHeight,
                  backgroundColor: incOutlined ? `${incomeColor}13` : incomeColor,
                  borderColor: incomeColor,
                  borderWidth: incOutlined ? 1.5 : 0,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }} />
              )}
              {expHeight > 0 && (
                <View style={{
                  width: BAR_W,
                  height: expHeight,
                  backgroundColor: expOutlined ? `${expenseColor}13` : expenseColor,
                  borderColor: expenseColor,
                  borderWidth: expOutlined ? 1.5 : 0,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }} />
              )}
            </View>
          </View>
          <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.text, fontWeight: isSelected ? '700' : '600', marginTop: 6, zIndex: 1 }}>
            {formatBottomLabel(bucket)}
          </Text>
        </Pressable>
      );
    };

    return isScrollable ? (
      <ScrollView
        ref={barsScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        contentContainerStyle={{
          alignItems: 'flex-end',
          height: 120,
          paddingHorizontal: 8,
          gap: 4,
        }}
      >
        {data.map(renderBucket)}
      </ScrollView>
    ) : (
      <View
        style={{
          height: 120,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {data.map(renderBucket)}
      </View>
    );
  }, [isScrollable, data, activeIdx, maxValue, palette, incomeColor, expenseColor, formatBottomLabel, surfaceColor, onBucketPress]);

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
      {/* Header Row — minHeight always reserved so tooltip appearing doesn't shift the chart */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, minHeight: 75 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          {title ? (
            <Text style={{ fontSize: HOME_TEXT.bodySmall - 0.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
              {title}
            </Text>
          ) : null}
          {activeItem ? (
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: title ? 2 : 0, fontWeight: FONT_WEIGHT.medium }}>
              {formatBucketLabel(activeItem)}
            </Text>
          ) : (
            subtitle && (
              <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: title ? 2 : 0 }}>
                {subtitle}
              </Text>
            )
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {activeItem ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginBottom: 2 }}>
                Income: <Text style={{ color: palette.numberPositive, fontWeight: FONT_WEIGHT.semibold }}>{activeItem.income < 0 ? '-' : ''}{formatCurrency(Math.abs(activeItem.income), sym)}</Text>
              </Text>
              <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginBottom: 2 }}>
                Expense: <Text style={{ color: palette.numberNegative, fontWeight: FONT_WEIGHT.semibold }}>{activeItem.expense < 0 ? '-' : ''}{formatCurrency(Math.abs(activeItem.expense), sym)}</Text>
              </Text>
              <View style={{ height: 1, width: 90, alignSelf: 'flex-end', backgroundColor: palette.divider, marginVertical: 3 }} />
              <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted }}>
                Net: <Text style={{ color: (activeItem.income - activeItem.expense) >= 0 ? palette.numberPositive : palette.numberNegative, fontWeight: FONT_WEIGHT.bold }}>{formatCurrency(activeItem.income - activeItem.expense, sym)}</Text>
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
          {onExpand ? (
            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={onExpand}
              style={{ paddingTop: 2 }}
            >
              <AppIcon name="maximize-2" size={15} color={palette.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {allZero && !isLoading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>No data for this period</Text>
        </View>
      ) : (
        <>
          {/* Chart Area — bars wrap dims while data refetches; overlay sibling stays full opacity. */}
          <View style={{ position: 'relative' }}>
            <View style={{ opacity: isLoading ? 0.2 : 1 }} pointerEvents={isLoading ? 'none' : 'auto'}>
              {barsContent}
            </View>
            {isLoading ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: palette.brand,
                  }}
                >
                  <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: '#FFFFFF', letterSpacing: 0.3 }}>
                    Updating…
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Legend + granularity toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 16, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: incomeColor }} />
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Income</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: expenseColor }} />
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Expense</Text>
              </View>
            </View>
            {onGranularityChange && !hideToggleIcon ? (
              <Pressable
                onPress={toggleGranularityPanel}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                style={({ pressed }) => ({
                  padding: 8,
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <AppIcon
                  name="sliders-horizontal"
                  size={18}
                  color={granularityOpen ? palette.brand : palette.textMuted}
                />
              </Pressable>
            ) : null}
          </View>

          {/* Granularity panel — natural-width chips, right-aligned to mirror the toggle icon above. */}
          {onGranularityChange && !hideToggleIcon ? (
            <Animated.View style={[{ overflow: 'hidden' }, panelAnimatedStyle]}>
              <View
                pointerEvents={isLoading ? 'none' : 'auto'}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 8,
                  paddingTop: 14,
                  paddingBottom: 6,
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                {chipsToRender.map((opt) => {
                  // 'auto' chip gets the real bucket-type name (Week, Month, …) so the user
                  // sees what each chip will actually show instead of an abstract "Auto".
                  const label = opt.key === 'auto' && autoBucketType
                    ? autoBucketType[0].toUpperCase() + autoBucketType.slice(1)
                    : opt.label;
                  return (
                    <FilterChip
                      key={opt.key}
                      label={label}
                      isActive={currentGranularity === opt.key}
                      onPress={() => onGranularityChange(opt.key)}
                      palette={palette}
                    />
                  );
                })}
              </View>
            </Animated.View>
          ) : null}
        </>
      )}
    </View>
  );
}
