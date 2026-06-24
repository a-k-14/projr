/**
 * BudgetListCard — row card used in the Budgets list screen.
 *
 * The progress bar is static (the hero ring carries the motion; animating every
 * row's bar at once was too busy). Tap feedback comes from the shared PressableScale.
 */
import { View, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { PressableScale } from '../PressableScale';
import { formatCurrency } from '../../../lib/derived';
import { isEmojiIcon } from '../../../lib/ui-format';
import { FONT_WEIGHT } from '../../../lib/design';
import { CARD_TEXT, HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT, PROGRESS } from '../../../lib/layoutTokens';
import type { AppThemePalette } from '../../../lib/theme';
import type { BudgetWithSpent } from '../../../types';

export function BudgetListCard({
  budget,
  sym,
  palette,
  categoryLabel,
  categoryIcon,
  onPress,
}: {
  budget: BudgetWithSpent;
  sym: string;
  palette: AppThemePalette;
  categoryLabel: string;
  categoryIcon: string;
  onPress: () => void;
}) {
  const isOver = budget.amount > 0 && budget.remaining < 0;
  const hasBudgetSet = budget.amount > 0;
  const clampedPercent = Math.min(Math.max(budget.percent, 0), 100);

  // Unified progress color: palette.budget when healthy, negative when overspent.
  const accent = isOver ? palette.negative : palette.budget;
  const accentSoft = isOver ? palette.outBg : palette.divider;

  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.card,
        {
          marginBottom: HOME_SPACE.md,
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.body}>
          {/* Column 1: Icon */}
          <View style={styles.iconContainer}>
            {isEmojiIcon(categoryIcon) ? (
              <Text style={{ fontSize: HOME_LAYOUT.listIconInnerSize }}>{categoryIcon}</Text>
            ) : (
              <AppIcon name={categoryIcon as any} size={HOME_LAYOUT.listIconInnerSize} color={palette.brand} strokeWidth={HOME_LAYOUT.listIconStrokeWidth} />
            )}
          </View>

          {/* Column 2: Labels, progress, stats */}
          <View style={styles.contentColumn}>
            {/* Top row: label + amount */}
            <View style={styles.topRow}>
              <View style={{ flex: 1, marginRight: HOME_SPACE.sm }}>
                <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  {categoryLabel}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.metaSmall, color: palette.textMuted, marginTop: 1 }}>
                  {budget.repeat ? 'Monthly' : 'One-time'}
                </Text>
              </View>
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                {formatCurrency(budget.amount, sym)}
              </Text>
            </View>

            {/* Progress bar (static) */}
            <View style={[styles.track, { backgroundColor: accentSoft }]}>
              <View style={[styles.fill, { backgroundColor: accent, width: `${clampedPercent}%` }]} />
            </View>

            {/* Bottom row: spent • % on left, remaining/over on right */}
            <View style={styles.bottomRow}>
              <Text style={{ fontSize: CARD_TEXT.tertiary, fontWeight: FONT_WEIGHT.medium, color: isOver ? palette.negative : palette.textMuted }}>
                {hasBudgetSet
                  ? `Spent ${formatCurrency(budget.spent, sym)} • ${Math.round(clampedPercent)}%`
                  : `Spent ${formatCurrency(budget.spent, sym)}`}
              </Text>
              <Text appWeight="medium" style={{ fontSize: CARD_TEXT.tertiary, fontWeight: FONT_WEIGHT.semibold, color: isOver ? palette.negative : palette.textSecondary }}>
                {hasBudgetSet
                  ? isOver
                    ? `Over ${formatCurrency(Math.abs(budget.remaining), sym)}`
                    : `Left ${formatCurrency(budget.remaining, sym)}`
                  : 'No limit'}
              </Text>
            </View>
          </View>
        </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: HOME_RADIUS.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: HOME_SPACE.md + 2,
  },
  contentColumn: {
    flex: 1,
    marginLeft: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: HOME_SPACE.sm + 2,
  },
  iconContainer: {
    width: HOME_LAYOUT.listIconSize - 4,
    height: HOME_LAYOUT.listIconSize - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: PROGRESS.cardHeight,
    borderRadius: PROGRESS.radius,
    overflow: 'hidden',
  },
  fill: {
    height: PROGRESS.cardHeight,
    borderRadius: PROGRESS.radius,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: HOME_SPACE.sm,
  },
});
