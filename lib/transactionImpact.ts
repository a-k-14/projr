export function getTransactionCashflowImpact(tx: {
  type: string;
  note?: string | null;
  transferPairId?: string | null;
}): 'in' | 'out' | 'neutral' {
  if (tx.transferPairId) return 'neutral';
  if (tx.type === 'in') return 'in';
  if (tx.type === 'out') return 'out';
  if (tx.type === 'loan') {
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
}): number {
  const impact = getTransactionCashflowImpact(tx);
  if (impact === 'in') return tx.amount;
  if (impact === 'out') return -tx.amount;
  return 0;
}
