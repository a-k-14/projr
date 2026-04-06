import { Tabs } from 'expo-router';
import { View, Text, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIGHT = {
  bg: '#FFFFFF',
  border: '#E5E7EB',
  active: '#1B4332',
  inactive: '#9CA3AF',
  label: '#0A0A0A',
};

const DARK = {
  bg: '#111827',
  border: '#1F2937',
  active: '#4ADE80',
  inactive: '#6B7280',
  label: '#F9FAFB',
};

function TabIcon({
  name,
  focused,
  label,
  colors,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  label: string;
  colors: typeof LIGHT;
}) {
  const outlineName = `${name}-outline` as keyof typeof Ionicons.glyphMap;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}>
      <Ionicons
        name={focused ? name : outlineName}
        size={22}
        color={focused ? colors.active : colors.inactive}
      />
      <Text
        style={{
          fontSize: 10,
          marginTop: 2,
          color: focused ? colors.active : colors.inactive,
          fontWeight: focused ? '600' : '400',
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
  const colors = scheme === 'dark' ? DARK : LIGHT;

  const TAB_HEIGHT = 56;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: TAB_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 4,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="grid" focused={focused} label="Home" colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="list" focused={focused} label="Activity" colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="cash" focused={focused} label="Loans" colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="pricetag" focused={focused} label="Budget" colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="settings" focused={focused} label="Settings" colors={colors} />
          ),
        }}
      />
    </Tabs>
  );
}
