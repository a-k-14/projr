import { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';
import { runMigrations } from '../db/migrate';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useUIStore } from '../stores/useUIStore';
import { useCategoriesStore } from '../stores/useCategoriesStore';
import { useAppTheme } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

import { SecurityGuard } from '../components/SecurityGuard';

export default function RootLayout() {
  const loadAccounts = useAccountsStore((s) => s.load);
  const loadSettings = useUIStore((s) => s.load);
  const loadCategories = useCategoriesStore((s) => s.load);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const { palette } = useAppTheme();

  const init = useCallback(async () => {
    setReady(false);
    setInitError(null);

    try {
      await runMigrations();
      await Promise.all([loadAccounts(), loadSettings(), loadCategories()]);
      setReady(true);
    } catch (error) {
      console.error('Init error:', error);
      setInitError(
        error instanceof Error ? error.message : 'Something went wrong while opening the app.'
      );
    } finally {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [loadAccounts, loadCategories, loadSettings]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    NavigationBar.setButtonStyleAsync(palette.navigationButtonStyle).catch(() => undefined);
  }, [palette.navigationButtonStyle]);

  if (initError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 28,
          backgroundColor: palette.background,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: palette.text,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          App couldn&apos;t start
        </Text>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: palette.textSecondary,
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          {initError}
        </Text>
        <TouchableOpacity
          onPress={init}
          activeOpacity={0.85}
          style={{
            minWidth: 140,
            minHeight: 48,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.brand,
            paddingHorizontal: 20,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: palette.onBrand }}>
            Try again
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        <SecurityGuard>
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
        </SecurityGuard>
        <StatusBar
          style={palette.statusBarStyle}
          backgroundColor={palette.background}
          translucent={false}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
