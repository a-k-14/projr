import { Feather, Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetMonthField, BudgetMonthSheet, formatBudgetMonthLabel, shiftBudgetMonth } from '../../components/budget-ui';
import { ScreenTitle } from '../../components/settings-ui';
import { FabButton } from '../../components/ui/FabButton';
import { formatCurrency } from '../../lib/derived';
import { CARD_PADDING, SCREEN_GUTTER } from '../../lib/design';
import { ACTIVITY_LAYOUT, HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT, getFabBottomOffset } from '../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';
import type { BudgetWithSpent } from '../../types';

function monthStartIso(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).toISOString();
}

function isEmojiIcon(icon?: string) {
  return !!icon && !/^[a-z-]+$/.test(icon);
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
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
        contentContainerStyle={{ paddingBottom: HOME_LAYOUT.fabContentBottomPadding }}
      >
        <ScreenTitle title="Budget" palette={palette} />

        <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: HOME_SPACE.md }}>
          <BudgetMonthField
            value={selectedMonth}
            palette={palette}
            onPress={() => setShowMonthSheet(true)}
            onPrev={() => setSelectedMonth((current) => shiftBudgetMonth(current, -1))}
            onNext={() => setSelectedMonth((current) => shiftBudgetMonth(current, 1))}
          />
        </View>

        {monthBudgets.length > 0 ? (
          <>
            <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: HOME_SPACE.md }}>
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
          </>
        ) : (
          <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
            <View style={[styles.emptyCard, { backgroundColor: palette.surface }]}>
              <Ionicons name="pie-chart-outline" size={48} color={palette.textMuted} />
              <Text style={{ color: palette.text, fontSize: HOME_TEXT.sectionTitle, fontWeight: '600', marginTop: HOME_SPACE.md }}>
                No budgets for {formatBudgetMonthLabel(selectedMonth)}
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.bodySmall, marginTop: HOME_SPACE.xs, textAlign: 'center' }}>
                Add a monthly subcategory budget and choose whether it repeats automatically.
              </Text>
            </View>
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
  const isOver = totalRemaining < 0;
  const progress = totalBudgeted > 0 ? Math.min(totalSpent / totalBudgeted, 1) : 0;
  const progressColor = palette.budget;
  const usageText = totalBudgeted > 0 ? `${Math.round((totalSpent / totalBudgeted) * 100)}% used` : 'No budget set';
  const statusLabel = isOver ? 'Over budget' : 'Left to spend';
  const statusValue = isOver ? `${formatCurrency(Math.abs(totalRemaining), sym)} overspent` : `${formatCurrency(totalRemaining, sym)} left`;

  return (
    <View style={[styles.overviewCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
      <View style={[styles.overviewGlowLarge, { backgroundColor: palette.budgetSoft }]} />
      <View style={[styles.overviewGlowSmall, { backgroundColor: palette.budgetSoft }]} />

      <View style={styles.overviewHeader}>
        <View>
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: '400' }}>
            Budget overview
          </Text>
          <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, marginTop: HOME_SPACE.xs }}>
            {monthLabel}
          </Text>
        </View>
        <View style={[styles.overviewPill, { backgroundColor: palette.budgetSoft }]}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: palette.budget }}>
            {monthBudgetsLabel(overBudgetCount)}
          </Text>
        </View>
      </View>

      <View style={styles.overviewMetrics}>
        <View style={styles.overviewMetricBlock}>
          <Text style={styles.metricLabel(palette)}>Budgeted</Text>
          <Text style={styles.metricValue(palette, palette.text)}>{formatCurrency(totalBudgeted, sym)}</Text>
        </View>
        <View style={styles.overviewMetricDivider(palette)} />
        <View style={styles.overviewMetricBlock}>
          <Text style={styles.metricLabel(palette)}>Spent</Text>
          <Text style={styles.metricValue(palette, isOver ? palette.negative : palette.text)}>{formatCurrency(totalSpent, sym)}</Text>
        </View>
      </View>

      <View style={{ marginTop: HOME_SPACE.lg }}>
        <View style={styles.progressRow}>
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>{usageText}</Text>
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>{totalBudgeted > 0 ? `${Math.round(progress * 100)}%` : '0%'}</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: palette.budgetSoft }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: progressColor }]} />
        </View>
      </View>

      <View style={[styles.overviewFooterLine, { marginTop: HOME_SPACE.lg }]}>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '500', color: palette.textMuted }}>
          {statusLabel}
        </Text>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '500', color: isOver ? palette.negative : palette.budget }}>
          {statusValue}
        </Text>
      </View>
    </View>
  );
}

