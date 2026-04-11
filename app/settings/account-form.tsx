import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, ScrollView, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { SCREEN_GUTTER, CARD_PADDING, RADIUS, SPACING } from '../../lib/design';
import { ACCOUNT_TYPES, CURRENCIES, ENTITY_COLORS } from '../../lib/settings-shared';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { ActionButton, ChoiceRow, FieldLabel, InputField } from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';


type Draft = {
  name: string;
  accountNumber: string;
  type: (typeof ACCOUNT_TYPES)[number]['key'];
  balance: string;
  currency: string;
};

export default function AccountFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const { accounts, load, isLoaded, add, update, remove } = useAccountsStore();
  const { settings } = useUIStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<Draft>({
    name: '',
    accountNumber: '',
    type: 'savings',
    balance: '',
    currency: settings.currency ?? 'INR',
  });
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const { calculatorValue, calculatorOpen, setCalculatorValue, setCalculatorOpen } =
    useTransactionDraftStore();
  const prevCalculatorOpen = useRef(calculatorOpen);

  // Sync calculator result back to balance field when calculator closes
  useEffect(() => {
    if (prevCalculatorOpen.current === true && calculatorOpen === false) {
      if (calculatorValue && calculatorValue !== '0') {
        const clean = calculatorValue.replace(/[^0-9.]/g, '');
        if (clean) setDraft((s) => ({ ...s, balance: clean }));
      }
    }
    prevCalculatorOpen.current = calculatorOpen;
  }, [calculatorOpen, calculatorValue]);

  function handleOpenCalculator() {
    Keyboard.dismiss();
    setTimeout(() => {
      setCalculatorOpen(true);
      setCalculatorValue(draft.balance || '');
      router.push('/modals/calculator');
    }, 150);
  }

  function handlePickerOpen(showSetter: (v: boolean) => void) {
    Keyboard.dismiss();
    setTimeout(() => {
      showSetter(true);
    }, 150);
  }

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  useEffect(() => {
    if (id) {
      const account = accounts.find((a) => a.id === id);
      if (account) {
        setDraft({
          name: account.name,
          accountNumber: account.accountNumber ?? '',
          type: account.type,
          balance: String(account.balance),
          currency: account.currency,
        });
      }
    } else {
      setDraft({
        name: '',
        accountNumber: '',
        type: 'savings',
        balance: '',
        currency: settings.currency ?? 'INR',
      });
    }
  }, [id, accounts, settings.currency]);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Account' : 'New Account',
    });
  }, [isEditing, navigation]);

  async function onSave() {
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('Missing name', 'Please enter an account name.');
      return;
    }
    const payload = {
      name,
      accountNumber: draft.accountNumber.trim() || undefined,
      type: draft.type,
      balance: Number.parseFloat(draft.balance || '0') || 0,
      initialBalance: Number.parseFloat(draft.balance || '0') || 0,
      currency: draft.currency,
      color: ENTITY_COLORS[0],
      icon: 'wallet', // Default dummy icon, no longer managed by user
    };
    if (isEditing && id) {
      await update(id, payload);
    } else {
      await add(payload);
    }
    router.back();
  }

  async function onDelete() {
    if (!id) return;
    const account = accounts.find((a) => a.id === id);
    Alert.alert(
      'Delete account?',
      `"${account?.name}" and all its transaction history will be permanently removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(id);
              router.back();
            } catch (error) {
              Alert.alert(
                'Unable to delete',
                error instanceof Error ? error.message : 'This account could not be deleted.',
              );
            }
          },
        },
      ],
    );
  }

  const selectedType = ACCOUNT_TYPES.find((t) => t.key === draft.type);
  const selectedCurrency = CURRENCIES.find((c) => c.code === draft.currency) ?? CURRENCIES[0];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SCREEN_GUTTER, paddingBottom: SPACING.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Account Name" palette={palette} />
          <InputField
            palette={palette}
            value={draft.name}
            onChangeText={(v) => setDraft((s) => ({ ...s, name: v }))}
            placeholder="e.g. HDFC Bank"
            autoFocus={!isEditing}
          />
        </View>

        {/* Account Number */}
        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Account Number" palette={palette} />
          <InputField
            palette={palette}
            value={draft.accountNumber}
            onChangeText={(v) => setDraft((s) => ({ ...s, accountNumber: v }))}
            placeholder="e.g. 1234 5678 1234"
            keyboardType="numeric"
          />
        </View>

        {/* Account Type */}
        <View style={{ marginBottom: SPACING.xl }}>
          <FieldLabel label="Account Type" palette={palette} />
          <TouchableOpacity
            onPress={() => handlePickerOpen(setShowTypePicker)}
            activeOpacity={0.7}
            style={pickerRowStyle(palette)}
          >
            <Text style={{ color: palette.text, fontSize: 16 }}>{selectedType?.label ?? ''}</Text>
            <Feather name="chevron-down" size={20} color={palette.textSoft} />
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Opening Balance" palette={palette} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SCREEN_GUTTER }}>
            <View style={{ flex: 1 }}>
              <InputField
                palette={palette}
                value={draft.balance}
                onChangeText={(v) => {
                  const clean = v.replace(/[^0-9.]/g, '');
                  setDraft((s) => ({ ...s, balance: clean }));
                }}
                placeholder="0.00"
                placeholderTextColor={palette.textSoft}
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              onPress={handleOpenCalculator}
              activeOpacity={0.7}
              style={{
                width: 56,
                height: 56,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="calculator-outline" size={24} color={palette.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Currency */}
        <View style={{ marginBottom: SPACING.xl }}>
          <FieldLabel label="Currency" palette={palette} />
          <TouchableOpacity
            onPress={() => handlePickerOpen(setShowCurrencyPicker)}
            activeOpacity={0.7}
            style={pickerRowStyle(palette)}
          >
            <Text style={{ color: palette.text, fontSize: 16 }}>
              {selectedCurrency.symbol} {selectedCurrency.code}
            </Text>
            <Feather name="chevron-down" size={20} color={palette.textSoft} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Fixed bottom actions */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: palette.divider,
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: SPACING.md,
          paddingBottom: (insets.bottom || 16) + 2,
          backgroundColor: palette.background,
          gap: SPACING.sm,
        }}
      >
        <ActionButton
          label={isEditing ? 'Save Account' : 'Create Account'}
          variant="primary"
          palette={palette}
          onPress={onSave}
        />
        {isEditing && (
          <ActionButton
            label="Delete Account"
            variant="danger"
            palette={palette}
            onPress={onDelete}
          />
        )}
      </View>

      {/* Account Type picker */}
      {showTypePicker && (
        <BottomSheet
          title="Account Type"
          palette={palette}
          onClose={() => setShowTypePicker(false)}
          hasNavBar
          extraBottomPadding={10}
        >
          {ACCOUNT_TYPES.map((t, i) => (
            <ChoiceRow
              key={t.key}
              title={t.label}
              selected={draft.type === t.key}
              palette={palette}
              noBorder={i === ACCOUNT_TYPES.length - 1}
              onPress={() => {
                setDraft((s) => ({ ...s, type: t.key }));
                setShowTypePicker(false);
              }}
            />
          ))}
        </BottomSheet>
      )}

      {/* Currency picker */}
      {showCurrencyPicker && (
        <BottomSheet
          title="Currency"
          subtitle="Pick the currency for this account"
          palette={palette}
          onClose={() => setShowCurrencyPicker(false)}
          hasNavBar
          extraBottomPadding={10}
        >
          {CURRENCIES.map((c, i) => (
            <ChoiceRow
              key={c.code}
              title={`${c.symbol} ${c.code}`}
              subtitle={c.name}
              selected={draft.currency === c.code}
              palette={palette}
              noBorder={i === CURRENCIES.length - 1}
              onPress={() => {
                setDraft((s) => ({ ...s, currency: c.code }));
                setShowCurrencyPicker(false);
              }}
            />
          ))}
        </BottomSheet>
      )}
    </SafeAreaView>
  );
}

function pickerRowStyle(palette: { border: string; surface: string }) {
  return {
    minHeight: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: CARD_PADDING,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  };
}
