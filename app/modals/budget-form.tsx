import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetMonthField, BudgetMonthSheet } from '../../components/budget-ui';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useBudgetDraftStore } from '../../stores/useBudgetDraftStore';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import type { BudgetWithSpent } from '../../types';

const ROW_LABEL_WIDTH = 92;
const ROW_MIN_HEIGHT = 62;
const ROW_COLUMN_GAP = 16;
const ROW_TRAILING_WIDTH = 24;

function sanitizeDecimalInput(value: string): string {
  let cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const parts = cleaned.split('.');
  if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
  if (cleaned.length > 1 && cleaned.startsWith('0') && cleaned[1] !== '.') cleaned = cleaned.substring(1);
  return cleaned;
}

export default function BudgetFormModal() {
  const { budgetId, month } = useLocalSearchParams<{ budgetId?: string; month?: string }>();
  const budgets = useBudgetStore((s) => s.budgets);
  const addBudget = useBudgetStore((s) => s.add);
  const updateBudget = useBudgetStore((s) => s.update);
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
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
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
          <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: palette.text }}>
            {editingBudget ? 'Edit budget' : 'New budget'}
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
        <TouchableOpacity
          onPress={handleSave}
          disabled={!isValid || loading}
          activeOpacity={0.8}
          style={{
            minHeight: 52,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isValid ? palette.budget : palette.borderSoft,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '800', color: palette.onBudget }}>
            {editingBudget ? 'Save changes' : 'Add budget'}
          </Text>
        </TouchableOpacity>
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

function SectionCard({ children, palette }: { children: React.ReactNode; palette: AppThemePalette }) {
  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: 18,
        marginHorizontal: 0,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function PickerRow({
  label,
  value,
  placeholder,
  onPress,
  palette,
  custom = false,
}: {
  label: string;
  value: string | React.ReactNode;
  placeholder?: boolean;
  onPress: () => void;
  palette: AppThemePalette;
  custom?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: palette.textMuted,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flex: 1,
          minWidth: 0,
          minHeight: ROW_MIN_HEIGHT,
          paddingLeft: 4,
        }}
      >
        {custom ? (
          <View style={{ flex: 1 }}>{value}</View>
        ) : (
          <>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '400',
                color: placeholder ? palette.textMuted : palette.text,
                textAlign: 'left',
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {value}
            </Text>
            <View style={{ width: ROW_TRAILING_WIDTH, alignItems: 'flex-start', justifyContent: 'center' }}>
              <Ionicons name="chevron-forward" size={15} color={palette.textSoft} />
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

function AmountRow({
  sym,
  amountStr,
  setAmountStr,
  onOpenCalculator,
  palette,
}: {
  sym: string;
  amountStr: string;
  setAmountStr: (value: string) => void;
  onOpenCalculator: () => void;
  palette: AppThemePalette;
}) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: palette.textMuted,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP,
        }}
      >
        Amount {sym ? `(${sym})` : ''}
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={amountStr}
            onChangeText={(value) => setAmountStr(formatIndianNumberStr(sanitizeDecimalInput(value)))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={palette.textSoft}
            style={{
              flex: 1,
              fontSize: 20,
              fontWeight: '500',
              color: palette.budget,
              paddingBottom: 2,
              paddingTop: 0,
              paddingLeft: 4,
              textAlign: 'left',
              lineHeight: 24,
              borderBottomWidth: isFocused ? 1.5 : 1,
              borderBottomColor: isFocused ? palette.budget : palette.borderSoft,
            }}
            cursorColor={palette.budget}
            autoFocus
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </View>
        <TouchableOpacity
          onPress={onOpenCalculator}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          style={{ marginLeft: SCREEN_GUTTER, width: ROW_TRAILING_WIDTH + 24, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: palette.inputBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="calculator-outline" size={22} color={palette.text} />
          </View>
        </TouchableOpacity>
      </View>
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
    <View style={{ paddingHorizontal: SCREEN_GUTTER, minHeight: 98, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 18 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textMuted, width: ROW_LABEL_WIDTH, paddingRight: ROW_COLUMN_GAP, paddingTop: 10 }}>
        Repeat
      </Text>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map((option) => (
            <TouchableOpacity
              key={option.label}
              onPress={() => {
                Keyboard.dismiss();
                setRepeat(option.value);
              }}
              style={{
                flex: 1,
                minHeight: 38,
                borderRadius: 14,
                borderWidth: 1.5,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
                backgroundColor: repeat === option.value ? palette.budgetSoft : palette.inputBg,
                borderColor: repeat === option.value ? palette.budget : palette.divider,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: repeat === option.value ? palette.budget : palette.text }}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ fontSize: 12, color: palette.textMuted }}>
          {repeat ? 'Budget repeats every month from the selected month onward.' : 'Budget applies only to the selected month.'}
        </Text>
      </View>
    </View>
  );
}
