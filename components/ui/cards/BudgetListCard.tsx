/**
 * BudgetListCard — row card used in the Budgets list screen (app/budget.tsx).
 * Shows category, budgeted amount, spent amount, progress bar, and remaining/over amount.
 */
import { Text } from '@/components/ui/AppText';
import { AppIcon } from '../AppIcon';
import { View } from 'react-native';
import { AppCard, CardTitleRow, CardSubtitleRow } from '../AppCard';
import { formatCurrency } from '../../../lib/derived';
import { CARD_TEXT, HOME_RADIUS, HOME_SPACE, PROGRESS } from '../../../lib/layoutTokens';
import { isEmojiIcon } from '../../../lib/ui-format';
import { HOME_TEXT } from '../../../lib/layoutTokens';
import type { AppThemePalette } from '../../../lib/theme';
import type { BudgetWithSpent } from '../../../types';
import { formatBudgetMonthLabel } from '../../budget-ui';

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

  return (
    <AppCard
      palette={palette}
      onPress={onPress}
      style={{
        marginBottom: HOME_SPACE.md,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: HOME_RADIUS.card,
      }}
      icon={isEmojiIcon(categoryIcon) ? (
        <Text style={{ fontSize: HOME_TEXT.rowLabel }}>{categoryIcon}</Text>
      ) : (
        <AppIcon name={categoryIcon as any} size={17} color={palette.budget} />
      )}
      topRow={
        <CardTitleRow
          title={categoryLabel}
          amount={formatCurrency(budget.amount, sym)}
          palette={palette}
        />
      }
      bottomRow={
        <CardSubtitleRow
          text={budget.repeat ? 'Repeats monthly' : `One-time • ${formatBudgetMonthLabel(budget.startDate)}`}
          rightText={`Spent ${formatCurrency(budget.spent, sym)}`}
          palette={palette}
        />
      }
      footer={
        <>
          <View style={{ height: PROGRESS.cardHeight, backgroundColor: palette.divider, borderRadius: PROGRESS.radius, overflow: 'hidden' }}>
            <View
              style={{
                height: PROGRESS.cardHeight,
                width: `${Math.min(Math.max(budget.percent, 0), 100)}%`,
                backgroundColor: palette.budget,
                borderRadius: PROGRESS.radius,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: HOME_SPACE.sm }}>
            <Text style={{ fontSize: CARD_TEXT.tertiary, color: isOver ? palette.negative : palette.textMuted }}>
              {Math.round(budget.percent)}%
            </Text>
            <Text style={{ fontSize: CARD_TEXT.tertiary, color: isOver ? palette.negative : palette.textMuted }}>
              {isOver ? `Over ${formatCurrency(Math.abs(budget.remaining), sym)}` : `Left ${formatCurrency(budget.remaining, sym)}`}
            </Text>
          </View>
        </>
      }
    />
  );
}
