import { useCallback, useEffect, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { View, ActivityIndicator } from 'react-native';
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
import { HOME_TEXT } from '../lib/layoutTokens';
import { markStarterDataSeeded, shouldAutoSeedStarterData } from '../services/settings';
import { FilledButton } from '../components/ui/AppButton';

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

      // Only seed starter data on a true first run, not after a user-triggered reset.
      if (
        useAccountsStore.getState().accounts.length === 0 &&
        await shouldAutoSeedStarterData()
      ) {
        const { seedDatabase } = await import('../db/seed');
        await seedDatabase();
        await markStarterDataSeeded();
        // Reload stores to reflect newly seeded data
        await Promise.all([loadAccounts(), loadCategories()]);
      }

      setReady(true);
    } catch (error) {
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
          backgroundColor: palette.background }}
      >
        <Text
          style={{
            fontSize: HOME_TEXT.heroValue,
            fontWeight: '700',
            color: palette.text,
            marginBottom: 12,
            textAlign: 'center' }}
        >
          App couldn&apos;t start
        </Text>
        <Text
          style={{
            fontSize: HOME_TEXT.sectionTitle,
            lineHeight: 22,
            color: palette.textSecondary,
            textAlign: 'center',
            marginBottom: 24 }}
        >
          {initError}
        </Text>
        <FilledButton
          label="Try again"
          onPress={init}
          palette={palette}
          style={{ minWidth: 140 }}
        />
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
          backgroundColor: palette.background }}
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
              animationDuration: 200,
              contentStyle: {
                backgroundColor: palette.background } }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="budget/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="loan/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="chart-prototype" options={{ headerShown: false }} />
            <Stack.Screen name="net-worth-prototype" options={{ headerShown: false }} />
            <Stack.Screen
              name="modals/add-transaction"
              options={{ headerShown: false }}
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
              name="modals/select-budget-category"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="modals/budget-form"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="modals/loan-settlement"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="modals/split-transaction"
              options={{ headerShown: false }}
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
