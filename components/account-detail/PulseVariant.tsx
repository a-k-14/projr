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
import React, { useMemo, useEffect } from 'react';
import { Dimensions, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/AppText';
import { formatCurrency, formatSignedCurrency } from '../../lib/derived';
import { APP_LOCALE } from '../../lib/dateUtils';
import { FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { type AppThemePalette } from '../../lib/theme';
import { ActivityPeriodHeader } from '../activity/ActivityPeriodHeader';
import { AppIcon } from '../ui/AppIcon';
import { AppSwitch } from '../ui/AppSwitch';
import { ACCOUNT_TYPE_META } from '../../lib/settings-shared';
import { HOME_RADIUS, HOME_TEXT, HELP_TEXTS } from '../../lib/layoutTokens';
import type { AccountType } from '../../types';

// ── Editorial palette shared between Pulse + Ledger variants ────────────────
export const EDITORIAL_BG = '#F7F4EE';
export const EDITORIAL_INK = '#0E1014';
export const EDITORIAL_INK_MUTED = '#5C5852';
export const EDITORIAL_INK_SUBTLE = '#8A8580';
export const EDITORIAL_HAIRLINE = '#E5DFD3';

// Width of the dotted divider in the hero.
const SCREEN_W = Dimensions.get('window').width;
const DOTTED_W = SCREEN_W - 2 * SCREEN_GUTTER;
const DOTTED_DOTS = Math.floor(DOTTED_W / 6);

interface PulseHeroProps {
  accountTypeLabel: string;
  accountType?: string;
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
  palette: AppThemePalette;
}

/**
 * Hero — balance + trend line on cream, NO card chrome. The amount is the
 * hero, not the card around it.
 */
export function PulseAccountHero({
  accountTypeLabel,
  accountType,
  isNegative,
  hideAmounts,
  currencySymbol,
  balanceInt,
  balanceDec,
  activePoint,
  activePointDateFormatted,
  activePointValFormatted,
  middleContent,
  palette,
}: PulseHeroProps) {
  const balanceClean = currencySymbol && balanceInt.startsWith(currencySymbol)
    ? balanceInt.slice(currencySymbol.length)
    : balanceInt;

  const isDark = palette.isDark;

  return (
    <View style={{ paddingTop: 2, paddingBottom: 4, position: 'relative' }}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2, alignItems: 'flex-start' }}>
        {/* Column 1: Icon */}
        {accountType && (() => {
          const typeMeta = ACCOUNT_TYPE_META[accountType as AccountType];
          if (!typeMeta) return null;
          const typeColor = typeMeta.color;
          return (
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: HOME_RADIUS.chip,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: typeMeta.bg ?? `${typeColor}18`,
              }}
            >
              <AppIcon name={typeMeta.icon} size={18} color={typeColor} strokeWidth={1.8} />
            </View>
          );
        })()}

        {/* Column 2: Type Label + Balance */}
        <View style={{ flex: 1 }}>
          {/* Type label — small caps */}
          <Text style={{
            fontSize: 10,
            fontWeight: FONT_WEIGHT.heavy,
            color: EDITORIAL_INK_MUTED,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            marginBottom: 2,
          }}>
            {accountTypeLabel}
          </Text>

          {/* Balance — sans, regular weight */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            {isNegative && !hideAmounts && (
              <Text style={{
                fontSize: 24,
                fontWeight: FONT_WEIGHT.regular,
                color: EDITORIAL_INK,
                marginRight: 2,
              }}>−</Text>
            )}
            {currencySymbol && !hideAmounts && (
              <Text style={{
                fontSize: 16,
                fontWeight: FONT_WEIGHT.regular,
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
                fontSize: 28,
                fontWeight: FONT_WEIGHT.regular,
                color: EDITORIAL_INK,
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
                lineHeight: 34,
              }}>
              {balanceClean}
            </Text>
            {balanceDec && (
              <Text style={{
                fontSize: 15,
                fontWeight: FONT_WEIGHT.regular,
                color: EDITORIAL_INK_MUTED,
                fontVariant: ['tabular-nums'],
              }}>
                {balanceDec}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Active tooltip overlay block — tooltip bg same as screen bg */}
      {activePoint && (() => {
        const diff = activePoint.prev ? activePoint.val - activePoint.prev.val : 0;
        const hasPrev = diff !== 0 && activePoint.prev;
        let prevDateStr = '';
        if (hasPrev) {
          const prevD = new Date(activePoint.prev.date + 'T00:00:00');
          prevDateStr = isNaN(prevD.getTime())
            ? ''
            : `${prevD.getDate()} ${prevD.toLocaleDateString(APP_LOCALE, { month: 'short' })}`;
        }
        const isPositive = diff > 0;
        const tooltipBg = palette.background;
        const textMainColor = isDark ? '#FFFFFF' : EDITORIAL_INK;
        const textMutedColor = isDark ? '#8A8580' : EDITORIAL_INK_MUTED;
        const dividerColor = isDark ? 'rgba(255,255,255,0.12)' : EDITORIAL_HAIRLINE;

        return (
          <View style={{
            position: 'absolute',
            top: 12,
            alignSelf: 'center',
            backgroundColor: tooltipBg,
            borderRadius: 12,
            paddingVertical: 8,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            zIndex: 100,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            shadowColor: isDark ? '#000000' : '#94A3B8',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.35 : 0.15,
            shadowRadius: 8,
            elevation: 8,
          }}>
            {/* Column 1: Dates */}
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={{ fontSize: 11, color: textMutedColor, fontWeight: FONT_WEIGHT.semibold }}>
                {activePointDateFormatted}
              </Text>
              {hasPrev && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 9.5, color: textMutedColor, marginRight: 3 }}>vs</Text>
                  <Text style={{ fontSize: 10, color: textMutedColor, fontWeight: FONT_WEIGHT.medium }}>
                    {prevDateStr}
                  </Text>
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={{ width: 1, height: hasPrev ? 26 : 14, backgroundColor: dividerColor }} />

            {/* Column 2: Amounts */}
            <View style={{ alignItems: 'flex-start', gap: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.semibold, color: textMainColor }}>
                {activePointValFormatted}
              </Text>
              {hasPrev && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <AppIcon
                    name={isPositive ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={isPositive ? palette.positive : palette.negative}
                    strokeWidth={2.5}
                  />
                  <Text style={{
                    fontSize: 10,
                    color: isPositive ? palette.positive : palette.negative,
                    fontWeight: FONT_WEIGHT.bold,
                  }}>
                    {formatSignedCurrency(Math.abs(diff), currencySymbol, { zeroPlaceholder: null })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
      })()}

      {/* Chart — 1px ink line, no fill, aligned closer to balance (marginBottom: 12) */}
      <View style={{ marginTop: 8, marginHorizontal: 0, marginBottom: 12 }}>
        {middleContent}
      </View>
    </View>
  );
}

export function PulseQuickActions() {
  return null;
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
const TICK_W = 2;
const TICK_GAP = 4;
const TICK_CONTAINER_W = Math.max(80, Dimensions.get('window').width - 2 * 12);
const TICK_TOTAL = Math.floor((TICK_CONTAINER_W + TICK_GAP) / (TICK_W + TICK_GAP));
const TICK_CONTENT_W = TICK_TOTAL * (TICK_W + TICK_GAP) - TICK_GAP;

export function PulseCashflowBar({
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
  animatedIncomeFraction,
  tickActivityProgress,
  openPeriodActivity,
}: PulseCashflowBarProps) {
  const detailIncomeTickOverlayStyle = useAnimatedStyle(() => {
    const progress = tickActivityProgress.value;
    const fraction = animatedIncomeFraction.value;
    const greenTicksCount = Math.round(fraction * TICK_TOTAL);
    const currentGreenTicks = greenTicksCount * progress;
    const width = currentGreenTicks > 0
      ? currentGreenTicks * TICK_W + (currentGreenTicks - 1) * TICK_GAP
      : 0;
    return {
      width: Math.max(0, width),
    };
  });

  const detailExpenseTickOverlayStyle = useAnimatedStyle(() => {
    const progress = tickActivityProgress.value;
    const fraction = animatedIncomeFraction.value;
    const greenTicksCount = Math.round(fraction * TICK_TOTAL);
    const redTicksCount = TICK_TOTAL - greenTicksCount;
    const currentRedTicks = redTicksCount * progress;
    const width = currentRedTicks > 0
      ? currentRedTicks * TICK_W + (currentRedTicks - 1) * TICK_GAP
      : 0;
    return {
      width: Math.max(0, width),
      right: 0,
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

  const noteProgress = useSharedValue(cashflowIsCashflow ? 1 : 0);
  useEffect(() => {
    noteProgress.value = withTiming(cashflowIsCashflow ? 1 : 0, { duration: 220 });
  }, [cashflowIsCashflow]);
  const CASHFLOW_NOTE_H = 30;
  const animatedNoteStyle = useAnimatedStyle(() => ({
    height: noteProgress.value * CASHFLOW_NOTE_H,
    opacity: noteProgress.value,
    overflow: 'hidden',
  }));

  return (
    <View style={{ paddingTop: 8, paddingBottom: 18 }}>
      {/* Period strip + Today/Month */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ActivityPeriodHeader
            period={dateFilter?.period === 'today' ? 'day' : (dateFilter?.period as any)}
            periodLabel={
              inlineFilter === 'in'
                ? `${cashflowIsCashflow ? 'Inflow' : 'Income'} · ${activityPeriodLabel}`
                : inlineFilter === 'out'
                ? `${cashflowIsCashflow ? 'Outflow' : 'Expenses'} · ${activityPeriodLabel}`
                : activityPeriodLabel
            }
            goPrev={() => dateFilter?.navigatePrevious()}
            goNext={() => dateFilter?.navigateNext()}
            canGoNext={dateFilter?.canNavigateNext}
            setShowPeriodSheet={() => setShowPeriodSheet(true)}
            // Wash header into the cream/ink palette
            palette={{
              ...palette,
              text: EDITORIAL_INK,
              textMuted: EDITORIAL_INK_SUBTLE,
              card: 'transparent',
              borderSoft: 'transparent',
            } as any}
            height={28}
            noBackground={true}
          />
        </View>
      </View>

      {/* Speedometer sweep ticks — replaced the line bar */}
      <View style={{ flexDirection: 'row', gap: TICK_GAP, marginBottom: 4, width: TICK_CONTENT_W, alignSelf: 'center' }}>
        {Array.from({ length: TICK_TOTAL }).map((_, i) => (
          <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }} />
        ))}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: 12, overflow: 'hidden' }, detailIncomeTickOverlayStyle]}>
          <View style={{ flexDirection: 'row', gap: TICK_GAP, width: TICK_CONTENT_W }}>
            {Array.from({ length: TICK_TOTAL }).map((_, i) => (
              <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.positive }} />
            ))}
          </View>
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', top: 0, height: 12, overflow: 'hidden' }, detailExpenseTickOverlayStyle]}>
          <View style={{ position: 'absolute', right: 0, flexDirection: 'row', gap: TICK_GAP, width: TICK_CONTENT_W }}>
            {Array.from({ length: TICK_TOTAL }).map((_, i) => (
              <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.negative }} />
            ))}
          </View>
        </Animated.View>
      </View>

      {/* Two numbers underneath — aligned horizontally with the ticks */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 14, width: TICK_CONTENT_W, alignSelf: 'center' }}>
        <TouchableOpacity
          delayPressIn={0}
          activeOpacity={0.7}
          onPress={() => openPeriodActivity('in')}
          style={{ flex: 1, paddingRight: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <AppIcon
              name="arrow-down-left"
              size={13}
              color={leftZero ? EDITORIAL_INK_SUBTLE : palette.positive}
              strokeWidth={2.4}
            />
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
              fontWeight: FONT_WEIGHT.regular,
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
            <AppIcon
              name="arrow-up-right"
              size={13}
              color={rightZero ? EDITORIAL_INK_SUBTLE : palette.negative}
              strokeWidth={2.4}
            />
          </View>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              fontSize: 20,
              fontWeight: FONT_WEIGHT.regular,
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
            color: net > 0 ? palette.positive : net < 0 ? palette.negative : EDITORIAL_INK_SUBTLE,
            fontWeight: FONT_WEIGHT.regular,
            letterSpacing: -0.2,
            fontVariant: ['tabular-nums'],
          }}>
            {netFormatted}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setCashflowIsCashflow(!cashflowIsCashflow)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
        >
          <Text style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted }}>
            Cashflow
          </Text>
          <AppSwitch
            value={cashflowIsCashflow}
            onValueChange={(val) => setCashflowIsCashflow(val)}
            palette={palette}
            width={36}
            height={20}
            thumbSize={14}
          />
        </TouchableOpacity>
      </View>

      {/* Cashflow info note */}
      <Animated.View style={animatedNoteStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 8 }}>
          <AppIcon name="info" size={11} color={palette.textMuted} strokeWidth={1.8} />
          <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, letterSpacing: 0.1 }}>
            {HELP_TEXTS.cashflowNote}
          </Text>
        </View>
      </Animated.View>

      {/* Closing dotted hairline */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
        {Array.from({ length: DOTTED_DOTS }).map((_, i) => (
          <View key={i} style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: EDITORIAL_HAIRLINE }} />
        ))}
      </View>
    </View>
  );
}
