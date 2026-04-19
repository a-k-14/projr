import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  ActionButton,
  ChoiceRow,
  FieldLabel,
  FixedBottomActions,
  IconBtn,
  InputField,
  SelectTrigger,
  SettingsFormLayout,
} from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { SPACING } from '../../lib/design';
import { ACCOUNT_ICONS, ACCOUNT_TYPES, CURRENCIES, ENTITY_COLORS } from '../../lib/settings-shared';
import { runAfterKeyboardDismiss } from '../../lib/ui-utils';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { Account, AccountType, CreateAccountInput } from '../../types';

type Draft = {
  name: string;
  accountNumber: string;
  type: AccountType;
  balance: string;
  currency: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  accountNumber: '',
  type: 'savings',
  balance: '0',
  currency: 'INR',
};

export default function AccountFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const accounts = useAccountsStore((s) => s.accounts);
  const addAccount = useAccountsStore((s) => s.add);
  const updateAccount = useAccountsStore((s) => s.update);
  const removeAccount = useAccountsStore((s) => s.remove);
  const { palette } = useAppTheme();
  const router = useRouter();
  const navigation = useNavigation();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  useEffect(() => {
    if (id) {
      const account = accounts.find((a) => a.id === id);
      if (account) {
        setDraft({
          name: account.name,
          accountNumber: account.accountNumber ?? '',
          type: account.type,
          balance: formatIndianNumberStr(String(account.initialBalance ?? 0)),
          currency: account.currency });
      }
    } else {
      setDraft(EMPTY_DRAFT);
    }
  }, [id, accounts]);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? (draft.name || 'Edit Account') : 'New Account',
    });
  }, [draft.name, isEditing, navigation]);

  const handleOpenCalculator = () => {
    runAfterKeyboardDismiss(() => {
      Alert.alert('Calculator', 'Calculator is coming soon to settings.');
    });
  };

  async function onSave() {
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('Missing name', 'Please enter an account name.');
      return;
    }

    const initialBalance = parseFloat(parseFormattedNumber(draft.balance)) || 0;

    if (isEditing && id) {
      const updateData: Partial<Account> = {
        name,
        accountNumber: draft.accountNumber.trim() || undefined,
        type: draft.type,
        initialBalance,
        currency: draft.currency,
      };
      await updateAccount(id, updateData);
    } else {
      const createData: CreateAccountInput = {
        name,
        accountNumber: draft.accountNumber.trim() || undefined,
        type: draft.type,
        initialBalance,
        balance: initialBalance,
        currency: draft.currency,
        color: ENTITY_COLORS[0],
        icon: ACCOUNT_ICONS[0],
      };
      await addAccount(createData);
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
          } },
      ],
    );
  }

  const selectedType = ACCOUNT_TYPES.find((t) => t.key === draft.type);
  const selectedCurrency = CURRENCIES.find((c) => c.code === draft.currency) ?? CURRENCIES[0];

  return (
    <>
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
          <FieldLabel label="Account Number (Last 4)" palette={palette} />
          <InputField
            palette={palette}
            value={draft.accountNumber}
            onChangeText={(v) => setDraft((s) => ({ ...s, accountNumber: v }))}
            placeholder="e.g. 1234"
            keyboardType="numeric"
          />
        </View>

        {/* Account Type */}
        <SelectTrigger
          label="Account Type"
          valueLabel={selectedType?.label}
          onPress={() => runAfterKeyboardDismiss(() => setShowTypePicker(true))}
          palette={palette}
        />

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
        <SelectTrigger
          label="Currency"
          valueLabel={`${selectedCurrency.symbol} ${selectedCurrency.code}`}
          onPress={() => runAfterKeyboardDismiss(() => setShowCurrencyPicker(true))}
          palette={palette}
        />
      </SettingsFormLayout>

      {/* Root-level BottomSheets avoid clipping in SettingsFormLayout ScrollView */}
      {showTypePicker && (
        <BottomSheet
          title="Account Type"
          palette={palette}
          onClose={() => setShowTypePicker(false)}
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

      {showCurrencyPicker && (
        <BottomSheet
          title="Currency"
          subtitle="Pick the currency for this account"
          palette={palette}
          onClose={() => setShowCurrencyPicker(false)}
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
    </>
  );
}
