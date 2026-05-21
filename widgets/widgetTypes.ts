export type BalanceDisplay = 'netWorth' | 'totalBalance' | 'specificAccount' | 'none';
export type WidgetBgTheme = 'classic' | 'warm' | 'heroBottom';

export interface ReniWidgetConfig {
  balanceDisplay: BalanceDisplay;
  accountId?: string;
  showQuickActions: boolean;
  showTodayActivity: boolean;
  bgTheme?: WidgetBgTheme;
}

export const DEFAULT_WIDGET_CONFIG: ReniWidgetConfig = {
  balanceDisplay: 'netWorth',
  showQuickActions: true,
  showTodayActivity: true,
  bgTheme: 'classic',
};

export interface WidgetDayBar {
  date: string;
  income: number;
  expense: number;
}

export interface WidgetData {
  balance: number | null;
  balanceLabel: string;
  currencySymbol: string;
  days: WidgetDayBar[];
  totalIncome: number;
  totalExpense: number;
  todayIncome: number;
  todayExpense: number;
  monthLabel: string;
}
