import * as LocalAuthentication from 'expo-local-authentication';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet, Platform , TouchableOpacity} from 'react-native';
import { useUIStore } from '../stores/useUIStore';
import { useAppTheme } from '../lib/theme';
import { FinanceEmptyMascot } from './ui/FinanceEmptyMascot';
import { HOME_TEXT } from '../lib/layoutTokens';

const GRACE_PERIOD_MS = 10000; // 10 seconds

export function SecurityGuard({ children }: { children: React.ReactNode }) {
  const isAuthEnabled = useUIStore((s) => s.settings.biometricLock);
  const [isLocked, setIsLocked] = useState(isAuthEnabled);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { palette } = useAppTheme();
  
  const appState = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);

  const authenticate = async () => {
    if (isAuthenticating) return;
    
    try {
      setIsAuthenticating(true);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setIsLocked(false);
        useUIStore.getState().updateSettings({ biometricLock: false });
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Reni',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false });

      if (result.success) {
        setIsLocked(false);
      }
    } catch (error) {
      console.error('Biometric auth failed', error);
      import('react-native').then(({ Alert }) => {
        Alert.alert('Authentication Error', 'An unexpected error occurred accessing biometric unlocking. If this persists, try restarting the app or checking device security settings.');
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    if (isAuthEnabled && isLocked) {
      authenticate();
    }
  }, [isAuthEnabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        if (isAuthEnabled) {
          const now = Date.now();
          if (lastBackgroundTime.current && now - lastBackgroundTime.current > GRACE_PERIOD_MS) {
            setIsLocked(true);
            authenticate();
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
  }, [isAuthEnabled]);

  // If the user disables the lock while the app is locked, unlock it immediately
  useEffect(() => {
    if (!isAuthEnabled) {
      setIsLocked(false);
    }
  }, [isAuthEnabled]);

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
            onPress={authenticate}
            activeOpacity={0.8}
            style={[styles.button, { backgroundColor: palette.brand }]}
          >
            <Text style={[styles.buttonText, { color: palette.onBrand }]}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
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
