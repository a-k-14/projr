import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SCREEN_GUTTER } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { clearLocalData } from '../../services/settings';

export default function ResetScreen() {
  const { palette } = useAppTheme();
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText === 'RESET';

  const handleReset = async () => {
    if (!isConfirmed) return;
    try {
      await clearLocalData();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Failed to reset app:', error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: SCREEN_GUTTER,
            paddingTop: 24, // Added small padding for breathing room at the very top
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                width: 64, // Slightly smaller icon container
                height: 64,
                borderRadius: 32,
                backgroundColor: palette.negative + '15',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name="warning" size={32} color={palette.negative} />
            </View>

            <Text
              style={{
                fontSize: 26, // Slightly smaller title
                fontWeight: '600',
                color: palette.text,
                textAlign: 'center',
                marginBottom: 12,
                letterSpacing: -0.5,
              }}
            >
              Reset App
            </Text>

            <Text
              style={{
                fontSize: 14,
                lineHeight: 22,
                color: palette.textMuted,
                textAlign: 'center',
                paddingHorizontal: 10,
              }}
            >
              This will permanently erase all your accounts, transactions, budgets, and settings.
              <Text style={{ fontWeight: '600', color: palette.text }}> This action cannot be undone.</Text>
            </Text>
          </View>

          <View style={{ width: '100%', marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: palette.textSecondary,
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              Type <Text style={{ color: palette.negative, fontWeight: '800' }}>RESET</Text> to confirm
            </Text>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder=""
              autoFocus
              style={{
                backgroundColor: palette.inputBg,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 16,
                fontSize: 18,
                fontWeight: '700',
                color: palette.text,
                textAlign: 'center',
                borderWidth: 1.5,
                borderColor: isConfirmed ? palette.negative : palette.divider,
              }}
            />
          </View>

          <View style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={handleReset}
              disabled={!isConfirmed}
              style={{
                width: '100%',
                backgroundColor: isConfirmed ? palette.negative : palette.divider,
                paddingVertical: 18,
                borderRadius: 20,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: isConfirmed ? '#FFF' : palette.textMuted,
                  fontSize: 18,
                  fontWeight: '700',
                }}
              >
                Erase Everything
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              style={{ paddingVertical: 12, alignItems: 'center' }}
            >
              <Text
                style={{
                  color: palette.textMuted,
                  fontSize: 16,
                  fontWeight: '600',
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
