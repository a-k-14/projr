import * as LocalAuthentication from 'expo-local-authentication';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { AppState, View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useUIStore } from '../stores/useUIStore';
import { useAppTheme } from '../lib/theme';
import { FinanceEmptyMascot } from './ui/FinanceEmptyMascot';
import { HOME_TEXT } from '../lib/layoutTokens';
import { useAppDialog } from './ui/useAppDialog';

const GRACE_PERIOD_MS = 10000; // 10 seconds
const AUTH_PROMPT_STALE_MS = 30000;

function shouldShowAuthFailure(error?: string) {
  return !!error && !['user_cancel', 'system_cancel', 'app_cancel', 'authentication_failed'].includes(error);
}

function authFailureMessage(error?: string) {
  if (error === 'lockout') {
    return 'Authentication is temporarily locked because of too many failed attempts. Try again later or use your device passcode if available.';
  }
  if (error === 'not_available') {
    return 'Device authentication is currently unavailable. Check your device security settings and try again.';
  }
  if (error === 'timeout') {
    return 'Authentication timed out. Tap Unlock to try again.';
  }
  return 'Authentication could not be started. Tap Unlock to try again, or check your device security settings.';
}

export function SecurityGuard({ children }: { children: React.ReactNode }) {
  const isAuthEnabled = useUIStore((s) => s.settings.biometricLock);
  const [isLocked, setIsLockedState] = useState(isAuthEnabled);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const isLockedRef = useRef(isAuthEnabled);
  const isAuthenticatingRef = useRef(false);
  const authAttemptIdRef = useRef(0);
  const authWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { palette } = useAppTheme();
  const { showAlert, showConfirm, dialog } = useAppDialog(palette);
  
  const appState = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);

  const clearAuthWatchdog = useCallback(() => {
    if (authWatchdogRef.current) {
      clearTimeout(authWatchdogRef.current);
      authWatchdogRef.current = null;
    }
  }, []);

  const cancelNativeAuth = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    await LocalAuthentication.cancelAuthenticate().catch(() => undefined);
  }, []);

  const setLocked = useCallback((locked: boolean) => {
    isLockedRef.current = locked;
    setIsLockedState(locked);
  }, []);

  const finishAuthAttempt = useCallback(
    (attemptId: number) => {
      if (authAttemptIdRef.current !== attemptId) return;
      clearAuthWatchdog();
      setIsAuthenticating(false);
      isAuthenticatingRef.current = false;
      lastBackgroundTime.current = null;
    },
    [clearAuthWatchdog],
  );

  const authenticate = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (isAuthenticatingRef.current) {
      if (!force) return;
      authAttemptIdRef.current += 1;
      clearAuthWatchdog();
      setIsAuthenticating(false);
      isAuthenticatingRef.current = false;
      await cancelNativeAuth();
    }

    if (AppState.currentState !== 'active') {
      setLocked(true);
      return;
    }
    
    const attemptId = authAttemptIdRef.current + 1;
    authAttemptIdRef.current = attemptId;

    try {
      setIsAuthenticating(true);
      isAuthenticatingRef.current = true;
      authWatchdogRef.current = setTimeout(() => {
        if (authAttemptIdRef.current !== attemptId || !isAuthenticatingRef.current) return;
        void cancelNativeAuth();
        finishAuthAttempt(attemptId);
      }, AUTH_PROMPT_STALE_MS);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        showConfirm({
          title: 'Biometrics Unavailable',
          message: 'Your device biometric enrollment has changed or is unavailable. To protect your data, the app remains locked.\n\nDo you want to disable the app lock?',
          cancelLabel: 'Keep Locked',
          confirmLabel: 'Disable Lock',
          destructive: true,
          onConfirm: () => {
            useUIStore.getState().updateSettings({ biometricLock: false });
            setLocked(false);
          },
        });
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Reni',
        promptSubtitle: 'Authentication required to access your financial data',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false });

      if (result.success) {
        setLocked(false);
      } else if (shouldShowAuthFailure(result.error)) {
        showAlert('Unlock Failed', authFailureMessage(result.error));
      }
    } catch (error) {
      console.error('Biometric auth failed', error);
      showAlert('Authentication Error', 'An unexpected error occurred accessing biometric unlocking. If this persists, try restarting the app or checking device security settings.');
    } finally {
      finishAuthAttempt(attemptId);
    }
  }, [cancelNativeAuth, clearAuthWatchdog, finishAuthAttempt, setLocked, showAlert, showConfirm]);

  useEffect(() => {
    if (isAuthEnabled) {
      setLocked(true);
      const timer = setTimeout(() => {
        void authenticate();
      }, 250);
      return () => clearTimeout(timer);
    } else {
      authAttemptIdRef.current += 1;
      clearAuthWatchdog();
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
      void cancelNativeAuth();
      setLocked(false);
    }
  }, [authenticate, cancelNativeAuth, clearAuthWatchdog, isAuthEnabled, setLocked]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (isAuthenticatingRef.current) {
        appState.current = nextAppState;
        return;
      }

      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        if (isAuthEnabled) {
          const now = Date.now();
          const shouldReauth =
            isLockedRef.current ||
            (lastBackgroundTime.current !== null && now - lastBackgroundTime.current > GRACE_PERIOD_MS);
          if (shouldReauth) {
            setLocked(true);
            void authenticate();
          }
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App has gone to the background
        lastBackgroundTime.current = Date.now();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [authenticate, isAuthEnabled, setLocked]);

  useEffect(() => {
    return () => {
      authAttemptIdRef.current += 1;
      clearAuthWatchdog();
      void cancelNativeAuth();
    };
  }, [cancelNativeAuth, clearAuthWatchdog]);

  if (isLocked) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.content}>
          <View style={styles.illustrationContainer}>
            <FinanceEmptyMascot palette={palette} variant="security" />
          </View>
          <Text style={[styles.title, { color: palette.text }]}>App Locked</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Authentication required to access your data
          </Text>
          
          <TouchableOpacity delayPressIn={0}
            onPress={() => void authenticate({ force: true })}
            activeOpacity={0.8}
            style={[styles.button, { backgroundColor: palette.brand }]}
          >
            <Text style={[styles.buttonText, { color: palette.onBrand }]}>
              {isAuthenticating ? 'Retry unlock' : 'Unlock'}
            </Text>
          </TouchableOpacity>
        </View>
        {dialog}
      </View>
    );
  }

  return (
    <>
      {children}
      {dialog}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center' },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%' },
  illustrationContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center' },
  title: {
    fontSize: HOME_TEXT.heroValue,
    fontWeight: '700',
    marginBottom: 10 },
  subtitle: {
    fontSize: HOME_TEXT.sectionTitle,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36 },
  button: {
    minHeight: 54,
    minWidth: 150,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28 },
  buttonText: {
    fontSize: HOME_TEXT.rowLabel,
    fontWeight: '700' } });
