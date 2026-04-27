import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { CARD_PADDING, HOME_TEXT, RADIUS, SCREEN_GUTTER, SPACING, TYPE } from '../../lib/design';
import { useAppTheme } from '../../lib/theme';
import { resetLocalAppData } from '../../services/localReset';

export default function ResetScreen() {
  const { palette } = useAppTheme();
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const isConfirmed = confirmText === 'RESET';
  const canReset = isConfirmed && !isResetting;

  const handleReset = async () => {
    if (!canReset) return;

    setIsResetting(true);
    setResetError(null);
    try {
      await resetLocalAppData();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Failed to reset app:', error);
      setResetError('Reset failed. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 40,
            paddingHorizontal: SCREEN_GUTTER,
          }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >

          <View style={{ alignItems: 'center', marginBottom: SPACING.lg }}>
            <FinanceEmptyMascot palette={palette} variant="danger" />
          </View>

          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: RADIUS.xl,
              borderWidth: 1,
              borderColor: palette.border,
              padding: CARD_PADDING,
            }}
          >
            <Text
              style={{
                fontSize: TYPE.body,
                lineHeight: 19,
                color: palette.textMuted,
                marginBottom: 16,
                textAlign: 'center',
                fontWeight: '400',
              }}
            >
              This deletes all accounts, transactions, budgets, loans, categories, tags, and settings on this device.
            </Text>

            <Text
              style={{
                fontSize: TYPE.rowLabel,
                fontWeight: '600',
                color: palette.text,
                marginBottom: 8,
              }}
            >
              Type RESET to continue
            </Text>

            <TextInput
              value={confirmText}
              onChangeText={(text) => {
                setConfirmText(text);
                if (resetError) setResetError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!isResetting}
              returnKeyType="done"
              style={{
                minHeight: 52,
                backgroundColor: palette.inputBg,
                borderRadius: RADIUS.md,
                paddingHorizontal: 16,
                fontSize: HOME_TEXT.rowLabel,
                fontWeight: '600',
                textAlign: 'center',
                color: palette.text,
                borderWidth: 1,
                borderColor: isConfirmed ? palette.negative : palette.border,
              }}
            />

            {resetError ? (
              <Text
                style={{
                  marginTop: 10,
                  fontSize: TYPE.body,
                  lineHeight: 18,
                  color: palette.negative,
                  fontWeight: '400',
                }}
              >
                {resetError}
              </Text>
            ) : null}

            <TouchableOpacity
              delayPressIn={0}
              onPress={handleReset}
              disabled={!canReset}
              activeOpacity={0.82}
              style={{
                minHeight: 50,
                marginTop: 18,
                borderRadius: RADIUS.md,
                backgroundColor: canReset ? palette.negative : palette.divider,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              {isResetting ? (
                <ActivityIndicator color={palette.onBrand} />
              ) : (
                <>
                  <AppIcon name="refresh-cw" size={18} color={canReset ? palette.onBrand : palette.textMuted} />
                  <Text
                    style={{
                      color: canReset ? palette.onBrand : palette.textMuted,
                      fontSize: TYPE.section,
                      fontWeight: '400',
                    }}
                  >
                    Erase Everything
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              delayPressIn={0}
              onPress={() => router.back()}
              disabled={isResetting}
              style={{
                minHeight: 44,
                marginTop: 8,
                borderRadius: RADIUS.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: isResetting ? palette.textSoft : palette.textMuted,
                  fontSize: TYPE.section,
                  fontWeight: '500',
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
