import { Feather, Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenTitle } from '../../components/settings-ui';
import { FabButton } from '../../components/ui/FabButton';
import { formatCurrency, parseFormattedNumber } from '../../lib/derived';
import { CARD_PADDING, SCREEN_GUTTER } from '../../lib/design';
import { ACTIVITY_LAYOUT, HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT, getFabBottomOffset } from '../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import type { BudgetWithSpent, Category, CreateBudgetInput } from '../../types';

function monthStartIso(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).toISOString();
}

function shiftMonth(iso: string, delta: number) {
  const date = new Date(iso);
  return new Date(date.getFullYear(), date.getMonth() + delta, 1, 0, 0, 0, 0).toISOString();
}

function formatMonthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function isEmojiIcon(icon?: string) {
  return !!icon && !/^[a-z-]+$/.test(icon);
}

function fieldLabelStyle(palette: AppThemePalette) {
  return {
    fontSize: 11,
    fontWeight: '700' as const,
    color: palette.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  };
}

function iconBoxStyle(palette: AppThemePalette) {
  return {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: palette.inputBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
}

export default function BudgetScreen() {
  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);
  const addBudget = useBudgetStore((s) => s.add);
  const updateBudget = useBudgetStore((s) => s.update);
  const removeBudget = useBudgetStore((s) => s.remove);
  const categories = useCategoriesStore((s) => s.categories);
  const categoriesLoaded = useCategoriesStore((s) => s.isLoaded);
  const loadCategories = useCategoriesStore((s) => s.load);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [selectedMonth, setSelectedMonth] = useState(() => monthStartIso(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const [editorBudget, setEditorBudget] = useState<BudgetWithSpent | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    if (!categoriesLoaded) loadCategories().catch(() => undefined);
  }, [categoriesLoaded, loadCategories]);

  useEffect(() => {
    loadBudgets(selectedMonth).catch(() => undefined);
  }, [loadBudgets, selectedMonth]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBudgets(selectedMonth);
    setRefreshing(false);
  };

  const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const overBudgetCount = budgets.filter((budget) => budget.remaining < 0).length;

  const outSubcategories = useMemo(
    () =>
      categories
        .filter((category) => category.parentId && category.type !== 'in')
        .slice()
        .sort((a, b) => {
          const aLabel = getCategoryFullDisplayName(a.id, ' › ');
          const bLabel = getCategoryFullDisplayName(b.id, ' › ');
          return aLabel.localeCompare(bLabel, 'en', { sensitivity: 'base' });
        }),
    [categories, getCategoryFullDisplayName],
  );

  const handleDelete = (budgetId: string) => {
    Alert.alert('Delete budget?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeBudget(budgetId);
          if (editorBudget?.id === budgetId) {
            setShowEditor(false);
            setEditorBudget(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
        contentContainerStyle={{ paddingBottom: HOME_LAYOUT.fabContentBottomPadding }}
      >
        <ScreenTitle title="Budget" palette={palette} />

        <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: HOME_SPACE.md }}>
          <View style={[styles.monthBar, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <TouchableOpacity
              onPress={() => setSelectedMonth((value) => shiftMonth(value, -1))}
              style={[styles.monthArrow, { borderRightColor: palette.divider }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={14} color={palette.text} />
            </TouchableOpacity>
            <View style={styles.monthCenter}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{formatMonthLabel(selectedMonth)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedMonth((value) => shiftMonth(value, 1))}
              style={[styles.monthArrow, { borderLeftColor: palette.divider }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-forward" size={14} color={palette.text} />
            </TouchableOpacity>
          </View>
        </View>

        {budgets.length > 0 ? (
          <>
            <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: HOME_SPACE.md }}>
              <View style={{ flexDirection: 'row', gap: HOME_SPACE.sm }}>
                <BudgetSummaryCell label="Budgeted" value={formatCurrency(totalBudgeted, sym)} palette={palette} />
                <BudgetSummaryCell
                  label="Spent"
                  value={formatCurrency(totalSpent, sym)}
                  palette={palette}
                  tone={totalSpent > totalBudgeted ? 'negative' : 'default'}
                />
                <BudgetSummaryCell
                  label={totalRemaining < 0 ? 'Over' : 'Left'}
                  value={formatCurrency(Math.abs(totalRemaining), sym)}
                  palette={palette}
                  tone={totalRemaining < 0 ? 'negative' : 'positive'}
                />
              </View>
            </View>

            {overBudgetCount > 0 ? (
              <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: HOME_SPACE.md }}>
                <View style={[styles.warningBox, { backgroundColor: palette.outBg }]}>
                  <Ionicons name="warning" size={16} color={palette.negative} />
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.negative, fontWeight: '500' }}>
                    {overBudgetCount} {overBudgetCount === 1 ? 'budget' : 'budgets'} over in {formatMonthLabel(selectedMonth)}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
              {budgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  sym={sym}
                  palette={palette}
                  categoryLabel={getCategoryFullDisplayName(budget.categoryId, ' › ')}
                  onPress={() => {
                    setEditorBudget(budget);
                    setShowEditor(true);
                  }}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
            <View style={[styles.emptyCard, { backgroundColor: palette.surface }]}>
              <Ionicons name="pie-chart-outline" size={48} color={palette.textMuted} />
              <Text style={{ color: palette.text, fontSize: HOME_TEXT.sectionTitle, fontWeight: '600', marginTop: HOME_SPACE.md }}>
                No budgets for {formatMonthLabel(selectedMonth)}
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
        onPress={() => {
          setEditorBudget(null);
          setShowEditor(true);
        }}
      />

      <BudgetEditorModal
        visible={showEditor}
        budget={editorBudget}
        selectedMonth={selectedMonth}
        categories={outSubcategories}
        palette={palette}
        sym={sym}
        getCategoryLabel={(id) => getCategoryFullDisplayName(id, ' › ')}
        onClose={() => {
          setShowEditor(false);
          setEditorBudget(null);
        }}
        onDelete={editorBudget ? () => handleDelete(editorBudget.id) : undefined}
        onSave={async (data) => {
          if (editorBudget) {
            await updateBudget(editorBudget.id, data, selectedMonth);
          } else {
            await addBudget(data, selectedMonth);
          }
          setShowEditor(false);
          setEditorBudget(null);
        }}
      />
    </SafeAreaView>
  );
}

function BudgetSummaryCell({
  label,
  value,
  palette,
  tone = 'default',
}: {
  label: string;
  value: string;
  palette: AppThemePalette;
  tone?: 'default' | 'positive' | 'negative';
}) {
  const color = tone === 'positive' ? palette.positive : tone === 'negative' ? palette.negative : palette.text;
  return (
    <View style={[styles.summaryCell, { backgroundColor: palette.surface }]}>
      <Text style={{ fontSize: 11, color: palette.textMuted, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color, marginTop: HOME_SPACE.xs }}>{value}</Text>
    </View>
  );
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
  const isWarning = !isOver && budget.percent >= 75;
  const progressColor = isOver ? palette.negative : isWarning ? palette.negative : palette.brand;

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
            {budget.repeat ? 'Repeats monthly' : `One-time • ${formatMonthLabel(budget.startDate)}`}
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

function BudgetEditorModal({
  visible,
  budget,
  selectedMonth,
  categories,
  palette,
  sym,
  getCategoryLabel,
  onClose,
  onDelete,
  onSave,
}: {
  visible: boolean;
  budget: BudgetWithSpent | null;
  selectedMonth: string;
  categories: Category[];
  palette: AppThemePalette;
  sym: string;
  getCategoryLabel: (id: string) => string;
  onClose: () => void;
  onDelete?: () => void;
  onSave: (data: CreateBudgetInput) => Promise<void>;
}) {
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startMonth, setStartMonth] = useState(selectedMonth);
  const [repeat, setRepeat] = useState(true);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAmountStr(budget ? String(budget.amount) : '');
    setCategoryId(budget?.categoryId ?? '');
    setStartMonth(budget?.startDate ?? selectedMonth);
    setRepeat(budget?.repeat ?? true);
    setShowCategoryPicker(false);
  }, [budget, selectedMonth, visible]);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const canSave = !!categoryId && Number(parseFormattedNumber(amountStr || '0')) > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setLoading(true);
    try {
      await onSave({
        categoryId,
        amount: Number(parseFormattedNumber(amountStr)),
        period: 'month',
        startDate: startMonth,
        repeat,
      });
    } catch (error) {
      Alert.alert('Error', String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: palette.scrim, justifyContent: 'flex-end' }}>
        <View style={[styles.editorShell, { backgroundColor: palette.background }]}>
          <View style={styles.editorHeader}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>
              {budget ? 'Edit Budget' : 'New Budget'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={palette.textMuted} />
            </TouchableOpacity>
          </View>

          {budget ? (
            <View style={[styles.detailStrip, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  This Month
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text, marginTop: 2 }}>
                  {formatCurrency(budget.spent, sym)} spent
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: budget.remaining < 0 ? palette.negative : palette.textSecondary }}>
                {budget.remaining < 0
                  ? `${formatCurrency(Math.abs(budget.remaining), sym)} over`
                  : `${formatCurrency(budget.remaining, sym)} left`}
              </Text>
            </View>
          ) : null}

          <View style={{ gap: HOME_SPACE.md }}>
            <View style={[styles.fieldCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={fieldLabelStyle(palette)}>Budget amount</Text>
              <TextInput
                value={amountStr}
                onChangeText={setAmountStr}
                keyboardType="numeric"
                placeholder={`0 ${sym}`.trim()}
                placeholderTextColor={palette.textMuted}
                style={{ fontSize: 20, fontWeight: '700', color: palette.text, padding: 0, marginTop: 6 }}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setShowCategoryPicker((value) => !value)}
              style={[styles.fieldCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}
            >
              <Text style={fieldLabelStyle(palette)}>Subcategory</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                {selectedCategory ? (
                  <>
                    <View style={iconBoxStyle(palette)}>
                      {isEmojiIcon(selectedCategory.icon) ? (
                        <Text style={{ fontSize: 16 }}>{selectedCategory.icon}</Text>
                      ) : (
                        <Feather name={selectedCategory.icon as keyof typeof Feather.glyphMap} size={15} color={palette.iconTint} />
                      )}
                    </View>
                    <Text style={{ flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
                      {getCategoryLabel(selectedCategory.id)}
                    </Text>
                  </>
                ) : (
                  <Text style={{ flex: 1, fontSize: 15, color: palette.textMuted }}>Choose a subcategory</Text>
                )}
                <Ionicons name={showCategoryPicker ? 'chevron-up' : 'chevron-down'} size={16} color={palette.textMuted} />
              </View>
            </TouchableOpacity>

            {showCategoryPicker ? (
              <View style={[styles.categoryPicker, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }}>
                  {categories.map((category, index) => (
                    <TouchableOpacity
                      key={category.id}
                      onPress={() => {
                        setCategoryId(category.id);
                        setShowCategoryPicker(false);
                      }}
                      activeOpacity={0.75}
                      style={{
                        minHeight: 56,
                        paddingHorizontal: CARD_PADDING,
                        paddingVertical: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderBottomWidth: index === categories.length - 1 ? 0 : 1,
                        borderBottomColor: palette.divider,
                        backgroundColor: categoryId === category.id ? palette.brandSoft : 'transparent',
                      }}
                    >
                      <View style={iconBoxStyle(palette)}>
                        {isEmojiIcon(category.icon) ? (
                          <Text style={{ fontSize: 16 }}>{category.icon}</Text>
                        ) : (
                          <Feather name={category.icon as keyof typeof Feather.glyphMap} size={15} color={palette.iconTint} />
                        )}
                      </View>
                      <Text style={{ flex: 1, marginLeft: 12, fontSize: 15, color: palette.text }} numberOfLines={1}>
                        {getCategoryLabel(category.id)}
                      </Text>
                      {categoryId === category.id ? <Ionicons name="checkmark-circle" size={18} color={palette.brand} /> : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: HOME_SPACE.sm }}>
              <View style={[styles.fieldCard, { flex: 1, backgroundColor: palette.surface, borderColor: palette.divider }]}>
                <Text style={fieldLabelStyle(palette)}>Month</Text>
                <View style={[styles.monthBar, { marginTop: 8, backgroundColor: palette.background, borderColor: palette.divider }]}>
                  <TouchableOpacity
                    onPress={() => setStartMonth((value) => shiftMonth(value, -1))}
                    style={[styles.monthArrow, { borderRightColor: palette.divider }]}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="chevron-back" size={14} color={palette.text} />
                  </TouchableOpacity>
                  <View style={styles.monthCenter}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>{formatMonthLabel(startMonth)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setStartMonth((value) => shiftMonth(value, 1))}
                    style={[styles.monthArrow, { borderLeftColor: palette.divider }]}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="chevron-forward" size={14} color={palette.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.fieldCard, { flex: 1, backgroundColor: palette.surface, borderColor: palette.divider }]}>
                <Text style={fieldLabelStyle(palette)}>Repeat</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  {[
                    { label: 'Yes', value: true },
                    { label: 'No', value: false },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.label}
                      onPress={() => setRepeat(option.value)}
                      activeOpacity={0.75}
                      style={[
                        styles.repeatChip,
                        {
                          backgroundColor: repeat === option.value ? palette.brandSoft : palette.background,
                          borderColor: repeat === option.value ? palette.brand : palette.divider,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: repeat === option.value ? palette.brand : palette.text }}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: HOME_SPACE.sm, marginTop: HOME_SPACE.lg }}>
            {budget && onDelete ? (
              <TouchableOpacity
                onPress={onDelete}
                activeOpacity={0.8}
                style={[styles.secondaryAction, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: palette.negative }}>Delete</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave || loading}
              activeOpacity={0.8}
              style={[
                styles.primaryAction,
                {
                  flex: 1,
                  backgroundColor: canSave ? palette.brand : palette.borderSoft,
                },
              ]}
            >
              <Text style={{ fontSize: 15, fontWeight: '800', color: palette.onBrand }}>
                {budget ? 'Save Changes' : 'Add Budget'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    minHeight: 48,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  monthArrow: {
    width: 40,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
  },
  monthCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  summaryCell: {
    flex: 1,
    borderRadius: HOME_RADIUS.card,
    padding: CARD_PADDING,
  },
  warningBox: {
    borderRadius: HOME_RADIUS.small,
    padding: HOME_SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HOME_SPACE.sm,
  },
  emptyCard: {
    borderRadius: HOME_RADIUS.card,
    padding: 32,
    alignItems: 'center',
  },
  budgetCard: {
    borderRadius: HOME_RADIUS.card,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 14,
    marginBottom: HOME_SPACE.md,
  },
  editorShell: {
    borderTopLeftRadius: HOME_RADIUS.large,
    borderTopRightRadius: HOME_RADIUS.large,
    paddingHorizontal: HOME_SPACE.xxl,
    paddingTop: HOME_SPACE.xl,
    paddingBottom: HOME_SPACE.xxl,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: HOME_SPACE.lg,
  },
  detailStrip: {
    minHeight: 64,
    borderRadius: HOME_RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: HOME_SPACE.md,
  },
  fieldCard: {
    borderRadius: HOME_RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 14,
  },
  categoryPicker: {
    borderRadius: HOME_RADIUS.card,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: -4,
  },
  repeatChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: HOME_RADIUS.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryAction: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
});
