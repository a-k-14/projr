import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { HOME_TEXT } from '../../lib/layoutTokens';
import { SCREEN_GUTTER } from '../../lib/design';
import type { AppThemePalette } from '../../lib/theme';

interface ResetConfirmationSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  palette: AppThemePalette;
}

export function ResetConfirmationSheet({
  visible,
  onClose,
  onConfirm,
  palette,
}: ResetConfirmationSheetProps) {
  const [confirmationText, setConfirmationText] = useState('');

  if (!visible) return null;

  const isConfirmed = confirmationText.toUpperCase() === 'RESET';

  return (
    <BottomSheet
      title="Danger Zone"
      subtitle="This action is irreversible"
      palette={palette}
      onClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 }}
      >
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: HOME_TEXT.body, color: palette.text, lineHeight: 22 }}>
            This will permanently delete all your accounts, transactions, categories, budgets, and settings from this device.
          </Text>
          <Text style={{ fontSize: HOME_TEXT.body, color: palette.text, marginTop: 12, fontWeight: '700' }}>
            To confirm, please type RESET below:
          </Text>
        </View>

        <TextInput
          value={confirmationText}
          onChangeText={setConfirmationText}
          placeholder="Type RESET here"
          placeholderTextColor={palette.textSoft}
          cursorColor={palette.negative}
          autoCapitalize="characters"
          autoFocus
          style={{
            height: 52,
            backgroundColor: palette.inputBg,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: isConfirmed ? palette.negative : palette.divider,
            paddingHorizontal: 16,
            fontSize: 16,
            fontWeight: '800',
            color: palette.negative,
            textAlign: 'center',
            marginBottom: 24,
          }}
        />

        <TouchableOpacity
          disabled={!isConfirmed}
          onPress={onConfirm}
          style={{
            height: 54,
            borderRadius: 16,
            backgroundColor: isConfirmed ? palette.negative : palette.borderSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: isConfirmed ? '#FFF' : palette.textMuted }}>
            ERASE ALL DATA
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}
