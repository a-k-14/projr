import { runMigrations } from '../db/migrate';
import { getAccounts, getAccountById } from '../services/accounts';
import { getCashflowSnapshot } from '../services/analytics';
import { getSettings } from '../services/settings';
import { toLocalDateKey, toLocalDayStartISO, toLocalDayEndISO } from '../lib/dateUtils';
import type { ReniWidgetConfig } from './widgetTypes';
import type { WidgetData } from './widgetTypes';
import { getLoans } from '../services/loans';
import { getDeposits } from '../services/fixedDeposits';
import { getAssets } from '../services/assets';
import { getLoanSummary } from '../lib/derived';
import { getFixedDepositSummary } from '../lib/fixed-deposits';

function monthBounds(): { from: string; to: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const from = toLocalDayStartISO(firstDay);
  const to = toLocalDayEndISO(lastDay);
  const label = now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  return { from, to, label };
}

export async function fetchWidgetData(config: ReniWidgetConfig): Promise<WidgetData> {
  await runMigrations();

  const [appSettings, accounts] = await Promise.all([getSettings(), getAccounts()]);
  const sym = appSettings.showCurrencySymbol ? appSettings.currencySymbol : '';

  const now = new Date();
  const { from, to, label: monthLabel } = monthBounds();
  const todayKey = toLocalDateKey(now.toISOString());

  const { summary, daily } = await getCashflowSnapshot('all', from, to);

  // Build a lookup of days that have transactions
  const byDate = new Map(daily.map((d) => [d.date, { income: d.in, expense: d.out }]));

  // Always return every day in the month so bars stay thin (future days = zeros)
  const pad = (n: number) => String(n).padStart(2, '0');
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(i + 1)}`;
    return { date, ...(byDate.get(date) ?? { income: 0, expense: 0 }) };
  });

  const todayEntry = daily.find((d) => d.date === todayKey);
  const todayIncome = todayEntry?.in ?? 0;
  const todayExpense = todayEntry?.out ?? 0;

  let balance: number | null = null;
  let balanceLabel = '';

  if (config.balanceDisplay === 'netWorth') {
    const [loansList, depositsList, assetsList] = await Promise.all([
      getLoans(),
      getDeposits(),
      getAssets(),
    ]);
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const loanSummary = getLoanSummary(loansList);
    const depositSummary = getFixedDepositSummary(depositsList);
    const assetsValue = assetsList.reduce((sum, a) => sum + a.value, 0);
    balance = totalBalance + loanSummary.net + depositSummary.activeInvestedValue + assetsValue;
    balanceLabel = 'Net Worth';
  } else if (config.balanceDisplay === 'totalBalance') {
    balance = accounts.reduce((sum, a) => sum + a.balance, 0);
    balanceLabel = 'All Accounts';
  } else if (config.balanceDisplay === 'specificAccount' && config.accountId) {
    const account = await getAccountById(config.accountId);
    balance = account?.balance ?? null;
    balanceLabel = account?.name ?? '';
  }

  return {
    balance,
    balanceLabel,
    currencySymbol: sym,
    days,
    totalIncome: summary.in,
    totalExpense: summary.out,
    todayIncome,
    todayExpense,
    monthLabel,
  };
}
