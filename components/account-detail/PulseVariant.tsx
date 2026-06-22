/**
 * Pulse — Account Detail design variant (Phase 1 of Design Lab).
 *
 * Hero card with chart fused inside the gradient (no white break), a pulsing
 * end-of-line dot, tabular numerals on the balance. A separate cashflow card
 * makes the speedometer ticks the headline (22px, cascade fill, glow handoff)
 * with the net amount centered beneath them, and collapses the three control
 * rows into a single bottom row.
 *
 * Toggle via long-press on the account name in the screen header.
 * Owned by `stores/useDesignLabStore.ts`.
 */
import React, { useEffect, useMemo } from 'react';
import { Dimensions, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/AppText';
import { ActivityPeriodHeader } from '../activity/ActivityPeriodHeader';
import { AppIcon } from '../ui/AppIcon';
import { AppSwitch } from '../ui/AppSwitch';
import { formatCurrency, formatSignedCurrency } from '../../lib/derived';
import { FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { HOME_RADIUS } from '../../lib/layoutTokens';
import { SegmentedPillSwitch } from '../ui/SegmentedPillSwitch';
import { type AppThemePalette } from '../../lib/theme';

// ── Tick geometry — taller, more breathing room than the Current variant.
// Container = screen - 2*gutter - 2*card-padding(14).
const PULSE_TICK_H = 22;
const PULSE_TICK_W = 2.6;
const PULSE_TICK_GAP = 5;
const PULSE_TICK_CONTAINER_W = Math.max(80, Dimensions.get('window').width - 2 * SCREEN_GUTTER - 2 * 14);
const PULSE_TICK_TOTAL = Math.floor((PULSE_TICK_CONTAINER_W + PULSE_TICK_GAP) / (PULSE_TICK_W + PULSE_TICK_GAP));
const PULSE_TICK_CONTENT_W = PULSE_TICK_TOTAL * (PULSE_TICK_W + PULSE_TICK_GAP) - PULSE_TICK_GAP;
const PULSE_TICK_REMAINDER = PULSE_TICK_CONTAINER_W - PULSE_TICK_CONTENT_W;

interface PulseHeroProps {
  palette: AppThemePalette;
  accountTypeLabel: string;
  isNegative: boolean;
  hideAmounts: boolean;
  currencySymbol: string;
  balanceInt: string;
  balanceDec: string;
  accountHeroDarkGradient: [string, string];
  typeColor: string;
  activePoint: any;
  activePointDateFormatted: string;
  activePointValFormatted: string;
  middleContent?: React.ReactNode;
}

/**
 * Hero card — balance + trend chart fused in one gradient block. The chart
 * lives inside the tinted area so there's no visual break, and the end-dot
 * pulses softly to feel "live".
 */
export function PulseAccountHero({
  palette,
  accountTypeLabel,
  isNegative,
  hideAmounts,
  currencySymbol,
  balanceInt,
  balanceDec,
  accountHeroDarkGradient,
  typeColor,
  activePoint,
  activePointDateFormatted,
  activePointValFormatted,
  middleContent,
}: PulseHeroProps) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.45 - pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));

  return (
    <View
      style={{
        backgroundColor: 'transparent',
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        borderColor: palette.isDark ? palette.borderSoft : 'transparent',
        marginBottom: 12,
        overflow: 'hidden',
        ...(palette.isDark ? {} : {
          elevation: 7,
          shadowColor: '#94A3B8',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.16,
          shadowRadius: 12,
        }),
      }}
    >
      {/* One gradient covering BOTH balance area AND chart area —
          the chart sits ON the tint, not on white below it. */}
      <LinearGradient
        pointerEvents="none"
        colors={[accountHeroDarkGradient[0], accountHeroDarkGradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      {/* Soft grain noise via stacked semi-transparent dots — done with two
          diagonal scrim overlays since we can't easily ship an image asset
          here. The dual-stop linear gradient adds the "printed paper" feel
          without an asset dependency. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />

      <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4 }}>
        {/* Top row: SAVINGS chip + active-point readout */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 22 }}>
          <View style={{
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.28)',
          }}>
            <Text style={{
              fontSize: 9.5,
              fontWeight: FONT_WEIGHT.heavy,
              color: 'rgba(255,255,255,0.82)',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}>
              {accountTypeLabel}
            </Text>
          </View>

          {activePoint ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{
                fontSize: 10,
                fontWeight: FONT_WEIGHT.semibold,
                color: 'rgba(255,255,255,0.62)',
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}>
                {activePointDateFormatted}
              </Text>
              <Text style={{
                fontSize: 13,
                fontWeight: FONT_WEIGHT.semibold,
                color: '#FFFFFF',
                fontVariant: ['tabular-nums'],
              }}>
                {activePointValFormatted}
              </Text>
            </View>
          ) : (
            <Text style={{
              fontSize: 10,
              fontWeight: FONT_WEIGHT.semibold,
              color: 'rgba(255,255,255,0.55)',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              Balance
            </Text>
          )}
        </View>

        {/* Balance — tabular numerals, no icon, breathing room */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
          {isNegative && !hideAmounts && (
            <Text style={{ fontSize: 22, fontWeight: FONT_WEIGHT.medium, color: '#FFFFFF', marginRight: 2 }}>−</Text>
          )}
          {currencySymbol && !hideAmounts && (
            <Text style={{ fontSize: 19, fontWeight: FONT_WEIGHT.medium, color: 'rgba(255,255,255,0.72)', marginRight: 4 }}>
              {currencySymbol}
            </Text>
          )}
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              fontSize: 32,
              fontWeight: FONT_WEIGHT.medium,
              color: '#FFFFFF',
              letterSpacing: -0.6,
              fontVariant: ['tabular-nums'],
            }}>
            {currencySymbol && balanceInt.startsWith(currencySymbol) ? balanceInt.slice(currencySymbol.length) : balanceInt}
          </Text>
          {balanceDec && (
            <Text style={{ fontSize: 16, fontWeight: FONT_WEIGHT.medium, color: 'rgba(255,255,255,0.6)', fontVariant: ['tabular-nums'] }}>
              {balanceDec}
            </Text>
          )}
        </View>

        {/* Micro tick mark below the integer — visual rhyme with the speedometer */}
        <View style={{ width: 38, height: 2, marginTop: 8, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.28)' }} />
      </View>

      {/* Chart on the tint — note: chart still has its own background; we
          drop margin to let the gradient bleed through. */}
      <View style={{ marginHorizontal: 0, marginTop: 4, marginBottom: 4, position: 'relative' }}>
        {middleContent}
        {/* Pulsing end-dot halo, anchored to the right edge of the chart */}
        <View pointerEvents="none" style={{ position: 'absolute', right: 16, top: '50%', marginTop: -6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: typeColor, opacity: 0.95 }} />
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: -6,
                left: -6,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: typeColor,
              },
              pulseStyle,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

interface PulseCashflowCardProps {
  palette: AppThemePalette;
  dateFilter: any;
  activityPeriodLabel: string;
  inlineFilter: 'in' | 'out' | null;
  setShowPeriodSheet: (v: boolean) => void;
  cashflowIsCashflow: boolean;
  setCashflowIsCashflow: (v: boolean) => void;
  hideAmounts: boolean;
  currencySymbol: string;
  metricLeftAmount: number;
  metricRightAmount: number;
  leftSpringStyle: any;
  rightSpringStyle: any;
  detailInflowColor: string;
  detailOutflowColor: string;
  /** Shared animated values driving the speedometer fraction — already kept
   *  in sync with `metricLeftAmount/metricRightAmount` by the parent. */
  animatedIncomeFraction: SharedValue<number>;
  tickActivityProgress: SharedValue<number>;
  typeColor: string;
  openPeriodActivity: (kind: 'in' | 'out') => void;
}

/**
 * Cashflow card — Pulse variant. Values + ticks become the headline; the
 * three controls (period / today-month / cashflow) collapse into one row at
 * the bottom. Ticks cascade in left→right on data change, and the handoff
 * tick between green and red glows in the account-type color.
 */
export function PulseCashflowCard({
  palette,
  dateFilter,
  activityPeriodLabel,
  inlineFilter,
  setShowPeriodSheet,
  cashflowIsCashflow,
  setCashflowIsCashflow,
  hideAmounts,
  currencySymbol,
  metricLeftAmount,
  metricRightAmount,
  leftSpringStyle,
  rightSpringStyle,
  detailInflowColor,
  detailOutflowColor,
  animatedIncomeFraction,
  tickActivityProgress,
  typeColor,
  openPeriodActivity,
}: PulseCashflowCardProps) {
  // ── Cascade-fill on data change ────────────────────────────────────────
  // We replay the cascade whenever the income/expense numbers shift. The
  // parent already animates `animatedIncomeFraction` + `tickActivityProgress`;
  // we add a per-tick stagger that rides on top of those values.
  const cascadeProgress = useSharedValue(0);
  const prevKeyRef = React.useRef('');
  const dataKey = `${metricLeftAmount}|${metricRightAmount}`;
  useEffect(() => {
    if (prevKeyRef.current === dataKey) return;
    prevKeyRef.current = dataKey;
    cascadeProgress.value = 0;
    cascadeProgress.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
  }, [dataKey, cascadeProgress]);

  // Per-tick reveal width — we widen a clipping box left→right that masks
  // the green/red overlays. This rides ON TOP of the parent's existing
  // speedometer sweep, so on a fresh load the user sees the cascade *and* the
  // proportional fill landing in place.
  const cascadeClipStyle = useAnimatedStyle(() => ({
    width: PULSE_TICK_CONTENT_W * cascadeProgress.value,
  }));

  // Glow tick position — the handoff between green and red. We compute its
  // index off the shared income fraction; show only when there's data.
  const glowStyle = useAnimatedStyle(() => {
    const fraction = animatedIncomeFraction.value;
    const greenCount = Math.round(fraction * PULSE_TICK_TOTAL);
    const idx = Math.max(0, Math.min(PULSE_TICK_TOTAL - 1, greenCount - 1));
    const left = idx * (PULSE_TICK_W + PULSE_TICK_GAP);
    const opacity = tickActivityProgress.value * 0.85;
    return {
      left,
      opacity,
    };
  });

  // Net amount — derived from the same metrics. Sign matters.
  const net = metricLeftAmount - metricRightAmount;
  const netFormatted = useMemo(() => {
    if (hideAmounts) return '••••';
    if (net === 0) return '—';
    return formatSignedCurrency(net, currencySymbol, { zeroPlaceholder: '—' });
  }, [net, hideAmounts, currencySymbol]);

  // Income / expense overlay widths still come from parent's shared values,
  // mirrored into local animated styles so we can compose them with the
  // cascade clip.
  const incomeOverlayStyle = useAnimatedStyle(() => {
    const fraction = animatedIncomeFraction.value;
    const progress = tickActivityProgress.value;
    const greenCount = Math.round(fraction * PULSE_TICK_TOTAL) * progress;
    const width = greenCount > 0 ? greenCount * PULSE_TICK_W + (greenCount - 1) * PULSE_TICK_GAP : 0;
    return { width: Math.max(0, width) };
  });
  const expenseOverlayStyle = useAnimatedStyle(() => {
    const fraction = animatedIncomeFraction.value;
    const progress = tickActivityProgress.value;
    const greenCount = Math.round(fraction * PULSE_TICK_TOTAL);
    const redCount = (PULSE_TICK_TOTAL - greenCount) * progress;
    const width = redCount > 0 ? redCount * PULSE_TICK_W + (redCount - 1) * PULSE_TICK_GAP : 0;
    return { width: Math.max(0, width), right: PULSE_TICK_REMAINDER };
  });

  const splitInt = (amount: number) => {
    if (amount === 0) return { int: '—', dec: '' };
    const formatted = formatCurrency(Math.abs(amount), currencySymbol);
    const dot = formatted.lastIndexOf('.');
    return dot >= 0 ? { int: formatted.slice(0, dot), dec: formatted.slice(dot) } : { int: formatted, dec: '' };
  };
  const leftSplit = splitInt(metricLeftAmount);
  const rightSplit = splitInt(metricRightAmount);
  const leftZero = metricLeftAmount === 0;
  const rightZero = metricRightAmount === 0;
  const leftSign = metricLeftAmount < 0 ? '−' : '';
  const rightSign = metricRightAmount < 0 ? '−' : '';

  return (
    <View style={{
      backgroundColor: palette.card,
      borderRadius: HOME_RADIUS.card,
      borderWidth: 1,
      borderColor: palette.borderSoft,
      paddingVertical: 18,
      paddingHorizontal: 18,
      marginBottom: 8,
    }}>
      {/* Row 1: values come FIRST — they're the headline */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <TouchableOpacity
          delayPressIn={0}
          activeOpacity={0.75}
          onPress={() => openPeriodActivity('in')}
          style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <AppIcon name="arrow-down-left" size={13} color={leftZero ? palette.textMuted : detailInflowColor} strokeWidth={2.4} />
            <Text style={{ fontSize: 10.5, color: palette.textMuted, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              {cashflowIsCashflow ? 'Inflow' : 'Income'}
            </Text>
          </View>
          <Animated.View style={leftSpringStyle}>
            <Text style={{ fontSize: 19, fontWeight: FONT_WEIGHT.semibold, color: leftZero ? palette.textMuted : palette.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
              {hideAmounts ? '••••' : leftZero ? '—' : (
                <Text>{leftSign}{leftSplit.int}{leftSplit.dec ? <Text style={{ fontSize: 14, color: palette.textMuted, fontVariant: ['tabular-nums'] }}>{leftSplit.dec}</Text> : null}</Text>
              )}
            </Text>
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity
          delayPressIn={0}
          activeOpacity={0.75}
          onPress={() => openPeriodActivity('out')}
          style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontSize: 10.5, color: palette.textMuted, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              {cashflowIsCashflow ? 'Outflow' : 'Expense'}
            </Text>
            <AppIcon name="arrow-up-right" size={13} color={rightZero ? palette.textMuted : detailOutflowColor} strokeWidth={2.4} />
          </View>
          <Animated.View style={rightSpringStyle}>
            <Text style={{ fontSize: 19, fontWeight: FONT_WEIGHT.semibold, color: rightZero ? palette.textMuted : palette.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
              {hideAmounts ? '••••' : rightZero ? '—' : (
                <Text>{rightSign}{rightSplit.int}{rightSplit.dec ? <Text style={{ fontSize: 14, color: palette.textMuted, fontVariant: ['tabular-nums'] }}>{rightSplit.dec}</Text> : null}</Text>
              )}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Row 2: speedometer ticks — taller, cascade fill, glow handoff */}
      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <View style={{
          width: PULSE_TICK_CONTENT_W,
          height: PULSE_TICK_H,
          position: 'relative',
        }}>
          {/* base ticks (dim) */}
          <View style={{ flexDirection: 'row', gap: PULSE_TICK_GAP, position: 'absolute', left: 0, top: 0 }}>
            {Array.from({ length: PULSE_TICK_TOTAL }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: PULSE_TICK_W,
                  height: PULSE_TICK_H,
                  borderRadius: 1.5,
                  backgroundColor: palette.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
                }}
              />
            ))}
          </View>

          {/* cascade clip — masks BOTH overlays so they paint left→right */}
          <Animated.View style={[
            { position: 'absolute', left: 0, top: 0, height: PULSE_TICK_H, overflow: 'hidden' },
            cascadeClipStyle,
          ]}>
            {/* green income overlay */}
            <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: PULSE_TICK_H, overflow: 'hidden' }, incomeOverlayStyle]}>
              <View style={{ flexDirection: 'row', gap: PULSE_TICK_GAP, width: PULSE_TICK_CONTENT_W }}>
                {Array.from({ length: PULSE_TICK_TOTAL }).map((_, i) => (
                  <View key={i} style={{ width: PULSE_TICK_W, height: PULSE_TICK_H, borderRadius: 1.5, backgroundColor: detailInflowColor }} />
                ))}
              </View>
            </Animated.View>
            {/* red expense overlay anchored from the right */}
            <Animated.View style={[{ position: 'absolute', top: 0, height: PULSE_TICK_H, overflow: 'hidden' }, expenseOverlayStyle]}>
              <View style={{ position: 'absolute', right: 0, flexDirection: 'row', gap: PULSE_TICK_GAP, width: PULSE_TICK_CONTENT_W }}>
                {Array.from({ length: PULSE_TICK_TOTAL }).map((_, i) => (
                  <View key={i} style={{ width: PULSE_TICK_W, height: PULSE_TICK_H, borderRadius: 1.5, backgroundColor: detailOutflowColor }} />
                ))}
              </View>
            </Animated.View>
          </Animated.View>

          {/* Glow on the handoff tick — only visible when there's data */}
          <Animated.View pointerEvents="none" style={[
            {
              position: 'absolute',
              top: -3,
              width: PULSE_TICK_W + 4,
              height: PULSE_TICK_H + 6,
              borderRadius: 4,
              backgroundColor: typeColor,
            },
            glowStyle,
          ]} />
        </View>

        {/* Net amount anchor — gives the bar a numeric center */}
        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ fontSize: 9.5, color: palette.textMuted, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 1.0, textTransform: 'uppercase' }}>
            Net
          </Text>
          <Text style={{
            fontSize: 14,
            fontWeight: FONT_WEIGHT.semibold,
            color: net > 0 ? detailInflowColor : net < 0 ? detailOutflowColor : palette.textMuted,
            letterSpacing: -0.3,
            fontVariant: ['tabular-nums'],
          }}>
            {netFormatted}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: palette.divider, marginTop: 18, marginBottom: 14 }} />

      {/* Row 3: ALL controls collapsed in one row — period · today/month · cashflow */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ActivityPeriodHeader
            period={dateFilter?.period === 'today' ? 'day' : dateFilter?.period as any}
            periodLabel={inlineFilter === 'in' ? `Income · ${activityPeriodLabel}` : inlineFilter === 'out' ? `Expenses · ${activityPeriodLabel}` : activityPeriodLabel}
            goPrev={() => dateFilter?.navigatePrevious()}
            goNext={() => dateFilter?.navigateNext()}
            canGoNext={dateFilter?.canNavigateNext}
            setShowPeriodSheet={() => setShowPeriodSheet(true)}
            palette={palette}
            height={30}
            noBackground={true}
          />
        </View>

        <SegmentedPillSwitch
          options={[
            { key: 'today', label: 'Today' },
            { key: 'month', label: 'Month' },
          ]}
          value={dateFilter?.period === 'month' ? 'month' : 'today'}
          onChange={(key) => {
            dateFilter?.setOffset(0);
            dateFilter?.setPeriod(key as any);
          }}
          backgroundColor={palette.isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F8'}
          pillColor={palette.isDark ? palette.surface : '#FFFFFF'}
          borderColor={palette.isDark ? 'transparent' : '#DFE5EF'}
          activeTextColor={palette.text}
          inactiveTextColor={palette.textMuted}
          height={30}
          radius={14}
          fontSize={10.5}
          itemMinWidth={48}
          style={{ width: 102 }}
        />

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setCashflowIsCashflow(!cashflowIsCashflow)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.heavy, color: palette.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Cashflow
          </Text>
          <AppSwitch
            value={cashflowIsCashflow}
            onValueChange={(val) => setCashflowIsCashflow(val)}
            palette={palette}
            width={32}
            height={18}
            thumbSize={12}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Placeholder hero shown when the user cycles to the "Ledger" variant in
 * Phase 1 — full Ledger implementation lands in Phase 2.
 */
export function LedgerComingSoonHero({ palette }: { palette: AppThemePalette }) {
  return (
    <View style={{
      backgroundColor: palette.card,
      borderRadius: HOME_RADIUS.card,
      borderWidth: 1,
      borderColor: palette.borderSoft,
      padding: 24,
      marginBottom: 12,
      alignItems: 'center',
    }}>
      <Text style={{
        fontSize: 10,
        fontWeight: FONT_WEIGHT.heavy,
        color: palette.brand,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        Ledger · Phase 2
      </Text>
      <Text style={{
        fontSize: 15,
        fontWeight: FONT_WEIGHT.medium,
        color: palette.text,
        textAlign: 'center',
        lineHeight: 21,
      }}>
        Editorial / minimal redesign coming next.{'\n'}Long-press the title to switch back.
      </Text>
    </View>
  );
}
