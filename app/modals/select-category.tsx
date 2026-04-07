import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import type { TransactionType } from '../../types';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';

export default function SelectCategoryScreen() {
  const { type } = useLocalSearchParams<{ type?: TransactionType }>();
  const { categories } = useCategoriesStore();
  const { categoryId, setCategoryId } = useTransactionDraftStore();
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
    <View style={{ flex: 1, backgroundColor: '#F0F0F5' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#F0F0F5' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#0A0A0A" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#0A0A0A', flex: 1 }}>
            Select category
          </Text>
        </View>
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              borderRadius: 16,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <Ionicons name="search" size={16} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search subcategories"
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 12, fontSize: 15, color: '#0A0A0A' }}
            />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 24 }}>
        {sections.map(({ parent, options }) => (
          <View key={parent.id} style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 10 }}>
              {parent.name}
            </Text>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E8EBF0', overflow: 'hidden' }}>
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
                      paddingHorizontal: 12,
                      paddingVertical: 14,
                      borderBottomWidth: index === options.length - 1 ? 0 : 1,
                      borderBottomColor: '#F3F4F6',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: selected ? '#F0FAF4' : '#fff',
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#0A0A0A' }}>
                      {category.name}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={18} color="#17673B" /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
        {!sections.length ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No subcategories found</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
