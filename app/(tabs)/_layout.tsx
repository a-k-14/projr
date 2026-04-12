import { Tabs, router } from 'expo-router';
import { View, Text, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';

function TabIcon({
  name,
  focused,
  label,
  active,
  inactive,
}: {
  name: keyof typeof Feather.glyphMap;
  focused: boolean;
  label: string;
  active: string;
  inactive: string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 4,
        width: 74,
      }}
    >
      <Feather name={name} size={20} color={focused ? active : inactive} />
      <Text
        numberOfLines={1}
        style={{
          fontSize: 11,
          lineHeight: 13,
          marginTop: 4,
          color: focused ? active : inactive,
          fontWeight: '500',
          textAlign: 'center',
          includeFontPadding: false,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));

  const TAB_HEIGHT = 60;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: {
          backgroundColor: palette.background,
        },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          height: TAB_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          paddingHorizontal: 2,
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="grid"
              focused={focused}
              label="Home"
              active={palette.tabActive}
              inactive={palette.tabInactive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="activity"
              focused={focused}
              label="Activity"
              active={palette.tabActive}
              inactive={palette.tabInactive}
            />
          ),
        }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push({
              pathname: '/(tabs)/activity',
              params: { source: 'activity-tab', ts: String(Date.now()) },
            });
          },
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="credit-card"
              focused={focused}
              label="Loans"
              active={palette.tabActive}
              inactive={palette.tabInactive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="pie-chart"
              focused={focused}
              label="Budget"
              active={palette.tabActive}
              inactive={palette.tabInactive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="settings"
              focused={focused}
              label="Settings"
              active={palette.tabActive}
              inactive={palette.tabInactive}
            />
          ),
        }}
      />
    </Tabs>
  );
}
