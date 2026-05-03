import { AppChevron } from '@/components/ui/AppChevron';
import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CardSection,
  FixedBottomActions
} from '../../components/settings-ui';
import { CATEGORY_TREE_ROW, CategoryIconBadge } from '../../components/ui/CategoryTreePicker';
import { CARD_PADDING, TYPE } from '../../lib/design';
import { HOME_LAYOUT } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { useCategoriesStore } from '../../stores/useCategoriesStore';

type Tab = 'in' | 'out';

export default function CategoriesScreen() {
  const { categories, load, isLoaded } = useCategoriesStore();
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('in');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const pagerRef = useRef<ScrollView | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  const topLevel = categories.filter((c) => !c.parentId);
  const visibleByTab = useMemo(
    () => ({
      in: topLevel.filter((c) => c.type === 'in' || c.type === 'both'),
      out: topLevel.filter((c) => c.type === 'out' || c.type === 'both')
    }),
    [topLevel],
  );

  useEffect(() => {
    const index = tab === 'in' ? 0 : 1;
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
  }, [tab, width]);

  const underlineTranslateX = Animated.divide(scrollX, 2);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function subsOf(parentId: string) {
    return categories.filter((c) => c.parentId === parentId);
  }

  const renderCategoryList = (kind: Tab) => {
    const visible = visibleByTab[kind];
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 42 }}
        showsVerticalScrollIndicator={false}
      >
        <CardSection palette={palette}>
          {visible.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted, fontSize: TYPE.rowValue }}>
                No {kind === 'in' ? 'income' : 'expense'} categories yet.
              </Text>
            </View>
          )}

          {visible.map((cat, catIdx) => {
            const subs = subsOf(cat.id);
            const isOpen = expanded.has(cat.id);
            const isLast = catIdx === visible.length - 1;

            return (
              <View key={cat.id}>
                <TouchableOpacity delayPressIn={0}
                  onPress={() => toggleExpand(cat.id)}
                  activeOpacity={0.6}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: CARD_PADDING,
                    paddingVertical: 12,
                    minHeight: CATEGORY_TREE_ROW.parentMinHeight,
                    borderBottomWidth: isLast && !isOpen ? 0 : 1,
                    borderBottomColor: palette.divider,
                    gap: CATEGORY_TREE_ROW.rowGap
                  }}
                >
                  <CategoryIconBadge icon={cat.icon ?? 'tag'} size={HOME_LAYOUT.listIconInnerSize} bgSize={40} palette={palette} />
                  <Text
                    style={{ flex: 1, fontSize: TYPE.rowLabel, fontWeight: '400', color: palette.text }}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                  {subs.length > 0 && (
                    <Text style={{ fontSize: TYPE.caption, color: palette.textMuted, marginRight: 4 }}>
                      {subs.length}
                    </Text>
                  )}
                  <TouchableOpacity delayPressIn={0}
                    onPress={() =>
                      router.push({ pathname: '/settings/category-form', params: { id: cat.id } })
                    }
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: palette.inputBg,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <AppIcon name="edit-2" size={14} color={palette.iconTint} />
                  </TouchableOpacity>
                  <AppChevron direction={isOpen ? 'up' : 'down'} size={18} tone="secondary" palette={palette} />
                </TouchableOpacity>

                {isOpen && (
                  <View
                    style={{
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: palette.divider,
                      backgroundColor: palette.inputBg
                    }}
                  >
                    {subs.map((sub) => (
                      <View
                        key={sub.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingLeft: CATEGORY_TREE_ROW.childIndent,
                          paddingRight: CARD_PADDING,
                          paddingVertical: 12,
                          minHeight: 56,
                          gap: 10,
                          borderTopWidth: 1,
                          borderTopColor: palette.divider
                        }}
                      >
                        <Text
                          style={{ flex: 1, fontSize: TYPE.section, color: palette.textSecondary, fontWeight: '400' }}
                          numberOfLines={1}
                        >
                          {sub.name}
                        </Text>
                      </View>
                    ))}
                    {subs.length === 0 && (
                      <View
                        style={{
                          paddingLeft: CATEGORY_TREE_ROW.childIndent,
                          paddingRight: CARD_PADDING,
                          paddingVertical: 12,
                          borderTopWidth: 1,
                          borderTopColor: palette.divider
                        }}
                      >
                        <Text style={{ fontSize: TYPE.body, color: palette.textSoft }}>No subcategories</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </CardSection>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flex: 1 }}>
        <Stack.Screen
          options={{
            title: 'Categories',
            headerRight: undefined,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            width: '100%',
            borderBottomWidth: 1,
            borderBottomColor: palette.divider,
            marginBottom: 8,
            position: 'relative'
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              bottom: -1,
              width: `${50}%`,
              height: 2,
              backgroundColor: palette.brand,
              transform: [{ translateX: underlineTranslateX }]
            }}
          />
          {(['in', 'out'] as const).map((t) => (
            <TouchableOpacity delayPressIn={0}
              key={t}
              onPress={() => setTab(t)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                paddingVertical: 14,
                alignItems: 'center'
              }}
            >
              <Text
                style={{
                  fontSize: TYPE.rowValue,
                  fontWeight: '600',
                  color: tab === t ? palette.brand : palette.textMuted
                }}
              >
                {t === 'in' ? 'Income' : 'Expense'} ({visibleByTab[t].length})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Animated.ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
            setTab(next === 0 ? 'in' : 'out');
          }}
        >
          <View style={{ width }}>{renderCategoryList('in')}</View>
          <View style={{ width }}>{renderCategoryList('out')}</View>
        </Animated.ScrollView>

        <FixedBottomActions palette={palette}>
          <TouchableOpacity
            delayPressIn={0}
            onPress={() => router.push({ pathname: '/settings/category-form', params: { type: tab } })}
            activeOpacity={0.7}
            style={{
              minHeight: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: palette.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: TYPE.body, fontWeight: '600', color: palette.brand }}>
              + Add Category
            </Text>
          </TouchableOpacity>
        </FixedBottomActions>
      </View>
    </SafeAreaView>
  );
}
