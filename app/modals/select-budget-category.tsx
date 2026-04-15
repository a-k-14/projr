import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardSection } from '../../components/settings-ui';
import { CARD_PADDING, SCREEN_GUTTER } from '../../lib/design';
import { useAppTheme } from '../../lib/theme';
import { useBudgetDraftStore } from '../../stores/useBudgetDraftStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';

function isEmoji(icon: string) {
  return !/^[a-z-]+$/.test(icon);
}

function CategoryIconBadge({ icon, palette }: { icon: string; palette: any }) {
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: palette.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isEmoji(icon) ? (
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      ) : (
        <Feather name={icon as any} size={16} color={palette.iconTint} />
      )}
    </View>
  );
}

export default function SelectBudgetCategoryScreen() {
  const categories = useCategoriesStore((s) => s.categories);
  const selectedCategoryId = useBudgetDraftStore((s) => s.categoryId);
  const setCategoryId = useBudgetDraftStore((s) => s.setCategoryId);
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());

  const sections = useMemo(() => {
    const parents = categories
      .filter((category) => !category.parentId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

    return parents
      .map((parent) => {
        const children = categories
          .filter((category) => category.parentId === parent.id && category.type === 'out')
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
          hasSearchMatch: filteredChildren.length > 0 || parent.name.toLowerCase().includes(search.trim().toLowerCase()),
        };
      })
      .filter((section) => section.children.length > 0)
      .filter((section) => search.trim() === '' || section.hasSearchMatch);
  }, [categories, search]);

  useEffect(() => {
    if (search.trim().length > 0) {
      setExpandedParentIds(new Set(sections.map((section) => section.parent.id)));
    }
  }, [search, sections]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text, flex: 1 }}>
            Select subcategory
          </Text>
        </View>
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: palette.surface,
              borderRadius: 16,
              paddingHorizontal: CARD_PADDING,
              borderWidth: 1,
              borderColor: palette.divider,
            }}
          >
            <Feather name="search" size={16} color={palette.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search budget subcategories..."
              placeholderTextColor={palette.textMuted}
              style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: palette.text }}
            />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {sections.length > 0 ? (
          <CardSection palette={palette}>
            {sections.map(({ parent, filteredChildren }, index) => {
              const isExpanded = expandedParentIds.has(parent.id);
              const isLast = index === sections.length - 1;
              return (
                <View key={parent.id}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      setExpandedParentIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(parent.id)) next.delete(parent.id);
                        else next.add(parent.id);
                        return next;
                      })
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: CARD_PADDING,
                      minHeight: 62,
                      borderBottomWidth: isLast && !isExpanded ? 0 : 1,
                      borderBottomColor: palette.divider,
                      gap: 12,
                    }}
                  >
                    <CategoryIconBadge icon={parent.icon || 'tag'} palette={palette} />
                    <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text, flex: 1 }} numberOfLines={1}>
                      {parent.name}
                    </Text>
                    <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textSoft} />
                  </TouchableOpacity>

                  {isExpanded ? (
                    <View style={{ backgroundColor: palette.inputBg }}>
                      {filteredChildren.map((child) => {
                        const selected = child.id === selectedCategoryId;
                        return (
                          <TouchableOpacity
                            key={child.id}
                            onPress={() => {
                              setCategoryId(child.id);
                              router.back();
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 12,
                              paddingLeft: CARD_PADDING + 40,
                              paddingRight: CARD_PADDING,
                              minHeight: 54,
                              borderTopWidth: 1,
                              borderTopColor: palette.divider,
                              backgroundColor: selected ? palette.brandSoft : 'transparent',
                            }}
                          >
                            <Text style={{ fontSize: 15, fontWeight: '400', color: palette.text, flex: 1 }} numberOfLines={1}>
                              {child.name}
                            </Text>
                            {selected ? <Feather name="check" size={16} color={palette.brand} /> : <Feather name="chevron-right" size={16} color={palette.textSoft} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </CardSection>
        ) : null}
      </ScrollView>
    </View>
  );
}
