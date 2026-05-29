import { HeaderMoreButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/AppText';
import { ActionStrip } from '../../components/ui/ActionStrip';
import { getCompactScrollableBottomPadding, SystemBottomGuard } from '@/components/ui/safeBottom';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  View,
  InteractionManager
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { ActionChip } from '../../components/ui/AppButton';
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
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { getBudgetTransactions } from '../../services/budget';
import type { Transaction } from '../../types';

export default function BudgetDetailScreen() {
  const { id, month } = useLocalSearchParams<{ id: string; month: string }>();
  const insets = useSafeAreaInsets();
  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const categories = useCategoriesStore((s) => s.categories);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accounts = useAccountsStore((s) => s.accounts);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const mutationVersion = useTransactionsStore((s) => s.mutationVersion);

  const [txns, setTxns] = useState<Transaction[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const panelProgress = useSharedValue(0);

  const toggleActions = () => {
    const nextShow = !showActions;
    setShowActions(nextShow);
    panelProgress.value = withTiming(nextShow ? 1 : 0, { duration: 220 });
  };
  const closePanel = () => {
    setShowActions(false);
    panelProgress.value = withTiming(0, { duration: 220 });
  };

  const actionsAnimatedStyle = useAnimatedStyle(() => ({
    height: panelProgress.value * 56,
    opacity: panelProgress.value,
  }));

  const budget = budgets.find((b) => b.id === id);

  useEffect(() => {
    if (month) {
      const task = InteractionManager.runAfterInteractions(() => {
        loadBudgets(month).catch(() => undefined);
      });
      return () => task.cancel();
    }
  }, [month, loadBudgets, mutationVersion]);

  useEffect(() => {
    if (!budget || !month) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setTxnsLoading(true);
      getBudgetTransactions(budget.categoryId, month)
        .then(setTxns)
        .catch(() => undefined)
        .finally(() => setTxnsLoading(false));
    });
    return () => task.cancel();
  }, [budget?.categoryId, month, mutationVersion]);

  if (!budget) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={palette.brand} />
      </View>
    );
  }

  const isOver = budget.amount > 0 && budget.remaining < 0;
  const categoryLabel = getCategoryFullDisplayName(budget.categoryId, ' › ');

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
                  <HeaderMoreButton palette={palette} isOpen={showActions} onPress={toggleActions} />
                }
              />
            </View>
          )
        }}
      />

      <View style={{ flex: 1 }}>
        {/* Action strip */}
        <ActionStrip palette={palette} animatedStyle={actionsAnimatedStyle}>
          <ActionChip
            icon="edit-2"
            label="Edit"
            palette={palette}
            onPress={() => {
              closePanel();
              router.push({ pathname: '/modals/budget-form', params: { budgetId: budget.id } });
            }}
          />
        </ActionStrip>

        {/* Hero card — sticky outside ScrollView */}
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: HOME_SPACE.md }}>
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
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: isOver ? palette.numberNegative : palette.text }}>
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
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: isOver ? palette.numberNegative : palette.numberPositive }}>
                  {formatCurrency(Math.abs(budget.remaining), sym)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Scrollable transaction list */}
        <ScrollView
          style={{ flex: 1 }}
          onScrollBeginDrag={closePanel}
          contentContainerStyle={{ paddingBottom: getCompactScrollableBottomPadding(insets) }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
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
                          <TransactionListItem
                            key={tx.id}
                            tx={tx}
                            sym={sym}
                            palette={palette}
                            isLast={i === items.length - 1}
                            categoryName={getCategoryFullDisplayName(tx.categoryId ?? '', ' › ')}
                            categoryIcon={getCategoryDisplayIcon(categoriesById, tx.categoryId)}
                            accountName={accountsById.get(tx.accountId)}
                            showAmountSign={false}
                            onPress={() => router.push({ pathname: '/modals/add-transaction', params: { editId: tx.id } })}
                          />
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
      <SystemBottomGuard />
    </View>
  );
}

