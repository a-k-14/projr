/**
 * LoanOverviewCard — hero summary card at the top of the Loans list screen (app/loans.tsx).
 * Wraps OverviewHeroCard with loan-specific metrics: lent, borrowed, net position.
 */
import { OverviewHeroCard } from '../OverviewHeroCard';
import { formatCurrency } from '../../../lib/derived';
import type { AppThemePalette } from '../../../lib/theme';

export function LoanOverviewCard({
  lent,
  borrowed,
  net,
  netPositive,
  sym,
  palette,
}: {
  lent: number;
  borrowed: number;
  net: number;
  netPositive: boolean;
  sym: string;
  palette: AppThemePalette;
}) {
  const isZero = borrowed === 0 && lent === 0;
  const footerLabel = isZero ? 'Net' : netPositive ? 'Net Lent' : 'Net Owed';

  return (
    <OverviewHeroCard
      palette={palette}
      icon="hand-coins"
      iconBg={palette.loanBg}
      iconColor={palette.loan}
      badgeLabel=""
      badgeBg={isZero ? palette.background : palette.loanSoft}
      badgeColor={isZero ? palette.textSecondary : palette.loan}
      metrics={[
        { key: 'lent', label: 'Lent', value: formatCurrency(lent, sym), valueColor: palette.text },
        { key: 'borrowed', label: 'Borrowed', value: formatCurrency(borrowed, sym), valueColor: palette.text },
      ]}
      footerLabel={footerLabel}
      footerValue={formatCurrency(Math.abs(net), sym)}
      footerValueColor={isZero ? palette.textMuted : palette.brand}
    />
  );
}
