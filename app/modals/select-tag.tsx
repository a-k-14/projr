import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_GUTTER, SHEET_GUTTER, RADIUS, SPACING } from '../../lib/design';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAppTheme } from '../../lib/theme';
import { HOME_TEXT } from '../../lib/layoutTokens';

export default function SelectTagSheet() {
  const tags = useCategoriesStore((s) => s.tags);
  const tagIds = useTransactionDraftStore((s) => s.tagIds);
  const setTagIds = useTransactionDraftStore((s) => s.setTagIds);
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [selectedIds, setSelectedIds] = useState<string[]>(tagIds);

  useEffect(() => {
    setSelectedIds(tagIds);
  }, [tagIds]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.scrim }}>
      <Pressable style={{ flex: 1 }} onPress={() => router.back()} />
      <View
        style={{
          backgroundColor: palette.card,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          paddingTop: 12,
          paddingBottom: insets.bottom + 14,
          paddingHorizontal: SHEET_GUTTER,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <View style={{ width: 42, height: 5, borderRadius: 999, backgroundColor: palette.divider, opacity: 0.65 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: '700', color: palette.text, flex: 1 }}>Select tags</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="close" size={22} color={palette.textMuted} />
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
                  paddingHorizontal: SHEET_GUTTER,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: selected ? palette.tabActive : palette.divider,
                  backgroundColor: selected ? palette.brandSoft : palette.surface,
                  marginBottom: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tag.color }} />
                  <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '600', color: palette.text }}>{tag.name}</Text>
                </View>
                {selected ? <Ionicons name="checkmark" size={18} color={palette.tabActive} /> : null}
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
            backgroundColor: palette.tabActive,
            borderRadius: 16,
            paddingVertical: 14,
            alignItems: 'center',
            marginTop: 4,
          }}
        >
          <Text style={{ color: palette.onBrand, fontSize: HOME_TEXT.sectionTitle, fontWeight: '700' }}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
