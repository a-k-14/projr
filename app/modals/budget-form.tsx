import { AppIcon } from '@/components/ui/AppIcon';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { Keyboard, ScrollView, View, TouchableOpacity, Pressable, TextInput, BackHandler } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, runOnJS } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetMonthSheet, formatBudgetMonthLabel } from '../../components/budget-ui';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { FixedBottomActions, FormSection } from '../../components/settings-ui';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { getScrollableBottomPadding } from '../../components/ui/safeBottom';
import { AppChevron } from '../../components/ui/AppChevron';
import { sanitizeDecimalInput } from '../../components/ui/transaction-form-primitives';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { FONT_WEIGHT } from '../../lib/design';
import { HOME_TEXT, SCREEN_HEADER, FORM_TOKENS, HOME_RADIUS } from '../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useBudgetDraftStore } from '../../stores/useBudgetDraftStore';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { useUIStore } from '../../stores/useUIStore';
import { BudgetCategoryPickerSheet } from '../../components/ui/BudgetCategoryPickerSheet';
import type { BudgetWithSpent } from '../../types';
import { toLocalMonthStartISO } from '../../lib/dateUtils';
import { isEmojiIcon } from '../../lib/ui-format';

function AnimatedHelperText({ repeat, palette }: { repeat: boolean; palette: AppThemePalette }) {
  const expansion = useSharedValue(1);
  const contentHeight = useSharedValue(0);
  const [displayedRepeat, setDisplayedRepeat] = useState(repeat);

  useEffect(() => {
    expansion.value = withTiming(0, { duration: 120, easing: Easing.in(Easing.quad) }, (finished) => {
      if (finished) {
        runOnJS(setDisplayedRepeat)(repeat);
        expansion.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
      }
    });
  }, [repeat]);

  const animStyle = useAnimatedStyle(() => ({
    height: expansion.value * contentHeight.value,
    opacity: expansion.value,
    overflow: 'hidden' as const,
  }));

  return (
    <Animated.View style={animStyle}>
      <View
        onLayout={(e) => {
          contentHeight.value = e.nativeEvent.layout.height;
        }}
        style={{ position: 'absolute', width: '100%' }}
      >
        <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary }}>
          {displayedRepeat
            ? 'Budget repeats every month from the selected month onward.'
            : 'Budget applies only to the selected month.'}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function BudgetFormModal() {
  const { budgetId, month } = useLocalSearchParams<{ budgetId?: string; month?: string }>();
  const budgets = useBudgetStore((s) => s.budgets);
  const addBudget = useBudgetStore((s) => s.add);
  const updateBudget = useBudgetStore((s) => s.update);
  const removeBudget = useBudgetStore((s) => s.remove);
  const categories = useCategoriesStore((s) => s.categories);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
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
  const [subCategoryIds, setSubCategoryIds] = useState<string[] | null>(null);
  const [startMonth, setStartMonth] = useState(month || toLocalMonthStartISO(new Date().getFullYear(), new Date().getMonth()));
  const [repeat, setRepeat] = useState(true);
  const [showMonthSheet, setShowMonthSheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const initializedRef = useRef(false);
  const amountInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (editingBudget) {
      setAmountStr(formatIndianNumberStr(String(editingBudget.amount)));
      setCategoryId(editingBudget.categoryId);
      setDraftCategoryId(editingBudget.categoryId);
      setSubCategoryIds(editingBudget.subCategoryIds || null);
      setStartMonth(editingBudget.startDate);
      setRepeat(editingBudget.repeat);
    } else {
      setStartMonth(month || toLocalMonthStartISO(new Date().getFullYear(), new Date().getMonth()));
      resetDraft();
    }
  }, [editingBudget, month, resetDraft, setDraftCategoryId]);

  const isValid = !!categoryId && Number(parseFormattedNumber(amountStr || '0')) !== 0;

  useEffect(() => {
    if (draftCategoryId && draftCategoryId !== categoryId) {
      setCategoryId(draftCategoryId);
      setSubCategoryIds(null);
    }
  }, [categoryId, draftCategoryId]);

  const category = useMemo(() => categories.find((item) => item.id === categoryId) ?? null, [categories, categoryId]);
  const subCatsOfParent = useMemo(() => categories.filter((c) => c.parentId === categoryId), [categories, categoryId]);
  const isAllSelected = useMemo(() => {
    if (!subCategoryIds || subCategoryIds.length === 0) return true;
    if (subCatsOfParent.length === 0) return true;
    return subCategoryIds.length === subCatsOfParent.length;
  }, [subCategoryIds, subCatsOfParent]);

  const checkIsDirty = () => {
    if (editingBudget) {
      const originalAmountStr = formatIndianNumberStr(String(editingBudget.amount));
      const originalSubIds = editingBudget.subCategoryIds || null;
      const subIdsChanged = JSON.stringify(subCategoryIds) !== JSON.stringify(originalSubIds);
      return (
        amountStr !== originalAmountStr ||
        categoryId !== editingBudget.categoryId ||
        subIdsChanged ||
        startMonth !== editingBudget.startDate ||
        repeat !== editingBudget.repeat
      );
    }
    const initialMonth = month || toLocalMonthStartISO(new Date().getFullYear(), new Date().getMonth());
    return (
      amountStr !== '' ||
      categoryId !== '' ||
      subCategoryIds !== null ||
      startMonth !== initialMonth ||
      repeat !== true
    );
  };

  const handleClose = () => {
    if (checkIsDirty()) {
      showConfirm({
        title: 'Discard Changes',
        message: 'Are you sure you want to discard your changes?',
        confirmLabel: 'Discard',
        onConfirm: () => {
          resetDraft();
          router.back();
        },
      });
      return;
    }
    resetDraft();
    router.back();
  };

  useEffect(() => {
    const onBackPress = () => {
      if (checkIsDirty()) {
        showConfirm({
          title: 'Discard Changes',
          message: 'Are you sure you want to discard your changes?',
          confirmLabel: 'Discard',
          onConfirm: () => {
            resetDraft();
            router.back();
          },
        });
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      subscription.remove();
    };
  }, [editingBudget, amountStr, categoryId, subCategoryIds, startMonth, repeat, month]);

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
    const payload = {
      categoryId,
      subCategoryIds,
      amount: Number(parseFormattedNumber(amountStr)),
      period: 'month' as const,
      startDate: startMonth,
      repeat };
    const work = editingBudget
      ? () => updateBudget(editingBudget.id, payload as Partial<BudgetWithSpent>, month)
      : () => addBudget(payload, month);

    try {
      await work();
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
        try {
          await removeBudget(editingBudget.id, month);
          resetDraft();
          router.back();
        } catch (error) {
          showAlert('Error', String(error));
        }
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
        <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <TouchableOpacity delayPressIn={0}
            onPress={handleClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: SCREEN_HEADER.iconTitleGap }}
          >
            <AppIcon name="x" size={18} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text }}>
            {editingBudget ? 'Edit Budget' : 'New Budget'}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets, 120) }}>
        <View style={{ paddingBottom: 20 }}>
          
          {/* Centered Large Amount Input pressable */}
          <Pressable
            onPress={() => amountInputRef.current?.focus()}
            style={{
              marginHorizontal: FORM_TOKENS.gutter,
              marginTop: 8,
              paddingTop: 28,
              paddingBottom: 28,
              paddingHorizontal: 18,
              alignItems: 'center',
              backgroundColor: palette.surface,
              borderRadius: HOME_RADIUS.card,
              borderWidth: 1,
              borderColor: palette.borderSoft,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center', position: 'relative' }}>
              {showCurrencySymbol && (
                <Text style={{ fontSize: 24, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginRight: 4 }}>
                  {currencySymbol}
                </Text>
              )}
              <TextInput
                ref={amountInputRef}
                value={amountStr}
                onChangeText={(value: string) => setAmountStr(formatIndianNumberStr(sanitizeDecimalInput(value)))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={palette.textSoft}
                cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                style={{
                  fontSize: 34,
                  fontWeight: FONT_WEIGHT.regular,
                  color: palette.brand,
                  letterSpacing: 0,
                  textAlign: 'center',
                  minWidth: 60,
                  paddingTop: 0,
                  paddingBottom: 2,
                  lineHeight: 38,
                }}
                autoFocus
              />
            </View>
            <TouchableOpacity
              onPress={handleOpenCalculator}
              activeOpacity={0.72}
              style={{
                position: 'absolute',
                right: 14,
                bottom: 12,
                width: 42,
                height: 42,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
              }}
            >
              <AppIcon name="calculator" size={21} color={palette.text} strokeWidth={1.9} />
            </TouchableOpacity>
          </Pressable>

          {/* Period FormSection */}
          <FormSection title="Period" palette={palette}>
            <TouchableOpacity
              onPress={openMonthPicker}
              activeOpacity={0.76}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 62,
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="calendar-plus" size={21} color={palette.brand} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  appWeight="medium"
                  style={{
                    fontSize: HOME_TEXT.bodyLarge,
                    color: palette.text,
                  }}
                  numberOfLines={1}
                >
                  {formatBudgetMonthLabel(startMonth)}
                </Text>
              </View>
              <AppChevron direction="right" size={18} tone="secondary" color={palette.textSecondary} palette={palette} />
            </TouchableOpacity>

            <PremiumDivider palette={palette} />

            {/* Repeat row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 62,
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name={repeat ? 'repeat' : 'calendar'} size={21} color={palette.brand} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  appWeight="medium"
                  style={{
                    fontSize: HOME_TEXT.bodyLarge,
                    color: palette.text,
                  }}
                  numberOfLines={1}
                >
                  Repeat Monthly
                </Text>
              </View>
              
              {/* Toggles/chips for repeat */}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['yes', 'no'] as const).map((opt) => {
                  const active = (opt === 'yes') === repeat;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => {
                        Keyboard.dismiss();
                        setRepeat(opt === 'yes');
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        borderRadius: HOME_RADIUS.pill,
                        borderWidth: 1,
                        borderColor: active ? palette.budget : palette.borderSoft,
                        backgroundColor: active ? palette.budgetSoft : 'transparent',
                      }}
                    >
                      <Text
                        appWeight="medium"
                        style={{
                          fontSize: HOME_TEXT.bodySmall,
                          color: active ? palette.budget : palette.textSecondary,
                        }}
                      >
                        {opt === 'yes' ? 'Yes' : 'No'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </FormSection>

          {/* Repeat helper text */}
          <View style={{ marginHorizontal: FORM_TOKENS.gutter + 4, marginTop: 6, marginBottom: 2, minHeight: 18 }}>
            <AnimatedHelperText repeat={repeat} palette={palette} />
          </View>

          {/* Category FormSection */}
          <FormSection title="Category" palette={palette}>
            {/* Category row */}
            <TouchableOpacity
              onPress={openCategoryPicker}
              activeOpacity={0.76}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 62,
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {category ? (
                  isEmojiIcon(category.icon) ? (
                    <Text style={{ fontSize: 21 }}>{category.icon}</Text>
                  ) : (
                    <AppIcon name={category.icon as any} size={21} color={palette.brand} strokeWidth={1.5} />
                  )
                ) : (
                  <AppIcon name="layout-grid" size={21} color={attemptedSubmit && !categoryId ? palette.negative : palette.brand} strokeWidth={1.5} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  appWeight="medium"
                  style={{
                    fontSize: HOME_TEXT.bodyLarge,
                    color: categoryId ? palette.text : (attemptedSubmit && !categoryId ? palette.negative : palette.textMuted),
                  }}
                  numberOfLines={1}
                >
                  {category ? category.name : 'Select category'}
                </Text>
                {categoryId && subCategoryIds && subCategoryIds.length > 0 && !isAllSelected ? (
                  <View style={{ marginTop: 4, gap: 2 }}>
                    {subCategoryIds.map((sid) => {
                      const subName = categories.find((c) => c.id === sid)?.name || '';
                      return (
                        <Text
                          key={sid}
                          appWeight="medium"
                          style={{
                            fontSize: HOME_TEXT.bodySmall,
                            color: palette.textSecondary,
                            paddingLeft: 8,
                          }}
                        >
                          › {subName}
                        </Text>
                      );
                    })}
                  </View>
                ) : categoryId ? (
                  <Text
                    appWeight="medium"
                    style={{
                      fontSize: HOME_TEXT.bodySmall,
                      color: palette.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    All subcategories
                  </Text>
                ) : null}
              </View>
              <AppChevron direction="right" size={18} tone="secondary" color={palette.textMuted} palette={palette} />
            </TouchableOpacity>
          </FormSection>

        </View>
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
        brandColor={palette.brand}
        brandSoft={palette.brandSoft}
        brandOnColor={palette.onBrand}
        onClose={() => setShowCalculator(false)}
        onApply={(finalValue: string) => {
          setShowCalculator(false);
          setAmountStr(formatIndianNumberStr(finalValue));
        }}
      />
      {showCategorySheet && (
        <BudgetCategoryPickerSheet
          categories={categories}
          selectedCategoryId={categoryId}
          selectedSubCategoryIds={subCategoryIds}
          palette={palette}
          onClose={() => setShowCategorySheet(false)}
          onApply={(data) => {
            setCategoryId(data.categoryId);
            setSubCategoryIds(data.subCategoryIds);
            setShowCategorySheet(false);
          }}
        />
      )}
      {dialog}
    </View>
  );
}

function PremiumDivider({ palette }: { palette: AppThemePalette }) {
  return <View style={{ height: 1, backgroundColor: palette.borderSoft, marginLeft: FORM_TOKENS.dividerIndent }} />;
}
