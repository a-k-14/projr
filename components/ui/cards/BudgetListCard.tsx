/**
 * BudgetListCard — row card used in the Budgets list screen.
 *
 * Redesigned using /frontend-design for a calm, premium visual aesthetic:
 * - Flat layout with generous spacing.
 * - Small, delicate static semi-circle gauge on the right (2px stroke).
 * - Muted category metadata labels.
 * - Circular category icon badge with a very soft tint container.
 */
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../AppText';
import { PressableScale } from '../PressableScale';
import { formatCurrency } from '../../../lib/derived';
import { FONT_WEIGHT } from '../../../lib/design';
import { CARD_TEXT, HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../../lib/layoutTokens';
import type { AppThemePalette } from '../../../lib/theme';
import type { BudgetWithSpent } from '../../../types';
import { CategoryIconBadge } from '../../activity/ActivityUI';

function StaticSemiGauge({
  size,
  strokeWidth,
  percent,
  color,
  trackColor,
}: {
  size: number;
  strokeWidth: number;
  percent: number;
  color: string;
  trackColor: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const arcLen = Math.PI * r;
  const clamped = Math.min(Math.max(percent, 0), 100);
  const strokeDashoffset = arcLen * (1 - clamped / 100);

  // SVG path for perfect top-half semi-circle dome (starts on left-bottom, sweeps over top)
  const pathD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <View style={{ width: size, height: size / 2 + strokeWidth / 2 + 1, overflow: 'hidden' }}>
      <Svg width={size} height={size}>
        <Path
          d={pathD}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={pathD}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={arcLen}
          strokeDashoffset={strokeDashoffset}
        />
      </Svg>
    </View>
  );
}

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

  // Calm, premium progress colors (matching overview card)
  const accent = !hasBudgetSet
    ? palette.textMuted
    : isOver
      ? palette.negative // theme crimson
      : clampedPercent > 85
        ? palette.warning // theme amber
        : palette.positive; // theme emerald
  const accentSoft = palette.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  const remainingText = hasBudgetSet
    ? isOver
      ? `${formatCurrency(Math.abs(budget.remaining), sym)} over of ${formatCurrency(budget.amount, sym)}`
      : `${formatCurrency(budget.remaining, sym)} left of ${formatCurrency(budget.amount, sym)}`
    : `${formatCurrency(budget.spent, sym)} spent`;

  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.card,
        {
          marginBottom: HOME_SPACE.md,
          backgroundColor: palette.card,
          borderColor: palette.borderSoft,
        },
      ]}
    >
      <View style={styles.body}>
        {/* Left Col: Category Icon + Labels + spent details */}
        <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
          <CategoryIconBadge
            icon={categoryIcon}
            palette={palette}
            iconColor={palette.brand}
            size={HOME_LAYOUT.listIconSize}
            iconSize={HOME_LAYOUT.listIconInnerSize}
            strokeWidth={HOME_LAYOUT.listIconStrokeWidth}
            noBackground
          />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.text }}>
              {categoryLabel}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.metaSmall, color: palette.textMuted, marginTop: 2 }}>
              {remainingText}
            </Text>
          </View>
        </View>

        {/* Right Col: Semi-circle progress gauge and remaining text */}
        <View style={{ alignItems: 'flex-end', marginLeft: 12, justifyContent: 'center' }}>
          {hasBudgetSet ? (
            <View style={{ alignItems: 'center', position: 'relative', width: 50, marginBottom: 2 }}>
              <StaticSemiGauge
                size={50}
                strokeWidth={2.5} // Balanced 2.5px line
                percent={clampedPercent}
                color={accent}
                trackColor={accentSoft}
              />
               <View style={{ position: 'absolute', bottom: -1, alignItems: 'center' }}>
                <Text style={{ fontSize: 8.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  {Math.round(budget.percent)}%
                </Text>
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: CARD_TEXT.tertiary, color: palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>
              No limit
            </Text>
          )}
          {hasBudgetSet && (
            <Text style={{ fontSize: 9.5, fontWeight: FONT_WEIGHT.semibold, color: palette.textSecondary, marginTop: 4 }}>
              {formatCurrency(budget.spent, sym)} spent
            </Text>
          )}
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
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: HOME_SPACE.md + 2,
  },
  iconContainer: {
    width: HOME_LAYOUT.listIconSize,
    height: HOME_LAYOUT.listIconSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
