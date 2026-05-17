import { HeaderEditButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/AppText';
import { getCompactScrollableBottomPadding } from '@/components/ui/safeBottom';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionListItem } from '../../components/TransactionListItem';
import { getCategoryDisplayIcon } from '../../lib/category-utils';
import { getRelativeDateLabel, toLocalDateKey } from '../../lib/dateUtils';
import { formatCurrency } from '../../lib/derived';
import { SCREEN_GUTTER, FONT_WEIGHT } from '../../lib/design';
import {
  HOME_RADIUS,
  HOME_SPACE,
  HOME_TEXT,
  SCREEN_HEADER,
} from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getBudgetTransactions } from '../../services/budget';
import type { Transaction } from '../../types';

export default function BudgetDetailScreen() {
  const { id, month } = useLocalSearchParams<{ id: string; month: string }>();
  const insets = useSafeAreaInsets();
  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const categoriesById = useCategoriesStore((s) => new Map(s.categories.map((c) => [c.id, c])));
  const accounts = useAccountsStore((s) => s.accounts);
  const accountsById = new Map(accounts.map((a) => [a.id, a.name]));
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();

  const [txns, setTxns] = useState<Transaction[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);

  const budget = budgets.find((b) => b.id === id);

  useEffect(() => {
    if (month) {
      loadBudgets(month).catch(() => undefined);
    }
  }, [month, loadBudgets]);

  useEffect(() => {
    if (!budget || !month) return;
    setTxnsLoading(true);
    getBudgetTransactions(budget.categoryId, month)
      .then(setTxns)
      .catch(() => undefined)
      .finally(() => setTxnsLoading(false));
  }, [budget?.categoryId, month]);

  if (!budget) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={palette.brand} />
      </View>
    );
  }

  const isOver = budget.amount > 0 && budget.remaining < 0;
  const categoryLabel = getCategoryFullDisplayName(budget.categoryId, ' › ');

  // Group transactions by date
  const groups: { dateKey: string; items: Transaction[] }[] = [];
  for (const tx of txns) {
    const key = toLocalDateKey(tx.date);
    const last = groups[groups.length - 1];
    if (last?.dateKey === key) last.items.push(tx);
    else groups.push({ dateKey: key, items: [tx] });
  }
  groups.reverse();

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          header: () => (
            <View style={{ paddingTop: insets.top, backgroundColor: palette.background }}>
              <ScreenHeader
                title={categoryLabel}
                palette={palette}
                showBack={true}
                titleSize={SCREEN_HEADER.detailTitleSize}
                rightAction={
                  <HeaderEditButton
                    palette={palette}
                    onPress={() => router.push({ pathname: '/modals/budget-form', params: { budgetId: budget.id } })}
                  />
                }
              />
            </View>
          )
        }}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: getCompactScrollableBottomPadding(insets) }}>
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: HOME_SPACE.md }}>
          {/* Budget summary card */}
          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: HOME_RADIUS.card,
              padding: HOME_SPACE.xl,
              marginBottom: HOME_SPACE.lg,
              borderWidth: 1,
              borderColor: palette.divider,
            }}
          >
            <View style={{ marginBottom: HOME_SPACE.lg }}>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Monthly Budget
              </Text>
              <Text appWeight="medium" style={{ fontSize: 32, fontWeight: FONT_WEIGHT.bold, color: palette.text, marginTop: 4 }}>
                {formatCurrency(budget.amount, sym)}
              </Text>
            </View>

            <View style={{ gap: HOME_SPACE.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: HOME_TEXT.body, color: palette.textSecondary }}>Spent</Text>
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: isOver ? palette.negative : palette.text }}>
                  {formatCurrency(budget.spent, sym)}
                </Text>
              </View>

              <View style={{ height: 8, backgroundColor: palette.divider, borderRadius: 4, overflow: 'hidden' }}>
                <View
                  style={{
                    height: 8,
                    width: `${Math.min(Math.max(budget.percent, 0), 100)}%`,
                    backgroundColor: palette.budget,
                    borderRadius: 4,
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: HOME_TEXT.body, color: palette.textSecondary }}>
                  {isOver ? 'Over budget' : 'Remaining'}
                </Text>
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: isOver ? palette.negative : palette.positive }}>
                  {formatCurrency(Math.abs(budget.remaining), sym)}
                </Text>
              </View>
            </View>
          </View>

          {/* Transaction list */}
          {txnsLoading ? (
            <ActivityIndicator color={palette.brand} style={{ marginTop: HOME_SPACE.lg }} />
          ) : txns.length === 0 ? (
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, textAlign: 'center', paddingVertical: HOME_SPACE.xl }}>
              No transactions this month
            </Text>
          ) : (
            <View style={{ gap: HOME_SPACE.sm + 4, marginBottom: HOME_SPACE.md }}>
              {groups.map(({ dateKey, items }) => {
                const { date, label } = getRelativeDateLabel(dateKey + 'T00:00:00');
                return (
                  <View key={dateKey}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: HOME_SPACE.sm, paddingHorizontal: 2 }}>
                      <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>{date}</Text>
                      {label ? (
                        <>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginHorizontal: 5 }}>•</Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{label}</Text>
                        </>
                      ) : null}
                    </View>
                    <View style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' }}>
                      {items.map((tx, i) => (
                        <TouchableOpacity
                          key={tx.id}
                          delayPressIn={0}
                          activeOpacity={0.75}
                          onPress={() => router.push({ pathname: '/modals/add-transaction', params: { editId: tx.id } })}
                        >
                          <TransactionListItem
                            tx={tx}
                            sym={sym}
                            palette={palette}
                            isLast={i === items.length - 1}
                            categoryName={getCategoryFullDisplayName(tx.categoryId ?? '', ' › ')}
                            categoryIcon={getCategoryDisplayIcon(categoriesById, tx.categoryId)}
                            accountName={accountsById.get(tx.accountId)}
                            showAmountSign={false}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
