/**
 * BudgetOverviewCard — hero summary card at the top of the Budgets list screen.
 *
 * Direction A redesign: gradient slate surface, animated circular progress ring,
 * stacked text block with primary "Remaining" value + secondary spent/budgeted line
 * + status pill. Ring fills via reanimated.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../AppText';
import { RingProgress } from '../RingProgress';
import { formatCurrency } from '../../../lib/derived';
import { FONT_WEIGHT } from '../../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../../lib/theme';

// Slate gradient pair derived from the existing palette.budget tones — keeps the
// hero on-palette while gaining a "carved" depth. Light mode uses the deeper slate
// pair (white text reads well); dark mode uses a softer pair that doesn't fight
// the pure-black background.
const GRADIENT_LIGHT = ['#1F2A3C', '#0F172A'] as const;
const GRADIENT_DARK = ['#1A2438', '#0B1220'] as const;

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
  const { mode } = useAppTheme();
  const hasBudgetSet = totalBudgeted > 0;
  const isOver = hasBudgetSet && totalRemaining < 0;
  const rawPercent = hasBudgetSet ? (totalSpent / totalBudgeted) * 100 : 0;
  const clampedPercent = Math.min(Math.max(rawPercent, 0), 100);



  const gradient = mode === 'dark' ? GRADIENT_DARK : GRADIENT_LIGHT;
  // Status colors — keep on-gradient (white-ish) so the hero reads as one surface.
  const onHero = '#FFFFFF';
  const onHeroSoft = 'rgba(255,255,255,0.85)';
  const onHeroFaint = 'rgba(255,255,255,0.48)';
  const ringTrack = 'rgba(255,255,255,0.14)';
  const ringColor = !hasBudgetSet
    ? 'rgba(255,255,255,0.35)'
    : isOver
      ? '#FB7185' // soft rose for over-budget
      : clampedPercent > 85
        ? '#FBBF24' // amber when nearing cap
        : '#34D399'; // emerald — healthy

  const pill = pillState(hasBudgetSet, isOver, overBudgetCount);

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, !palette.isDark && palette.states.cardSoftShadow]}
    >


      <View style={styles.row}>
        {/* Left text block */}
        <View style={{ flex: 1, marginRight: 24, justifyContent: 'space-between', alignSelf: 'stretch' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: HOME_TEXT.metaSmall, fontWeight: FONT_WEIGHT.semibold, color: onHeroFaint, letterSpacing: 0.3 }}>
                {hasBudgetSet ? (isOver ? 'Over budget' : 'Remaining') : 'Monthly budget'}
              </Text>
              {pill ? (
                <View style={[styles.pillInline, { backgroundColor: pill.bg }]}>
                  <View style={[styles.pillDot, { backgroundColor: pill.dot }]} />
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: pill.text }}>
                    {pill.label}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ fontSize: 28, fontWeight: FONT_WEIGHT.medium, color: onHero, letterSpacing: -0.5, marginTop: 4 }}
            >
              {hasBudgetSet ? formatCurrency(Math.abs(totalRemaining), sym) : 'Not set'}
            </Text>
          </View>

          <View style={styles.secondaryRow}>
            <SecondaryStat label="Budgeted" value={hasBudgetSet ? formatCurrency(totalBudgeted, sym) : 'Not set'} labelColor={onHeroFaint} valueColor={onHeroSoft} />
            <View style={styles.secondaryDivider} />
            <SecondaryStat label="Spent" value={formatCurrency(totalSpent, sym)} labelColor={onHeroFaint} valueColor={onHeroSoft} />
          </View>
        </View>

        {/* Ring */}
        <RingProgress
          size={96}
          strokeWidth={8}
          percent={hasBudgetSet ? clampedPercent : 0}
          color={ringColor}
          trackColor={ringTrack}
        >
          <Text style={{ fontSize: 24, fontWeight: FONT_WEIGHT.medium, color: onHero, letterSpacing: -0.5 }}>
            {hasBudgetSet ? `${Math.round(clampedPercent)}%` : '—'}
          </Text>
          <Text style={{ fontSize: HOME_TEXT.metaSmall, fontWeight: FONT_WEIGHT.medium, color: onHeroFaint, marginTop: 1 }}>
            Used
          </Text>
        </RingProgress>
      </View>
    </LinearGradient>
  );
}

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
      <Text style={{ fontSize: HOME_TEXT.metaSmall, fontWeight: FONT_WEIGHT.semibold, color: labelColor }}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: valueColor, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function pillState(hasBudgetSet: boolean, isOver: boolean, overBudgetCount: number) {
  if (!hasBudgetSet) return null;
  if (isOver) {
    return {
      label: overBudgetCount > 1 ? `${overBudgetCount} Overspent` : 'Overspent',
      bg: 'rgba(251,113,133,0.18)',
      text: '#FCA5A5',
      dot: '#FB7185',
    };
  }
  return {
    label: 'On Track',
    bg: 'rgba(52,211,153,0.16)',
    text: '#86EFAC',
    dot: '#34D399',
  };
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: HOME_RADIUS.card,
    paddingHorizontal: HOME_SPACE.lg,
    paddingTop: HOME_SPACE.xl,
    paddingBottom: HOME_SPACE.xl + 2,
    minHeight: 164,
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
    height: 28,
    marginHorizontal: HOME_SPACE.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pillInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: HOME_RADIUS.full,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
