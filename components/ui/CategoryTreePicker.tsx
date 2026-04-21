import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text } from '@/components/ui/AppText';
import { LayoutAnimation, ScrollView, TextInput, View, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardSection } from '../settings-ui';
import { CARD_PADDING, SCREEN_GUTTER } from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
import { isEmojiIcon } from '../../lib/ui-format';
import type { AppThemePalette } from '../../lib/theme';

type PickerCategory = {
  id: string;
  name: string;
  icon?: string | null;
};

export type PickerSection = {
  parent: PickerCategory;
  children: PickerCategory[];
  filteredChildren: PickerCategory[];
  hasSearchMatch?: boolean;
};

export const CATEGORY_TREE_ROW = {
  parentMinHeight: 62,
  childMinHeight: 52,
  rowGap: 12,
  childIndent: CARD_PADDING + 40 } as const;

export function buildCategoryPickerSections<T extends PickerCategory & { parentId?: string | null; type?: string }>({
  categories,
  search,
  parentFilter,
  childFilter,
  requireChildren = false,
}: {
  categories: T[];
  search: string;
  parentFilter?: (category: T) => boolean;
  childFilter?: (category: T, parent: T) => boolean;
  requireChildren?: boolean;
}): PickerSection[] {
  const normalizedSearch = search.trim().toLowerCase();
  const parents = categories
    .filter((category) => category.parentId == null && (!parentFilter || parentFilter(category)))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  return parents
    .map((parent) => {
      const children = categories
        .filter((category) => category.parentId === parent.id && (!childFilter || childFilter(category, parent)))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
      const filteredChildren = children.filter((child) => {
        if (!normalizedSearch) return true;
        return `${parent.name} ${child.name}`.toLowerCase().includes(normalizedSearch);
      });

      return {
        parent,
        children,
        filteredChildren,
        hasSearchMatch: filteredChildren.length > 0 || parent.name.toLowerCase().includes(normalizedSearch),
      };
    })
    .filter((section) => !requireChildren || section.children.length > 0)
    .filter((section) => !normalizedSearch || section.hasSearchMatch);
}

export function CategoryIconBadge({
  icon,
  size = 20,
  bgSize = 40,
  palette,
  backgroundColor,
  borderColor,
  iconColor,
  showBorder = false }: {
  icon: string;
  size?: number;
  bgSize?: number;
  palette: AppThemePalette;
  backgroundColor?: string;
  borderColor?: string;
  iconColor?: string;
  showBorder?: boolean;
}) {
  return (
    <View
      style={{
        width: bgSize,
        height: bgSize,
        borderRadius: bgSize * 0.28,
        backgroundColor: backgroundColor ?? palette.inputBg,
        borderWidth: showBorder ? 1 : 0,
        borderColor: borderColor ?? palette.border,
        alignItems: 'center',
        justifyContent: 'center' }}
    >
      {isEmojiIcon(icon) ? (
        <Text style={{ fontSize: size }}>{icon}</Text>
      ) : (
        <Feather name={icon as any} size={size} color={iconColor ?? palette.iconTint} />
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
  emptyMessage = 'No categories found' }: {
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

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity delayPressIn={0} onPress={onBack} style={{ padding: 4, marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, flex: 1 }}>
            {title}
          </Text>
          <TouchableOpacity delayPressIn={0} onPress={() => { onBack(); router.push('/settings/categories'); }} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
            <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.brand }}>Manage</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <CategoryTreePickerContent
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        sections={sections}
        selectedCategoryId={selectedCategoryId}
        expandedParentIds={expandedParentIds}
        setExpandedParentIds={setExpandedParentIds}
        onSelect={onSelect}
        palette={palette}
        emptyMessage={emptyMessage}
        contentBottomPadding={insets.bottom + 24}
      />
    </View>
  );
}

