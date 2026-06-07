/**
 * AccountDetailsV2Hero — experimental rearrangement of the account detail hero.
 *
 * Renders as TWO separate cards instead of the existing single-card hero:
 *   Card 1: gradient top (icon + name + balance) with the balance trend chart embedded below
 *   Card 2: period chips + cashflow toggle + tick chart + income/expense values
 *
 * JSX is duplicated from `AccountSummaryCard` (in app/(tabs)/index.tsx) so that
 * the original card stays untouched. Animation behavior (tick sweep, metric springs,
 * cashflow note expand) is preserved 1:1.
 *
 * Activated for a single account via HomeAccountPage's `useExperimentalHero` prop
 * (set from app/account/[id].tsx based on V2_ACCOUNT_NAME).
 */

import { Dimensions, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon } from '../ui/AppIcon';
import { Text } from '../ui/AppText';
import { AppSwitch } from '../ui/AppSwitch';
import { SegmentedPillSwitch } from '../ui/SegmentedPillSwitch';
import { FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { HELP_TEXTS, HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import { ACCOUNT_TYPE_META } from '../../lib/settings-shared';
import { formatDate } from '../../lib/dateUtils';
import type { AppThemePalette } from '../../lib/theme';
import type { AccountType, CashflowSummary, PeriodType } from '../../types';

type HomePeriodType = 'today' | PeriodType;

const PERIODS: HomePeriodType[] = ['today', 'week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<HomePeriodType, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom',
};

// Tick-chart geometry — duplicated from index.tsx so V2 looks identical.
const TICK_W = 2.3;
const TICK_GAP = 4;
const TICK_CONTAINER_W = Math.max(80, Dimensions.get('window').width - 2 * SCREEN_GUTTER - 2 * 14);
const TICK_TOTAL = Math.floor((TICK_CONTAINER_W + TICK_GAP) / (TICK_W + TICK_GAP));
const TICK_CONTENT_W = TICK_TOTAL * (TICK_W + TICK_GAP) - TICK_GAP;
const TICK_REMAINDER = TICK_CONTAINER_W - TICK_CONTENT_W;

const METRIC_ARM_WINDOW_MS = 750;
const CASHFLOW_NOTE_H = 30;

// Split "12,345.67" -> { int: "12,345", dec: ".67" }
function splitTickAmount(amount: number): { int: string; dec: string } {
  const formatted = Math.abs(amount).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
  const dotIdx = formatted.indexOf('.');
  if (dotIdx === -1) return { int: formatted, dec: '' };
  return { int: formatted.slice(0, dotIdx), dec: formatted.slice(dotIdx) };
}

function useMetricSprings(tweenTrigger: number, leftAmount: number, rightAmount: number) {
  const leftSpring = useSharedValue(0);
  const rightSpring = useSharedValue(0);
  const lastTweenTriggerRef = useRef(tweenTrigger);
  const armedStampRef = useRef(0);
  const lastLeftAmountRef = useRef(leftAmount);
  const lastRightAmountRef = useRef(rightAmount);

  useEffect(() => {
    if (tweenTrigger !== lastTweenTriggerRef.current) {
      lastTweenTriggerRef.current = tweenTrigger;
      armedStampRef.current = performance.now();
    }

    const leftChanged = leftAmount !== lastLeftAmountRef.current;
    const rightChanged = rightAmount !== lastRightAmountRef.current;
    lastLeftAmountRef.current = leftAmount;
    lastRightAmountRef.current = rightAmount;

    if (armedStampRef.current === 0) return;
    if (performance.now() - armedStampRef.current > METRIC_ARM_WINDOW_MS) {
      armedStampRef.current = 0;
      return;
    }

    const springUp = (sv: typeof leftSpring) => {
      sv.value = -4;
      sv.value = withSpring(0, { damping: 12, stiffness: 220, mass: 0.6 });
    };

    if (leftChanged) springUp(leftSpring);
    if (rightChanged) springUp(rightSpring);
    if (leftChanged || rightChanged) armedStampRef.current = 0;
  }, [tweenTrigger, leftAmount, rightAmount, leftSpring, rightSpring]);

  const leftSpringStyle = useAnimatedStyle(() => ({ transform: [{ translateY: leftSpring.value }] }));
  const rightSpringStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rightSpring.value }] }));

  return { leftSpringStyle, rightSpringStyle };
}

