import { AppIcon, IconName } from '@/components/ui/AppIcon';
import { router, Tabs } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HOME_RADIUS } from '../../lib/layoutTokens';
import { getTabReset, runAfterTabHidden } from '../../lib/tabResetRegistry';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { PressableScale } from '../../components/ui/PressableScale';

const TAB_ITEMS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'house', label: 'Home' },
  activity: { icon: 'activity', label: 'Activity' },
  insights: { icon: 'chart-column-increasing', label: 'Insights' },
  settings: { icon: 'settings', label: 'Settings' },
};

const VISIBLE_TAB_NAMES = ['index', 'activity', 'insights', 'settings'] as const;
const TAB_BAR_SLOTS = ['index', 'activity', 'add', 'insights', 'settings'] as const;

const BACKGROUND_RESET_ENABLED: Record<string, boolean> = {
  index: true,
  // Activity background reset preserves filters but clears scroll state.
  activity: true,
  deposits: true,
  loans: true,
  insights: true,
  budget: true,
  settings: true,
};

function TabIcon({
  name,
  focused,
  palette,
}: {
  name: IconName;
  focused: boolean;
  palette: AppThemePalette;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.12 : 1, {
      damping: 14,
      stiffness: 320,
      mass: 0.5,
    });
  }, [focused]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <AppIcon
        name={name}
        size={20}
        color={focused ? palette.brand : palette.textSecondary}
        strokeWidth={1.8}
      />
    </Animated.View>
  );
}

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
  const tabHeight = 64;
  const routes = VISIBLE_TAB_NAMES
    .map((name) => state.routes.find((route: any) => route.name === name))
    .filter(Boolean);
  const itemWidth = width / TAB_BAR_SLOTS.length;
  const pillWidth = 50;
  const pillHeight = 36;
  const activeRouteName = state.routes[state.index]?.name;
  const activeSlotIndex = TAB_BAR_SLOTS.findIndex((slot) => slot === activeRouteName);
  const targetSlotIndex = activeSlotIndex >= 0 ? activeSlotIndex : 0;

  const getPillTarget = (slotIndex: number) =>
    Math.max(slotIndex, 0) * itemWidth + (itemWidth - pillWidth) / 2;
  const pillX = useSharedValue(getPillTarget(targetSlotIndex));
  const hasAnimatedPillRef = useRef(false);

  useEffect(() => {
    const nextX = getPillTarget(targetSlotIndex);
    if (!hasAnimatedPillRef.current) {
      pillX.value = nextX;
      hasAnimatedPillRef.current = true;
      return;
    }
    pillX.value = withSpring(nextX, {
      damping: 24,
      stiffness: 420,
      mass: 0.45,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSlotIndex, itemWidth]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  return (
    <View style={{ width: '100%', position: 'relative', overflow: 'visible' }}>
      <LinearGradient
        colors={palette.gradients.tabShadow}
        style={{
          position: 'absolute',
          top: -12,
          left: 0,
          right: 0,
          height: 12,
          zIndex: 1,
        }}
      />
      <View
        style={{
          width: '100%',
          height: tabHeight + insetsBottom,
          paddingBottom: insetsBottom,
          backgroundColor: palette.background,
          borderTopWidth: 0,
          ...palette.states.tabShadow,
        }}
      >
      <View style={{ height: tabHeight, flexDirection: 'row', position: 'relative' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 14,
              left: 0,
              width: pillWidth,
              height: pillHeight,
              borderRadius: HOME_RADIUS.tab + 2,
              borderWidth: 1,
              borderColor: palette.brand,
              backgroundColor: palette.brandSoft,
              opacity: activeSlotIndex >= 0 ? 1 : 0,
            },
            pillStyle,
          ]}
        />
        {TAB_BAR_SLOTS.map((slot) => {
          if (slot === 'add') {
            return (
              <PressableScale
                key="add"
                onPress={() => router.push('/modals/add-transaction')}
                activeScale={0.94}
                style={{
                  width: itemWidth,
                  height: tabHeight,
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  paddingTop: 10,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 4,
                    borderRadius: HOME_RADIUS.tab + 2,
                    backgroundColor: palette.card,
                  }}
                >
                  <View
                    style={{
                      width: 54,
                      height: 44,
                      borderRadius: HOME_RADIUS.tab - 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: palette.states.tabFabBg,
                      elevation: 0,
                    }}
                  >
                    <AppIcon
                      name="plus"
                      size={22}
                      color={palette.states.tabFabIcon}
                      strokeWidth={1.8}
                    />
                  </View>
                </View>
              </PressableScale>
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

            if (event.defaultPrevented) return;

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
            <PressableScale
              key={route.key}
              onPress={onPress}
              activeScale={0.92}
              style={{
                width: itemWidth,
                height: tabHeight,
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: 21,
              }}
            >
              <TabIcon
                name={item.icon as any}
                focused={focused}
                palette={palette}
              />
            </PressableScale>
          );
        })}
      </View>
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
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          overflow: 'visible',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ freezeOnBlur: false }} />
      <Tabs.Screen name="activity" options={{ lazy: false, freezeOnBlur: false }} />
      <Tabs.Screen name="insights" options={{ lazy: false }} />
      <Tabs.Screen name="settings" options={{ lazy: false }} />
    </Tabs>
  );
}
