import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import {
  CardSection,
  FixedBottomActions,
  SettingsScreenLayout,
} from '../../components/settings-ui';
import { CARD_PADDING } from '../../lib/design';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';

type Tab = 'in' | 'out';

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
    <SettingsScreenLayout
      palette={palette}
      bottomAction={
        <FixedBottomActions palette={palette}>
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
        </FixedBottomActions>
      }
    >
      {/* Underline tabs - kept inside ScrollView for list context but could be fixed header */}
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
          marginBottom: 16,
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

      <CardSection palette={palette}>
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
                      <Text style={{ fontSize: 13, color: palette.textSoft }}>No subcategories</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </CardSection>
    </SettingsScreenLayout>
  );
}
