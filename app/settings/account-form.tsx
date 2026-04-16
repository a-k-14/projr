import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, InteractionManager, Keyboard, Text, TouchableOpacity, View } from 'react-native';
import {
  ActionButton,
  ChoiceRow,
  FieldLabel,
  FixedBottomActions,
  IconBtn,
  InputField,
  SettingsFormLayout,
} from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { RADIUS, SCREEN_GUTTER, SPACING } from '../../lib/design';
import { ACCOUNT_TYPES, CURRENCIES, ENTITY_COLORS } from '../../lib/settings-shared';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { useUIStore } from '../../stores/useUIStore';

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
  const accounts = useAccountsStore((s) => s.accounts);
  const loadAccounts = useAccountsStore((s) => s.load);
  const isAccountsLoaded = useAccountsStore((s) => s.isLoaded);
  const addAccount = useAccountsStore((s) => s.add);
  const updateAccount = useAccountsStore((s) => s.update);
  const removeAccount = useAccountsStore((s) => s.remove);
  const defaultCurrency = useUIStore((s) => s.settings.currency);
  const { palette } = useAppTheme();
  const router = useRouter();
  const navigation = useNavigation();

  const [draft, setDraft] = useState<Draft>({
    name: '',
    accountNumber: '',
    type: 'savings',
    balance: '',
    currency: defaultCurrency ?? 'INR',
  });
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const calculatorValue = useTransactionDraftStore((s) => s.calculatorValue);
  const calculatorOpen = useTransactionDraftStore((s) => s.calculatorOpen);
  const setCalculatorValue = useTransactionDraftStore((s) => s.setCalculatorValue);
  const setCalculatorOpen = useTransactionDraftStore((s) => s.setCalculatorOpen);
  const prevCalculatorOpen = useRef(calculatorOpen);

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
    InteractionManager.runAfterInteractions(() => {
      setCalculatorOpen(true);
      setCalculatorValue(draft.balance || '');
      router.push('/modals/calculator');
    });
  }

  function handlePickerOpen(showSetter: (v: boolean) => void) {
    Keyboard.dismiss();
    InteractionManager.runAfterInteractions(() => {
      showSetter(true);
    });
  }

  useEffect(() => {
    if (!isAccountsLoaded) loadAccounts().catch(() => undefined);
  }, [isAccountsLoaded, loadAccounts]);

  useEffect(() => {
    if (id) {
      const account = accounts.find((a) => a.id === id);
      if (account) {
        setDraft({
          name: account.name,
          accountNumber: account.accountNumber ?? '',
          type: account.type,
          balance: formatIndianNumberStr(String(account.initialBalance)),
          currency: account.currency,
        });
      }
    } else {
      setDraft({
        name: '',
        accountNumber: '',
        type: 'savings',
        balance: '',
        currency: defaultCurrency ?? 'INR',
      });
    }
  }, [id, accounts, defaultCurrency]);

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
    const openingBalance = Number.parseFloat(parseFormattedNumber(draft.balance || '0')) || 0;
    const payload = {
      name,
      accountNumber: draft.accountNumber.trim() || undefined,
      type: draft.type,
      initialBalance: openingBalance,
      currency: draft.currency,
      color: ENTITY_COLORS[0],
      icon: 'wallet',
    };
    if (isEditing && id) {
      await updateAccount(id, payload);
    } else {
      await addAccount({ ...payload, balance: openingBalance });
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
              await removeAccount(id);
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
    <SettingsFormLayout
      palette={palette}
      bottomActions={
        <FixedBottomActions palette={palette}>
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
        </FixedBottomActions>
      }
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ flex: 1 }}>
            <InputField
              palette={palette}
              isNumeric
              value={draft.balance}
              onChangeText={(v) => {
                const clean = v.replace(/[^0-9.]/g, '');
                // Apply real-time formatting if it's not a trailing decimal point
                const formatted = v.endsWith('.') ? clean + '.' : formatIndianNumberStr(clean);
                setDraft((s) => ({ ...s, balance: formatted }));
              }}
              placeholder="0.00"
            />
          </View>
          <IconBtn onPress={handleOpenCalculator} palette={palette}>
            <Ionicons name="calculator-outline" size={20} color={palette.text} />
          </IconBtn>
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
    </SettingsFormLayout>
  );
}

function pickerRowStyle(palette: { border: string; surface: string }) {
  return {
    minHeight: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  };
}
