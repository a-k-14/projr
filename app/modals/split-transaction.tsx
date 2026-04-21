import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { Alert, Keyboard, Platform, ScrollView, TextInput, View, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryPickerSheet } from '../../components/ui/CategoryPickerSheet';
import { SectionCard } from '../../components/ui/transaction-form-primitives';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { SplitDraftRow, useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import type { Category, TransactionType } from '../../types';

function sanitizeDecimalInput(value: string): string {
  const isNegative = value.trim().startsWith('-');
  let cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return isNegative ? '-' : '';
  const parts = cleaned.split('.');
  if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
  if (cleaned.length > 1 && cleaned.startsWith('0') && cleaned[1] !== '.') {
    cleaned = cleaned.substring(1);
  }
  return `${isNegative ? '-' : ''}${cleaned}`;
}

function getCategoryName(categories: Category[], categoryId: string) {
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return 'Select category';
  return category.parentId
    ? `${categories.find((item) => item.id === category.parentId)?.name ?? 'Category'} › ${category.name}`
    : category.name;
}

export default function SplitTransactionModal() {
  const { type } = useLocalSearchParams<{ type?: TransactionType }>();
  const txType = type === 'in' || type === 'out' ? type : 'out';
  const categories = useCategoriesStore((s) => s.categories);
  const splitRows = useTransactionDraftStore((s) => s.splitRows);
  const setSplitRows = useTransactionDraftStore((s) => s.setSplitRows);
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [categorySheetRowId, setCategorySheetRowId] = useState<string | null>(null);

  useEffect(() => {
    if (splitRows.length === 0) {
      setSplitRows([{ id: `split-${Date.now()}`, categoryId: '', amountStr: '' }]);
    }
  }, [setSplitRows, splitRows.length]);

  const total = splitRows.reduce(
    (sum, row) => sum + (parseFloat(parseFormattedNumber(row.amountStr)) || 0),
    0,
  );

  const updateRow = (id: string, patch: Partial<SplitDraftRow>) => {
    setSplitRows(splitRows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const selectCategoryForSheetRow = (categoryId: string) => {
    if (categorySheetRowId) {
      updateRow(categorySheetRowId, { categoryId });
    }
    setCategorySheetRowId(null);
  };

  const openCategoryManagerFromSheet = () => {
    setCategorySheetRowId(null);
    router.push('/settings/categories');
  };

  const addRow = () => {
    setSplitRows([...splitRows, { id: `split-${Date.now()}-${splitRows.length}`, categoryId: '', amountStr: '' }]);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
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
      Alert.alert('Complete all line items', 'Choose a category and amount for each split line.');
      return;
    }
    setSplitRows(filledRows);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity delayPressIn={0} onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>
            Split Transaction
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 128 }}
        keyboardShouldPersistTaps="always"
      >
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 4 }}>
          <View style={{ alignItems: 'flex-end', marginBottom: 10 }}>
            <TouchableOpacity delayPressIn={0} onPress={addRow} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="add" size={14} color={palette.brand} />
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.brand }}>Add Line Item</Text>
            </TouchableOpacity>
          </View>

          <SectionCard palette={palette} horizontalInset={0}>
            {splitRows.map((row, index) => (
              <View
                key={row.id}
                style={{
                  minHeight: 62,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: SCREEN_GUTTER,
                  borderBottomWidth: index === splitRows.length - 1 ? 0 : 1,
                  borderBottomColor: palette.divider }}
              >
                <TouchableOpacity delayPressIn={0}
                  onPress={() => {
                    if (Keyboard.isVisible()) {
                      Keyboard.dismiss();
                      setTimeout(() => setCategorySheetRowId(row.id), 100);
                    } else {
                      setCategorySheetRowId(row.id);
                    }
                  }}
                  activeOpacity={0.75}
                  style={{ flex: 1, minWidth: 0, paddingRight: 8 }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: HOME_TEXT.sectionTitle,
                      fontWeight: row.categoryId ? '500' : '400',
                      color: row.categoryId ? palette.text : palette.textMuted }}
                  >
                    {getCategoryName(categories, row.categoryId)}
                  </Text>
                </TouchableOpacity>

                <View
                  style={{
                    width: 112,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: focusedRowId === row.id ? palette.textSecondary : palette.borderSoft ?? palette.border,
                    paddingBottom: 4 }}
                >
                  <TextInput
                    value={row.amountStr}
                    onChangeText={(value) =>
                      updateRow(row.id, {
                        amountStr: formatIndianNumberStr(sanitizeDecimalInput(value)) })
                    }
                    placeholder="0"
                    placeholderTextColor={palette.textSoft}
                    keyboardType="decimal-pad"
                    onFocus={() => {
                      setFocusedRowId(row.id);
                      requestAnimationFrame(() => {
                        scrollRef.current?.scrollToEnd({ animated: true });
                      });
                    }}
                    onBlur={() => setFocusedRowId((current) => (current === row.id ? null : current))}
                    style={{
                      flex: 1,
                      fontSize: HOME_TEXT.sectionTitle,
                      fontWeight: '500',
                      color: palette.text,
                      textAlign: 'right',
                      paddingVertical: 0 }}
                  />
                </View>

                <TouchableOpacity delayPressIn={0}
                  onPress={() => removeRow(row.id)}
                  style={{
                    width: 34,
                    height: 34,
                    marginLeft: 8,
                    borderRadius: 12,
                    backgroundColor: palette.inputBg,
                    alignItems: 'center',
                    justifyContent: 'center' }}
                >
                  <Ionicons name="trash-outline" size={16} color={palette.negative} />
                </TouchableOpacity>
              </View>
            ))}
          </SectionCard>
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: 12,
          paddingBottom: (insets.bottom || 16) + 4,
          backgroundColor: palette.background }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted, fontWeight: '600' }}>Total</Text>
          <Text style={{ fontSize: HOME_TEXT.rowLabel, color: palette.text, fontWeight: '700' }}>{formatIndianNumberStr(String(total || 0))}</Text>
        </View>
        <TouchableOpacity delayPressIn={0}
          onPress={handleDone}
          activeOpacity={0.85}
          style={{
            backgroundColor: palette.brand,
            borderRadius: 18,
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center' }}
        >
          <Text style={{ color: palette.onBrand, fontSize: HOME_TEXT.rowLabel, fontWeight: '700' }}>Done</Text>
        </TouchableOpacity>
      </View>
      {categorySheetRowId ? (
        <CategoryPickerSheet
          categories={categories}
          transactionType={txType}
          selectedCategoryId={splitRows.find((row) => row.id === categorySheetRowId)?.categoryId}
          palette={palette}
          onClose={() => setCategorySheetRowId(null)}
          onManage={openCategoryManagerFromSheet}
          onSelect={selectCategoryForSheetRow}
        />
      ) : null}
    </View>
  );
}
