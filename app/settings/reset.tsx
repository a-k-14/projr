import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { router } from 'expo-router';
import { STRINGS } from '../../lib/strings';
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
import { CARD_PADDING, HOME_TEXT, RADIUS, SCREEN_GUTTER, TYPE , FONT_WEIGHT} from '../../lib/design';
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
      setResetError(STRINGS.reset.labels.errorReset);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 16,
            paddingBottom: 40,
            paddingHorizontal: SCREEN_GUTTER,
          }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >

          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: RADIUS.xl,
              borderWidth: 1,
              borderColor: palette.border,
              padding: CARD_PADDING,
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <FinanceEmptyMascot palette={palette} variant="danger" />
            <Text
              style={{
                fontSize: TYPE.body,
                lineHeight: 19,
                color: palette.uiNegative,
                marginTop: 16,
                textAlign: 'center',
                fontWeight: FONT_WEIGHT.semibold,
              }}
            >
              {STRINGS.reset.labels.warnMessage}
            </Text>
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
                fontSize: TYPE.rowLabel,
                fontWeight: FONT_WEIGHT.semibold,
                color: palette.text,
                marginBottom: 8,
              }}
            >
              {STRINGS.reset.labels.typePrompt}
            </Text>

            <TextInput
              value={confirmText}
              onChangeText={(text) => {
                setConfirmText(text.toUpperCase());
                if (resetError) setResetError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isResetting}
              returnKeyType="done"
              style={{
                minHeight: 52,
                backgroundColor: palette.inputBg,
                borderRadius: RADIUS.md,
                paddingHorizontal: 16,
                fontSize: HOME_TEXT.rowLabel,
                fontWeight: FONT_WEIGHT.semibold,
                textAlign: 'center',
                color: palette.text,
                borderWidth: 1,
                borderColor: isConfirmed ? palette.uiNegative : palette.border,
              }}
            />

            {resetError ? (
              <Text
                style={{
                  marginTop: 10,
                  fontSize: TYPE.body,
                  lineHeight: 18,
                  color: palette.uiNegative,
                  fontWeight: FONT_WEIGHT.regular,
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
                backgroundColor: canReset ? palette.uiNegative : palette.divider,
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
                      fontWeight: FONT_WEIGHT.regular,
                    }}
                  >
                    {STRINGS.reset.labels.buttonText}
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
                  fontWeight: FONT_WEIGHT.medium,
                }}
              >
                {STRINGS.reset.labels.cancelText}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
