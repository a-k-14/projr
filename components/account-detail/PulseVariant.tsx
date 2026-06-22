/**
 * Pulse — Account Detail design variant (Phase 1, REWRITTEN to literal
 * "Direction A" spec).
 *
 * Editorial / minimal aesthetic per the original Direction A bullets:
 * - Warm off-white canvas #F7F4EE, deep ink #0E1014
 * - Forest green credits #1B6B4F / terracotta debits #B23A2F. No gradients.
 * - Hero = balance + chart fused with NO card chrome, 1px ink line, no fill
 * - Single proportional cashflow bar (income green vs expense red), not ticks
 * - Row of 4 quick-action pills under the hero
 * - +Add lives on a floating bottom-right FAB (header +Add hidden in this
 *   variant; FAB component is owned by `app/account/[id].tsx`)
 * - Activity list rows use minimal colored dots instead of icon circles
 *
 * The Pulse variant keeps the EXISTING sans typography (per user direction —
 * no serif font change here; the serif treatment lives in the Ledger variant).
 *
 * Toggle: long-press the account name in the screen header.
 * Owned by `stores/useDesignLabStore.ts`.
 */
import React, { useEffect, useMemo } from 'react';
import { Dimensions, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/AppText';
import { ActivityPeriodHeader } from '../activity/ActivityPeriodHeader';
import { AppIcon } from '../ui/AppIcon';
import { AppSwitch } from '../ui/AppSwitch';
import { formatCurrency, formatSignedCurrency } from '../../lib/derived';
import { FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { SegmentedPillSwitch } from '../ui/SegmentedPillSwitch';
import { type AppThemePalette } from '../../lib/theme';

// ── Editorial palette shared between Pulse + Ledger variants ────────────────
// Both variants apply the same cream canvas wash; the difference is that
// Ledger uses serif numerals (Fraunces) while Pulse stays on the app's
// existing sans. See `app/account/[id].tsx` for the screen-level overrides.
export const EDITORIAL_BG = '#F7F4EE';
export const EDITORIAL_INK = '#0E1014';
export const EDITORIAL_INK_MUTED = '#5C5852';
export const EDITORIAL_INK_SUBTLE = '#8A8580';
export const EDITORIAL_HAIRLINE = '#E5DFD3';
export const EDITORIAL_CREDIT = '#1B6B4F';   // forest green
export const EDITORIAL_DEBIT = '#B23A2F';    // terracotta

// Proportional cashflow bar dims.
const CASHFLOW_BAR_HEIGHT = 8;
const CASHFLOW_BAR_RADIUS = 4;

// Width of the dotted divider in the hero.
const SCREEN_W = Dimensions.get('window').width;
const DOTTED_W = SCREEN_W - 2 * SCREEN_GUTTER;
const DOTTED_DOTS = Math.floor(DOTTED_W / 6);

interface PulseHeroProps {
  accountTypeLabel: string;
  isNegative: boolean;
  hideAmounts: boolean;
  currencySymbol: string;
  balanceInt: string;
  balanceDec: string;
  activePoint: any;
  activePointDateFormatted: string;
  activePointValFormatted: string;
  /** Editorial chart node — 1px ink line, no fill. Built by the parent. */
  middleContent: React.ReactNode;
}

/**
 * Hero — balance + trend line on cream, NO card chrome. The amount is the
 * hero, not the card around it.
 */
export function PulseAccountHero({
  accountTypeLabel,
  isNegative,
  hideAmounts,
  currencySymbol,
  balanceInt,
  balanceDec,
  activePoint,
  activePointDateFormatted,
  activePointValFormatted,
  middleContent,
}: PulseHeroProps) {
  const balanceClean = currencySymbol && balanceInt.startsWith(currencySymbol)
    ? balanceInt.slice(currencySymbol.length)
    : balanceInt;

  return (
    <View style={{ paddingTop: 18, paddingBottom: 4 }}>
      {/* Type label — small caps */}
      <Text style={{
        fontSize: 10,
        fontWeight: FONT_WEIGHT.heavy,
        color: EDITORIAL_INK_SUBTLE,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        marginBottom: 12,
      }}>
        {accountTypeLabel}
      </Text>

      {/* Balance — sans, large, ink. Tabular-nums so digits don't jiggle. */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        {isNegative && !hideAmounts && (
          <Text style={{
            fontSize: 36,
            fontWeight: FONT_WEIGHT.medium,
            color: EDITORIAL_INK,
            marginRight: 2,
          }}>−</Text>
        )}
        {currencySymbol && !hideAmounts && (
          <Text style={{
            fontSize: 22,
            fontWeight: FONT_WEIGHT.medium,
            color: EDITORIAL_INK_MUTED,
            marginRight: 4,
          }}>
            {currencySymbol}
          </Text>
        )}
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{
            fontSize: 44,
            fontWeight: FONT_WEIGHT.semibold,
            color: EDITORIAL_INK,
            letterSpacing: -1.4,
            fontVariant: ['tabular-nums'],
            lineHeight: 48,
          }}>
          {balanceClean}
        </Text>
        {balanceDec && (
          <Text style={{
            fontSize: 20,
            fontWeight: FONT_WEIGHT.medium,
            color: EDITORIAL_INK_MUTED,
            fontVariant: ['tabular-nums'],
          }}>
            {balanceDec}
          </Text>
        )}
      </View>

      {/* Chart — 1px ink line, no fill. Scrubber updates active-point row. */}
      <View style={{ marginTop: 4, marginHorizontal: -SCREEN_GUTTER + 4 }}>
        {middleContent}
      </View>

      {/* Active-point readout (scrubber output) / "Today" anchor */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{
          fontSize: 11,
          color: EDITORIAL_INK_SUBTLE,
          fontWeight: FONT_WEIGHT.semibold,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}>
          {activePoint ? activePointDateFormatted : '\u00A0'}
        </Text>
        <Text style={{
          fontSize: 12,
          color: EDITORIAL_INK,
          fontWeight: FONT_WEIGHT.semibold,
          letterSpacing: 0.4,
          fontVariant: ['tabular-nums'],
        }}>
          {activePoint ? activePointValFormatted : 'TODAY'}
        </Text>
      </View>
    </View>
  );
}

interface QuickAction {
  key: string;
  label: string;
  icon: string;
  onPress?: () => void;
}

interface PulseQuickActionsProps {
  actions?: QuickAction[];
}

/**
 * Row of 4 minimal pill buttons just under the hero — Transfer · Statement
 * · Reconcile · Categorize. These are visually present per Direction A;
 * actual feature wiring TBD (each opens a placeholder for now).
 */
export function PulseQuickActions({ actions }: PulseQuickActionsProps) {
  const items: QuickAction[] = actions ?? [
    { key: 'transfer', label: 'Transfer', icon: 'shuffle' },
    { key: 'statement', label: 'Statement', icon: 'file-text' },
    { key: 'reconcile', label: 'Reconcile', icon: 'check-circle' },
    { key: 'categorize', label: 'Categorize', icon: 'tag' },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 18,
      paddingBottom: 10,
      gap: 8,
    }}>
      {items.map((a) => (
        <TouchableOpacity
          key={a.key}
          delayPressIn={0}
          activeOpacity={0.7}
          onPress={a.onPress}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 9,
            paddingHorizontal: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: EDITORIAL_HAIRLINE,
            backgroundColor: 'transparent',
          }}
        >
          <AppIcon name={a.icon} size={12} color={EDITORIAL_INK} strokeWidth={2} />
          <Text style={{
            fontSize: 10.5,
            color: EDITORIAL_INK,
            fontWeight: FONT_WEIGHT.semibold,
            letterSpacing: 0.2,
          }}
            numberOfLines={1}>
            {a.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface PulseCashflowBarProps {
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
  animatedIncomeFraction: SharedValue<number>;
  tickActivityProgress: SharedValue<number>;
  openPeriodActivity: (kind: 'in' | 'out') => void;
}

/**
 * Cashflow — ONE horizontal proportional bar (income green vs expense red)
 * with two numbers underneath. Replaces the noisy tick band per Direction A.
 *
 * Still proportional, still animated (spring-driven width from parent's
 * shared values, with a cascade-in on mount), just one continuous line not
 * 60 ticks.
 */
export function PulseCashflowBar({
  palette: _palette,
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
  animatedIncomeFraction,
  tickActivityProgress,
  openPeriodActivity,
}: PulseCashflowBarProps) {
  // Cascade-in: the bar paints left→right on first mount + period change.
  const cascade = useSharedValue(0);
  const prevKeyRef = React.useRef('');
  const dataKey = `${metricLeftAmount}|${metricRightAmount}`;
  useEffect(() => {
    if (prevKeyRef.current === dataKey) return;
    prevKeyRef.current = dataKey;
    cascade.value = 0;
    cascade.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [dataKey, cascade]);

  const cascadeStyle = useAnimatedStyle(() => ({
    width: `${cascade.value * 100}%`,
  }));

  // Green segment width = fraction * cascade-revealed area.
  const greenSegStyle = useAnimatedStyle(() => {
    const fraction = animatedIncomeFraction.value;
    const progress = tickActivityProgress.value;
    return {
      flex: Math.max(0.0001, fraction * progress),
    };
  });
  const redSegStyle = useAnimatedStyle(() => {
    const fraction = animatedIncomeFraction.value;
    const progress = tickActivityProgress.value;
    return {
      flex: Math.max(0.0001, (1 - fraction) * progress),
    };
  });

  const net = metricLeftAmount - metricRightAmount;
  const netFormatted = useMemo(() => {
    if (hideAmounts) return '••••';
    if (net === 0) return '—';
    return formatSignedCurrency(net, currencySymbol, { zeroPlaceholder: '—' });
  }, [net, hideAmounts, currencySymbol]);

  const leftZero = metricLeftAmount === 0;
  const rightZero = metricRightAmount === 0;
  const formatAmount = (amount: number) => {
    if (hideAmounts) return '••••';
    if (amount === 0) return '—';
    return formatCurrency(Math.abs(amount), currencySymbol);
  };
  const leftSign = metricLeftAmount < 0 ? '−' : '';
  const rightSign = metricRightAmount < 0 ? '−' : '';

  return (
    <View style={{ paddingTop: 22, paddingBottom: 18 }}>
      {/* Period strip + Today/Month */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ActivityPeriodHeader
            period={dateFilter?.period === 'today' ? 'day' : (dateFilter?.period as any)}
            periodLabel={inlineFilter === 'in' ? `Income · ${activityPeriodLabel}` : inlineFilter === 'out' ? `Expenses · ${activityPeriodLabel}` : activityPeriodLabel}
            goPrev={() => dateFilter?.navigatePrevious()}
            goNext={() => dateFilter?.navigateNext()}
            canGoNext={dateFilter?.canNavigateNext}
            setShowPeriodSheet={() => setShowPeriodSheet(true)}
            // Wash header into the cream/ink palette
            palette={{
              ..._palette,
              text: EDITORIAL_INK,
              textMuted: EDITORIAL_INK_SUBTLE,
              card: 'transparent',
              borderSoft: 'transparent',
            } as any}
            height={28}
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
          backgroundColor={EDITORIAL_HAIRLINE}
          pillColor="#FFFFFF"
          borderColor={EDITORIAL_HAIRLINE}
          activeTextColor={EDITORIAL_INK}
          inactiveTextColor={EDITORIAL_INK_SUBTLE}
          height={28}
          radius={14}
          fontSize={10.5}
          itemMinWidth={48}
          style={{ width: 102, marginLeft: 8 }}
        />
      </View>

      {/* Proportional bar — single line, green | red */}
      <Animated.View style={[
        {
          height: CASHFLOW_BAR_HEIGHT,
          borderRadius: CASHFLOW_BAR_RADIUS,
          backgroundColor: EDITORIAL_HAIRLINE,
          overflow: 'hidden',
          flexDirection: 'row',
        },
        cascadeStyle,
      ]}>
        <Animated.View style={[{ height: CASHFLOW_BAR_HEIGHT, backgroundColor: EDITORIAL_CREDIT }, greenSegStyle]} />
        <Animated.View style={[{ height: CASHFLOW_BAR_HEIGHT, backgroundColor: EDITORIAL_DEBIT }, redSegStyle]} />
      </Animated.View>

      {/* Two numbers underneath */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 14 }}>
        <TouchableOpacity
          delayPressIn={0}
          activeOpacity={0.7}
          onPress={() => openPeriodActivity('in')}
          style={{ flex: 1, paddingRight: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: leftZero ? EDITORIAL_INK_SUBTLE : EDITORIAL_CREDIT }} />
            <Text style={{
              fontSize: 10,
              color: EDITORIAL_INK_SUBTLE,
              fontWeight: FONT_WEIGHT.heavy,
              letterSpacing: 1.0,
              textTransform: 'uppercase',
            }}>
              {cashflowIsCashflow ? 'Inflow' : 'Income'}
            </Text>
          </View>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              fontSize: 20,
              fontWeight: FONT_WEIGHT.semibold,
              color: leftZero ? EDITORIAL_INK_SUBTLE : EDITORIAL_INK,
              letterSpacing: -0.5,
              fontVariant: ['tabular-nums'],
            }}>
            {leftSign}{formatAmount(metricLeftAmount)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          delayPressIn={0}
          activeOpacity={0.7}
          onPress={() => openPeriodActivity('out')}
          style={{ flex: 1, paddingLeft: 8, alignItems: 'flex-end' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={{
              fontSize: 10,
              color: EDITORIAL_INK_SUBTLE,
              fontWeight: FONT_WEIGHT.heavy,
              letterSpacing: 1.0,
              textTransform: 'uppercase',
            }}>
              {cashflowIsCashflow ? 'Outflow' : 'Expense'}
            </Text>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: rightZero ? EDITORIAL_INK_SUBTLE : EDITORIAL_DEBIT }} />
          </View>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              fontSize: 20,
              fontWeight: FONT_WEIGHT.semibold,
              color: rightZero ? EDITORIAL_INK_SUBTLE : EDITORIAL_INK,
              letterSpacing: -0.5,
              fontVariant: ['tabular-nums'],
            }}>
            {rightSign}{formatAmount(metricRightAmount)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Net + Cashflow toggle row */}
      <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{
            fontSize: 9.5,
            color: EDITORIAL_INK_SUBTLE,
            fontWeight: FONT_WEIGHT.heavy,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}>
            Net
          </Text>
          <Text style={{
            fontSize: 13,
            color: net > 0 ? EDITORIAL_CREDIT : net < 0 ? EDITORIAL_DEBIT : EDITORIAL_INK_SUBTLE,
            fontWeight: FONT_WEIGHT.semibold,
            letterSpacing: -0.2,
            fontVariant: ['tabular-nums'],
          }}>
            {netFormatted}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{
            fontSize: 10,
            color: EDITORIAL_INK_SUBTLE,
            fontWeight: FONT_WEIGHT.heavy,
            letterSpacing: 1.0,
            textTransform: 'uppercase',
          }}>
            Cashflow
          </Text>
          <AppSwitch
            value={cashflowIsCashflow}
            onValueChange={(val) => setCashflowIsCashflow(val)}
            palette={{
              ..._palette,
              brand: EDITORIAL_INK,
              borderSoft: EDITORIAL_HAIRLINE,
            } as any}
            width={32}
            height={18}
            thumbSize={12}
          />
        </View>
      </View>

      {/* Closing dotted hairline */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
        {Array.from({ length: DOTTED_DOTS }).map((_, i) => (
          <View key={i} style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: EDITORIAL_HAIRLINE }} />
        ))}
      </View>
    </View>
  );
}
