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
import { useAppTheme } from '../../lib/theme';
import { HOME_TEXT, SCREEN_GUTTER } from '../../lib/layoutTokens';
import { clearLocalData } from '../../services/settings';

export default function ResetScreen() {
  const { palette } = useAppTheme();
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText.trim().toUpperCase() === 'RESET';

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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: SCREEN_GUTTER,
            paddingBottom: 40,
          }}
        >
          <TouchableOpacity
            style={{ position: 'absolute', top: 20, left: SCREEN_GUTTER }}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </TouchableOpacity>

          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: 24,
              padding: 24,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: palette.divider,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: palette.negative + '10',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Ionicons name="warning" size={32} color={palette.negative} />
            </View>

            <Text
              style={{
                fontSize: 24,
                fontWeight: '700',
                color: palette.text,
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              Full Reset
            </Text>

            <Text
              style={{
                fontSize: 16,
                lineHeight: 24,
                color: palette.textMuted,
                textAlign: 'center',
                marginBottom: 24,
              }}
            >
              This will permanently erase all your accounts, transactions, budgets, and settings. This action cannot be undone.
            </Text>

            <View style={{ width: '100%', marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: palette.textSecondary,
                  marginBottom: 8,
                  textAlign: 'center',
                }}
              >
                Type <Text style={{ color: palette.negative }}>RESET</Text> to confirm
              </Text>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="Type here..."
                placeholderTextColor={palette.textSoft}
                autoFocus
                autoCapitalize="characters"
                style={{
                  backgroundColor: palette.inputBg,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 18,
                  fontWeight: '700',
                  color: palette.text,
                  textAlign: 'center',
                  borderWidth: 1,
                  borderColor: palette.divider,
                }}
              />
            </View>

            <TouchableOpacity
              onPress={handleReset}
              disabled={!isConfirmed}
              style={{
                width: '100%',
                backgroundColor: isConfirmed ? palette.negative : palette.divider,
                paddingVertical: 16,
                borderRadius: 18,
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
                Reset Everything
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginTop: 16 }}
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
