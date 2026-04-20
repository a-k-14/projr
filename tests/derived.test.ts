import test from 'node:test';
import assert from 'node:assert/strict';
import { getTransactionBalanceDelta, getTransactionCashflowImpact } from '../lib/transactionImpact.ts';

test('loan origin labels map to the right cashflow direction', () => {
  assert.equal(getTransactionCashflowImpact({ type: 'loan', note: 'Lent to Ravi' }), 'out');
  assert.equal(getTransactionCashflowImpact({ type: 'loan', note: 'Borrowed from Ravi' }), 'in');
});

test('loan settlement labels map to the right cashflow direction', () => {
  assert.equal(getTransactionCashflowImpact({ type: 'loan', note: 'Receipt from Ravi' }), 'in');
  assert.equal(getTransactionCashflowImpact({ type: 'loan', note: 'Repayment to Ravi' }), 'out');
});

test('balance deltas follow cashflow impact for normal and loan transactions', () => {
  assert.equal(getTransactionBalanceDelta({ type: 'in', amount: 500 }), 500);
  assert.equal(getTransactionBalanceDelta({ type: 'out', amount: 500 }), -500);
  assert.equal(
    getTransactionBalanceDelta({ type: 'loan', amount: 750, note: 'Borrowed from Meena' }),
    750
  );
  assert.equal(
    getTransactionBalanceDelta({ type: 'loan', amount: 750, note: 'Repayment to Meena' }),
    -750
  );
  assert.equal(
    getTransactionBalanceDelta({ type: 'in', amount: 500, transferPairId: 'pair-1' }),
    0
  );
});

test('unknown loan notes stay neutral instead of mutating balances', () => {
  assert.equal(getTransactionCashflowImpact({ type: 'loan', note: 'Loan adjustment' }), 'neutral');
  assert.equal(
    getTransactionBalanceDelta({ type: 'loan', amount: 999, note: 'Loan adjustment' }),
    0
  );
});

test('negative expense amounts invert balance deltas', () => {
  assert.equal(getTransactionBalanceDelta({ type: 'out', amount: -2500 }), 2500);
});
