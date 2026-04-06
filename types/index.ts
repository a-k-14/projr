export type AccountType = 'savings' | 'credit' | 'cash' | 'wallet';
export type TransactionType = 'in' | 'out' | 'transfer' | 'loan';
export type LoanDirection = 'lent' | 'borrowed';
export type LoanStatus = 'open' | 'closed';
export type Theme = 'light' | 'dark' | 'auto';
export type PeriodType = 'week' | 'month' | 'year' | 'custom';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color: string;
  icon: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  accountId: string;
  linkedAccountId?: string;
  loanId?: string;
  categoryId?: string;
  tags: string[];
  note?: string;
  date: string;
  transferPairId?: string;
  createdAt: string;
}

export interface Loan {
  id: string;
  personName: string;
  direction: LoanDirection;
  accountId: string;
  givenAmount: number;
  status: LoanStatus;
  note?: string;
  tags: string[];
  date: string;
  createdAt: string;
}

export interface LoanWithSummary extends Loan {
  settledAmount: number;
  pendingAmount: number;
  repaidPercent: number;
  transactions: Transaction[];
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  icon: string;
  color: string;
  type: 'in' | 'out' | 'both';
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  period: 'month' | 'year';
  startDate: string;
  createdAt: string;
}

export interface BudgetWithSpent extends Budget {
  spent: number;
  remaining: number;
  percent: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
}

export interface Settings {
  defaultAccountId: string;
  currency: string;
  currencySymbol: string;
  theme: Theme;
  yearStart: number;
  cloudBackupEnabled: boolean;
  supabaseUserId?: string;
}

export interface CashflowSummary {
  in: number;
  out: number;
  net: number;
}

export interface DailySpending {
  date: string;
  amount: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  total: number;
  percent: number;
}

export interface TransactionFilters {
  accountId?: string;
  type?: TransactionType;
  categoryId?: string;
  tagId?: string;
  fromDate?: string;
  toDate?: string;
  loanId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LoanFilters {
  accountId?: string;
  status?: LoanStatus;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  balance: number;
  currency?: string;
  color: string;
  icon: string;
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  accountId: string;
  linkedAccountId?: string;
  loanId?: string;
  categoryId?: string;
  tags?: string[];
  note?: string;
  date: string;
}

export interface CreateLoanInput {
  personName: string;
  direction: LoanDirection;
  accountId: string;
  givenAmount: number;
  note?: string;
  tags?: string[];
  date: string;
}

export interface CreateBudgetInput {
  categoryId: string;
  amount: number;
  period: 'month' | 'year';
  startDate: string;
}
