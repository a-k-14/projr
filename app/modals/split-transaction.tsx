import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform, Pressable, ScrollView, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import RNAnimated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { CategoryPickerSheet } from '../../components/ui/CategoryPickerSheet';
import { getBottomActionPadding, getScrollableBottomPadding } from '../../components/ui/safeBottom';
import { sanitizeDecimalInput, SectionCard } from '../../components/ui/transaction-form-primitives';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { getCategoryDisplayIcon } from '../../lib/category-utils';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { HOME_TEXT, SCREEN_HEADER } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { isEmojiIcon } from '../../lib/ui-format';
import { runAfterKeyboardDismiss } from '../../lib/ui-utils';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { SplitDraftRow, useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { useUIStore } from '../../stores/useUIStore';
import type { Category, TransactionType } from '../../types';

const CARD_GAP = 24;

function getCategoryName(categories: Category[], categoryId: string) {
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return 'Select category';
  return category.parentId
    ? `${categories.find((item) => item.id === category.parentId)?.name ?? 'Category'} › ${category.name}`
    : category.name;
}

function AnimatedSplitCard({
  onRemove,
  children,
}: {
  onRemove: () => void;
  children: (triggerDelete: () => void) => React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const marginBottom = useRef(new Animated.Value(0)).current;
  const measuredHeight = useRef(0);

  const triggerDelete = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: false }),
      Animated.timing(marginBottom, {
        toValue: -(measuredHeight.current + CARD_GAP),
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start(() => onRemove());
  };

  return (
    <Animated.View
      onLayout={(e) => {
        measuredHeight.current = e.nativeEvent.layout.height;
      }}
      style={{ opacity, marginBottom }}
    >
      {children(triggerDelete)}
    </Animated.View>
  );
}

export default function SplitTransactionModal() {
  const { type } = useLocalSearchParams<{ type?: TransactionType }>();
  const txType = type === 'in' || type === 'out' ? type : 'out';
  const categories = useCategoriesStore((s) => s.categories);
  const splitRows = useTransactionDraftStore((s) => s.splitRows);
  const setSplitRows = useTransactionDraftStore((s) => s.setSplitRows);
  const { palette } = useAppTheme();
  const sym = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const { dialog } = useAppDialog(palette);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const currentScrollYRef = useRef(0);
  const preFocusScrollYRef = useRef<number | null>(null);
  const [categorySheetRowId, setCategorySheetRowId] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [lastFocusedRowId, setLastFocusedRowId] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const shakeOffset = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
  }));

  useEffect(() => {
    if (splitRows.length === 0) {
      setSplitRows([{ id: `split-${Date.now()}`, categoryId: '', amountStr: '' }]);
    }
  }, [setSplitRows, splitRows.length]);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const didHideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      if (preFocusScrollYRef.current !== null) {
        scrollRef.current?.scrollTo({ y: preFocusScrollYRef.current, animated: true });
        preFocusScrollYRef.current = null;
      }
    });
    return () => {
      showSub.remove();
      didHideSub.remove();
    };
  }, []);

  const handleFieldFocus = (index: number) => {
    if (preFocusScrollYRef.current === null) {
      preFocusScrollYRef.current = currentScrollYRef.current;
    }
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: index * 132, animated: true });
    }, 180);
  };

  const total = splitRows.reduce(
    (sum, row) => sum + (parseFloat(parseFormattedNumber(row.amountStr)) || 0),
    0,
  );
  const amountColor = palette.brand;

  const updateRow = (id: string, patch: Partial<SplitDraftRow>) => {
    setSplitRows(splitRows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const selectCategoryForSheetRow = (categoryId: string) => {
    if (categorySheetRowId) updateRow(categorySheetRowId, { categoryId });
    setCategorySheetRowId(null);
  };

  const openCategoryPickerForRow = (rowId: string, index: number) => {
    handleFieldFocus(index);
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      setTimeout(() => setCategorySheetRowId(rowId), 100);
    } else {
      setCategorySheetRowId(rowId);
    }
  };

  const addRow = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSplitRows([...splitRows, { id: `split-${Date.now()}-${splitRows.length}`, categoryId: '', amountStr: '' }]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const removeRow = (id: string) => {
    if (splitRows.length === 1) {
      setSplitRows([{ id: `split-${Date.now()}`, categoryId: '', amountStr: '' }]);
      return;
    }
    setSplitRows(splitRows.filter((row) => row.id !== id));
  };

  const handleDone = () => {
    const filledRows = splitRows.filter(
      (row) => row.categoryId || (parseFloat(parseFormattedNumber(row.amountStr)) || 0) !== 0 || (row.note && row.note.trim().length > 0),
    );
    if (filledRows.length === 0) {
      setSplitRows([]);
      router.back();
      return;
    }
    const valid = filledRows.every(
      (row) => row.categoryId && (parseFloat(parseFormattedNumber(row.amountStr)) || 0) !== 0,
    );
    if (!valid) {
      setAttemptedSubmit(true);
      shakeOffset.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      return;
    }
    setSplitRows(filledRows);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <TouchableOpacity delayPressIn={0} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: SCREEN_HEADER.iconTitleGap }}>
            <AppIcon name="x" size={18} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text }}>
            Split Transaction
          </Text>
        </View>
      </SafeAreaView>

      {/* Frozen toolbar — outside ScrollView */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingHorizontal: SCREEN_GUTTER, paddingBottom: 8, marginTop: -10 }}>
        <Pressable
          onPress={() => runAfterKeyboardDismiss(() => setShowCalculator(true))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <AppIcon name="calculator" size={20} color={palette.brand} strokeWidth={1.9} />
        </Pressable>
        <TextButton label="+ Add Line" onPress={addRow} palette={palette} tone="brand" compact />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets, 128) + keyboardHeight }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          currentScrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          preFocusScrollYRef.current = null;
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ paddingHorizontal: SCREEN_GUTTER, gap: CARD_GAP }}>
            {splitRows.map((row, index) => (
              <AnimatedSplitCard
                key={row.id}
                onRemove={() => removeRow(row.id)}
              >
                {(triggerDelete) => (
                  <SectionCard palette={palette} horizontalInset={0}>
                    {/* Row 1: Amount Field with Label on Left, Value on Right, and red trash-2 icon */}
                    <Pressable
                      onPress={() => handleFieldFocus(index)}
                      style={{
                        minHeight: 56,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                          <AppIcon name="hash" size={18} color={palette.text} />
                        </View>
                        <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.textSecondary, fontWeight: FONT_WEIGHT.regular }}>
                          Amount
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {showCurrencySymbol && (
                            <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginRight: 3 }}>
                              {sym}
                            </Text>
                          )}
                          <TextInput
                            value={row.amountStr}
                            onChangeText={(value: string) => updateRow(row.id, { amountStr: formatIndianNumberStr(sanitizeDecimalInput(value)) })}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={attemptedSubmit && (parseFloat(parseFormattedNumber(row.amountStr)) || 0) === 0 ? palette.negative : palette.textSoft}
                            cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                            style={{
                              fontSize: 15,
                              fontWeight: FONT_WEIGHT.semibold,
                              color: attemptedSubmit && (parseFloat(parseFormattedNumber(row.amountStr)) || 0) === 0 ? palette.negative : amountColor,
                              textAlign: 'right',
                              minWidth: 50,
                              paddingVertical: 0,
                            }}
                            autoFocus={index === 0}
                            onFocus={() => {
                              handleFieldFocus(index);
                              setLastFocusedRowId(row.id);
                            }}
                          />
                        </View>

                        {/* Red Trash Can Icon on Right with no borders */}
                        <TouchableOpacity
                          delayPressIn={0}
                          onPress={triggerDelete}
                          activeOpacity={0.7}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={{ padding: 4 }}
                        >
                          <AppIcon name="trash-2" size={18} color={palette.negative} />
                        </TouchableOpacity>
                      </View>
                    </Pressable>

                    {/* Row 2: Category Picker (minHeight: 56) */}
                    <TouchableOpacity
                      onPress={() => openCategoryPickerForRow(row.id, index)}
                      activeOpacity={0.76}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        minHeight: 56,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        gap: 12,
                        borderTopWidth: 1,
                        borderTopColor: palette.borderSoft,
                      }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        {row.categoryId ? (() => {
                          const icon = getCategoryDisplayIcon(categoriesById, row.categoryId);
                          return isEmojiIcon(icon) ? (
                            <Text style={{ fontSize: 18 }}>{icon}</Text>
                          ) : (
                            <AppIcon name={icon as any} size={18} color={palette.brand} strokeWidth={1.5} />
                          );
                        })() : (
                          <AppIcon name="layout-grid" size={18} color={attemptedSubmit && !row.categoryId ? palette.negative : palette.text} strokeWidth={1.5} />
                        )}
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: HOME_TEXT.body,
                          color: row.categoryId ? palette.text : attemptedSubmit && !row.categoryId ? palette.negative : palette.textMuted,
                          fontWeight: FONT_WEIGHT.medium,
                        }}
                        numberOfLines={1}
                      >
                        {getCategoryName(categories, row.categoryId)}
                      </Text>
                      <AppIcon name="chevron-right" size={16} color={palette.textSecondary} />
                    </TouchableOpacity>

                    {/* Row 3: Notes Field (minHeight: 56) */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        minHeight: 56,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        gap: 12,
                        borderTopWidth: 1,
                        borderTopColor: palette.borderSoft,
                      }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="file-text" size={18} color={palette.text} />
                      </View>
                      <TextInput
                        value={row.note ?? ''}
                        onChangeText={(text: string) => updateRow(row.id, { note: text })}
                        placeholder="Notes"
                        placeholderTextColor={palette.textMuted}
                        cursorColor={palette.isDark ? '#FFFFFF' : palette.text}
                        style={{
                          flex: 1,
                          fontSize: HOME_TEXT.body,
                          color: palette.text,
                          paddingVertical: 0,
                          fontWeight: FONT_WEIGHT.regular,
                        }}
                        onFocus={() => handleFieldFocus(index)}
                      />
                    </View>
                  </SectionCard>
                )}
              </AnimatedSplitCard>
            ))}
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: 12,
          paddingBottom: getBottomActionPadding(insets, 4),
          backgroundColor: palette.background,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted, fontWeight: FONT_WEIGHT.semibold }}>Total</Text>
          <Text style={{ fontSize: HOME_TEXT.rowLabel, color: palette.text, fontWeight: FONT_WEIGHT.bold }}>{formatIndianNumberStr(String(total || 0))}</Text>
        </View>
        <RNAnimated.View style={[shakeStyle, { width: '100%' }]}>
          <FilledButton label="Done" onPress={handleDone} palette={palette} tone="brand" />
        </RNAnimated.View>
      </View>

      {categorySheetRowId ? (
        <CategoryPickerSheet
          categories={categories}
          transactionType={txType}
          selectedCategoryId={splitRows.find((row) => row.id === categorySheetRowId)?.categoryId}
          palette={palette}
          onClose={() => setCategorySheetRowId(null)}
          onManage={() => { setCategorySheetRowId(null); router.push('/settings/categories'); }}
          onSelect={selectCategoryForSheetRow}
        />
      ) : null}

      <CalculatorSheet
        visible={showCalculator}
        value={
          (splitRows.find(r => r.id === (lastFocusedRowId || splitRows[0]?.id))?.amountStr || '').replace(/,/g, '')
        }
        palette={palette}
        brandColor={palette.brand}
        brandSoft={palette.brandSoft}
        brandOnColor={palette.onBrand}
        onClose={() => setShowCalculator(false)}
        onApply={(finalValue) => {
          setShowCalculator(false);
          const targetId = lastFocusedRowId || splitRows[0]?.id;
          if (targetId) {
            updateRow(targetId, { amountStr: formatIndianNumberStr(finalValue) });
          }
        }}
      />

      {dialog}
    </KeyboardAvoidingView>
  );
}
