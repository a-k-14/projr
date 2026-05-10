import { AppIcon, IconName } from '@/components/ui/AppIcon';
import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HOME_RADIUS } from '../../lib/layoutTokens';
import { getTabReset, runAfterTabHidden } from '../../lib/tabResetRegistry';
import { AppThemePalette, useAppTheme } from '../../lib/theme';

const TAB_ITEMS: Record<string, { icon: IconName }> = {
  index: { icon: 'layout-panel-left' },
  activity: { icon: 'activity' },
  insights: { icon: 'bar-chart-2' },
  settings: { icon: 'settings' },
};

const VISIBLE_TAB_NAMES = ['index', 'activity', 'insights', 'settings'] as const;
const TAB_BAR_SLOTS = ['index', 'activity', 'add', 'insights', 'settings'] as const;

const BACKGROUND_RESET_ENABLED: Record<string, boolean> = {
  index: true,
  activity: true,
  deposits: true,
  loans: true,
  insights: true,
  budget: true,
  settings: true,
};

function AppTabBar({
  state,
  navigation,
  insetsBottom,
  palette,
}: {
  state: any;
  navigation: any;
  insetsBottom: number;
  palette: AppThemePalette;
}) {
  const { width } = useWindowDimensions();
  const tabHeight = 56;
  const routes = VISIBLE_TAB_NAMES
    .map((name) => state.routes.find((route: any) => route.name === name))
    .filter(Boolean);
  const itemWidth = width / TAB_BAR_SLOTS.length;
  const pillWidth = 50;
  const pillHeight = 36;
  const activeRouteName = state.routes[state.index]?.name;
  const activeSlotIndex = TAB_BAR_SLOTS.findIndex((slot) => slot === activeRouteName);
  const indicatorX = useSharedValue(Math.max(activeSlotIndex, 0) * itemWidth + (itemWidth - pillWidth) / 2);

  useEffect(() => {
    indicatorX.value = withTiming(Math.max(activeSlotIndex, 0) * itemWidth + (itemWidth - pillWidth) / 2, { duration: 210 });
  }, [activeSlotIndex, indicatorX, itemWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      style={{
        height: tabHeight + insetsBottom,
        paddingBottom: insetsBottom,
        backgroundColor: palette.surface,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: palette.isDark ? 0.12 : 0.05,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      <View style={{ height: tabHeight, flexDirection: 'row', position: 'relative' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: (tabHeight - pillHeight) / 2,
              left: 0,
              width: pillWidth,
              height: pillHeight,
              borderRadius: HOME_RADIUS.tab + 2,
              borderWidth: 1,
              borderColor: palette.brand,
              backgroundColor: palette.brandSoft,
              opacity: activeSlotIndex >= 0 ? 1 : 0,
            },
            indicatorStyle,
          ]}
        />
        {TAB_BAR_SLOTS.map((slot) => {
          if (slot === 'add') {
            return (
              <TouchableOpacity
                key="add"
                delayPressIn={0}
                activeOpacity={0.88}
                onPress={() => router.push('/modals/add-transaction')}
                style={{
                  width: itemWidth,
                  height: tabHeight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 42,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: palette.isDark ? palette.surfaceRaised : palette.text,
                    borderWidth: 1,
                    borderColor: palette.isDark ? palette.borderSoft : '#24345A',
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: palette.isDark ? 0.20 : 0.14,
                    shadowRadius: 8,
                    elevation: 5,
                  }}
                >
                  <AppIcon
                    name="plus"
                    size={22}
                    color={palette.isDark ? palette.listText : palette.surface}
                    strokeWidth={1.8}
                  />
                </View>
              </TouchableOpacity>
            );
          }

          const route = routes.find((item: any) => item.name === slot);
          if (!route) return null;

          const focused = activeRouteName === route.name;
          const item = TAB_ITEMS[route.name] ?? TAB_ITEMS.index;

          const onPress = () => {
            const leavingRouteName = state.routes[state.index]?.name;
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (event.defaultPrevented) {
              return;
            }

            if (focused) {
              getTabReset(route.name)?.({ mode: 'full', animated: true });
              return;
            }

            navigation.navigate(route.name, route.params);
            if (leavingRouteName && BACKGROUND_RESET_ENABLED[leavingRouteName]) {
              runAfterTabHidden(() => {
                const latestState = navigation.getState?.();
                const latestRouteName = latestState?.routes?.[latestState.index]?.name;
                if (latestRouteName !== leavingRouteName) {
                  getTabReset(leavingRouteName)?.({ mode: 'background', animated: false });
                }
              });
            }
          };

          return (
            <TouchableOpacity
              delayPressIn={0}
              key={route.key}
              activeOpacity={0.82}
              onPress={onPress}
              style={{
                width: itemWidth,
                height: tabHeight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon
                name={item.icon as any}
                size={21}
                color={focused ? palette.brand : palette.textSecondary}
                strokeWidth={focused ? 2 : 1.75}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();

  return (
    <Tabs
      tabBar={(props) => (
        <AppTabBar
          {...props}
          insetsBottom={insets.bottom}
          palette={palette}
        />
      )}
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        sceneStyle: {
          backgroundColor: palette.background,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ freezeOnBlur: false }} />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
