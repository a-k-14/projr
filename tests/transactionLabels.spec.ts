import { getTransactionLabels, type TransactionLabelContext } from '../lib/transactionLabels';
import type { Category, Transaction } from '../types';

const categories: Category[] = [
  { id: 'food', name: 'Food', icon: 'x', color: '#000', type: 'out' },
  { id: 'groceries', name: 'Groceries', parentId: 'food', icon: 'x', color: '#000', type: 'out' },
  { id: 'rent', name: 'Rent', icon: 'x', color: '#000', type: 'out' }, // childless top-level
  { id: '__sys_financial_income__', name: 'Automated', icon: 'x', color: '#000', type: 'in' },
  { id: '__sys_financial_expense__', name: 'Automated', icon: 'x', color: '#000', type: 'out' },
  { id: 'loan_int_in', name: 'Loan Interest In', parentId: '__sys_financial_income__', icon: 'x', color: '#000', type: 'in' },
  { id: 'loan_int_out', name: 'Loan Interest Out', parentId: '__sys_financial_expense__', icon: 'x', color: '#000', type: 'out' },
  { id: 'dep_int', name: 'Deposit Interest', parentId: '__sys_financial_income__', icon: 'x', color: '#000', type: 'in' },
];

const ctx: TransactionLabelContext = {
  categoriesById: new Map(categories.map((c) => [c.id, c])),
  accountsById: new Map([['acc1', 'HDFC'], ['acc2', 'Cash']]),
  loansById: new Map([
    ['lentLoan', { personName: 'John', direction: 'lent' }],
    ['borrowedLoan', { personName: 'Riya', direction: 'borrowed' }],
  ]),
  depositsById: new Map([['fd1', { name: 'FD', bankName: 'HDFC' }]]),
};

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 't', type: 'out', amount: 100, accountId: 'acc1', tags: [],
    date: '2026-03-10T00:00:00.000Z', createdAt: '2026-03-10T00:00:00.000Z',
    ...partial,
  } as Transaction;
}

describe('getTransactionLabels', () => {
  it('income/expense use real category + subcategory', () => {
    expect(getTransactionLabels(tx({ type: 'out', categoryId: 'groceries', payee: 'BigBasket' }), ctx))
      .toEqual({ type: 'Expense', category: 'Food', subcategory: 'Groceries', payee: 'BigBasket' });
  });

  it('childless top-level category leaves subcategory blank', () => {
    const l = getTransactionLabels(tx({ type: 'out', categoryId: 'rent' }), ctx);
    expect(l.category).toBe('Rent');
    expect(l.subcategory).toBe('');
  });

  it('transfer legs carry the other account in payee', () => {
    expect(getTransactionLabels(tx({ type: 'out', transferPairId: 'p1', linkedAccountId: 'acc2' }), ctx))
      .toEqual({ type: 'Transfer', category: 'Transfer', subcategory: 'Out', payee: 'Cash' });
    expect(getTransactionLabels(tx({ type: 'in', transferPairId: 'p1', linkedAccountId: 'acc1' }), ctx).subcategory)
      .toBe('In');
  });

  it('loan principal synthesizes Lent/Recovered/Borrowed/Repaid', () => {
    expect(getTransactionLabels(tx({ type: 'loan', loanId: 'lentLoan', note: 'Lent to John' }), ctx).subcategory).toBe('Lent');
    expect(getTransactionLabels(tx({ type: 'loan', loanId: 'lentLoan', note: 'Receipt from John' }), ctx).subcategory).toBe('Recovered');
    expect(getTransactionLabels(tx({ type: 'loan', loanId: 'borrowedLoan', note: 'Borrowed from Riya' }), ctx).subcategory).toBe('Borrowed');
    expect(getTransactionLabels(tx({ type: 'loan', loanId: 'borrowedLoan', note: 'Repayment to Riya' }), ctx).subcategory).toBe('Repaid');
    const l = getTransactionLabels(tx({ type: 'loan', loanId: 'lentLoan', note: 'Lent to John' }), ctx);
    expect(l.type).toBe('Loan');
    expect(l.payee).toBe('John');
  });

  it('loan interest is typed Income/Expense with Automated category', () => {
    expect(getTransactionLabels(tx({ type: 'loan', loanId: 'lentLoan', categoryId: 'loan_int_in', loanTransactionType: 'interest', note: 'Receipt from John' }), ctx))
      .toEqual({ type: 'Income', category: 'Automated', subcategory: 'Loan Interest In', payee: 'John' });
    expect(getTransactionLabels(tx({ type: 'loan', loanId: 'borrowedLoan', categoryId: 'loan_int_out', loanTransactionType: 'interest', note: 'Payment to Riya' }), ctx).type)
      .toBe('Expense');
  });

  it('deposit principal and interest', () => {
    expect(getTransactionLabels(tx({ type: 'deposit', depositId: 'fd1', depositTransactionType: 'new' }), ctx))
      .toEqual({ type: 'Deposit', category: 'Deposit', subcategory: 'New', payee: 'FD — HDFC' });
    expect(getTransactionLabels(tx({ type: 'deposit', depositId: 'fd1', depositTransactionType: 'closed' }), ctx).subcategory).toBe('Closed');
    expect(getTransactionLabels(tx({ type: 'in', depositId: 'fd1', categoryId: 'dep_int' }), ctx))
      .toEqual({ type: 'Income', category: 'Automated', subcategory: 'Deposit Interest', payee: 'FD — HDFC' });
  });
});
