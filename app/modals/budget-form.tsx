import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, ScrollView, Text, View } from 'react-native';
import { TouchableOpacity as RnghTouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetMonthField, BudgetMonthSheet } from '../../components/budget-ui';
import { AmountRow, OptionChipRow, PickerRow, SectionCard } from '../../components/ui/transaction-form-primitives';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useBudgetDraftStore } from '../../stores/useBudgetDraftStore';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
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

  const draftCategoryId = useBudgetDraftStore((s) => s.categoryId);
  const calculatorValue = useBudgetDraftStore((s) => s.calculatorValue);
  const calculatorOpen = useBudgetDraftStore((s) => s.calculatorOpen);
  const setDraftCategoryId = useBudgetDraftStore((s) => s.setCategoryId);
  const setCalculatorValue = useBudgetDraftStore((s) => s.setCalculatorValue);
  const setCalculatorOpen = useBudgetDraftStore((s) => s.setCalculatorOpen);
  const resetDraft = useBudgetDraftStore((s) => s.reset);

  const editingBudget = useMemo(
    () => (budgetId ? budgets.find((budget) => budget.id === budgetId) ?? null : null),
    [budgetId, budgets],
  );

  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startMonth, setStartMonth] = useState(month || new Date().toISOString());
  const [repeat, setRepeat] = useState(true);
  const [loading] = useState(false);
  const [showMonthSheet, setShowMonthSheet] = useState(false);
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
      setCalculatorValue(String(editingBudget.amount));
    } else {
      setStartMonth(month || new Date().toISOString());
      resetDraft();
    }
  }, [editingBudget, month, resetDraft, setCalculatorValue, setDraftCategoryId]);

  useEffect(() => {
    if (draftCategoryId && draftCategoryId !== categoryId) {
      setCategoryId(draftCategoryId);
    }
  }, [categoryId, draftCategoryId]);

  const prevCalculatorOpen = useRef(calculatorOpen);
  useEffect(() => {
    if (prevCalculatorOpen.current && !calculatorOpen) {
      if (calculatorValue && calculatorValue !== '0') {
        setAmountStr(formatIndianNumberStr(calculatorValue.replace(/[^0-9.]/g, '')));
      }
    }
    prevCalculatorOpen.current = calculatorOpen;
  }, [calculatorOpen, calculatorValue]);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const isValid = !!categoryId && Number(parseFormattedNumber(amountStr || '0')) > 0;

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
        repeat,
      };
      if (editingBudget) {
        await updateBudget(editingBudget.id, payload as Partial<BudgetWithSpent>, month);
      } else {
        await addBudget(payload, month);
      }
      resetDraft();
      router.back();
    } catch (error) {
      Alert.alert('Error', String(error));
    }
  };

  const handleDelete = () => {
    if (!editingBudget) return;
    Alert.alert('Delete budget', 'This budget will be removed for its covered month(s).', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeBudget(editingBudget.id, month);
          resetDraft();
          router.back();
        },
      },
    ]);
  };

  const handleOpenCalculator = () => {
    Keyboard.dismiss();
    setCalculatorValue(amountStr);
    setCalculatorOpen(true);
    router.push({
      pathname: '/modals/calculator',
      params: {
        draft: 'budget',
        brandColor: palette.budget,
        brandSoft: palette.budgetSoft,
      },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity
            onPress={() => {
              resetDraft();
              router.back();
            }}
            style={{ padding: 4, marginRight: 12 }}
          >
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>
            {editingBudget ? 'Edit budget' : 'New budget'}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingBottom: 120 }}>
        <SectionCard palette={palette} horizontalInset={0}>
          <PickerRow
            label="Month"
            palette={palette}
            onPress={openMonthPicker}
            custom
            value={<BudgetMonthField value={startMonth} palette={palette} onPress={openMonthPicker} />}
          />
          <PickerRow
            label="Category"
            value={selectedCategory ? getCategoryFullDisplayName(selectedCategory.id, ' › ') : 'Select subcategory'}
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
          backgroundColor: palette.background,
        }}
      >
        <RnghTouchableOpacity
          onPress={handleSave}
          enabled={isValid}
          style={{
            minHeight: 52,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isValid ? palette.budget : palette.borderSoft,
          }}
        >
          <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '800', color: palette.onBudget }}>
            {editingBudget ? 'Save changes' : 'Add budget'}
          </Text>
        </RnghTouchableOpacity>
        {editingBudget ? (
          <RnghTouchableOpacity onPress={handleDelete} style={{ alignItems: 'center', marginTop: 12, paddingVertical: 8 }}>
            <Text style={{ color: palette.negative, fontSize: HOME_TEXT.sectionTitle, fontWeight: '500' }}>Delete budget</Text>
          </RnghTouchableOpacity>
        ) : null}
      </View>
      <BudgetMonthSheet
        visible={showMonthSheet}
        palette={palette}
        selectedMonth={startMonth}
        onSelect={setStartMonth}
        onClose={() => setShowMonthSheet(false)}
      />
    </View>
  );
}

function RepeatRow({
  repeat,
  setRepeat,
  palette,
}: {
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
