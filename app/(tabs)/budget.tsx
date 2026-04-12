import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenTitle } from '../../components/settings-ui';
import { FabButton } from '../../components/ui/FabButton';
import { formatCurrency } from '../../lib/derived';
import { CARD_PADDING, SCREEN_GUTTER } from '../../lib/design';
import {
  HOME_LAYOUT,
  HOME_RADIUS,
  HOME_SHADOW,
  HOME_SPACE,
  HOME_TEXT,
} from '../../lib/layoutTokens';
import { AppThemePalette, getThemePalette, resolveTheme } from '../../lib/theme';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import type { BudgetWithSpent, CreateBudgetInput } from '../../types';

export default function BudgetScreen() {
  const { budgets, load, add, remove } = useBudgetStore();
  const { categories } = useCategoriesStore();
  const { settings } = useUIStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));

  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const sym = settings.currencySymbol;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    load(settings.yearStart);
  }, [settings.yearStart]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(settings.yearStart);
    setRefreshing(false);
  };

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const overBudgetCount = budgets.filter((b) => b.spent > b.amount).length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: HOME_LAYOUT.fabContentBottomPadding }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
      >
        {/* Header */}
        <ScreenTitle title="Budgets" palette={palette} />

        {/* Summary */}
        {budgets.length > 0 && (
          <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: SCREEN_GUTTER }}>
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md }}>
              <View style={{ flex: 1, backgroundColor: palette.surface, borderRadius: HOME_RADIUS.card, padding: CARD_PADDING }}>
                <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, fontWeight: '600', letterSpacing: 0.5 }}>
                  BUDGETED
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text, marginTop: HOME_SPACE.xs }}>
                  {formatCurrency(totalBudgeted, sym)}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: palette.surface, borderRadius: HOME_RADIUS.card, padding: CARD_PADDING }}>
                <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, fontWeight: '600', letterSpacing: 0.5 }}>
                  SPENT
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: totalSpent > totalBudgeted ? palette.negative : palette.text,
                    marginTop: HOME_SPACE.xs,
                  }}
                >
                  {formatCurrency(totalSpent, sym)}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: palette.surface, borderRadius: HOME_RADIUS.card, padding: CARD_PADDING }}>
                <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, fontWeight: '600', letterSpacing: 0.5 }}>
                  LEFT
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: totalRemaining < 0 ? palette.negative : palette.positive,
                    marginTop: HOME_SPACE.xs,
                  }}
                >
                  {formatCurrency(Math.abs(totalRemaining), sym)}
                </Text>
              </View>
            </View>

            {overBudgetCount > 0 && (
              <View
                style={{
                  backgroundColor: palette.outBg,
                  borderRadius: HOME_RADIUS.small,
                  padding: HOME_SPACE.md,
                  marginTop: HOME_SPACE.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: HOME_SPACE.sm,
                }}
              >
                <Ionicons name="warning" size={16} color={palette.negative} />
                <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.negative, fontWeight: '500' }}>
                  {overBudgetCount} {overBudgetCount === 1 ? 'category' : 'categories'} over budget
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Budget list */}
        <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
          {budgets.length === 0 ? (
            <View
              style={{
                backgroundColor: palette.surface,
                borderRadius: HOME_RADIUS.card,
                padding: 32,
                alignItems: 'center',
              }}
            >
              <Ionicons name="pricetag-outline" size={48} color={palette.textMuted} />
              <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.sectionTitle, fontWeight: '500', marginTop: HOME_SPACE.md }}>
                No budgets yet
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.bodySmall, marginTop: HOME_SPACE.xs, textAlign: 'center' }}>
                Tap + to set spending limits per category
              </Text>
            </View>
          ) : (
            budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                sym={sym}
                palette={palette}
                onDelete={() => {
                  Alert.alert('Delete budget?', 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => remove(budget.id) },
                  ]);
                }}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <FabButton
        bottom={insets.bottom + HOME_LAYOUT.fabBottomOffset}
        palette={palette}
        backgroundColor={palette.budget}
        iconColor={palette.onBudget}
        onPress={() => setShowAddModal(true)}
      />

      <AddBudgetModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={async (data) => {
          await add(data, settings.yearStart);
          setShowAddModal(false);
        }}
        palette={palette}
        sym={sym}
        categories={categories}
      />
    </SafeAreaView>
  );
}

// ─── BudgetCard ───────────────────────────────────────────────────────────────

import type { Category } from '../../types';

