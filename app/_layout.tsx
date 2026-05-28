import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { AppState, View, ActivityIndicator, Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as QuickActions from 'expo-quick-actions';
import { useTransactionDraftStore } from '../stores/useTransactionDraftStore';
import '../widgets/widgetTaskHandler';
import { updateAllReniWidgets } from '../widgets/widgetTaskHandler';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { runMigrations } from '../db/migrate';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useUIStore } from '../stores/useUIStore';
import { useCategoriesStore } from '../stores/useCategoriesStore';
import { useFixedDepositsStore } from '../stores/useFixedDepositsStore';
import { useLoansStore } from '../stores/useLoansStore';
import { useAssetsStore } from '../stores/useAssetsStore';
import { useAppTheme } from '../lib/theme';
import { FONT_WEIGHT } from '../lib/design';
import { HOME_TEXT } from '../lib/layoutTokens';
import { markStarterDataSeeded, shouldAutoSeedStarterData } from '../services/settings';
import { isAutoBackupDue, runAutoBackup } from '../services/backup';
import { FilledButton } from '../components/ui/AppButton';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
// Skip the 400ms fade-out animation. On warm-resume (activity recreated, JS alive)
// this is what makes the splash feel like a "loading screen" rather than a flash —
// the system splash itself is OS-controlled (~150ms minimum on Android 12+), but
// the fade animation on top of it is fully under our control.
SplashScreen.setOptions({ duration: 0 });

import { ErrorBoundary } from '../components/ErrorBoundary';
import { SecurityGuard } from '../components/SecurityGuard';

export default function RootLayout() {
  const loadAccounts = useAccountsStore((s) => s.load);
  const loadSettings = useUIStore((s) => s.load);
  const loadCategories = useCategoriesStore((s) => s.load);
  const loadDeposits = useFixedDepositsStore((s) => s.load);
  const loadLoans = useLoansStore((s) => s.load);
  const loadAssets = useAssetsStore((s) => s.load);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const { palette } = useAppTheme();

  const init = useCallback(async () => {
    setReady(false);
    setInitError(null);

    try {
      await runMigrations();
      // Critical-path loads: home tab needs accounts + settings + categories before
      // it can paint anything useful. Deposits/loans/assets feed the net-worth chip
      // and the secondary cards — defer them so the splash hides sooner. Home's
      // `stableNetWorth` retains last non-zero NW so the chip doesn't flash 0 while
      // the background loads finish.
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
      // Background loads — kick off after the home tab is visible.
      Promise.all([loadDeposits(), loadLoans(), loadAssets()]).catch(() => undefined);
    } catch (error) {
      setInitError(
        error instanceof Error ? error.message : 'Something went wrong while opening the app.'
      );
    }
  }, [loadAccounts, loadCategories, loadSettings, loadDeposits, loadLoans, loadAssets]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (ready || initError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [initError, ready]);

  useEffect(() => {
    NavigationBar.setButtonStyleAsync(palette.navigationButtonStyle).catch(() => undefined);
  }, [palette.navigationButtonStyle]);

  const settings = useUIStore((s) => s.settings);
  const updateSettings = useUIStore((s) => s.updateSettings);

  useEffect(() => {
    if (!ready) return;
    if (!isAutoBackupDue(settings)) return;
    runAutoBackup(settings.autoBackupFolderUri, settings.autoBackupKeepCount)
      .then(() => updateSettings({ lastAutoBackupAt: new Date().toISOString(), lastAutoBackupError: '' }))
      .catch((e: any) => updateSettings({ lastAutoBackupError: e?.message ?? 'Backup failed' }).catch(() => undefined));
  }, [ready]);

  // Update widget when app goes to background — only place new transactions can happen
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current === 'active' && next === 'background') {
        updateAllReniWidgets().catch(() => undefined);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    QuickActions.setItems([
      { id: 'add-income', title: 'Add Income', icon: 'shortcut_income', params: { type: 'in' } },
      { id: 'add-expense', title: 'Add Expense', icon: 'shortcut_expense', params: { type: 'out' } },
      { id: 'add-transfer', title: 'Add Transfer', icon: 'shortcut_transfer', params: { type: 'transfer' } },
    ]).catch(() => undefined);

    // Shortcut entry must always open a CLEAN form — wipe any leftover draft state
    // (e.g. category pre-fill from a still-mounted edit form below in the stack).
    const openFromShortcut = (type: unknown) => {
      if (!type) return;
      useTransactionDraftStore.getState().reset();
      router.push({ pathname: '/modals/add-transaction', params: { type: String(type), fromWidget: '1' } });
    };

    if (QuickActions.initial) {
      openFromShortcut(QuickActions.initial.params?.type);
    }

    const sub = QuickActions.addListener((action) => {
      openFromShortcut(action.params?.type);
    });
    return () => sub.remove();
  }, [ready]);

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
            fontWeight: FONT_WEIGHT.bold,
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
        <BottomSheetModalProvider>
          <ErrorBoundary>
            <SecurityGuard>
              <Stack
                screenOptions={{
                  contentStyle: {
                    backgroundColor: palette.background } }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
                <Stack.Screen name="settings" options={{ headerShown: false }} />
                <Stack.Screen name="deposits" options={{ headerShown: false }} />
                <Stack.Screen name="loans" options={{ headerShown: false }} />
                <Stack.Screen name="budget" options={{ headerShown: false }} />
                <Stack.Screen name="budget/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="loan/[id]" options={{ headerShown: false }} />
                {__DEV__ && <Stack.Screen name="net-worth-prototype" options={{ headerShown: false }} />}
                {__DEV__ && <Stack.Screen name="palette-preview" options={{ headerShown: false }} />}
                <Stack.Screen name="assets" options={{ headerShown: false }} />
                <Stack.Screen name="net-worth" options={{ headerShown: false }} />
                <Stack.Screen name="notes" options={{ headerShown: false }} />
                <Stack.Screen name="note/[id]" options={{ headerShown: false }} />
                <Stack.Screen
                  name="modals/add-transaction"
                  options={{ headerShown: false, animation: 'none' }}
                />
                <Stack.Screen
                  name="modals/asset-form"
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
          </ErrorBoundary>
        </BottomSheetModalProvider>
        <StatusBar
          style={palette.statusBarStyle}
          backgroundColor="transparent"
          translucent
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
