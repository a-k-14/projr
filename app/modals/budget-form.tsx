import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { Keyboard, ScrollView, View , TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetMonthField, BudgetMonthSheet } from '../../components/budget-ui';
import { AmountRow, OptionChipRow, PickerRow, SectionCard } from '../../components/ui/transaction-form-primitives';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { HOME_TEXT, PRIMARY_ACTION } from '../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useBudgetDraftStore } from '../../stores/useBudgetDraftStore';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { useAppDialog } from '../../components/ui/useAppDialog';
import type { BudgetWithSpent } from '../../types';

export default function BudgetFormModal() {
  const { budgetId, month } = useLocalSearchParams<{ budgetId?: string; month?: string }>();
  const budgets = useBudgetStore((s) => s.budgets);
  const addBudget = useBudgetStore((s) => s.add);
  const updateBudget = useBudgetStore((s) => s.update);
  const removeBudget = useBudgetStore((s) => s.remove);
  const categories = useCategoriesStore((s) => s.categories);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { showAlert, showConfirm, dialog } = useAppDialog(palette);

  const draftCategoryId = useBudgetDraftStore((s) => s.categoryId);
  const setDraftCategoryId = useBudgetDraftStore((s) => s.setCategoryId);
  const resetDraft = useBudgetDraftStore((s) => s.reset);

  const editingBudget = useMemo(
    () => (budgetId ? budgets.find((budget) => budget.id === budgetId) ?? null : null),
    [budgetId, budgets],
  );

  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startMonth, setStartMonth] = useState(month || new Date().toISOString());
  const [repeat, setRepeat] = useState(true);
  const [showMonthSheet, setShowMonthSheet] = useState(false);
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
      setStartMonth(month || new Date().toISOString());
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
    setDraftCategoryId(categoryId);
    requestAnimationFrame(() => {
      router.push('/modals/select-budget-category');
    });
  };

  const handleSave = async () => {
    if (!isValid) return;
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
            style={{ padding: 4, marginRight: 12 }}
          >
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>
            {editingBudget ? 'Edit Budget' : 'New Budget'}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingBottom: 120 }}>
        <SectionCard palette={palette}>
          <PickerRow
            label="Month"
            palette={palette}
            onPress={openMonthPicker}
            custom
            value={<BudgetMonthField value={startMonth} palette={palette} onPress={openMonthPicker} />}
          />
          <PickerRow
            label="Category"
            value={selectedCategory ? getCategoryFullDisplayName(selectedCategory.id, ' › ') : 'Select Category'}
            placeholder={!selectedCategory}
            palette={palette}
            onPress={openCategoryPicker}
          />
          <AmountRow
            sym={sym}
            amountStr={amountStr}
            setAmountStr={setAmountStr}
            onOpenCalculator={handleOpenCalculator}
            palette={palette}
            accentColor={palette.budget}
            autoFocus
            calculatorButtonVariant="large"
          />
          <RepeatRow repeat={repeat} setRepeat={setRepeat} palette={palette} />
        </SectionCard>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: SCREEN_GUTTER,
          paddingBottom: Math.max(insets.bottom, 12) + 12,
          paddingTop: 8,
          backgroundColor: palette.background }}
      >
        <TouchableOpacity delayPressIn={0}
          onPress={handleSave}
          disabled={!isValid}
          style={{
            minHeight: PRIMARY_ACTION.height,
            borderRadius: PRIMARY_ACTION.radius,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isValid ? palette.budget : palette.borderSoft }}
        >
          <Text style={{ fontSize: PRIMARY_ACTION.labelSize, fontWeight: '600', color: palette.onBudget }}>
            {editingBudget ? 'Save changes' : 'Add budget'}
          </Text>
        </TouchableOpacity>
        {editingBudget ? (
          <TouchableOpacity delayPressIn={0} onPress={handleDelete} style={{ alignItems: 'center', marginTop: 12, paddingVertical: 8 }}>
            <Text style={{ color: palette.negative, fontSize: HOME_TEXT.sectionTitle, fontWeight: '500' }}>Delete budget</Text>
          </TouchableOpacity>
        ) : null}
      </View>
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
        onClose={(finalValue) => {
          setShowCalculator(false);
          setAmountStr(formatIndianNumberStr(finalValue));
        }}
      />
      {dialog}
    </View>
  );
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