export function CategoryTreePickerContent({
  search,
  onSearchChange,
  searchPlaceholder,
  sections,
  selectedCategoryId,
  expandedParentIds,
  setExpandedParentIds,
  onSelect,
  palette,
  emptyMessage,
  maxListHeight,
  contentBottomPadding = 24,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  sections: PickerSection[];
  selectedCategoryId?: string;
  expandedParentIds: Set<string>;
  setExpandedParentIds: (value: Set<string>) => void;
  onSelect: (id: string) => void;
  palette: AppThemePalette;
  emptyMessage?: string;
  maxListHeight?: number;
  contentBottomPadding?: number;
}) {
  return (
    <View style={{ flex: 1 }}>
      <CategorySearchBox
        search={search}
        onSearchChange={onSearchChange}
        placeholder={searchPlaceholder}
        palette={palette}
      />

      <ScrollView style={maxListHeight ? { maxHeight: maxListHeight } : undefined} contentContainerStyle={{ paddingBottom: contentBottomPadding }} keyboardShouldPersistTaps="handled">
        <CategoryTreeList
          sections={sections}
          selectedCategoryId={selectedCategoryId}
          expandedParentIds={expandedParentIds}
          setExpandedParentIds={setExpandedParentIds}
          onSelect={onSelect}
          palette={palette}
          emptyMessage={emptyMessage}
        />
      </ScrollView>
    </View>
  );
}

export function CategorySearchBox({
  search,
  onSearchChange,
  placeholder,
  palette,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  palette: AppThemePalette;
}) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: palette.surface,
          borderRadius: 16,
          paddingHorizontal: CARD_PADDING,
          borderWidth: 1,
          borderColor: palette.divider }}
      >
        <Feather name="search" size={16} color={palette.textMuted} />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: HOME_TEXT.sectionTitle, color: palette.text }}
        />
      </View>
    </View>
  );
}

export function CategoryTreeList({
  sections,
  selectedCategoryId,
  expandedParentIds,
  setExpandedParentIds,
  onSelect,
  palette,
  emptyMessage = 'No categories found',
}: {
  sections: PickerSection[];
  selectedCategoryId?: string;
  expandedParentIds: Set<string>;
  setExpandedParentIds: (value: Set<string>) => void;
  onSelect: (id: string) => void;
  palette: AppThemePalette;
  emptyMessage?: string;
}) {
  const toggleParent = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = new Set(expandedParentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedParentIds(next);
  };

  return (
    <View>
        {sections.length > 0 ? (
          <CardSection palette={palette}>
            {sections.map(({ parent, children, filteredChildren }, index) => {
              const isExpanded = expandedParentIds.has(parent.id);
              const hasChildren = children.length > 0;
              const isLast = index === sections.length - 1;
              const selected = parent.id === selectedCategoryId;

              return (
                <View key={parent.id}>
                  <TouchableOpacity delayPressIn={0}
                    activeOpacity={0.6}
                    onPress={() => (hasChildren ? toggleParent(parent.id) : onSelect(parent.id))}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: CARD_PADDING,
                      minHeight: CATEGORY_TREE_ROW.parentMinHeight,
                      borderBottomWidth: isLast && !isExpanded ? 0 : 1,
                      borderBottomColor: palette.divider,
                      backgroundColor: selected ? palette.brandSoft : 'transparent',
                      gap: CATEGORY_TREE_ROW.rowGap }}
                  >
                    <CategoryIconBadge icon={parent.icon || 'tag'} palette={palette} />
                    <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '500', color: palette.text, flex: 1 }} numberOfLines={1}>
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
                          justifyContent: 'center' }}
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
                          <TouchableOpacity delayPressIn={0}
                            key={child.id}
                            onPress={() => onSelect(child.id)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 12,
                              paddingLeft: CATEGORY_TREE_ROW.childIndent,
                              paddingRight: CARD_PADDING,
                              minHeight: CATEGORY_TREE_ROW.childMinHeight,
                              borderTopWidth: 1,
                              borderTopColor: palette.divider,
                              backgroundColor: childSelected ? palette.brandSoft : 'transparent' }}
                          >
                            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '400', color: palette.text, flex: 1 }} numberOfLines={1}>
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
                                  justifyContent: 'center' }}
                              >
                                <Feather name="check" size={13} color={palette.onBrand} />
                              </View>
                            ) : null}
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
            <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted }}>{emptyMessage}</Text>
          </View>
        )}
    </View>
  );
}
