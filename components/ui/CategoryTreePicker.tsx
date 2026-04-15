import { Feather } from '@expo/vector-icons';
import { LayoutAnimation, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardSection } from '../settings-ui';
import { CARD_PADDING, SCREEN_GUTTER } from '../../lib/design';
import type { AppThemePalette } from '../../lib/theme';

type PickerCategory = {
  id: string;
  name: string;
  icon?: string | null;
};

type PickerSection = {
  parent: PickerCategory;
  children: PickerCategory[];
  filteredChildren: PickerCategory[];
};

function isEmoji(icon: string) {
  return !/^[a-z-]+$/.test(icon);
}

function CategoryIconBadge({
  icon,
  size = 20,
  bgSize = 40,
  palette,
}: {
  icon: string;
  size?: number;
  bgSize?: number;
  palette: AppThemePalette;
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

export function CategoryTreePicker({
  title,
  search,
  onSearchChange,
  searchPlaceholder,
  sections,
  selectedCategoryId,
  expandedParentIds,
  setExpandedParentIds,
  onBack,
  onSelect,
  palette,
  emptyMessage = 'No categories found',
}: {
  title: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  sections: PickerSection[];
  selectedCategoryId?: string;
  expandedParentIds: Set<string>;
  setExpandedParentIds: (value: Set<string>) => void;
  onBack: () => void;
  onSelect: (id: string) => void;
  palette: AppThemePalette;
  emptyMessage?: string;
}) {
  const insets = useSafeAreaInsets();

  const toggleParent = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = new Set(expandedParentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedParentIds(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity onPress={onBack} style={{ padding: 4, marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text, flex: 1 }}>
            {title}
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
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={palette.textMuted}
              style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: palette.text }}
            />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {sections.length > 0 ? (
          <CardSection palette={palette}>
            {sections.map(({ parent, children, filteredChildren }, index) => {
              const isExpanded = expandedParentIds.has(parent.id);
              const hasChildren = children.length > 0;
              const isLast = index === sections.length - 1;
              const selected = parent.id === selectedCategoryId;

              return (
                <View key={parent.id}>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={() => (hasChildren ? toggleParent(parent.id) : onSelect(parent.id))}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: CARD_PADDING,
                      minHeight: 62,
                      borderBottomWidth: isLast && !isExpanded ? 0 : 1,
                      borderBottomColor: palette.divider,
                      backgroundColor: selected ? palette.brandSoft : 'transparent',
                      gap: 12,
                    }}
                  >
                    <CategoryIconBadge icon={parent.icon || 'tag'} palette={palette} />
                    <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text, flex: 1 }} numberOfLines={1}>
                      {parent.name}
                    </Text>
                    {hasChildren ? (
                      <Feather
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={palette.textSoft}
                      />
                    ) : selected ? (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: palette.tabActive,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name="check" size={13} color={palette.onBrand} />
                      </View>
                    ) : null}
                  </TouchableOpacity>

                  {isExpanded && hasChildren ? (
                    <View style={{ backgroundColor: palette.inputBg }}>
                      {filteredChildren.map((child) => {
                        const childSelected = child.id === selectedCategoryId;
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
                              minHeight: 52,
                              borderTopWidth: 1,
                              borderTopColor: palette.divider,
                              backgroundColor: childSelected ? palette.brandSoft : 'transparent',
                            }}
                          >
                            <Text style={{ fontSize: 15, fontWeight: '400', color: palette.text, flex: 1 }} numberOfLines={1}>
                              {child.name}
                            </Text>
                            {childSelected ? (
                              <View
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 11,
                                  backgroundColor: palette.tabActive,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Feather name="check" size={13} color={palette.onBrand} />
                              </View>
                            ) : (
                              <Feather name="chevron-right" size={16} color={palette.textSoft} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </CardSection>
        ) : (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Feather name="search" size={48} color={palette.divider} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 14, color: palette.textMuted }}>{emptyMessage}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
