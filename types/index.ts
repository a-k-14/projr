export type NoteType = 'text' | 'checklist';

export interface Note {
  id: string;
  title: string;
  type: NoteType;
  body: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteItem {
  id: string;
  noteId: string;
  text: string;
  checked: boolean;
  sortOrder: number;
}

export interface NoteWithItems extends Note {
  items: NoteItem[];
}

export type AccountType = 'savings' | 'credit' | 'cash' | 'wallet' | 'investment' | 'other';
export type TransactionType = 'in' | 'out' | 'transfer' | 'loan' | 'deposit';
export type DepositTransactionType = 'new' | 'closed';
export type LoanDirection = 'lent' | 'borrowed';
export type LoanStatus = 'open' | 'closed';
export type LoanTransactionType = 'principal' | 'interest' | 'others' | 'charges' | 'adjustment';
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
  accountNumber?: string;
  initialBalance: number;
  sortOrder: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  accountId: string;
  splitGroupId?: string;
  linkedAccountId?: string;
  loanId?: string;
  loanTransactionType?: LoanTransactionType;
  depositId?: string;
  depositTransactionType?: DepositTransactionType;
  categoryId?: string;
  payee?: string;
  tags: string[];
  note?: string;
  receiptImageUris?: string[];
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
  interestAmount: number;
  othersAmount: number;
  transactions: Transaction[];
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  icon: string;
  color: string;
  type: 'in' | 'out' | 'both';
  systemKey?: string;
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
  period: 'month';
  startDate: string;
  repeat: boolean;
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
  lastUsedAccountId?: string;
  currency: string;
  currencySymbol: string;
  showCurrencySymbol: boolean;
  theme: Theme;
  yearStart: number;
  cloudBackupEnabled: boolean;
  biometricLock: boolean;
  homeAccountViewMode: 'swipe' | 'list';
  homeExcludedAccountIds: string[];
  supabaseUserId?: string;
  autoBackupEnabled: boolean;
  autoBackupFolderUri: string;
  autoBackupFrequencyDays: number;
  lastAutoBackupAt: string;
  autoBackupKeepCount: number;
  lastManualBackupAt: string;
  lastAutoBackupError: string;
  hideAmounts: boolean;
  lastRestoreAt: string;
}

export interface CashflowSummary {
  in: number;
  out: number;
  net: number;
}

export interface DailyCashflow {
  date: string;
  in: number;
  out: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  total: number;
  percent: number;
}

export interface TransactionFilters {
  accountId?: string;
  type?: TransactionType | TransactionType[];
  categoryId?: string;
  tagId?: string;
  fromDate?: string;
  toDate?: string;
  loanId?: string;
  depositId?: string;
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
  accountNumber?: string;
  initialBalance: number;
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  accountId: string;
  splitGroupId?: string;
  linkedAccountId?: string;
  loanId?: string;
  loanTransactionType?: LoanTransactionType;
  depositId?: string;
  depositTransactionType?: DepositTransactionType;
  categoryId?: string;
  payee?: string;
  tags?: string[];
  note?: string;
  receiptImageUris?: string[] | null;
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

export type DepositStatus = 'active' | 'closed';

export interface Deposit {
  id: string;
  name: string;
  bankName?: string;
  accountId: string;
  principalAmount: number;
  interestRate?: number;
  tenureMonths?: number;
  startDate: string;
  maturityDate?: string;
  maturityValue?: number;
  status: DepositStatus;
  note?: string;
  createdAt: string;
}

export interface CreateDepositInput {
  name: string;
  bankName?: string | null;
  accountId: string;
  principalAmount: number;
  interestRate?: number | null;
  tenureMonths?: number | null;
  startDate: string;
  maturityDate?: string | null;
  maturityValue?: number | null;
  note?: string | null;
}

export interface CloseDepositInput {
  principalAmount?: number;
  interestAmount?: number;
  accountId?: string;
  date?: string;
  note?: string;
}

export interface DepositFilters {
  status?: DepositStatus;
  accountId?: string;
}

export interface Asset {
  id: string;
  name: string;
  icon: string;
  value: number;
  note?: string;
  createdAt: string;
}

export interface CreateAssetInput {
  name: string;
  icon: string;
  value: number;
  note?: string | null;
}

export interface CreateBudgetInput {
  categoryId: string;
  amount: number;
  period: 'month';
  startDate: string;
  repeat: boolean;
}