function BudgetCard({
  budget,
  sym,
  palette,
  onDelete,
}: {
  budget: BudgetWithSpent;
  sym: string;
  palette: AppThemePalette;
  onDelete: () => void;
}) {
  const isOver = budget.spent > budget.amount;
  const isWarning = !isOver && budget.percent > 75;
  const barColor = isOver ? palette.negative : isWarning ? palette.negative : palette.brand;
  const barOpacity = isWarning ? 0.55 : 1;

  return (
    <TouchableOpacity
      onLongPress={onDelete}
      style={{
        backgroundColor: palette.surface,
        borderRadius: HOME_RADIUS.card,
        padding: HOME_SPACE.xl,
        marginBottom: HOME_SPACE.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: HOME_SPACE.md }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: HOME_RADIUS.small,
            backgroundColor: budget.categoryColor + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: HOME_SPACE.md,
          }}
        >
          <Ionicons name={budget.categoryIcon as any} size={18} color={budget.categoryColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '600', color: palette.text }}>
            {budget.categoryName}
          </Text>
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
            {budget.period === 'month' ? 'Monthly' : 'Yearly'} budget
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: isOver ? palette.negative : palette.text }}>
            {formatCurrency(budget.spent, sym)}
          </Text>
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
            of {formatCurrency(budget.amount, sym)}
          </Text>
        </View>
      </View>

      {/* Progress bar with ghost track */}
      <View style={{ height: 6, backgroundColor: palette.divider, borderRadius: 3, overflow: 'hidden' }}>
        <View
          style={{
            height: 6,
            width: `${Math.min(budget.percent, 100)}%`,
            backgroundColor: barColor,
            opacity: barOpacity,
            borderRadius: 3,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: HOME_SPACE.sm }}>
        <Text style={{ fontSize: HOME_TEXT.caption, color: isOver ? palette.negative : palette.textMuted }}>
          {isOver
            ? `${formatCurrency(budget.spent - budget.amount, sym)} over`
            : `${formatCurrency(budget.remaining, sym)} left`}
        </Text>
        <Text style={{ fontSize: HOME_TEXT.caption, color: isOver ? palette.negative : isWarning ? palette.negative : palette.textMuted }}>
          {Math.round(budget.percent)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── AddBudgetModal ───────────────────────────────────────────────────────────

function AddBudgetModal({
  visible,
  onClose,
  onSave,
  palette,
  sym,
  categories,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: CreateBudgetInput) => Promise<void>;
  palette: AppThemePalette;
  sym: string;
  categories: Category[];
}) {
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(false);

  const outCategories = categories.filter((c) => c.type !== 'in');

  const handleSave = async () => {
    const amount = parseFloat(amountStr);
    if (!amount || !categoryId) return;
    setLoading(true);
    try {
      await onSave({
        categoryId,
        amount,
        period,
        startDate: new Date().toISOString(),
      });
      setAmountStr('');
      setCategoryId('');
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  };

  const isReady = !!amountStr && !!categoryId;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: palette.scrim, justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: palette.background,
            borderTopLeftRadius: HOME_RADIUS.large,
            borderTopRightRadius: HOME_RADIUS.large,
            padding: HOME_SPACE.xxl,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: HOME_SPACE.xxxl }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>New Budget</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={palette.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: HOME_RADIUS.pill,
              paddingHorizontal: HOME_SPACE.xl,
              paddingVertical: HOME_SPACE.lg,
              marginBottom: HOME_SPACE.md,
            }}
          >
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: HOME_SPACE.sm }}>
              Budget amount
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, color: palette.textMuted, marginRight: HOME_SPACE.xs }}>{sym}</Text>
              <TextInput
                value={amountStr}
                onChangeText={setAmountStr}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={palette.textMuted}
                autoFocus
                style={{ fontSize: 24, fontWeight: '700', color: palette.brand, flex: 1 }}
              />
            </View>
          </View>

          {/* Category */}
          <View style={{ marginBottom: HOME_SPACE.md }}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: HOME_SPACE.sm }}>
              Category
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {outCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  style={{
                    paddingHorizontal: HOME_SPACE.lg,
                    paddingVertical: HOME_SPACE.sm,
                    borderRadius: HOME_RADIUS.small,
                    marginRight: HOME_SPACE.sm,
                    backgroundColor: categoryId === cat.id ? palette.brand : palette.surface,
                    borderWidth: 1,
                    borderColor: categoryId === cat.id ? palette.brand : palette.divider,
                  }}
                >
                  <Text
                    style={{
                      fontSize: HOME_TEXT.bodySmall,
                      color: categoryId === cat.id ? palette.surface : palette.textSecondary,
                    }}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Period */}
          <View style={{ flexDirection: 'row', gap: HOME_SPACE.md, marginBottom: HOME_SPACE.xxl }}>
            {(['month', 'year'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={{
                  flex: 1,
                  paddingVertical: HOME_SPACE.md,
                  borderRadius: HOME_RADIUS.small,
                  alignItems: 'center',
                  backgroundColor: period === p ? palette.brand : palette.surface,
                  borderWidth: 1,
                  borderColor: period === p ? palette.brand : palette.divider,
                }}
              >
                <Text
                  style={{
                    fontSize: HOME_TEXT.body,
                    fontWeight: '500',
                    color: period === p ? palette.surface : palette.textSecondary,
                  }}
                >
                  {p === 'month' ? 'Monthly' : 'Yearly'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!isReady || loading}
            style={{
              backgroundColor: isReady ? palette.brand : palette.textMuted,
              borderRadius: HOME_RADIUS.pill,
              paddingVertical: HOME_SPACE.xl,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: palette.surface, fontSize: HOME_TEXT.heroLabel, fontWeight: '600' }}>
              Add Budget
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
