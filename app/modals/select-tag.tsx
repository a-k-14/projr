import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';

export default function SelectTagSheet() {
  const { tags } = useCategoriesStore();
  const { tagIds, setTagIds } = useTransactionDraftStore();
  const insets = useSafeAreaInsets();

  const [selectedIds, setSelectedIds] = useState<string[]>(tagIds);

  useEffect(() => {
    setSelectedIds(tagIds);
  }, [tagIds]);

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.32)' }}>
      <Pressable style={{ flex: 1 }} onPress={() => router.back()} />
      <View
        style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 12,
          paddingBottom: insets.bottom + 14,
          paddingHorizontal: 12,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <View style={{ width: 42, height: 5, borderRadius: 999, backgroundColor: '#E5E7EB' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0A0A0A', flex: 1 }}>Select tags</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="close" size={22} color="#0A0A0A" />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          {tags.map((tag) => {
            const selected = selectedIds.includes(tag.id);
            return (
              <TouchableOpacity
                key={tag.id}
                onPress={() =>
                  setSelectedIds((current) =>
                    current.includes(tag.id)
                      ? current.filter((id) => id !== tag.id)
                      : [...current, tag.id]
                  )
                }
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: selected ? tag.color : '#E5E7EB',
                  backgroundColor: selected ? '#F8FAFC' : '#fff',
                  marginBottom: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tag.color }} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#0A0A0A' }}>{tag.name}</Text>
                </View>
                {selected ? <Ionicons name="checkmark" size={18} color={tag.color} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          onPress={() => {
            setTagIds(selectedIds);
            router.back();
          }}
          style={{
            backgroundColor: '#17673B',
            borderRadius: 16,
            paddingVertical: 14,
            alignItems: 'center',
            marginTop: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
