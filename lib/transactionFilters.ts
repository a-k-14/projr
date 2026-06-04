import { getTransactionCashflowImpact } from './derived';
import type { Category, Transaction, Loan } from '../types';

export interface FilterOptions {
  accountId?: string | 'all';
  typeFilter?: 'all' | 'in' | 'out' | 'transfer' | 'loan' | 'deposit';
  cashflowBucket?: 'all' | 'in' | 'out' | 'net';
  cashflowMode?: 'incomeExpense' | 'total';
  selectedCategoryIds?: string[];
  selectedTagIds?: string[];
  amountMin?: number;
  amountMax?: number;
  searchQuery?: string;
}

export interface FilterContext {
  categories: Category[];
  accountsById: Map<string, string>;
  tagNamesById: Map<string, string>;
  loansById: Map<string, Loan>;
  getCategoryFullDisplayName: (id: string, separator?: string) => string;
}

export function filterTransactions(
  transactions: Transaction[],
  options: FilterOptions,
  context: FilterContext
): Transaction[] {
  const {
    accountId = 'all',
    typeFilter = 'all',
    cashflowBucket = 'all',
    cashflowMode = 'incomeExpense',
    selectedCategoryIds = [],
    selectedTagIds = [],
    amountMin,
    amountMax,
    searchQuery = '',
  } = options;

  const { categories, accountsById, tagNamesById, loansById, getCategoryFullDisplayName } = context;

  const query = searchQuery.trim().toLowerCase();
  const selectedTagSet = new Set(selectedTagIds);
  const selectedCategoryAndDescendants = new Set<string>();

  selectedCategoryIds.forEach((id) => {
    selectedCategoryAndDescendants.add(id);
    categories
      .filter((category) => category.parentId === id)
      .forEach((child) => selectedCategoryAndDescendants.add(child.id));
  });

  // When the user is searching, treat search as a top-level lookup that ignores
  // every other filter (period/account/type/amount/category/tag/cashflow). The
  // caller is responsible for passing the FULL transaction set in that case.
  // The search predicate also matches the numeric amount as text so "200" finds
  // a ₹200 transaction even if its note/payee don't mention the amount.
  if (query) {
    const numericQuery = Number(query.replace(/[^0-9.]/g, ''));
    const queryIsNumeric = Number.isFinite(numericQuery) && /[0-9]/.test(query);
    return transactions.filter((tx) => {
      const loan = tx.loanId ? loansById.get(tx.loanId) : undefined;
      const linkedAccountName = tx.linkedAccountId ? accountsById.get(tx.linkedAccountId) : undefined;
      const searchable = [
        tx.note,
        tx.payee,
        tx.categoryId ? getCategoryFullDisplayName(tx.categoryId, ' › ') : undefined,
        accountsById.get(tx.accountId),
        linkedAccountName,
        loan?.personName,
        tx.tags.map((tagId) => tagNamesById.get(tagId)).filter(Boolean).join(' • '),
        String(tx.amount),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (searchable.includes(query)) return true;
      if (queryIsNumeric && tx.amount === numericQuery) return true;
      return false;
    });
  }

  return transactions.filter((tx) => {
    // 1. Account Filter
    if (accountId !== 'all' && tx.accountId !== accountId) {
      return false;
    }

    // 2. Type Filter (Incomes, Expenses, Transfers, Loans, Deposits)
    if (typeFilter === 'transfer') {
      if (!tx.transferPairId) return false;
    } else if (typeFilter === 'loan') {
      if (tx.type !== 'loan') return false;
    } else if (typeFilter === 'deposit') {
      if (tx.type !== 'deposit') return false;
    } else if (typeFilter !== 'all') {
      if (tx.transferPairId || tx.type === 'loan' || tx.type === 'deposit' || tx.type !== typeFilter) {
        return false;
      }
    }

    // 3. Cashflow Impact Calculations
    const impact = getTransactionCashflowImpact(tx, {
      includeTransfers: cashflowMode === 'total',
      includeLoans: cashflowMode === 'total',
      includeDeposits: cashflowMode === 'total',
    });

    // 4. Cashflow Bucket Filter (Inflow, Outflow, Net)
    if (cashflowBucket !== 'all') {
      if (cashflowBucket === 'net') {
        if (impact === 'neutral') return false;
      } else if (impact !== cashflowBucket) {
        return false;
      }
    }

    // 5. Amount Filter
    if (amountMin !== undefined && tx.amount < amountMin) return false;
    if (amountMax !== undefined && tx.amount > amountMax) return false;

    // 6. Category Filter
    if (selectedCategoryIds.length > 0) {
      if (!tx.categoryId || !selectedCategoryAndDescendants.has(tx.categoryId)) return false;
    }

    // 7. Tags Filter
    if (selectedTagIds.length > 0) {
      const hasTag = tx.tags.some((tagId) => selectedTagSet.has(tagId));
      if (!hasTag) return false;
    }

    return true;
  });
}
