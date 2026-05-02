import { getLoanOutstanding } from '../lib/derived';
import type { Loan } from '../types';

describe('loan math', () => {
  it('allows repayment percent above 100 on overpayment', () => {
    const loan: Loan = {
      id: 'loan1',
      personName: 'Asha',
      direction: 'lent',
      accountId: 'acc1',
      givenAmount: 1000,
      status: 'open',
      tags: [],
      date: '2026-04-20T00:00:00.000Z',
      createdAt: '2026-04-20T00:00:00.000Z',
    };

    expect(getLoanOutstanding(loan, 1250)).toEqual({
      given: 1000,
      settled: 1250,
      pending: 0,
      percent: 125,
    });
  });
});
