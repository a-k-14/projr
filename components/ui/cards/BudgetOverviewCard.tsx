/**
 * BudgetOverviewCard — hero summary card at the top of the Budgets list screen (app/budget.tsx).
 * Wraps OverviewHeroCard with budget-specific metrics: budgeted, spent, remaining, progress.
 */
import { OverviewHeroCard } from '../OverviewHeroCard';
import { formatCurrency } from '../../../lib/derived';
import type { AppThemePalette } from '../../../lib/theme';

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
  const progress = totalBudgeted > 0 ? Math.min(totalSpent / totalBudgeted, 1) : 0;
  const usageText = totalBudgeted > 0 ? `${Math.round((totalSpent / totalBudgeted) * 100)}% used` : 'Not set';
  const statusLabel = hasBudgetSet ? (isOver ? 'Over' : 'Left') : 'No budget set';
  const statusValue = hasBudgetSet ? formatCurrency(Math.abs(totalRemaining), sym) : '';

  return (
    <OverviewHeroCard
      palette={palette}
      icon="pie-chart"
      iconBg="#F0EFFA"
      iconColor="#5A56A3"
      badgeLabel={budgetStatusLabel(totalBudgeted, overBudgetCount)}
      badgeBg={totalBudgeted <= 0 ? palette.background : overBudgetCount > 0 ? palette.outBg : palette.inBg}
      badgeColor={totalBudgeted <= 0 ? palette.textSecondary : overBudgetCount > 0 ? palette.negative : palette.positive}
      metrics={[
        { key: 'budgeted', label: 'Budgeted', value: formatCurrency(totalBudgeted, sym), valueColor: palette.text },
        { key: 'spent', label: 'Spent', value: formatCurrency(totalSpent, sym), valueColor: isOver ? palette.negative : palette.text },
      ]}
      progressLabelLeft={usageText}
      progressLabelRight=""
      progressPercent={progress * 100}
      progressColor={palette.budget}
      progressTrackColor={palette.budgetSoft}
      footerLabel={statusLabel}
      footerValue={statusValue}
      footerValueColor={isOver ? palette.negative : palette.budget}
    />
  );
}

function budgetStatusLabel(totalBudgeted: number, overBudgetCount: number) {
  if (totalBudgeted <= 0) return 'Not set';
  return overBudgetCount > 0 ? 'Overspent' : 'On track';
}
