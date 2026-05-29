import { AppIcon } from '@/components/ui/AppIcon';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { Keyboard, ScrollView, View , TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetMonthSheet, formatBudgetMonthLabel } from '../../components/budget-ui';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { FixedBottomActions } from '../../components/settings-ui';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { getScrollableBottomPadding } from '../../components/ui/safeBottom';
import { AmountRow, OptionChipRow, PickerRow, SectionCard } from '../../components/ui/transaction-form-primitives';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { SCREEN_HEADER } from '../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useBudgetDraftStore } from '../../stores/useBudgetDraftStore';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { CategoryPickerSheet } from '../../components/ui/CategoryPickerSheet';
import type { BudgetWithSpent, Category } from '../../types';
import { toLocalMonthStartISO } from '../../lib/dateUtils';

export default function BudgetFormModal() {
  const { budgetId, month } = useLocalSearchParams<{ budgetId?: string; month?: string }>();
  const budgets = useBudgetStore((s) => s.budgets);
  const addBudget = useBudgetStore((s) => s.add);
  const updateBudget = useBudgetStore((s) => s.update);
  const removeBudget = useBudgetStore((s) => s.remove);
  const categories = useCategoriesStore((s) => s.categories);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { showAlert, showConfirm, dialog } = useAppDialog(palette);

  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const shakeOffset = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
  }));

  const draftCategoryId = useBudgetDraftStore((s) => s.categoryId);
  const setDraftCategoryId = useBudgetDraftStore((s) => s.setCategoryId);
  const resetDraft = useBudgetDraftStore((s) => s.reset);

  const editingBudget = useMemo(
    () => (budgetId ? budgets.find((budget) => budget.id === budgetId) ?? null : null),
    [budgetId, budgets],
  );

  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startMonth, setStartMonth] = useState(month || toLocalMonthStartISO(new Date().getFullYear(), new Date().getMonth()));
  const [repeat, setRepeat] = useState(true);
  const [showMonthSheet, setShowMonthSheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (editingBudget) {
      setAmountStr(formatIndianNumberStr(String(editingBudget.amount)));
      setCategoryId(editingBudget.categoryId);
      setDraftCategoryId(editingBudget.categoryId);
      setStartMonth(editingBudget.startDate);
      setRepeat(editingBudget.repeat);
    } else {
      setStartMonth(month || toLocalMonthStartISO(new Date().getFullYear(), new Date().getMonth()));
      resetDraft();
    }
  }, [editingBudget, month, resetDraft, setDraftCategoryId]);

  useEffect(() => {
    if (draftCategoryId && draftCategoryId !== categoryId) {
      setCategoryId(draftCategoryId);
    }
  }, [categoryId, draftCategoryId]);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const isValid = !!categoryId && Number(parseFormattedNumber(amountStr || '0')) !== 0;

  const openMonthPicker = () => {
    Keyboard.dismiss();
    requestAnimationFrame(() => setShowMonthSheet(true));
  };

  const openCategoryPicker = () => {
    Keyboard.dismiss();
    setShowCategorySheet(true);
  };

  const handleSave = async () => {
    if (!isValid) {
      setAttemptedSubmit(true);
      shakeOffset.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      return;
    }
    try {
      const payload = {
        categoryId,
        amount: Number(parseFormattedNumber(amountStr)),
        period: 'month' as const,
        startDate: startMonth,
        repeat };
      if (editingBudget) {
        await updateBudget(editingBudget.id, payload as Partial<BudgetWithSpent>, month);
      } else {
        await addBudget(payload, month);
      }
      resetDraft();
      router.back();
    } catch (error) {
      showAlert('Error', String(error));
    }
  };

  const handleDelete = () => {
    if (!editingBudget) return;
    showConfirm({
      title: 'Delete Budget',
      message: 'This budget will be removed for its covered month(s).',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        await removeBudget(editingBudget.id, month);
        resetDraft();
        router.back();
      },
    });
  };

  const handleOpenCalculator = () => {
    Keyboard.dismiss();
    setShowCalculator(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity delayPressIn={0}
            onPress={() => {
              resetDraft();
              router.back();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: SCREEN_HEADER.iconTitleGap }}
          >
            <AppIcon name="x" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text }}>
            {editingBudget ? 'Edit Budget' : 'New Budget'}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets) }}>
        <SectionCard palette={palette}>
          <PickerRow
            label="Month"
            value={formatBudgetMonthLabel(startMonth)}
            palette={palette}
            onPress={openMonthPicker}
          />
          <PickerRow
            label="Category"
            value={getCategoryDisplayParts(categories, categoryId).name}
            subtitle={getCategoryDisplayParts(categories, categoryId).parentName}
            placeholder={!selectedCategory}
            palette={palette}
            onPress={openCategoryPicker}
            hasError={attemptedSubmit && !categoryId}
          />
          <AmountRow
            sym={sym}
            amountStr={amountStr}
            setAmountStr={setAmountStr}
            onOpenCalculator={handleOpenCalculator}
            palette={palette}
            accentColor={palette.brand}
            autoFocus
            calculatorButtonVariant="large"
            hasError={attemptedSubmit && Number(parseFormattedNumber(amountStr || '0')) === 0}
          />
          <RepeatRow repeat={repeat} setRepeat={setRepeat} palette={palette} />
        </SectionCard>
      </ScrollView>

      <FixedBottomActions palette={palette}>
        <Animated.View style={[shakeStyle, { width: '100%' }]}>
          <FilledButton label={editingBudget ? 'Save changes' : 'Add budget'} onPress={handleSave} disabled={false} palette={palette} tone="brand" />
        </Animated.View>
        {editingBudget ? (
          <TextButton label="Delete budget" onPress={handleDelete} palette={palette} tone="danger" />
        ) : null}
      </FixedBottomActions>
      <BudgetMonthSheet
        visible={showMonthSheet}
        palette={palette}
        selectedMonth={startMonth}
        onSelect={setStartMonth}
        onClose={() => setShowMonthSheet(false)}
      />
      <CalculatorSheet
        visible={showCalculator}
        value={amountStr.replace(/,/g, '')}
        palette={palette}
        brandColor={palette.budget}
        brandSoft={palette.budgetSoft}
        brandOnColor={palette.onBudget}
        onClose={() => setShowCalculator(false)}
        onApply={(finalValue: string) => {
          setShowCalculator(false);
          setAmountStr(formatIndianNumberStr(finalValue));
        }}
      />
      {showCategorySheet && (
        <CategoryPickerSheet
          categories={categories}
          transactionType="out"
          selectedCategoryId={categoryId}
          palette={palette}
          onClose={() => setShowCategorySheet(false)}
          onManage={() => {
            setShowCategorySheet(false);
            router.push('/settings/categories');
          }}
          onSelect={(id) => {
            setCategoryId(id);
            setShowCategorySheet(false);
          }}
        />
      )}
      {dialog}
    </View>
  );
}

function getCategoryDisplayParts(
  categories: Category[],
  categoryId: string,
): { name: string; parentName?: string } {
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return { name: 'Select Category' };
  if (!category.parentId) return { name: category.name };
  return {
    name: category.name,
    parentName: categories.find((item) => item.id === category.parentId)?.name ?? 'Category',
  };
}

function RepeatRow({
  repeat,
  setRepeat,
  palette }: {
  repeat: boolean;
  setRepeat: (value: boolean) => void;
  palette: AppThemePalette;
}) {
  return (
    <OptionChipRow
      label="Repeat"
      palette={palette}
      options={[{ label: 'Yes', selected: repeat, onPress: () => { Keyboard.dismiss(); setRepeat(true); }, activeColor: palette.budget, activeBg: palette.budgetSoft }, { label: 'No', selected: !repeat, onPress: () => { Keyboard.dismiss(); setRepeat(false); }, activeColor: palette.budget, activeBg: palette.budgetSoft }]}
      helperText={repeat ? 'Budget repeats every month from the selected month onward.' : 'Budget applies only to the selected month.'}
    />
  );
}
