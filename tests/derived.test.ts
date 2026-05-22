import test from 'node:test';
import assert from 'node:assert/strict';
import { getStructuredLoanCashflowImpact, getTransactionBalanceDelta, getTransactionCashflowImpact } from '../lib/transactionImpact.ts';

test('loan origin labels map to the right cashflow direction', () => {
  assert.equal(getTransactionCashflowImpact({ type: 'loan', note: 'Lent to Ravi' }), 'out');
  assert.equal(getTransactionCashflowImpact({ type: 'loan', note: 'Borrowed from Ravi' }), 'in');
});

test('loan settlement labels map to the right cashflow direction', () => {
  assert.equal(getTransactionCashflowImpact({ type: 'loan', note: 'Receipt from Ravi' }), 'in');
  assert.equal(getTransactionCashflowImpact({ type: 'loan', note: 'Repayment to Ravi' }), 'out');
});

test('income expense reporting can exclude loans', () => {
  assert.equal(
    getTransactionCashflowImpact(
      { type: 'loan', note: 'Borrowed from Ravi' },
      { includeLoans: false },
    ),
    'neutral',
  );
  assert.equal(
    getTransactionCashflowImpact(
      { type: 'loan', note: 'Lent to Ravi' },
      { includeLoans: false },
    ),
    'neutral',
  );
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

test('structured loan settlement type maps by loan direction without note labels', () => {
  assert.equal(
    getStructuredLoanCashflowImpact({ type: 'loan', loanTransactionType: 'principal' }, 'lent'),
    'in',
  );
  assert.equal(
    getStructuredLoanCashflowImpact({ type: 'loan', loanTransactionType: 'principal' }, 'borrowed'),
    'out',
  );
});

test('structured loan interest/charges maps correctly even with type in/out', () => {
  assert.equal(
    getStructuredLoanCashflowImpact({ type: 'in', loanTransactionType: 'interest', loanId: 'loan-1' }, 'lent'),
    'in',
  );
  assert.equal(
    getStructuredLoanCashflowImpact({ type: 'out', loanTransactionType: 'interest', loanId: 'loan-1' }, 'borrowed'),
    'out',
  );
});

test('negative expense amounts invert balance deltas', () => {
  assert.equal(getTransactionBalanceDelta({ type: 'out', amount: -2500 }), 2500);
});

test('loan interest/charges can be included in cashflow even when includeLoans is false', () => {
  // Principal is neutral when includeLoans: false
  assert.equal(
    getTransactionCashflowImpact(
      { type: 'loan', note: 'Repayment to Ravi', loanTransactionType: 'principal' },
      { includeLoans: false },
    ),
    'neutral',
  );

  assert.equal(
    getTransactionCashflowImpact(
      { type: 'loan', note: 'Borrowed from Ravi', loanTransactionType: null },
      { includeLoans: false },
    ),
    'neutral',
  );

  // Interest/others/charges/adjustment is not neutral if there's a recognized note prefix
  assert.equal(
    getTransactionCashflowImpact(
      { type: 'loan', note: 'Payment to Ravi', loanTransactionType: 'interest' },
      { includeLoans: false },
    ),
    'out',
  );

  assert.equal(
    getTransactionCashflowImpact(
      { type: 'loan', note: 'Receipt from Ravi', loanTransactionType: 'charges' },
      { includeLoans: false },
    ),
    'in',
  );

  assert.equal(
    getTransactionCashflowImpact(
      { type: 'loan', note: 'Payment to Ravi', loanTransactionType: 'adjustment' },
      { includeLoans: false },
    ),
    'out',
  );

  assert.equal(
    getTransactionCashflowImpact(
      { type: 'loan', note: 'Payment to Ravi', loanTransactionType: 'others' },
      { includeLoans: false },
    ),
    'out',
  );
});

test('deposit transaction cashflow impact maps correctly', () => {
  // Deposit defaults to included (out/in) if options are not passed (useful for balance deltas)
  assert.equal(
    getTransactionCashflowImpact({ type: 'deposit', depositTransactionType: 'new' }),
    'out',
  );
  assert.equal(
    getTransactionCashflowImpact({ type: 'deposit', depositTransactionType: 'closed' }),
    'in',
  );

  // If includeDeposits is false, both new deposit and closed deposit should be neutral
  assert.equal(
    getTransactionCashflowImpact(
      { type: 'deposit', depositTransactionType: 'new' },
      { includeDeposits: false },
    ),
    'neutral',
  );
  assert.equal(
    getTransactionCashflowImpact(
      { type: 'deposit', depositTransactionType: 'closed' },
      { includeDeposits: false },
    ),
    'neutral',
  );

  // If includeDeposits is true, they should match their cashflow directions
  assert.equal(
    getTransactionCashflowImpact(
      { type: 'deposit', depositTransactionType: 'new' },
      { includeDeposits: true },
    ),
    'out',
  );
  assert.equal(
    getTransactionCashflowImpact(
      { type: 'deposit', depositTransactionType: 'closed' },
      { includeDeposits: true },
    ),
    'in',
  );
});
