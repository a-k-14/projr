import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import { AppThemePalette, useAppTheme } from '../../lib/theme';

const TAB_ITEMS: Record<string, { icon: keyof typeof Feather.glyphMap; label: string }> = {
  index: { icon: 'grid', label: 'Home' },
  activity: { icon: 'activity', label: 'Activity' },
  loans: { icon: 'credit-card', label: 'Loans' },
  budget: { icon: 'pie-chart', label: 'Budget' },
  settings: { icon: 'settings', label: 'Settings' },
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
  const tabHeight = 60;
  const routes = state.routes;
  const itemWidth = width / Math.max(routes.length, 1);
  const pillWidth = 58;
  const indicatorX = useSharedValue(state.index * itemWidth + (itemWidth - pillWidth) / 2);

  useEffect(() => {
    indicatorX.value = withTiming(state.index * itemWidth + (itemWidth - pillWidth) / 2, { duration: 190 });
  }, [indicatorX, itemWidth, state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      style={{
        height: tabHeight + insetsBottom,
        paddingBottom: insetsBottom,
        backgroundColor: palette.surface,
        borderTopWidth: 1,
        borderTopColor: palette.border,
      }}
    >
      <View style={{ height: tabHeight, flexDirection: 'row', position: 'relative' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 5,
              left: 0,
              width: pillWidth,
              height: 30,
              borderRadius: HOME_RADIUS.tab,
              borderWidth: 1,
              borderColor: palette.borderSoft,
              backgroundColor: palette.inputBg,
            },
            indicatorStyle,
          ]}
        />
        {routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const item = TAB_ITEMS[route.name] ?? TAB_ITEMS.index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
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
                alignItems: 'center',
                paddingTop: 9,
              }}
            >
              <Feather name={item.icon} size={20} color={focused ? palette.text : palette.tabInactive} />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: HOME_TEXT.tiny,
                  lineHeight: 13,
                  marginTop: 8,
                  color: focused ? palette.text : palette.tabInactive,
                  fontWeight: '500',
                  textAlign: 'center',
                  includeFontPadding: false,
                }}
              >
                {item.label}
              </Text>
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
      <Tabs.Screen name="index" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen
        name="loans"
        listeners={{
          tabPress: () => {
            router.navigate('/(tabs)/loans');
          },
        }}
      />
      <Tabs.Screen
        name="budget"
        listeners={{
          tabPress: () => {
            router.navigate('/(tabs)/budget');
          },
        }}
      />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
