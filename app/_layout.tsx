import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { runMigrations } from '../db/migrate';
import { seedDatabase } from '../db/seed';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useUIStore } from '../stores/useUIStore';
import { useCategoriesStore } from '../stores/useCategoriesStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const loadAccounts = useAccountsStore((s) => s.load);
  const loadSettings = useUIStore((s) => s.load);
  const loadCategories = useCategoriesStore((s) => s.load);

  useEffect(() => {
    async function init() {
      try {
        await runMigrations();
        await seedDatabase();
        await Promise.all([loadAccounts(), loadSettings(), loadCategories()]);
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        SplashScreen.hideAsync();
      }
    }
    init();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="loan/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="modals/add-transaction"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="modals/add-loan"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}
