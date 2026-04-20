import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CardSection, ScreenTitle, SectionLabel } from '../../components/settings-ui';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { CARD_PADDING, HOME_TEXT, RADIUS, SCREEN_GUTTER, SPACING, TYPE } from '../../lib/design';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
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
            paddingTop: 8,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenTitle
            title="Reset App"
            subtitle="Erase local app data from this device."
            palette={palette}
          />

          <View style={{ alignItems: 'center', marginHorizontal: SCREEN_GUTTER, marginBottom: SPACING.lg }}>
            <FinanceEmptyMascot palette={palette} variant="security" />
          </View>

          <SectionLabel label="Data Removal" palette={palette} />
          <CardSection palette={palette}>
            <ResetInfoRow
              icon="wallet-outline"
              title="Accounts and balances"
              subtitle="All local account records will be removed."
              palette={palette}
            />
            <ResetInfoRow
              icon="receipt-outline"
              title="Transactions, budgets, and loans"
              subtitle="Your local history and planning data will be cleared."
              palette={palette}
            />
            <ResetInfoRow
              icon="settings-outline"
              title="Settings and security preferences"
              subtitle="The app returns to a fresh local setup."
              palette={palette}
              noBorder
            />
          </CardSection>

          <SectionLabel label="Confirm Reset" palette={palette} />
          <CardSection palette={palette}>
            <View style={{ padding: CARD_PADDING }}>
              <Text
                style={{
                  fontSize: TYPE.rowLabel,
                  fontWeight: '700',
                  color: palette.text,
                  marginBottom: 6,
                }}
              >
                Type RESET to continue
              </Text>
              <Text
                style={{
                  fontSize: TYPE.body,
                  lineHeight: 19,
                  color: palette.textMuted,
                  marginBottom: 14,
                }}
              >
                This cannot be undone.
              </Text>

              <TextInput
                value={confirmText}
                onChangeText={(text) => {
                  setConfirmText(text);
                  if (resetError) setResetError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isResetting}
                placeholder="RESET"
                placeholderTextColor={palette.textSoft}
                returnKeyType="done"
                style={{
                  minHeight: 52,
                  backgroundColor: palette.inputBg,
                  borderRadius: RADIUS.md,
                  paddingHorizontal: 16,
                  fontSize: HOME_TEXT.rowLabel,
                  fontWeight: '700',
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
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={canReset ? '#FFFFFF' : palette.textMuted}
                    />
                    <Text
                      style={{
                        color: canReset ? '#FFFFFF' : palette.textMuted,
                        fontSize: TYPE.section,
                        fontWeight: '700',
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
                    fontWeight: '700',
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </CardSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ResetInfoRow({
  icon,
  title,
  subtitle,
  palette,
  noBorder,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  palette: AppThemePalette;
  noBorder?: boolean;
}) {
  return (
    <View
      style={{
        minHeight: 72,
        paddingHorizontal: CARD_PADDING,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: palette.divider,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: palette.outBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        <Ionicons name={icon} size={18} color={palette.negative} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: TYPE.section, fontWeight: '600', color: palette.text }}>
          {title}
        </Text>
        <Text
          style={{
            marginTop: 3,
            fontSize: TYPE.body,
            lineHeight: 18,
            color: palette.textMuted,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
