import { useEffect, useState, useColorScheme } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { CARD_PADDING, SCREEN_GUTTER, SPACING } from '../../lib/design';

type Tab = 'in' | 'out';

/** Feather icon names are lowercase ASCII + hyphens. Anything else is an emoji. */
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

export default function CategoriesScreen() {
  const { categories, load, isLoaded } = useCategoriesStore();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('in');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  const topLevel = categories.filter((c) => !c.parentId);
  const visible = topLevel.filter((c) => c.type === tab || c.type === 'both');

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

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
      {/* Full-width underline tabs */}
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
        }}
      >
        {(['in', 'out'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              paddingVertical: 14,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: tab === t ? palette.active : 'transparent',
              marginBottom: -1,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: tab === t ? palette.active : palette.textMuted,
              }}
            >
              {t === 'in' ? 'Income' : 'Expense'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: SPACING.md, paddingBottom: 8 }}
      >
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 20,
            marginHorizontal: SCREEN_GUTTER,
            borderWidth: 1,
            borderColor: palette.border,
            overflow: 'hidden',
          }}
        >
          {visible.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                No {tab === 'in' ? 'income' : 'expense'} categories yet.
              </Text>
            </View>
          )}

          {visible.map((cat, catIdx) => {
            const subs = subsOf(cat.id);
            const isOpen = expanded.has(cat.id);
            const isLast = catIdx === visible.length - 1;

            return (
              <View key={cat.id}>
                {/* Parent row */}
                <TouchableOpacity
                  onPress={() => toggleExpand(cat.id)}
                  activeOpacity={0.6}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: CARD_PADDING,
                    paddingVertical: 12,
                    minHeight: 62,
                    borderBottomWidth: isLast && !isOpen ? 0 : 1,
                    borderBottomColor: palette.divider,
                    gap: 12,
                  }}
                >
                  <CategoryIconBadge icon={cat.icon ?? 'tag'} size={20} bgSize={40} palette={palette} />
                  <Text
                    style={{ flex: 1, fontSize: 15, fontWeight: '500', color: palette.text }}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                  {subs.length > 0 && (
                    <Text style={{ fontSize: 12, color: palette.textMuted, marginRight: 4 }}>
                      {subs.length}
                    </Text>
                  )}
                  {/* Edit button */}
                  <TouchableOpacity
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
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="edit-2" size={14} color={palette.iconTint} />
                  </TouchableOpacity>
                  {/* Expand toggle */}
                  <Feather
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={palette.textSoft}
                  />
                </TouchableOpacity>

                {/* Expanded subcategories */}
                {isOpen && (
                  <View
                    style={{
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: palette.divider,
                    }}
                  >
                    {subs.map((sub, subIdx) => (
                      <View
                        key={sub.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingLeft: CARD_PADDING + 52,
                          paddingRight: CARD_PADDING,
                          paddingVertical: 10,
                          minHeight: 44,
                          borderTopWidth: subIdx === 0 ? 0 : 0,
                          gap: 10,
                          backgroundColor: palette.surface,
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: palette.active,
                            opacity: 0.5,
                          }}
                        />
                        <Text style={{ fontSize: 14, color: palette.textMuted }}>{sub.name}</Text>
                      </View>
                    ))}
                    {subs.length === 0 && (
                      <View
                        style={{
                          paddingLeft: CARD_PADDING + 52,
                          paddingVertical: 10,
                          backgroundColor: palette.surface,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: palette.textSoft }}>
                          No subcategories
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Fixed bottom add button */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: palette.divider,
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: SPACING.md,
          paddingBottom: insets.bottom + SPACING.md,
          backgroundColor: palette.background,
        }}
      >
        <TouchableOpacity
          onPress={() =>
            router.push({ pathname: '/settings/category-form', params: { type: tab } })
          }
          activeOpacity={0.7}
          style={{
            minHeight: 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: palette.active,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.active }}>
            + Add {tab === 'in' ? 'Income' : 'Expense'} Category
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
