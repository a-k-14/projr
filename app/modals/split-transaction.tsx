import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SectionCard } from '../../components/ui/transaction-form-primitives';
import { CategoryTreePicker } from '../../components/ui/CategoryTreePicker';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { useAppTheme } from '../../lib/theme';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { SplitDraftRow, useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import type { Category, TransactionType } from '../../types';

function sanitizeDecimalInput(value: string): string {
  let cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const parts = cleaned.split('.');
  if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
  if (cleaned.length > 1 && cleaned.startsWith('0') && cleaned[1] !== '.') {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
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
  const [search, setSearch] = useState('');
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);

  useEffect(() => {
    if (splitRows.length === 0) {
      setSplitRows([{ id: `split-${Date.now()}`, categoryId: '', amountStr: '' }]);
    }
  }, [setSplitRows, splitRows.length]);

  const sections = useMemo(() => {
    const parents = categories
      .filter((c) => c.parentId == null && (c.type === txType || c.type === 'both'))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

    return parents
      .map((parent) => {
        const children = categories
          .filter((c) => c.parentId === parent.id && (c.type === txType || c.type === 'both'))
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
        const filteredChildren = children.filter((child) => {
          if (!search.trim()) return true;
          const haystack = `${parent.name} ${child.name}`.toLowerCase();
          return haystack.includes(search.trim().toLowerCase());
        });

        return {
          parent,
          children,
          filteredChildren,
          hasSearchMatch:
            filteredChildren.length > 0 ||
            parent.name.toLowerCase().includes(search.trim().toLowerCase()),
        };
      })
      .filter((section) => search.trim() === '' || section.hasSearchMatch);
  }, [categories, search, txType]);

  useEffect(() => {
    if (search.trim().length > 0) {
      setExpandedParentIds(new Set(sections.map((section) => section.parent.id)));
    }
  }, [search, sections]);

  const total = splitRows.reduce(
    (sum, row) => sum + (parseFloat(parseFormattedNumber(row.amountStr)) || 0),
    0,
  );

  const updateRow = (id: string, patch: Partial<SplitDraftRow>) => {
    setSplitRows(splitRows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
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
      (row) => row.categoryId || (parseFloat(parseFormattedNumber(row.amountStr)) || 0) > 0,
    );
    if (filledRows.length === 0) {
      setSplitRows([]);
      router.back();
      return;
    }
    const valid = filledRows.every(
      (row) => row.categoryId && (parseFloat(parseFormattedNumber(row.amountStr)) || 0) > 0,
    );
    if (!valid) {
      Alert.alert('Complete all line items', 'Choose a category and amount for each split line.');
      return;
    }
    setSplitRows(filledRows);
    router.back();
  };

  if (activeRowId) {
    const selectedCategoryId = splitRows.find((row) => row.id === activeRowId)?.categoryId;
    return (
      <CategoryTreePicker
        title="Select category"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${txType} categories...`}
        sections={sections}
        selectedCategoryId={selectedCategoryId}
        expandedParentIds={expandedParentIds}
        setExpandedParentIds={setExpandedParentIds}
        onBack={() => setActiveRowId(null)}
        onSelect={(categoryId) => {
          updateRow(activeRowId, { categoryId });
          setSearch('');
          setActiveRowId(null);
        }}
        palette={palette}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: palette.text }}>
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
            <TouchableOpacity onPress={addRow} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="add" size={14} color={palette.brand} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: palette.brand }}>Add Line Item</Text>
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
                  borderBottomColor: palette.divider,
                }}
              >
                <TouchableOpacity
                  onPress={() => setActiveRowId(row.id)}
                  activeOpacity={0.75}
                  style={{ flex: 1, minWidth: 0, paddingRight: 10 }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 15,
                      fontWeight: row.categoryId ? '500' : '400',
                      color: row.categoryId ? palette.text : palette.textMuted,
                    }}
                  >
                    {getCategoryName(categories, row.categoryId)}
                  </Text>
                </TouchableOpacity>

                <View
                  style={{
                    width: 94,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: focusedRowId === row.id ? palette.brand : palette.borderSoft ?? palette.border,
                    paddingBottom: 4,
                    marginRight: 8,
                  }}
                >
                  <TextInput
                    value={row.amountStr}
                    onChangeText={(value) =>
                      updateRow(row.id, {
                        amountStr: formatIndianNumberStr(sanitizeDecimalInput(value)),
                      })
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
                      fontSize: 15,
                      fontWeight: '500',
                      color: palette.text,
                      textAlign: 'right',
                      paddingVertical: 0,
                    }}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => removeRow(row.id)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    backgroundColor: palette.inputBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
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
          backgroundColor: palette.background,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 14, color: palette.textMuted, fontWeight: '600' }}>Total</Text>
          <Text style={{ fontSize: 18, color: palette.text, fontWeight: '700' }}>{formatIndianNumberStr(String(total || 0))}</Text>
        </View>
        <TouchableOpacity
          onPress={handleDone}
          activeOpacity={0.85}
          style={{
            backgroundColor: palette.brand,
            borderRadius: 18,
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: palette.onBrand, fontSize: 16, fontWeight: '700' }}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
