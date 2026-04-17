import { Feather, Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetMonthField, BudgetMonthSheet, formatBudgetMonthLabel, shiftBudgetMonth } from '../../components/budget-ui';
import { ScreenTitle } from '../../components/settings-ui';
import { EmptyStateCard } from '../../components/ui/EmptyStateCard';
import { FabButton } from '../../components/ui/FabButton';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { OverviewHeroCard } from '../../components/ui/OverviewHeroCard';
import { formatCurrency } from '../../lib/derived';
import { CARD_PADDING, SCREEN_GUTTER } from '../../lib/design';
import { ACTIVITY_LAYOUT, HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT, PROGRESS, getFabBottomOffset } from '../../lib/layoutTokens';
import { isEmojiIcon } from '../../lib/ui-format';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';
import type { BudgetWithSpent } from '../../types';

function monthStartIso(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).toISOString();
}

export default function BudgetScreen() {
  const isFocused = useIsFocused();
  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);
  const categoriesLoaded = useCategoriesStore((s) => s.isLoaded);
  const loadCategories = useCategoriesStore((s) => s.load);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const storeTransactions = useTransactionsStore((s) => s.transactions);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [selectedMonth, setSelectedMonth] = useState(() => monthStartIso(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const [showMonthSheet, setShowMonthSheet] = useState(false);

  useEffect(() => {
    if (!categoriesLoaded) loadCategories().catch(() => undefined);
  }, [categoriesLoaded, loadCategories]);

  useEffect(() => {
    loadBudgets(selectedMonth).catch(() => undefined);
  }, [loadBudgets, selectedMonth]);

  useEffect(() => {
    if (!isFocused) return;
    loadBudgets(selectedMonth).catch(() => undefined);
  }, [isFocused, loadBudgets, selectedMonth, storeTransactions]);

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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScreenTitle title="Budget" palette={palette} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
        contentContainerStyle={{ paddingBottom: HOME_LAYOUT.fabContentBottomPadding }}
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
            onPrev={() => setSelectedMonth((current) => shiftBudgetMonth(current, -1))}
            onNext={() => setSelectedMonth((current) => shiftBudgetMonth(current, 1))}
          />
        </View>

        {monthBudgets.length > 0 ? (
          <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
            {monthBudgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                sym={sym}
                palette={palette}
                categoryLabel={getCategoryFullDisplayName(budget.categoryId, ' › ')}
                onPress={() =>
                  router.push({
                    pathname: '/budget/[id]',
                    params: { id: budget.id, month: selectedMonth },
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

      <FabButton
        bottom={getFabBottomOffset(insets.bottom)}
        palette={palette}
        backgroundColor={palette.budget}
        iconColor={palette.onBudget}
        onPress={() =>
          router.push({
            pathname: '/modals/budget-form',
            params: { month: selectedMonth },
          })
        }
      />
      <BudgetMonthSheet
        visible={showMonthSheet}
        palette={palette}
        selectedMonth={selectedMonth}
        onSelect={setSelectedMonth}
        onClose={() => setShowMonthSheet(false)}
        hasNavBar
      />
    </SafeAreaView>
  );
}

function BudgetOverviewCard({
  palette,
  monthLabel,
  totalBudgeted,
  totalSpent,
  totalRemaining,
  overBudgetCount,
  sym,
}: {
  palette: AppThemePalette;
  monthLabel: string;
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  overBudgetCount: number;
  sym: string;
}) {
  const hasBudgetSet = totalBudgeted > 0;
  const isOver = hasBudgetSet && totalRemaining < 0;
  const progress = totalBudgeted > 0 ? Math.min(totalSpent / totalBudgeted, 1) : 0;
  const usageText = totalBudgeted > 0 ? `${Math.round((totalSpent / totalBudgeted) * 100)}% used` : 'Not set';
  const statusLabel = hasBudgetSet ? (isOver ? 'Over budget' : 'Left to spend') : 'Not set';
  const statusValue = hasBudgetSet
    ? formatCurrency(Math.abs(totalRemaining), sym)
    : formatCurrency(totalSpent, sym);

  return (
    <OverviewHeroCard
      palette={palette}
      eyebrow="Budget overview"
      title={monthLabel}
      badgeLabel={monthBudgetsLabel(totalBudgeted, overBudgetCount)}
      badgeBg={palette.budgetSoft}
      badgeColor={palette.budget}
      metrics={[
        { key: 'budgeted', label: 'Budgeted', value: formatCurrency(totalBudgeted, sym), valueColor: palette.text },
        { key: 'spent', label: 'Spent', value: formatCurrency(totalSpent, sym), valueColor: isOver ? palette.negative : palette.text },
      ]}
      progressLabelLeft={usageText}
      progressLabelRight=""
      progressPercent={progress * 100}
      progressColor={palette.budget}
      progressTrackColor={palette.budgetSoft}
      footerLabel={statusLabel}
      footerValue={statusValue}
      footerValueColor={isOver ? palette.negative : palette.budget}
      decorativeColor={palette.budgetSoft}
    />
  );
}

function monthBudgetsLabel(totalBudgeted: number, overBudgetCount: number) {
  if (totalBudgeted <= 0) return 'Not set';
  return overBudgetCount > 0 ? 'Overspent' : 'On track';
}

function BudgetCard({
  budget,
  sym,
  palette,
  categoryLabel,
  onPress,
}: {
  budget: BudgetWithSpent;
  sym: string;
  palette: AppThemePalette;
  categoryLabel: string;
  onPress: () => void;
}) {
  const isOver = budget.amount > 0 && budget.remaining < 0;
  const progressColor = palette.budget;

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={[styles.budgetCard, { backgroundColor: palette.surface }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: HOME_LAYOUT.listIconSize,
            height: HOME_LAYOUT.listIconSize,
            borderRadius: HOME_RADIUS.small,
            backgroundColor: palette.inputBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: HOME_SPACE.sm + 2,
          }}
        >
          {isEmojiIcon(budget.categoryIcon) ? (
            <Text style={{ fontSize: HOME_TEXT.rowLabel }}>{budget.categoryIcon}</Text>
          ) : (
            <Feather name={budget.categoryIcon as keyof typeof Feather.glyphMap} size={17} color={palette.iconTint} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
              {categoryLabel}
            </Text>
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text, textAlign: 'right' }}>
              {formatCurrency(budget.amount, sym)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 1 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>
              {budget.repeat ? 'Repeats monthly' : `One-time • ${formatBudgetMonthLabel(budget.startDate)}`}
            </Text>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary, textAlign: 'right' }}>
              Spent {formatCurrency(budget.spent, sym)}
            </Text>
          </View>
          <View
            style={{
              height: PROGRESS.cardHeight,
              backgroundColor: palette.divider,
              borderRadius: PROGRESS.radius,
              marginTop: 6,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: PROGRESS.cardHeight,
                width: `${Math.min(Math.max(budget.percent, 0), 100)}%`,
                backgroundColor: progressColor,
                borderRadius: PROGRESS.radius,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: HOME_SPACE.sm }}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: isOver ? palette.negative : palette.textMuted }}>
              {Math.round(budget.percent)}%
            </Text>
            <Text style={{ fontSize: HOME_TEXT.caption, color: isOver ? palette.negative : palette.textMuted }}>
              {isOver ? formatCurrency(Math.abs(budget.remaining), sym) : formatCurrency(budget.remaining, sym)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = {
  budgetCard: {
    borderRadius: HOME_RADIUS.card,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 14,
    marginBottom: HOME_SPACE.md,
  },
};
