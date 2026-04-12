import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_GUTTER } from '../../lib/design';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import type { TransactionType } from '../../types';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';

export default function SelectCategoryScreen() {
  const { type } = useLocalSearchParams<{ type?: TransactionType }>();
  const { categories } = useCategoriesStore();
  const { categoryId, setCategoryId } = useTransactionDraftStore();
  const { settings } = useUIStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const sections = useMemo(() => {
    const parents = categories.filter((category) => category.parentId == null && (category.type === type || category.type === 'both'));
    return parents
      .map((parent) => {
        const children = categories.filter((category) => category.parentId === parent.id);
        const options = children.length > 0 ? children : [];
        return {
          parent,
          options: options.filter((option) => {
            const haystack = `${parent.name} ${option.name}`.toLowerCase();
            return haystack.includes(search.trim().toLowerCase());
          }),
        };
      })
      .filter((section) => section.options.length > 0);
  }, [categories, search, type]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text, flex: 1 }}>
            Select category
          </Text>
        </View>
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: palette.surface,
              borderRadius: 16,
              paddingHorizontal: SCREEN_GUTTER,
              borderWidth: 1,
              borderColor: palette.divider,
            }}
          >
            <Ionicons name="search" size={16} color={palette.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search subcategories"
              placeholderTextColor={palette.textMuted}
              style={{ flex: 1, paddingHorizontal: SCREEN_GUTTER, paddingVertical: 12, fontSize: 15, color: palette.text }}
            />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: insets.bottom + 24 }}>
        {sections.map(({ parent, options }) => (
          <View key={parent.id} style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.textMuted, marginBottom: 8 }}>
              {parent.name}
            </Text>
            <View
              style={{
                backgroundColor: palette.surface,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: palette.divider,
                overflow: 'hidden',
              }}
            >
              {options.map((category, index) => {
                const selected = category.id === categoryId;
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => {
                      setCategoryId(category.id);
                      router.back();
                    }}
                    style={{
                      paddingHorizontal: SCREEN_GUTTER,
                      paddingVertical: 14,
                      borderBottomWidth: index === options.length - 1 ? 0 : 1,
                      borderBottomColor: palette.divider,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: selected ? palette.brandSoft : palette.surface,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>
                      {category.name}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={18} color={palette.tabActive} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
        {!sections.length ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: palette.textMuted }}>No subcategories found</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
