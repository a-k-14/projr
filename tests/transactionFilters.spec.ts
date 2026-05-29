import { filterTransactions } from '../lib/transactionFilters';
import type { Category, Transaction, Loan } from '../types';

function tx(patch: Partial<Transaction>): Transaction {
  return {
    id: patch.id ?? 'tx',
    type: patch.type ?? 'out',
    amount: patch.amount ?? 0,
    accountId: patch.accountId ?? 'acc1',
    tags: patch.tags ?? [],
    date: patch.date ?? '2026-04-20T00:00:00.000Z',
    createdAt: patch.createdAt ?? '2026-04-20T00:00:00.000Z',
    note: patch.note ?? undefined,
    receiptImageUris: patch.receiptImageUris ?? [],
    ...patch,
  };
}

describe('transaction filters for automated loan categories', () => {
  const dummyCategories: Category[] = [
    { id: '__sys_financial_income__', name: 'Automated', icon: 'circle-arrow-down', color: '#16A34A', type: 'in', systemKey: 'financial_income', parentId: undefined },
    { id: '__sys_loan_interest_received__', name: 'Loan Interest In', icon: 'circle-arrow-down', color: '#16A34A', type: 'in', systemKey: 'loan_interest_received', parentId: '__sys_financial_income__' },
    { id: '__sys_financial_expense__', name: 'Automated', icon: 'circle-arrow-up', color: '#DC2626', type: 'out', systemKey: 'financial_expense', parentId: undefined },
    { id: '__sys_loan_interest_paid__', name: 'Loan Interest Out', icon: 'circle-arrow-up', color: '#DC2626', type: 'out', systemKey: 'loan_interest_paid', parentId: '__sys_financial_expense__' },
  ];

  const context = {
    categories: dummyCategories,
    accountsById: new Map<string, string>(),
    tagNamesById: new Map<string, string>(),
    loansById: new Map<string, Loan>(),
    getCategoryFullDisplayName: (id: string) => id,
  };

  it('permits interest/charges transactions to pass inflow/outflow filters', () => {
    const interestReceivedTx = tx({
      id: 'tx-1',
      type: 'in',
      amount: 100,
      categoryId: '__sys_loan_interest_received__',
      loanTransactionType: 'interest',
      loanId: 'loan-1',
      note: 'Payment from borrower',
    });

    const interestPaidTx = tx({
      id: 'tx-2',
      type: 'out',
      amount: 50,
      categoryId: '__sys_loan_interest_paid__',
      loanTransactionType: 'interest',
      loanId: 'loan-1',
      note: 'Payment to lender',
    });

    const normalLoanTx = tx({
      id: 'tx-3',
      type: 'loan',
      amount: 1000,
      loanTransactionType: 'principal',
      loanId: 'loan-1',
      note: 'Lent to John',
    });

    const transactions = [interestReceivedTx, interestPaidTx, normalLoanTx];

    // 1. Inflow Filter ('in') should match interestReceivedTx and exclude others
    const inflows = filterTransactions(transactions, { typeFilter: 'in' }, context);
    expect(inflows.map(t => t.id)).toEqual(['tx-1']);

    // 2. Outflow Filter ('out') should match interestPaidTx and exclude others
    const outflows = filterTransactions(transactions, { typeFilter: 'out' }, context);
    expect(outflows.map(t => t.id)).toEqual(['tx-2']);

    // 3. Category Filter 'Automated' (financial income) should match child categories as well
    const catIncomeFilters = filterTransactions(transactions, { selectedCategoryIds: ['__sys_financial_income__'] }, context);
    expect(catIncomeFilters.map(t => t.id)).toEqual(['tx-1']);
  });
});
