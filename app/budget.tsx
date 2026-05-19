import { HeaderAddButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetMonthField, BudgetMonthSheet, formatBudgetMonthLabel, shiftBudgetMonth } from '../components/budget-ui';
import { EmptyStateCard } from '../components/ui/EmptyStateCard';
import { FinanceEmptyMascot } from '../components/ui/FinanceEmptyMascot';
import { BudgetListCard, BudgetOverviewCard } from '../components/ui/cards';
import { getScrollableBottomPadding, SystemBottomGuard } from '../components/ui/safeBottom';
import { formatCurrency } from '../lib/derived';
import { SCREEN_GUTTER } from '../lib/design';
import { ACTIVITY_LAYOUT, HOME_SPACE } from '../lib/layoutTokens';
import { getCategoryDisplayIcon } from '../lib/category-utils';
import { registerTabReset } from '../lib/tabResetRegistry';
import { useAppTheme } from '../lib/theme';
import { useBudgetStore } from '../stores/useBudgetStore';
import { useCategoriesStore } from '../stores/useCategoriesStore';
import { useUIStore } from '../stores/useUIStore';

function monthStartIso(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).toISOString();
}

import { ScreenScaffold } from '../components/ui/ScreenScaffold';

export default function BudgetScreen() {
  const isFocused = useIsFocused();
  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);
  const categories = useCategoriesStore((s) => s.categories);
  const categoriesLoaded = useCategoriesStore((s) => s.isLoaded);
  const loadCategories = useCategoriesStore((s) => s.load);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const [selectedMonth, setSelectedMonth] = useState(() => monthStartIso(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const [showMonthSheet, setShowMonthSheet] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollToTop = useCallback((animated: boolean) => {
    scrollViewRef.current?.scrollTo({ y: 0, animated });
  }, []);

  const resetBudgetView = useCallback((animated: boolean) => {
    setSelectedMonth(monthStartIso(new Date()));
    setShowMonthSheet(false);
    scrollToTop(animated);
  }, [scrollToTop]);

  useEffect(() => {
    return registerTabReset('budget', ({ mode, animated }) => {
      if (mode === 'background') {
        scrollToTop(animated);
      } else {
        resetBudgetView(animated);
      }
    });
  }, [resetBudgetView, scrollToTop]);

  useEffect(() => {
    if (!categoriesLoaded) loadCategories().catch(() => undefined);
  }, [categoriesLoaded, loadCategories]);

  useEffect(() => {
    if (!isFocused) return;
    loadBudgets(selectedMonth).catch(() => undefined);
  }, [isFocused, loadBudgets, selectedMonth]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBudgets(selectedMonth);
    setRefreshing(false);
  };

  const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const overBudgetCount = budgets.filter((budget) => budget.remaining < 0).length;

  const monthBudgets = useMemo(
    () =>
      budgets.slice().sort((a, b) => {
        const overDelta = Number(b.remaining < 0) - Number(a.remaining < 0);
        if (overDelta !== 0) return overDelta;
        return getCategoryFullDisplayName(a.categoryId, ' › ').localeCompare(
          getCategoryFullDisplayName(b.categoryId, ' › '),
          'en',
          { sensitivity: 'base' },
        );
      }),
    [budgets, getCategoryFullDisplayName],
  );

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Budgets"
        palette={palette}
        showBack={true}
        onBack={() => router.replace('/')}
        rightAction={
          <HeaderAddButton palette={palette} onPress={() => router.push('/modals/budget-form')} />
        }
      />
      <ScrollView
        ref={scrollViewRef}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
        contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets) }}
      >
        <View style={{ paddingTop: ACTIVITY_LAYOUT.headerPaddingTop, paddingHorizontal: SCREEN_GUTTER, marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom }}>
          <BudgetOverviewCard
            palette={palette}
            monthLabel={formatBudgetMonthLabel(selectedMonth)}
            totalBudgeted={totalBudgeted}
            totalSpent={totalSpent}
            totalRemaining={totalRemaining}
            overBudgetCount={overBudgetCount}
            sym={sym}
          />
        </View>

        <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom }}>
          <BudgetMonthField
            value={selectedMonth}
            palette={palette}
            onPress={() => setShowMonthSheet(true)}
            onPrev={() => setSelectedMonth(prev => shiftBudgetMonth(prev, -1))}
            onNext={() => setSelectedMonth(prev => shiftBudgetMonth(prev, 1))}
          />
        </View>

        {monthBudgets.length > 0 ? (
          <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
            {monthBudgets.map((budget) => (
              <BudgetListCard
                key={budget.id}
                budget={budget}
                sym={sym}
                palette={palette}
                categoryLabel={getCategoryFullDisplayName(budget.categoryId, ' › ')}
                categoryIcon={getCategoryDisplayIcon(categoriesById, budget.categoryId) ?? budget.categoryIcon}
                onPress={() =>
                  router.push({
                    pathname: '/budget/[id]',
                    params: { id: budget.id, month: selectedMonth }
                  })
                }
              />
            ))}
          </View>
        ) : (
          <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
            <EmptyStateCard
              palette={palette}
              title={`No budgets for ${formatBudgetMonthLabel(selectedMonth)}`}
              subtitle="Add a monthly subcategory budget and choose whether it repeats automatically."
              illustration={<FinanceEmptyMascot palette={palette} variant="budget" />}
            />
          </View>
        )}
      </ScrollView>

      <BudgetMonthSheet
        visible={showMonthSheet}
        palette={palette}
        selectedMonth={selectedMonth}
        onSelect={setSelectedMonth}
        onClose={() => setShowMonthSheet(false)}
      />
    </ScreenScaffold>
  );
}