interface Props {
  accountName: string;
  accountTypeLabel: string;
  balance: number;
  currencySymbol: string;
  palette: AppThemePalette;

  incomeExpense?: { income: number; expense: number };
  cashflowSummary?: CashflowSummary;

  period?: HomePeriodType;
  onPeriodChange?: (p: HomePeriodType) => void;
  onOpenCustomRange?: () => void;

  isCashflowView?: boolean;
  onToggleCashflowView?: (v: boolean) => void;

  onPressMetricIn?: () => void;
  onPressMetricOut?: () => void;

  hideAmounts?: boolean;
  accountType?: AccountType;
  from?: string;
  to?: string;
  tweenTrigger: number;

  /** The TrendLineChart node, rendered inside the gradient card below the balance. */
  trendChart: React.ReactNode;
  /** When set, the gradient top-right shows the tooltip (date + value) instead
   *  of being empty. Set while the user is dragging the chart. */
  activeTrendPoint?: { date: string; val: number } | null;
}

export function AccountDetailsV2Hero({
  accountName,
  balance,
  currencySymbol,
  palette,
  incomeExpense,
  cashflowSummary,
  period,
  onPeriodChange,
  onOpenCustomRange,
  isCashflowView,
  onToggleCashflowView,
  onPressMetricIn,
  onPressMetricOut,
  hideAmounts,
  accountType,
  from,
  to,
  tweenTrigger,
  trendChart,
  activeTrendPoint,
}: Props) {
  const typeMeta = accountType ? ACCOUNT_TYPE_META[accountType] : undefined;
  const typeColor = typeMeta?.color ?? palette.brand;

  // Depth gradient: top = account-type color, bottom = same color darkened ~32%.
  // Matches AccountSummaryCard's `accountHeroDarkGradient` logic exactly so the
  // V2 hero feels visually identical to the classic hero's gradient top half.
  const accountHeroDarkGradient: [string, string] = React.useMemo(() => {
    if (!accountType || !typeColor.startsWith('#') || typeColor.length < 7) return ['#16192A', '#1A1E30'];
    const r = parseInt(typeColor.slice(1, 3), 16);
    const g = parseInt(typeColor.slice(3, 5), 16);
    const b = parseInt(typeColor.slice(5, 7), 16);
    const darkFactor = 0.68;
    const dr = Math.round(r * darkFactor);
    const dg = Math.round(g * darkFactor);
    const db = Math.round(b * darkFactor);
    const darker = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
    return [typeColor, darker];
  }, [accountType, typeColor]);
  const heroText = '#FFFFFF';
  const heroMutedText = 'rgba(255,255,255,0.75)';
  const heroSoftText = 'rgba(255,255,255,0.52)';

  // Balance number split (integer / decimal).
  const balanceFormatted = Math.abs(balance).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const balanceDotIdx = balanceFormatted.indexOf('.');
  const balanceInt = balanceDotIdx === -1 ? balanceFormatted : balanceFormatted.slice(0, balanceDotIdx);
  const balanceDec = balanceDotIdx === -1 ? '' : balanceFormatted.slice(balanceDotIdx);

  // ── Tick chart animation (duplicated from AccountSummaryCard) ──
  const isCashflow = !!isCashflowView;
  const tickIn = isCashflow ? (cashflowSummary?.in ?? 0) : (incomeExpense?.income ?? 0);
  const tickOut = isCashflow ? (cashflowSummary?.out ?? 0) : (incomeExpense?.expense ?? 0);
  const totalTick = tickIn + tickOut;
  const incomeFraction = totalTick > 0 ? tickIn / totalTick : 0.5;
  const animatedIncomeFraction = useSharedValue(incomeFraction);
  const tickActivityProgress = useSharedValue(totalTick > 0 ? 1 : 0);
  const prevTotalTickRef = useRef(totalTick);

  useEffect(() => {
    if (totalTick > 0) {
      if (prevTotalTickRef.current === 0) {
        animatedIncomeFraction.value = incomeFraction;
      } else {
        animatedIncomeFraction.value = withSpring(incomeFraction, { damping: 26, stiffness: 180, mass: 0.9, overshootClamping: true });
      }
    }
    tickActivityProgress.value = withTiming(totalTick > 0 ? 1 : 0, { duration: 250 });
    prevTotalTickRef.current = totalTick;
  }, [tickIn, tickOut, incomeFraction, totalTick, animatedIncomeFraction, tickActivityProgress]);

  const incomeTickOverlayStyle = useAnimatedStyle(() => {
    const progress = tickActivityProgress.value;
    const fraction = animatedIncomeFraction.value;
    const greenTicksCount = Math.round(fraction * TICK_TOTAL);
    const currentGreenTicks = greenTicksCount * progress;
    const width = currentGreenTicks > 0
      ? currentGreenTicks * TICK_W + (currentGreenTicks - 1) * TICK_GAP
      : 0;
    return { width: Math.max(0, width) };
  });
  const expenseTickOverlayStyle = useAnimatedStyle(() => {
    const progress = tickActivityProgress.value;
    const fraction = animatedIncomeFraction.value;
    const greenTicksCount = Math.round(fraction * TICK_TOTAL);
    const redTicksCount = TICK_TOTAL - greenTicksCount;
    const currentRedTicks = redTicksCount * progress;
    const width = currentRedTicks > 0
      ? currentRedTicks * TICK_W + (currentRedTicks - 1) * TICK_GAP
      : 0;
    return { width: Math.max(0, width), right: TICK_REMAINDER };
  });

  // Cashflow help-text expand.
  const cashflowNoteProgress = useSharedValue(isCashflowView ? 1 : 0);
  useEffect(() => {
    cashflowNoteProgress.value = withTiming(isCashflowView ? 1 : 0, { duration: 220 });
  }, [isCashflowView, cashflowNoteProgress]);
  const cashflowNoteStyle = useAnimatedStyle(() => ({
    height: cashflowNoteProgress.value * CASHFLOW_NOTE_H,
    opacity: cashflowNoteProgress.value,
    overflow: 'hidden',
  }));

  // Income / expense values + their slide-on-change springs.
  const metricLeftAmount = tickIn;
  const metricRightAmount = tickOut;
  const { leftSpringStyle, rightSpringStyle } = useMetricSprings(tweenTrigger, metricLeftAmount, metricRightAmount);

  const periodOptions = PERIODS.map((item) => ({ key: item, label: PERIOD_LABELS[item] }));
  const walletCardBg = palette.isDark ? '#1A1F2E' : palette.card;

  return (
    <View>
      {/* ── Card 1: gradient top + balance trend chart ── */}
      <View
        style={{
          borderRadius: HOME_RADIUS.card,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: palette.isDark ? 'rgba(255,255,255,0.10)' : '#E2E7F4',
          backgroundColor: palette.card,
          ...(!palette.isDark
            ? {
                elevation: 6,
                shadowColor: '#94A3B8',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.13,
                shadowRadius: 10,
              }
            : {}),
        }}
      >
        {/* Gradient top: account icon + name + balance */}
        <View style={{ position: 'relative' }}>
          <LinearGradient
            colors={[accountHeroDarkGradient[0], accountHeroDarkGradient[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {accountType && (
                <View
                  style={{
                    backgroundColor: palette.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.12)',
                    width: 42,
                    height: 42,
                    borderRadius: HOME_RADIUS.chip,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AppIcon
                    name={typeMeta?.icon ?? 'wallet'}
                    size={20}
                    color="rgba(255,255,255,0.90)"
                    strokeWidth={1.9}
                  />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: HOME_TEXT.metaSmall,
                      fontWeight: FONT_WEIGHT.semibold,
                      color: heroMutedText,
                      letterSpacing: 0.4,
                    }}
                  >
                    {accountName}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  {currencySymbol ? (
                    <Text
                      style={{
                        fontSize: HOME_TEXT.sectionTitle,
                        fontWeight: FONT_WEIGHT.medium,
                        color: heroMutedText,
                        marginRight: 3,
                      }}
                    >
                      {currencySymbol}
                    </Text>
                  ) : null}
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{
                      fontSize: HOME_TEXT.heroCardValue,
                      fontWeight: FONT_WEIGHT.medium,
                      color: heroText,
                    }}
                  >
                    {hideAmounts ? '••••' : balanceInt}
                  </Text>
                  {balanceDec ? (
                    <Text
                      style={{
                        fontSize: HOME_TEXT.rowLabel,
                        fontWeight: FONT_WEIGHT.medium,
                        color: heroSoftText,
                      }}
                    >
                      {balanceDec}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Tooltip — compact block, top-right of gradient. Only visible while
                dragging the chart. Smaller fonts than the name/balance so it reads
                as a transient hint, not a primary value. */}
            {activeTrendPoint && (() => {
              const v = Math.abs(activeTrendPoint.val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
              return (
                <View style={{ position: 'absolute', top: 14, right: 14, alignItems: 'flex-end' }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: HOME_TEXT.label,
                      fontWeight: FONT_WEIGHT.medium,
                      color: heroSoftText,
                      letterSpacing: 0.3,
                    }}
                  >
                    {formatDate(activeTrendPoint.date)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: HOME_TEXT.bodySmall,
                      fontWeight: FONT_WEIGHT.semibold,
                      color: heroText,
                      marginTop: 1,
                    }}
                  >
                    {currencySymbol ? `${currencySymbol} ` : ''}{v}
                  </Text>
                </View>
              );
            })()}
          </View>
        </View>

        {/* Balance trend chart embedded inside the same card.
            Caller (account/[id].tsx) is responsible for passing embedded=true
            on the TrendLineChart so it doesn't paint its own nested border. */}
        <View style={{ backgroundColor: palette.card }}>
          {trendChart}
        </View>
      </View>

      {/* ── Card 2: period chips + cashflow + ticks + income/expense ── */}
      {/* Gap matches the old layout (spacer 20px + TrendLineChart marginTop 20px ≈ 40px)
          so the visual rhythm between the hero and the period section is identical. */}
      <View
        style={{
          marginTop: 40,
          borderRadius: HOME_RADIUS.card,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: palette.isDark ? 'rgba(255,255,255,0.10)' : '#E2E7F4',
          backgroundColor: walletCardBg,
          ...(!palette.isDark
            ? {
                elevation: 6,
                shadowColor: '#94A3B8',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.13,
                shadowRadius: 10,
              }
            : {}),
        }}
      >
        <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
          {/* Period pills */}
          {period && onPeriodChange && (
            <SegmentedPillSwitch
              options={periodOptions}
              value={period}
              onChange={(key) => {
                const nextPeriod = key as HomePeriodType;
                if (nextPeriod === 'custom') { onOpenCustomRange?.(); return; }
                onPeriodChange(nextPeriod);
              }}
              backgroundColor={palette.isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F8'}
              pillColor={palette.isDark ? palette.surface : '#FFFFFF'}
              borderColor={palette.isDark ? 'transparent' : '#DFE5EF'}
              activeTextColor={palette.text}
              inactiveTextColor={palette.textMuted}
              height={32}
              radius={14}
              fontSize={10.5}
              itemMinWidth={54}
              style={{ alignSelf: 'stretch' }}
            />
          )}

          {/* Cashflow toggle + date range */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 }}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => onToggleCashflowView?.(!isCashflowView)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
            >
              <Text style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted }}>
                Cashflow
              </Text>
              <AppSwitch
                value={!!isCashflowView}
                onValueChange={(val) => onToggleCashflowView?.(val)}
                palette={palette}
                width={36}
                height={20}
                thumbSize={14}
              />
            </TouchableOpacity>
            {from && to && (
              <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, justifyContent: 'flex-end' }}>
                <Text style={{ fontSize: 10.5, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: 0.2 }}>
                  {formatDate(from)}
                </Text>
                {period !== 'today' && (
                  <Text style={{ fontSize: 10.5, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: 0.2 }}>
                    {` – ${formatDate(to)}`}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Tick chart — speedometer sweep */}
          <View style={{ flexDirection: 'row', gap: TICK_GAP, marginBottom: 6, width: TICK_CONTAINER_W }}>
            {Array.from({ length: TICK_TOTAL }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: TICK_W,
                  height: 12,
                  borderRadius: 2,
                  backgroundColor: palette.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                }}
              />
            ))}
            <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: 12, overflow: 'hidden' }, incomeTickOverlayStyle]}>
              <View style={{ flexDirection: 'row', gap: TICK_GAP, width: TICK_CONTENT_W }}>
                {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                  <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.chartIncome }} />
                ))}
              </View>
            </Animated.View>
            <Animated.View style={[{ position: 'absolute', top: 0, height: 12, overflow: 'hidden' }, expenseTickOverlayStyle]}>
              <View style={{ position: 'absolute', right: 0, flexDirection: 'row', gap: TICK_GAP, width: TICK_CONTENT_W }}>
                {Array.from({ length: TICK_TOTAL }).map((_, i) => (
                  <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.chartExpense }} />
                ))}
              </View>
            </Animated.View>
          </View>

          {/* Income / Expense values */}
          {(() => {
            const leftSplit = splitTickAmount(metricLeftAmount);
            const rightSplit = splitTickAmount(metricRightAmount);
            const leftIsZero = metricLeftAmount === 0;
            const rightIsZero = metricRightAmount === 0;
            const leftSign = metricLeftAmount < 0 ? '-' : '';
            const rightSign = metricRightAmount < 0 ? '-' : '';
            return (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 8 }}>
                <TouchableOpacity delayPressIn={0} activeOpacity={0.75} onPress={onPressMetricIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <AppIcon name="arrow-down-left" size={15} color={leftIsZero ? palette.textMuted : palette.positive} strokeWidth={2.2} />
                  <Animated.View style={leftSpringStyle}>
                    <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.semibold, color: leftIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }}>
                      {hideAmounts ? '••••' : leftIsZero ? '—' : (
                        <Text>{leftSign}{leftSplit.int}{leftSplit.dec ? <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{leftSplit.dec}</Text> : null}</Text>
                      )}
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
                <TouchableOpacity delayPressIn={0} activeOpacity={0.75} onPress={onPressMetricOut} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Animated.View style={rightSpringStyle}>
                    <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.semibold, color: rightIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }}>
                      {hideAmounts ? '••••' : rightIsZero ? '—' : (
                        <Text>{rightSign}{rightSplit.int}{rightSplit.dec ? <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{rightSplit.dec}</Text> : null}</Text>
                      )}
                    </Text>
                  </Animated.View>
                  <AppIcon name="arrow-up-right" size={15} color={rightIsZero ? palette.textMuted : palette.negative} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* Cashflow note — expands when toggle is on */}
          <Animated.View style={cashflowNoteStyle}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 8 }}>
              <AppIcon name="info" size={11} color={palette.textMuted} strokeWidth={1.8} />
              <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, letterSpacing: 0.1 }}>
                {HELP_TEXTS.cashflowNote}
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
