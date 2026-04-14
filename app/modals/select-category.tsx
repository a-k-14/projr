import { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, LayoutAnimation, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_GUTTER, CARD_PADDING } from '../../lib/design';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import type { TransactionType } from '../../types';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { useAppTheme } from '../../lib/theme';
import { CardSection } from '../../components/settings-ui';

function isEmoji(icon: string) {
  return !/^[a-z-]+$/.test(icon);
}

function CategoryIconBadge({
  icon,
  size,
  bgSize,
  palette,
}: {
  icon: string;
  size: number;
  bgSize: number;
  palette: any;
}) {
  return (
    <View
      style={{
        width: bgSize,
        height: bgSize,
        borderRadius: bgSize * 0.28,
        backgroundColor: palette.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isEmoji(icon) ? (
        <Text style={{ fontSize: size }}>{icon}</Text>
      ) : (
        <Feather name={icon as any} size={size} color={palette.iconTint} />
      )}
    </View>
  );
}

export default function SelectCategoryScreen() {
  const { type } = useLocalSearchParams<{ type?: TransactionType }>();
  const categories = useCategoriesStore((s) => s.categories);
  const selectedCategoryId = useTransactionDraftStore((s) => s.categoryId);
  const setCategoryId = useTransactionDraftStore((s) => s.setCategoryId);
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());

  // Build hierarchical sections with strict type filtering
  const sections = useMemo(() => {
    // Filter top-level parents first based on transaction type
    const parents = categories.filter(
      (c) => c.parentId == null && (type === undefined || c.type === type || c.type === 'both')
    );
    
    return parents.map((parent) => {
      const children = categories.filter((c) => c.parentId === parent.id);
      const filteredChildren = children.filter((child) => {
        if (!search.trim()) return true;
        const haystack = `${parent.name} ${child.name}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      });

      return {
        parent,
        children: children,
        filteredChildren: filteredChildren,
        hasSearchMatch: filteredChildren.length > 0 || parent.name.toLowerCase().includes(search.trim().toLowerCase()),
      };
    }).filter(s => search.trim() === '' || s.hasSearchMatch);
  }, [categories, search, type]);

  // Auto-expand parents when searching
  useEffect(() => {
    if (search.trim().length > 0) {
      setExpandedParentIds(new Set(sections.map(s => s.parent.id)));
    }
  }, [search, sections]);

  const toggleParent = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = new Set(expandedParentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedParentIds(next);
  };

  const onSelect = (id: string) => {
    setCategoryId(id);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color={palette.text} />
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
              paddingHorizontal: CARD_PADDING,
              borderWidth: 1,
              borderColor: palette.divider,
            }}
          >
            <Feather name="search" size={16} color={palette.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${type || ''} categories...`}
              placeholderTextColor={palette.textMuted}
              style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: palette.text }}
            />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {sections.length > 0 && (
          <CardSection palette={palette}>
            {sections.map(({ parent, children, filteredChildren }, index) => {
              const isExpanded = expandedParentIds.has(parent.id);
              const hasChildren = children.length > 0;
              const isLast = index === sections.length - 1;
              
              return (
                <View key={parent.id}>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={() => hasChildren ? toggleParent(parent.id) : onSelect(parent.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: CARD_PADDING,
                      minHeight: 62,
                      borderBottomWidth: (isLast && !isExpanded) ? 0 : 1,
                      borderBottomColor: palette.divider,
                      gap: 12,
                    }}
                  >
                    <CategoryIconBadge icon={parent.icon || 'tag'} size={20} bgSize={40} palette={palette} />
                    <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text, flex: 1 }}>
                      {parent.name}
                    </Text>
                    {hasChildren && (
                      <Feather 
                        name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                        size={18} 
                        color={palette.textSoft} 
                      />
                    )}
                  </TouchableOpacity>

                  {isExpanded && hasChildren && (
                    <View style={{ backgroundColor: palette.inputBg }}>
                      {filteredChildren.map((child) => {
                        const selected = child.id === selectedCategoryId;
                        return (
                          <TouchableOpacity
                            key={child.id}
                            onPress={() => onSelect(child.id)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 12,
                              paddingLeft: CARD_PADDING + 40,
                              paddingRight: CARD_PADDING,
                              minHeight: 48,
                              borderTopWidth: 1,
                              borderTopColor: palette.divider,
                              backgroundColor: selected ? palette.brandSoft : 'transparent'
                            }}
                          >
                            <Text style={{ 
                              fontSize: 14, 
                              fontWeight: '400', 
                              color: selected ? palette.tabActive : palette.textMuted,
                              flex: 1 
                            }}>
                              {child.name}
                            </Text>
                            {selected && <Feather name="check" size={16} color={palette.tabActive} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </CardSection>
        )}

        {!sections.length ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Feather name="search" size={48} color={palette.divider} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 14, color: palette.textMuted }}>No categories found</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
