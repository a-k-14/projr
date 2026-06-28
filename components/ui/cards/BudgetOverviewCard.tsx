/**
 * BudgetOverviewCard — hero summary card at the top of the Budgets list screen.
 *
 * Redesigned using /frontend-design for a calm, premium visual aesthetic:
 * - Clean, spacious layout with a thin card structure.
 * - Ultra-thin (3px) semi-circle dome progress gauge that feels light and elegant.
 * - Refined display typography using light/medium weights.
 * - Elegant status indicator dot and curated calm colors.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, InteractionManager } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../AppText';
import { formatCurrency } from '../../../lib/derived';
import { FONT_WEIGHT } from '../../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../../lib/layoutTokens';
import { type AppThemePalette } from '../../../lib/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ── Semi-circle helpers ───────────────────────────────────────────────────────

function semiArcLength(r: number) {
  return Math.PI * r;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SemiGaugeProps {
  size: number;
  strokeWidth: number;
  percent: number; // 0–100
  color: string;
  trackColor: string;
}

function SemiGauge({ size, strokeWidth, percent, color, trackColor }: SemiGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const arcLen = semiArcLength(r);

  // Perfect top-half semi-circle dome path
  const pathD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const progress = useSharedValue(0);
  const clamped = Math.min(Math.max(percent, 0), 100);

  useEffect(() => {
    let timer: any;
    const task = InteractionManager.runAfterInteractions(() => {
      // Small timeout to ensure visual smoothness after the transition/render settles
      timer = setTimeout(() => {
        progress.value = withTiming(clamped / 100, {
          duration: 900,
          easing: Easing.out(Easing.cubic),
        });
      }, 120);
    });
    return () => {
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [clamped, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLen * (1 - progress.value),
  }));

  const viewH = size / 2 + strokeWidth / 2 + 2;

  return (
    <View style={{ width: size, height: viewH, overflow: 'hidden' }}>
      <Svg width={size} height={size}>
        <Path
          d={pathD}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedPath
          d={pathD}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={arcLen}
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function BudgetOverviewCard({
  palette,
  totalBudgeted,
  totalSpent,
  totalRemaining,
  overBudgetCount,
  sym,
}: {
  palette: AppThemePalette;
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  overBudgetCount: number;
  sym: string;
}) {
  const hasBudgetSet = totalBudgeted > 0;
  const isOver = hasBudgetSet && totalRemaining < 0;
  const rawPercent = hasBudgetSet ? (totalSpent / totalBudgeted) * 100 : 0;
  const clampedPercent = Math.min(Math.max(rawPercent, 0), 100);

  // Calm, premium progress colors (softer, refined tones)
  const ringColor = !hasBudgetSet
    ? palette.textMuted
    : isOver
      ? palette.negative // theme crimson
      : clampedPercent > 85
        ? palette.warning // theme amber
        : palette.positive; // theme emerald

  const trackColor = palette.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const pill = pillState(palette, hasBudgetSet, isOver, overBudgetCount);

  const GAUGE_SIZE = 130;
  const STROKE = 4; // Refined progress line stroke

  return (
    <View style={[styles.card, {
      backgroundColor: palette.card,
      borderColor: palette.borderSoft,
    }]}>

      {/* Main row: text block + gauge */}
      <View style={styles.row}>
        {/* Left: display label, value + secondary metrics */}
        <View style={{ flex: 1, marginRight: 16, justifyContent: 'space-between', alignSelf: 'stretch' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                {hasBudgetSet ? (isOver ? 'Over budget' : 'Remaining') : 'Monthly budget'}
              </Text>
            </View>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ fontSize: 32, fontWeight: FONT_WEIGHT.regular, color: palette.text, letterSpacing: -0.8, marginTop: 1 }}
            >
              {hasBudgetSet ? formatCurrency(Math.abs(totalRemaining), sym) : 'Not Set'}
            </Text>
          </View>

          <View style={styles.secondaryRow}>
            <SecondaryStat
              label="Budgeted"
              value={hasBudgetSet ? formatCurrency(totalBudgeted, sym) : '—'}
              labelColor={palette.textMuted}
              valueColor={palette.textSecondary}
            />
            <View style={[styles.secondaryDivider, { backgroundColor: palette.borderSoft }]} />
            <SecondaryStat
              label="Spent"
              value={hasBudgetSet ? formatCurrency(totalSpent, sym) : '—'}
              labelColor={palette.textMuted}
              valueColor={palette.textSecondary}
            />
          </View>
        </View>

        {/* Right: semi-circle gauge with badge above */}
        <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' }}>
          {pill ? (
            <View style={[styles.pillInline, { backgroundColor: pill.bg, borderColor: pill.border, borderWidth: 1, paddingVertical: 1.5, paddingHorizontal: 7 }]}>
              <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.medium, color: pill.text, letterSpacing: 0.1 }}>
                {pill.label}
              </Text>
            </View>
          ) : <View />}
          <View style={{ position: 'relative', width: GAUGE_SIZE, alignItems: 'center' }}>
            <SemiGauge
              size={GAUGE_SIZE}
              strokeWidth={STROKE}
              percent={hasBudgetSet ? clampedPercent : 0}
              color={ringColor}
              trackColor={trackColor}
            />
            {/* Centred label overlaid on the flat edge of the semi-circle */}
            <View style={{
              position: 'absolute',
              bottom: 4,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 22, fontWeight: FONT_WEIGHT.regular, color: palette.text, letterSpacing: -0.6 }}>
                {hasBudgetSet ? `${Math.round(rawPercent)}%` : '—'}
              </Text>
              <Text style={{ fontSize: 9.5, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 1 }}>
                used
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SecondaryStat({
  label,
  value,
  labelColor,
  valueColor,
}: {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 9.5, fontWeight: FONT_WEIGHT.semibold, color: labelColor, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: valueColor, marginTop: 3 }}>
        {value}
      </Text>
    </View>
  );
}

function getRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pillState(palette: AppThemePalette, hasBudgetSet: boolean, isOver: boolean, overBudgetCount: number) {
  if (!hasBudgetSet) return null;
  const opacityBg = palette.isDark ? 0.15 : 0.08;
  const opacityBorder = palette.isDark ? 0.4 : 0.3;

  if (isOver) {
    const color = palette.negative;
    return {
      label: overBudgetCount > 1 ? `${overBudgetCount} Overspent` : 'Overspent',
      bg: getRgba(color, opacityBg),
      text: color,
      border: getRgba(color, opacityBorder),
    };
  }

  if (overBudgetCount > 0) {
    const color = palette.warning;
    return {
      label: overBudgetCount > 1 ? `${overBudgetCount} Overspent` : '1 Overspent',
      bg: getRgba(color, opacityBg),
      text: color,
      border: getRgba(color, opacityBorder),
    };
  }

  const color = palette.positive;
  return {
    label: 'On Track',
    bg: getRgba(color, opacityBg),
    text: color,
    border: getRgba(color, opacityBorder),
  };
}

const styles = StyleSheet.create({
  card: {
    borderRadius: HOME_RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: HOME_SPACE.lg,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 132,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: HOME_SPACE.md,
  },
  secondaryDivider: {
    width: 1,
    height: 24,
    marginHorizontal: HOME_SPACE.md,
  },
  pillInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: HOME_RADIUS.small,
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