function monthBudgetsLabel(overBudgetCount: number) {
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
  const isOver = budget.remaining < 0;
  const progressColor = palette.budget;

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={[styles.budgetCard, { backgroundColor: palette.surface }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: HOME_SPACE.md }}>
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
            <Text style={{ fontSize: 18 }}>{budget.categoryIcon}</Text>
          ) : (
            <Feather name={budget.categoryIcon as keyof typeof Feather.glyphMap} size={17} color={palette.iconTint} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
            {categoryLabel}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary, marginTop: 1 }}>
            {budget.repeat ? 'Repeats monthly' : `One-time • ${formatBudgetMonthLabel(budget.startDate)}`}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
          <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text }}>
            {formatCurrency(budget.amount, sym)}
          </Text>
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary, marginTop: 1 }}>
            spent {formatCurrency(budget.spent, sym)}
          </Text>
        </View>
      </View>

      <View style={{ height: 6, backgroundColor: palette.divider, borderRadius: 999, overflow: 'hidden' }}>
        <View
          style={{
            height: 6,
            width: `${Math.min(Math.max(budget.percent, 0), 100)}%`,
            backgroundColor: progressColor,
            borderRadius: 999,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: HOME_SPACE.sm }}>
        <Text style={{ fontSize: HOME_TEXT.caption, color: isOver ? palette.negative : palette.textMuted }}>
          {isOver ? `${formatCurrency(Math.abs(budget.remaining), sym)} over` : `${formatCurrency(budget.remaining, sym)} left`}
        </Text>
        <Text style={{ fontSize: HOME_TEXT.caption, color: isOver ? palette.negative : palette.textMuted }}>
          {Math.round(budget.percent)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = {
  overviewCard: {
    borderRadius: HOME_RADIUS.card,
    padding: CARD_PADDING,
    overflow: 'hidden' as const,
    position: 'relative' as const,
    borderWidth: 1,
  },
  overviewGlowLarge: {
    position: 'absolute' as const,
    width: 140,
    height: 140,
    borderRadius: 999,
    top: -42,
    right: -34,
    opacity: 0.24,
  },
  overviewGlowSmall: {
    position: 'absolute' as const,
    width: 76,
    height: 76,
    borderRadius: 999,
    bottom: -22,
    right: 28,
    opacity: 0.12,
  },
  overviewHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    gap: HOME_SPACE.md,
  },
  overviewPill: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  overviewMetrics: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    marginTop: HOME_SPACE.lg,
    borderRadius: HOME_RADIUS.small,
    overflow: 'hidden' as const,
  },
  overviewMetricBlock: {
    flex: 1,
    minWidth: 0,
  },
  overviewMetricDivider: (palette: AppThemePalette) => ({
    width: 1,
    backgroundColor: palette.divider,
    marginHorizontal: HOME_SPACE.md,
  }),
  progressRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: HOME_SPACE.xs + 2,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: 10,
    borderRadius: 999,
  },
  overviewFooterLine: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  emptyCard: {
    borderRadius: HOME_RADIUS.card,
    padding: 32,
    alignItems: 'center' as const,
  },
  budgetCard: {
    borderRadius: HOME_RADIUS.card,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 14,
    marginBottom: HOME_SPACE.md,
  },
  metricLabel: (palette: AppThemePalette) => ({
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  }),
  metricValue: (palette: AppThemePalette, color: string) => ({
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800' as const,
    color,
    marginTop: HOME_SPACE.xs + 2,
  }),
};
