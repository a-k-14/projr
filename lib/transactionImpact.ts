type LoanDirection = 'lent' | 'borrowed';
type LoanRole = 'origin' | 'settlement';

function getLoanOriginImpact(direction: LoanDirection): 'in' | 'out' {
  return direction === 'lent' ? 'out' : 'in';
}

function getLoanSettlementImpact(direction: LoanDirection): 'in' | 'out' {
  return direction === 'lent' ? 'in' : 'out';
}

export function getStructuredLoanCashflowImpact(
  tx: {
    type: string;
    note?: string | null;
    loanTransactionType?: string | null;
  },
  direction: LoanDirection,
  role?: LoanRole,
): 'in' | 'out' | 'neutral' {
  if (tx.type !== 'loan') return 'neutral';
  if (role === 'origin') return getLoanOriginImpact(direction);
  if (role === 'settlement') return getLoanSettlementImpact(direction);
  if (tx.loanTransactionType) return getLoanSettlementImpact(direction);
  return getTransactionCashflowImpact(tx);
}

export function getTransactionCashflowImpact(tx: {
  type: string;
  note?: string | null;
  transferPairId?: string | null;
  depositTransactionType?: string | null;
}, options?: {
  // Transfer impact is relative to the concrete transfer leg represented by tx.type.
  includeTransfers?: boolean;
  includeLoans?: boolean;
}): 'in' | 'out' | 'neutral' {
  if (tx.transferPairId) {
    return options?.includeTransfers && (tx.type === 'in' || tx.type === 'out') ? tx.type : 'neutral';
  }
  if (tx.type === 'in') return 'in';
  if (tx.type === 'out') return 'out';
  if (tx.type === 'deposit') {
    // Creating a deposit moves money OUT of source; closing/maturity brings it back IN.
    return tx.depositTransactionType === 'closed' ? 'in' : 'out';
  }
  if (tx.type === 'loan' && options?.includeLoans !== false) {
    const note = (tx.note ?? '').toLowerCase();
    if (
      note.startsWith('borrowed from') ||
      note.startsWith('payment from') ||
      note.startsWith('receipt from')
    ) {
      return 'in';
    }
    if (
      note.startsWith('lent to') ||
      note.startsWith('payment to') ||
      note.startsWith('repayment to')
    ) {
      return 'out';
    }
  }
  return 'neutral';
}

export function getTransactionBalanceDelta(tx: {
  type: string;
  amount: number;
  note?: string | null;
  transferPairId?: string | null;
  depositTransactionType?: string | null;
}): number {
  const impact = getTransactionCashflowImpact(tx);
  if (impact === 'in') return tx.amount;
  if (impact === 'out') return -tx.amount;
  return 0;
}
