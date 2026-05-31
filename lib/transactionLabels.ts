import type { Category, Loan, Transaction } from '../types';
import { getTransactionCashflowImpact } from './transactionImpact';

export interface TransactionLabelContext {
  categoriesById: Map<string, Category>;
  /** account id -> account name */
  accountsById: Map<string, string>;
  loansById: Map<string, Pick<Loan, 'personName' | 'direction'>>;
  depositsById: Map<string, { name: string; bankName?: string | null }>;
}

export interface TransactionLabels {
  /** Income | Expense | Transfer | Loan | Deposit */
  type: string;
  category: string;
  subcategory: string;
  /** merchant/person for in/out, other account for transfers, person for loans, deposit for deposits */
  payee: string;
}

/**
 * Single source of truth for how a transaction is labelled for display/export.
 * The activity cards and the CSV export both derive their labels from this, so they
 * never drift. Computed purely from the transaction + lookup maps (no UI involved).
 *
 * Locked rules:
 *  - Type reflects how the row counts: in/out and loan/deposit interest+charges → Income/Expense
 *    (they DO hit income/expense totals); neutral principal moves keep Loan/Deposit/Transfer.
 *  - Category/Subcategory come from the real category when one exists (so loan interest /
 *    deposit interest read "Automated / …"); otherwise synthesized for the null-category cases.
 */
export function getTransactionLabels(
  tx: Transaction,
  ctx: TransactionLabelContext,
): TransactionLabels {
  const { categoriesById, accountsById, loansById, depositsById } = ctx;

  // Resolve the real category hierarchy when the row carries one.
  let category = '';
  let subcategory = '';
  if (tx.categoryId) {
    const cat = categoriesById.get(tx.categoryId);
    if (cat) {
      const parent = cat.parentId ? categoriesById.get(cat.parentId) : undefined;
      if (parent) {
        category = parent.name;
        subcategory = cat.name;
      } else {
        category = cat.name;
      }
    }
  }

  const deposit = tx.depositId ? depositsById.get(tx.depositId) : undefined;
  const depositLabel = deposit
    ? deposit.bankName
      ? `${deposit.name} — ${deposit.bankName}`
      : deposit.name
    : '';
  const loan = tx.loanId ? loansById.get(tx.loanId) : undefined;

  // Transfers: each stored leg is its own row.
  if (tx.transferPairId) {
    return {
      type: 'Transfer',
      category: 'Transfer',
      subcategory: tx.type === 'in' ? 'In' : 'Out',
      payee: tx.linkedAccountId ? accountsById.get(tx.linkedAccountId) ?? '' : '',
    };
  }

  // Deposit principal moves (new / closed) — no DB category.
  if (tx.type === 'deposit') {
    return {
      type: 'Deposit',
      category: 'Deposit',
      subcategory: tx.depositTransactionType === 'closed' ? 'Closed' : 'New',
      payee: depositLabel,
    };
  }

  // Loans.
  if (tx.type === 'loan') {
    // Interest / charges carry a real (Automated) category and count as income/expense.
    if (tx.categoryId) {
      const impact = getTransactionCashflowImpact(tx, {
        includeTransfers: true,
        includeLoans: true,
        includeDeposits: true,
      });
      return {
        type: impact === 'in' ? 'Income' : 'Expense',
        category,
        subcategory,
        payee: loan?.personName ?? '',
      };
    }
    // Principal moves — synthesize the card's label (Lent / Recovered / Borrowed / Repaid).
    const impact = getTransactionCashflowImpact(tx, { includeTransfers: true });
    let sub = 'Principal';
    if (loan?.direction === 'lent') {
      sub = impact === 'out' ? 'Lent' : 'Recovered';
    } else if (loan?.direction === 'borrowed') {
      sub = impact === 'in' ? 'Borrowed' : 'Repaid';
    }
    return { type: 'Loan', category: 'Loan', subcategory: sub, payee: loan?.personName ?? '' };
  }

  // Plain income / expense (incl. deposit interest, which is stored as type 'in').
  return {
    type: tx.type === 'in' ? 'Income' : 'Expense',
    category,
    subcategory,
    payee: deposit ? depositLabel : tx.payee ?? '',
  };
}
