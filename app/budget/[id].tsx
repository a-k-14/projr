import { AppIcon } from '@/components/ui/AppIcon';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatCurrency } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import {
  ACTIVITY_LAYOUT,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_TEXT,
  PROGRESS,
} from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';

export default function BudgetDetailScreen() {
  const { id, month } = useLocalSearchParams<{ id: string; month: string }>();
  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();

  const budget = budgets.find((b) => b.id === id);

  useEffect(() => {
    if (month) {
      loadBudgets(month).catch(() => undefined);
    }
  }, [month, loadBudgets]);

  if (!budget) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={palette.brand} />
      </View>
    );
  }

  const isOver = budget.amount > 0 && budget.remaining < 0;
  const categoryLabel = getCategoryFullDisplayName(budget.categoryId, ' › ');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScreenHeader 
        title={categoryLabel}
        palette={palette}
        showBack={true}
        rightAction={
          <TouchableOpacity
            delayPressIn={0}
            onPress={() => router.push({ pathname: '/modals/budget-form', params: { editId: budget.id } })}
            style={{
              backgroundColor: palette.brandSoft,
              borderWidth: 1.5,
              borderColor: palette.brand,
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '500', color: palette.brand }}>
              Edit
            </Text>
          </TouchableOpacity>
        }
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: HOME_SPACE.md }}>
          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: HOME_RADIUS.card,
              padding: HOME_SPACE.xl,
              marginBottom: HOME_SPACE.md,
              borderWidth: 1,
              borderColor: palette.divider,
            }}
          >
            <View style={{ marginBottom: HOME_SPACE.lg }}>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Monthly Budget
              </Text>
              <Text appWeight="medium" style={{ fontSize: 32, fontWeight: '700', color: palette.text, marginTop: 4 }}>
                {formatCurrency(budget.amount, sym)}
              </Text>
            </View>

            <View style={{ gap: HOME_SPACE.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: HOME_TEXT.body, color: palette.textSecondary }}>Spent</Text>
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: isOver ? palette.negative : palette.text }}>
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
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: isOver ? palette.negative : palette.positive }}>
                  {formatCurrency(Math.abs(budget.remaining), sym)}
                </Text>
              </View>
            </View>
          </View>
          
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginLeft: 4, marginBottom: 12 }}>
            Transactions in this category for {month} will appear here.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
