import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useLoansStore } from '../stores/useLoansStore';
import { getLoanTransactionKind } from './derived';
import { safePush } from './safePush';
import type { Transaction } from '../types';

export function useTransactionPress() {
  const nav = useNavigation();
  const loans = useLoansStore((s) => s.loans);

  const handleTransactionPress = useCallback((tx: Transaction) => {
    // Deposit 'new' transaction → edit deposit form
    if (tx.type === 'deposit' && tx.depositId && tx.depositTransactionType === 'new') {
      safePush(nav, { pathname: '/modals/add-transaction', params: { editDepositId: tx.depositId, closeDepositId: '' } });
      return;
    }
    // Deposit close or interest income linked to a deposit → close deposit form
    if (tx.depositId && (tx.depositTransactionType === 'closed' || tx.type === 'in')) {
      const focusField = tx.type === 'in' ? 'interest' : 'principal';
      safePush(nav, { pathname: '/modals/add-transaction', params: { closeDepositId: tx.depositId, editDepositId: '', focusField } });
      return;
    }
    if (tx.loanId) {
      const loan = loans.find((item) => item.id === tx.loanId);
      if (loan && getLoanTransactionKind(tx, loan.direction) === 'settlement') {
        safePush(nav, { pathname: '/modals/loan-settlement', params: { editId: tx.id } });
        return;
      }
    }
    safePush(nav, { pathname: '/modals/add-transaction', params: { editId: tx.id } });
  }, [loans, nav]);

  return handleTransactionPress;
}
