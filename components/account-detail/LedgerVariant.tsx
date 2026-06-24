/**
 * Ledger — Account Detail design variant (Phase 2 of Design Lab).
 *
 * Editorial / minimal aesthetic inspired by Monarch Money & Copilot:
 * - Warm off-white canvas (#F7F4EE) replacing the app's normal background
 * - Deep-ink text (#0E1014)
 * - Forest green for credits (#1B6B4F), terracotta for debits (#B23A2F)
 * - Serif display (Fraunces) on the balance only — everything else in sans
 * - Hero block is bare: no card chrome, no shadow — balance + 1px ink trend
 *   line read as a single editorial composition
 * - Cashflow ticks are kept (still proportional, still animated) but quieter:
 *   thinner bars, more gap, monochrome, no glow
 * - Activity list keeps its current rendering (user can still pick emojis /
 *   icons for categories), only the section dividers go dotted
 *
 * Toggle: long-press the account name in the screen header.
 * Owned by `stores/useDesignLabStore.ts`.
 */
import { Text } from '@/components/ui/AppText';
import React, { useEffect, useMemo } from 'react';
import { Dimensions, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { formatCurrency, formatSignedCurrency } from '../../lib/derived';
import { FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { type AppThemePalette, useAppTheme } from '../../lib/theme';
import { ActivityPeriodHeader } from '../activity/ActivityPeriodHeader';
import { AppIcon } from '../ui/AppIcon';
import { AppSwitch } from '../ui/AppSwitch';
import { SegmentedPillSwitch } from '../ui/SegmentedPillSwitch';

// ── Ledger palette (literal hex per Direction A spec) ───────────────────────
export const LEDGER_PALETTE = {
  bg: '#F7F4EE',          // warm off-white canvas
  ink: '#0E1014',         // deep ink for text
  inkMuted: '#5C5852',    // muted ink (warm grey)
  inkSubtle: '#8A8580',   // subtle ink for labels
  hairline: '#E5DFD3',    // soft hairline divider on the cream bg
  credit: '#1B6B4F',      // forest green
  debit: '#B23A2F',       // terracotta
  cardBg: '#FFFFFF',      // for activity card surface contrast against cream
  cardEdge: '#EAE4D6',    // card border on cream
};

// Quieter, thinner ticks than Pulse — still 60-ish bars but with more breathing
// room so the band reads as a single editorial mark, not a meter.
const LEDGER_TICK_H = 14;
const LEDGER_TICK_W = 1.5;
const LEDGER_TICK_GAP = 6;
const LEDGER_TICK_CONTAINER_W = Math.max(80, Dimensions.get('window').width - 2 * SCREEN_GUTTER);
const LEDGER_TICK_TOTAL = Math.floor((LEDGER_TICK_CONTAINER_W + LEDGER_TICK_GAP) / (LEDGER_TICK_W + LEDGER_TICK_GAP));
const LEDGER_TICK_CONTENT_W = LEDGER_TICK_TOTAL * (LEDGER_TICK_W + LEDGER_TICK_GAP) - LEDGER_TICK_GAP;
const LEDGER_TICK_REMAINDER = LEDGER_TICK_CONTAINER_W - LEDGER_TICK_CONTENT_W;

/** Custom hook stub — returns undefined display font families to fall back to system font. */
export function useLedgerFonts() {
  return {
    fontsLoaded: true,
    displayFamily: undefined,
    displayFamilyHeavy: undefined,
  };
}

export function useLedgerPalette() {
  const { palette } = useAppTheme();
  return useMemo(() => ({
    bg: palette.background,
    ink: palette.text,
    inkMuted: palette.textSecondary,
    inkSubtle: palette.textMuted,
    hairline: palette.divider,
    credit: '#1B6B4F',
    debit: '#B23A2F',
    cardBg: palette.card,
    cardEdge: palette.borderSoft,
  }), [palette]);
}

interface LedgerHeroProps {
  accountTypeLabel: string;
  isNegative: boolean;
  hideAmounts: boolean;
  currencySymbol: string;
  balanceInt: string;
  balanceDec: string;
  activePoint: any;
  activePointDateFormatted: string;
  activePointValFormatted: string;
  /** Chart node pre-built by the parent with Ledger-tuned styling
   *  (hideAreaFill, lineStrokeWidth=1, ink stroke color). */
  middleContent: React.ReactNode;
}

/**
 * Hero — balance + trend line as a single editorial composition. No card,
 * no border, no shadow — sits directly on the cream canvas.
 */
export function LedgerAccountHero({
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
}: LedgerHeroProps) {
  const LEDGER_PALETTE = useLedgerPalette();
  const { displayFamily, displayFamilyHeavy } = useLedgerFonts();
  const balanceClean = currencySymbol && balanceInt.startsWith(currencySymbol)
    ? balanceInt.slice(currencySymbol.length)
    : balanceInt;

  return (
    <View style={{ paddingTop: 22, paddingBottom: 8 }}>
      {/* Type label — small caps, letter-spaced */}
      <Text style={{
        fontSize: 10,
        fontWeight: FONT_WEIGHT.heavy,
        color: LEDGER_PALETTE.inkSubtle,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        marginBottom: 14,
      }}>
        {accountTypeLabel}
      </Text>

      {/* Balance — serif display. The amount IS the hero. */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        {isNegative && !hideAmounts && (
          <Text style={{
            fontSize: 24,
            fontFamily: displayFamily,
            color: LEDGER_PALETTE.ink,
            marginRight: 2,
          }}>−</Text>
        )}
        {currencySymbol && !hideAmounts && (
          <Text style={{
            fontSize: 16,
            fontFamily: displayFamily,
            color: LEDGER_PALETTE.inkMuted,
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
            fontFamily: displayFamily,
            fontWeight: FONT_WEIGHT.medium,
            color: LEDGER_PALETTE.ink,
            letterSpacing: -0.6,
            // Tabular-nums via fontVariant doesn't work with custom font on
            // Android — Fraunces handles digits proportionally; we accept a
            // tiny jiggle for the editorial look.
            lineHeight: 34,
          }}>
          {balanceClean}
        </Text>
        {balanceDec && (
          <Text style={{
            fontSize: 15,
            fontFamily: displayFamily,
            color: LEDGER_PALETTE.inkMuted,
            lineHeight: 19,
          }}>
            {balanceDec}
          </Text>
        )}
      </View>

      {/* Chart — 1px ink line, no fill. Provided by parent. */}
      <View style={{ marginTop: 12, marginHorizontal: -SCREEN_GUTTER + 4 }}>
        {middleContent}
      </View>

      {/* Active point readout / "Today" anchor — sits below the chart in a
          single airy row instead of a floating tooltip. */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{
          fontSize: 11,
          color: LEDGER_PALETTE.inkSubtle,
          fontWeight: FONT_WEIGHT.semibold,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}>
          {activePoint ? activePointDateFormatted : '\u00A0'}
        </Text>
        <Text style={{
          fontSize: 12,
          color: LEDGER_PALETTE.ink,
          fontWeight: FONT_WEIGHT.semibold,
          letterSpacing: 0.4,
        }}>
          {activePoint ? activePointValFormatted : 'TODAY'}
        </Text>
      </View>

      {/* Dotted hairline before the cashflow block */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <View key={i} style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: LEDGER_PALETTE.hairline }} />
        ))}
      </View>
    </View>
  );
}

interface LedgerCashflowProps {
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
  detailInflowColor: string;
  detailOutflowColor: string;
  animatedIncomeFraction: SharedValue<number>;
  tickActivityProgress: SharedValue<number>;
  openPeriodActivity: (kind: 'in' | 'out') => void;
}

/**
 * Cashflow card — Ledger variant. Income / Expense as serif numerals on the
 * cream canvas, with a quieter version of the speedometer ticks beneath. No
 * card chrome — just a dotted divider above and below to anchor it.
 */
export function LedgerCashflowCard({
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
  detailInflowColor: _detailInflowColor,
  detailOutflowColor: _detailOutflowColor,
  animatedIncomeFraction,
  tickActivityProgress,
  openPeriodActivity,
}: LedgerCashflowProps) {
  const LEDGER_PALETTE = useLedgerPalette();
  const { displayFamily } = useLedgerFonts();
  // Ledger uses its own forest-green / terracotta — overrides the global brand
  // colors so the editorial palette stays consistent.
  const ledgerInflow = LEDGER_PALETTE.credit;
  const ledgerOutflow = LEDGER_PALETTE.debit;

  // Cascade fill — same trick as Pulse, but slower and softer for editorial
  // pacing (700ms vs 480ms).
  const cascadeProgress = useSharedValue(0);
  const prevKeyRef = React.useRef('');
  const dataKey = `${metricLeftAmount}|${metricRightAmount}`;
  useEffect(() => {
    if (prevKeyRef.current === dataKey) return;
    prevKeyRef.current = dataKey;
    cascadeProgress.value = 0;
    cascadeProgress.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [dataKey, cascadeProgress]);
  const cascadeClipStyle = useAnimatedStyle(() => ({
    width: LEDGER_TICK_CONTENT_W * cascadeProgress.value,
  }));

  const incomeOverlayStyle = useAnimatedStyle(() => {
    const fraction = animatedIncomeFraction.value;
    const progress = tickActivityProgress.value;
    const greenCount = Math.round(fraction * LEDGER_TICK_TOTAL) * progress;
    const width = greenCount > 0 ? greenCount * LEDGER_TICK_W + (greenCount - 1) * LEDGER_TICK_GAP : 0;
    return { width: Math.max(0, width) };
  });
  const expenseOverlayStyle = useAnimatedStyle(() => {
    const fraction = animatedIncomeFraction.value;
    const progress = tickActivityProgress.value;
    const greenCount = Math.round(fraction * LEDGER_TICK_TOTAL);
    const redCount = (LEDGER_TICK_TOTAL - greenCount) * progress;
    const width = redCount > 0 ? redCount * LEDGER_TICK_W + (redCount - 1) * LEDGER_TICK_GAP : 0;
    return { width: Math.max(0, width), right: LEDGER_TICK_REMAINDER };
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
      {/* Top row: small period header strip — sits above the values */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
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
            // Forge a palette stub so the period header reads ink on cream
            palette={{
              ..._palette,
              text: LEDGER_PALETTE.ink,
              textMuted: LEDGER_PALETTE.inkSubtle,
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
          backgroundColor={LEDGER_PALETTE.hairline}
          pillColor="#FFFFFF"
          borderColor={LEDGER_PALETTE.cardEdge}
          activeTextColor={LEDGER_PALETTE.ink}
          inactiveTextColor={LEDGER_PALETTE.inkSubtle}
          height={28}
          radius={14}
          fontSize={10.5}
          itemMinWidth={48}
          style={{ width: 102, marginLeft: 8 }}
        />
      </View>

      {/* Values — large, serif. Headline of the section. */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <TouchableOpacity
          delayPressIn={0}
          activeOpacity={0.7}
          onPress={() => openPeriodActivity('in')}
          style={{ flex: 1, paddingRight: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <AppIcon name="arrow-down-left" size={12} color={leftZero ? LEDGER_PALETTE.inkSubtle : ledgerInflow} strokeWidth={2.4} />
            <Text style={{
              fontSize: 10,
              color: LEDGER_PALETTE.inkSubtle,
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
              fontSize: 22,
              fontFamily: displayFamily,
              color: leftZero ? LEDGER_PALETTE.inkSubtle : LEDGER_PALETTE.ink,
              letterSpacing: -0.5,
              lineHeight: 26,
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Text style={{
              fontSize: 10,
              color: LEDGER_PALETTE.inkSubtle,
              fontWeight: FONT_WEIGHT.heavy,
              letterSpacing: 1.0,
              textTransform: 'uppercase',
            }}>
              {cashflowIsCashflow ? 'Outflow' : 'Expense'}
            </Text>
            <AppIcon name="arrow-up-right" size={12} color={rightZero ? LEDGER_PALETTE.inkSubtle : ledgerOutflow} strokeWidth={2.4} />
          </View>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              fontSize: 22,
              fontFamily: displayFamily,
              color: rightZero ? LEDGER_PALETTE.inkSubtle : LEDGER_PALETTE.ink,
              letterSpacing: -0.5,
              lineHeight: 26,
            }}>
            {rightSign}{formatAmount(metricRightAmount)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quieter ticks — thinner, more gap, monochrome (no glow handoff) */}
      <View style={{ marginTop: 22, alignItems: 'center' }}>
        <View style={{ width: LEDGER_TICK_CONTENT_W, height: LEDGER_TICK_H, position: 'relative' }}>
          {/* base */}
          <View style={{ flexDirection: 'row', gap: LEDGER_TICK_GAP, position: 'absolute', left: 0, top: 0 }}>
            {Array.from({ length: LEDGER_TICK_TOTAL }).map((_, i) => (
              <View key={i} style={{ width: LEDGER_TICK_W, height: LEDGER_TICK_H, backgroundColor: LEDGER_PALETTE.hairline }} />
            ))}
          </View>

          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: LEDGER_TICK_H, overflow: 'hidden' }, cascadeClipStyle]}>
            <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: LEDGER_TICK_H, overflow: 'hidden' }, incomeOverlayStyle]}>
              <View style={{ flexDirection: 'row', gap: LEDGER_TICK_GAP, width: LEDGER_TICK_CONTENT_W }}>
                {Array.from({ length: LEDGER_TICK_TOTAL }).map((_, i) => (
                  <View key={i} style={{ width: LEDGER_TICK_W, height: LEDGER_TICK_H, backgroundColor: ledgerInflow }} />
                ))}
              </View>
            </Animated.View>
            <Animated.View style={[{ position: 'absolute', top: 0, height: LEDGER_TICK_H, overflow: 'hidden' }, expenseOverlayStyle]}>
              <View style={{ position: 'absolute', right: 0, flexDirection: 'row', gap: LEDGER_TICK_GAP, width: LEDGER_TICK_CONTENT_W }}>
                {Array.from({ length: LEDGER_TICK_TOTAL }).map((_, i) => (
                  <View key={i} style={{ width: LEDGER_TICK_W, height: LEDGER_TICK_H, backgroundColor: ledgerOutflow }} />
                ))}
              </View>
            </Animated.View>
          </Animated.View>
        </View>

        {/* Net anchor — serif numeral */}
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{
            fontSize: 9.5,
            color: LEDGER_PALETTE.inkSubtle,
            fontWeight: FONT_WEIGHT.heavy,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}>
            Net
          </Text>
          <Text style={{
            fontSize: 15,
            fontFamily: displayFamily,
            color: net > 0 ? ledgerInflow : net < 0 ? ledgerOutflow : LEDGER_PALETTE.inkSubtle,
            letterSpacing: -0.3,
            lineHeight: 18,
          }}>
            {netFormatted}
          </Text>
        </View>
      </View>

      {/* Cashflow toggle — subtle, right-aligned */}
      <View style={{ marginTop: 18, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <Text style={{
          fontSize: 10,
          color: LEDGER_PALETTE.inkSubtle,
          fontWeight: FONT_WEIGHT.heavy,
          letterSpacing: 1.0,
          textTransform: 'uppercase',
        }}>
          Cashflow
        </Text>
        <TouchableOpacity onPress={() => setCashflowIsCashflow(!cashflowIsCashflow)} delayPressIn={0} activeOpacity={0.7}>
          <AppSwitch
            value={cashflowIsCashflow}
            onValueChange={(val) => setCashflowIsCashflow(val)}
            palette={{
              ..._palette,
              brand: LEDGER_PALETTE.ink,
              borderSoft: LEDGER_PALETTE.hairline,
            } as any}
            width={32}
            height={18}
            thumbSize={12}
          />
        </TouchableOpacity>
      </View>

      {/* Closing dotted hairline */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <View key={i} style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: LEDGER_PALETTE.hairline }} />
        ))}
      </View>
    </View>
  );
}
