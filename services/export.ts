import * as FileSystem from 'expo-file-system/legacy';
import type { Category, Loan, TransactionFilters } from '../types';
import { getTransactions } from './transactions';
import { getCategories } from './categories';
import { getAccounts } from './accounts';
import { getLoans } from './loans';
import { getDeposits } from './fixedDeposits';
import { getTags } from './tags';
import { getLoanTransactionUserNote } from '../lib/derived';
import { getTransactionLabels, type TransactionLabelContext } from '../lib/transactionLabels';

const CSV_HEADER = ['Date', 'Type', 'Category', 'Subcategory', 'Amount', 'Account', 'Payee', 'Tags', 'Note'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Fixed dd-MMM-yyyy (locale-independent, unambiguous, spreadsheet-parseable). */
function formatExportDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

/** RFC 4180 escaping: wrap in quotes when the value has a comma, quote, or newline. */
function csvCell(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/**
 * Build the CSV text for the given filters. Pulls the FULL filtered set (no row limit),
 * so the export always reconciles with the on-screen summary regardless of pagination.
 */
export async function buildTransactionsCsv(filters: TransactionFilters): Promise<{ csv: string; rowCount: number }> {
  const [transactions, categories, accounts, loans, deposits, tags] = await Promise.all([
    getTransactions({ ...filters, limit: undefined, offset: undefined }),
    getCategories(),
    getAccounts(),
    getLoans(),
    getDeposits(),
    getTags(),
  ]);

  const ctx: TransactionLabelContext = {
    categoriesById: new Map<string, Category>(categories.map((c) => [c.id, c])),
    accountsById: new Map(accounts.map((a) => [a.id, a.name])),
    loansById: new Map<string, Pick<Loan, 'personName' | 'direction'>>(
      loans.map((l) => [l.id, { personName: l.personName, direction: l.direction }]),
    ),
    depositsById: new Map(deposits.map((d) => [d.id, { name: d.name, bankName: d.bankName }])),
  };
  const tagNameById = new Map(tags.map((t) => [t.id, t.name]));

  const rows: (string | number)[][] = [CSV_HEADER];
  for (const tx of transactions) {
    const labels = getTransactionLabels(tx, ctx);
    const tagNames = tx.tags
      .map((id) => tagNameById.get(id))
      .filter((n): n is string => !!n)
      .join('; ');
    // Loan rows store the system label in note ("Lent to John · ..."); export only the user note.
    let note = tx.type === 'loan' ? getLoanTransactionUserNote(tx.note) ?? '' : tx.note ?? '';
    if (tx.splitGroupId) note = note ? `${note} (SPLIT)` : '(SPLIT)';

    rows.push([
      formatExportDate(tx.date),
      labels.type,
      labels.category,
      labels.subcategory,
      tx.amount,
      ctx.accountsById.get(tx.accountId) ?? '',
      labels.payee,
      tagNames,
      note,
    ]);
  }

  return { csv: toCsv(rows), rowCount: transactions.length };
}

export interface ExportCsvResult {
  status: 'success' | 'cancelled' | 'empty';
  rowCount: number;
}

/**
 * Build + write the CSV to a user-picked folder via the Storage Access Framework
 * (same mechanism as the DB backup). Returns 'cancelled' if the folder pick is denied,
 * 'empty' if there are no rows to export.
 */
export async function exportTransactionsCsv(filters: TransactionFilters, fileBaseName: string): Promise<ExportCsvResult> {
  const { csv, rowCount } = await buildTransactionsCsv(filters);
  if (rowCount === 0) return { status: 'empty', rowCount: 0 };

  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) return { status: 'cancelled', rowCount };

  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    fileBaseName,
    'text/csv',
  );
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return { status: 'success', rowCount };
}
