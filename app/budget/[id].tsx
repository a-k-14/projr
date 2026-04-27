import { AppIcon } from '@/components/ui/AppIcon';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { RefreshControl, ScrollView, View , TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MetricProgressCard } from '../../components/ui/MetricProgressCard';
import { TransactionListItem } from '../../components/TransactionListItem';
import { getRelativeDateLabel } from '../../lib/dateUtils';
import { formatCurrency, groupTransactionsByDate } from '../../lib/derived';
import { ACTIVITY_LAYOUT, HOME_TEXT, SCREEN_HEADER } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { getBudgetTransactionEntries } from '../../services/budget';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';

type BudgetEntry = Awaited<ReturnType<typeof getBudgetTransactionEntries>>[number];

export default function BudgetDetailScreen() {
  const isFocused = useIsFocused();
  const { id, month } = useLocalSearchParams<{ id: string; month?: string }>();
  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);
  const accounts = useAccountsStore((s) => s.accounts);
  const categories = useCategoriesStore((s) => s.categories);
  const tags = useCategoriesStore((s) => s.tags);
  const loans = useLoansStore((s) => s.loans);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const storeTransactions = useTransactionsStore((s) => s.transactions);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const accountsById = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((loan) => [loan.id, loan])), [loans]);
  const tagNamesById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags]);

  useEffect(() => {
    if (month) loadBudgets(month).catch(() => undefined);
  }, [loadBudgets, month]);

  const budget = budgets.find((item) => item.id === id);

  const loadEntries = async () => {
    if (!budget || !month) return;
    const next = await getBudgetTransactionEntries(budget.categoryId, month);
    setEntries(next);
  };

  useEffect(() => {
    loadEntries().catch(() => undefined);
  }, [budget?.categoryId, month]);

  useEffect(() => {
    if (!isFocused || !month) return;
    loadBudgets(month).catch(() => undefined);
    loadEntries().catch(() => undefined);
  }, [budget?.categoryId, isFocused, loadBudgets, month, storeTransactions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  };

  const grouped = useMemo(() => {
    return groupTransactionsByDate(entries.map((entry) => entry.transaction)).map((group) => {
      const { date, label } = getRelativeDateLabel(group.dateKey);
      return {
        key: group.dateKey,
        title: date,
        subtitle: label,
        items: entries.filter((entry) => group.items.some((item) => item.id === entry.transaction.id)) };
    });
  }, [entries]);

  if (!budget) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: palette.textMuted }}>Budget not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity delayPressIn={0} onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
          <AppIcon name="arrow-left" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text }} numberOfLines={1}>
          {getCategoryFullDisplayName(budget.categoryId, ' › ')}
        </Text>
        <TouchableOpacity delayPressIn={0}
          onPress={() =>
            router.push({
              pathname: '/modals/budget-form',
              params: { budgetId: budget.id, month } })
          }
          style={{ padding: 6 }}
        >
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.brand }}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.budget} />} contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ paddingHorizontal: 14, marginBottom: 14 }}>
          <MetricProgressCard
            palette={palette}
            metrics={[
              { key: 'budgeted', label: 'BUDGETED', value: formatCurrency(budget.amount, sym), valueColor: palette.text },
              { key: 'spent', label: 'SPENT', value: formatCurrency(budget.spent, sym), valueColor: budget.remaining < 0 ? palette.negative : palette.budget },
            ]}
            progressPercent={Math.min(Math.max(budget.percent, 0), 100)}
            progressColor={budget.remaining < 0 ? palette.negative : palette.budget}
            progressLabelLeft={budget.amount <= 0 ? 'Not set' : budget.remaining < 0 ? 'Over budget' : 'On track'}
            progressLabelRight={`${Math.round(budget.percent)}%`}
            footerLeft={{ text: budget.remaining < 0 ? `${formatCurrency(Math.abs(budget.remaining), sym)} over` : `${formatCurrency(budget.remaining, sym)} left`, color: budget.remaining < 0 ? palette.negative : palette.textSecondary }}
            footerRight={{ text: `${entries.length} transaction${entries.length === 1 ? '' : 's'}` }}
          />
        </View>

        {grouped.map((group) => (
          <View key={group.key} style={{ marginBottom: ACTIVITY_LAYOUT.groupCardMarginBottom }}>
            <View
              style={{
                paddingLeft: ACTIVITY_LAYOUT.groupHeaderPaddingX,
                paddingRight: ACTIVITY_LAYOUT.headerPaddingX + 10,
                marginBottom: ACTIVITY_LAYOUT.groupHeaderBottom,
                flexDirection: 'row',
                alignItems: 'center'
              }}
            >
              <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '600', color: palette.text }}>{group.title}</Text>
              {group.subtitle ? (
                <>
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '500', color: palette.textMuted, marginHorizontal: 6 }}>•</Text>
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '500', color: palette.textMuted }}>{group.subtitle}</Text>
                </>
              ) : null}
            </View>
            <View
              style={{
                backgroundColor: palette.surface,
                borderRadius: ACTIVITY_LAYOUT.groupCardRadius,
                marginHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
                overflow: 'hidden'
              }}
            >
              {group.items.map((entry, index) => (
                <TransactionListItem
                  key={entry.transaction.id}
                  tx={entry.transaction}
                  displayAmount={entry.countedAmount}
                  sym={sym}
                  palette={palette}
                  isLast={index === group.items.length - 1}
                  categoryName={entry.transaction.categoryId ? getCategoryFullDisplayName(entry.transaction.categoryId, ' › ') : undefined}
                  categoryIcon={entry.transaction.categoryId ? categoriesById.get(entry.transaction.categoryId)?.icon : undefined}
                  accountName={accountsById.get(entry.transaction.accountId)}
                  linkedAccountName={entry.transaction.linkedAccountId ? accountsById.get(entry.transaction.linkedAccountId) : undefined}
                  loanPersonName={entry.transaction.loanId ? loansById.get(entry.transaction.loanId)?.personName : undefined}
                  loanDirection={entry.transaction.loanId ? loansById.get(entry.transaction.loanId)?.direction : undefined}
                  tertiaryText={
                    entry.transaction.tags.length > 0
                      ? entry.transaction.tags
                        .map((tagId) => tagNamesById.get(tagId))
                        .filter((value): value is string => !!value)
                        .join(' • ') || undefined
                      : undefined
                  }
                  showAmountSign={false}
                  useTypeAmountColor
                  onPress={(tx) => router.push({ pathname: '/modals/add-transaction', params: { editId: tx.id } })}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
