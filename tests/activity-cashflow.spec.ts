import { getActivityDisplayedCashflow, getActivityDrilldownTransactions } from '../lib/activityCashflow.ts';
import type { Transaction } from '../types/index.ts';

function tx(patch: Partial<Transaction>): Transaction {
  return {
    id: patch.id ?? 'tx',
    type: patch.type ?? 'out',
    amount: patch.amount ?? 0,
    accountId: patch.accountId ?? 'acc1',
    tags: patch.tags ?? [],
    date: patch.date ?? '2026-04-20T00:00:00.000Z',
    createdAt: patch.createdAt ?? '2026-04-20T00:00:00.000Z',
    ...patch,
  };
}

describe('activity cashflow drilldown summary', () => {
  it('summarizes the filtered period when no category drilldown is active', () => {
    const transactions = [
      tx({ id: 'income', type: 'in', amount: 500 }),
      tx({ id: 'expense', type: 'out', amount: 125, categoryId: 'food' }),
      tx({ id: 'transfer-out', type: 'out', amount: 100, transferPairId: 'pair1' }),
      tx({ id: 'transfer-in', type: 'in', amount: 100, transferPairId: 'pair1' }),
    ];

    expect(getActivityDisplayedCashflow(transactions, null)).toEqual({
      in: 500,
      out: 125,
      net: 375,
    });
  });

  it('summarizes only the selected subcategory when drilldown is active', () => {
    const transactions = [
      tx({ id: 'food-1', type: 'out', amount: 125, categoryId: 'food' }),
      tx({ id: 'food-2', type: 'out', amount: 75, categoryId: 'food' }),
      tx({ id: 'salary', type: 'in', amount: 1000, categoryId: 'salary' }),
    ];

    expect(
      getActivityDisplayedCashflow(transactions, {
        subKey: 'food',
      }),
    ).toEqual({
      in: 0,
      out: 200,
      net: -200,
    });
  });

  it('drills into uncategorized synthetic type buckets', () => {
    const transactions = [
      tx({ id: 'uncategorized-out', type: 'out', amount: 40 }),
      tx({ id: 'uncategorized-in', type: 'in', amount: 70 }),
      tx({ id: 'categorized-out', type: 'out', amount: 20, categoryId: 'food' }),
    ];

    expect(getActivityDrilldownTransactions(transactions, { subKey: 'type:out' }).map((item) => item.id)).toEqual([
      'uncategorized-out',
    ]);
  });
});
