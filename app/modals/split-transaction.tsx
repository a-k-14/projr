import React from 'react';
import RNAnimated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { Animated, Keyboard, Pressable, ScrollView, TouchableWithoutFeedback, View, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { CategoryPickerSheet } from '../../components/ui/CategoryPickerSheet';
import { getBottomActionPadding, getScrollableBottomPadding } from '../../components/ui/safeBottom';
import { AmountRow, PickerRow, SectionCard } from '../../components/ui/transaction-form-primitives';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { SCREEN_GUTTER, FONT_WEIGHT } from '../../lib/design';
import { HOME_TEXT, SCREEN_HEADER } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { runAfterKeyboardDismiss } from '../../lib/ui-utils';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { SplitDraftRow, useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import type { Category, TransactionType } from '../../types';

const CARD_GAP = 8;

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
  const { dialog } = useAppDialog(palette);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const [categorySheetRowId, setCategorySheetRowId] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
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

  const total = splitRows.reduce(
    (sum, row) => sum + (parseFloat(parseFormattedNumber(row.amountStr)) || 0),
    0,
  );
  const amountColor = txType === 'in' ? palette.uiPositive : palette.uiNegative;

  const updateRow = (id: string, patch: Partial<SplitDraftRow>) => {
    setSplitRows(splitRows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const selectCategoryForSheetRow = (categoryId: string) => {
    if (categorySheetRowId) updateRow(categorySheetRowId, { categoryId });
    setCategorySheetRowId(null);
  };

  const openCategoryPickerForRow = (rowId: string) => {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      setTimeout(() => setCategorySheetRowId(rowId), 100);
    } else {
      setCategorySheetRowId(rowId);
    }
  };

  const addRow = () => {
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
      (row) => row.categoryId || (parseFloat(parseFormattedNumber(row.amountStr)) || 0) !== 0,
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
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity delayPressIn={0} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: SCREEN_HEADER.iconTitleGap }}>
            <AppIcon name="x" size={24} color={palette.text} />
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
        contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets, 128) }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
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
                    <AmountRow
                      sym=""
                      amountStr={row.amountStr}
                      setAmountStr={(value) => updateRow(row.id, { amountStr: value })}
                      palette={palette}
                      accentColor={amountColor}
                      autoFocus={index === 0}
                      onDelete={triggerDelete}
                      hasError={attemptedSubmit && (parseFloat(parseFormattedNumber(row.amountStr)) || 0) === 0}
                    />
                    <PickerRow
                      label="Category"
                      value={getCategoryName(categories, row.categoryId)}
                      placeholder={!row.categoryId}
                      onPress={() => openCategoryPickerForRow(row.id)}
                      palette={palette}
                      hasError={attemptedSubmit && !row.categoryId}
                    />
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
        value=""
        palette={palette}
        brandColor={palette.brand}
        brandSoft={palette.brandSoft}
        brandOnColor={palette.onBrand}
        onClose={() => setShowCalculator(false)}
        onApply={() => setShowCalculator(false)}
      />

      {dialog}
    </View>
  );
}
