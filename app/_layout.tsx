import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';
import { runMigrations } from '../db/migrate';
import { seedDatabase } from '../db/seed';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useUIStore } from '../stores/useUIStore';
import { useCategoriesStore } from '../stores/useCategoriesStore';
import { useAppTheme } from '../lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const loadAccounts = useAccountsStore((s) => s.load);
  const loadSettings = useUIStore((s) => s.load);
  const loadCategories = useCategoriesStore((s) => s.load);
  const [ready, setReady] = useState(false);
  const { palette } = useAppTheme();

  useEffect(() => {
    async function init() {
      try {
        await runMigrations();
        await seedDatabase();
        await Promise.all([loadAccounts(), loadSettings(), loadCategories()]);
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setReady(true);
        SplashScreen.hideAsync();
      }
    }
    init();
  }, []);

  useEffect(() => {
    NavigationBar.setButtonStyleAsync(palette.navigationButtonStyle).catch(() => undefined);
  }, [palette.navigationButtonStyle]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.background,
        }}
      >
        <ActivityIndicator size="large" color={palette.tabActive} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            contentStyle: {
              backgroundColor: palette.background,
            },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="budget/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="loan/[id]" options={{ headerShown: false }} />
          <Stack.Screen
            name="modals/add-transaction"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="modals/select-account"
            options={{ presentation: 'transparentModal', headerShown: false }}
          />
          <Stack.Screen
            name="modals/select-tag"
            options={{ presentation: 'transparentModal', headerShown: false }}
          />
          <Stack.Screen
            name="modals/select-category"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="modals/select-budget-category"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="modals/calculator"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="modals/budget-form"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="modals/loan-settlement"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="modals/split-transaction"
            options={{ presentation: 'modal', headerShown: false }}
          />
        </Stack>
        <StatusBar
          style={palette.statusBarStyle}
          backgroundColor={palette.background}
          translucent={false}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
