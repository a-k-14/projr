import { AppIcon } from '@/components/ui/AppIcon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import {
  ActionButton,
  ChoiceRow,
  FieldLabel,
  FixedBottomActions,
  InputField,
  SelectTrigger,
  SettingsFormLayout,
} from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { CalculatorTrigger } from '../../components/ui/CalculatorTrigger';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { SPACING } from '../../lib/design';
import { ACCOUNT_ICONS, ACCOUNT_TYPES, ENTITY_COLORS } from '../../lib/settings-shared';
import { runAfterKeyboardDismiss } from '../../lib/ui-utils';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { Account, AccountType, CreateAccountInput } from '../../types';

type Draft = {
  name: string;
  accountNumber: string;
  type: AccountType;
  balance: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  accountNumber: '',
  type: 'savings',
  balance: '',
};

export default function AccountFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const accounts = useAccountsStore((s) => s.accounts);
  const addAccount = useAccountsStore((s) => s.add);
  const updateAccount = useAccountsStore((s) => s.update);
  const removeAccount = useAccountsStore((s) => s.remove);
  const appCurrency = useUIStore((s) => s.settings.currency);
  const { palette } = useAppTheme();
  const { showAlert, showConfirm, dialog } = useAppDialog(palette);
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const accountNumberRef = useRef<TextInput>(null);
  const openingBalanceRef = useRef<TextInput>(null);

  useEffect(() => {
    if (id) {
      const account = accounts.find((a) => a.id === id);
      if (account) {
        setDraft({
          name: account.name,
          accountNumber: account.accountNumber ?? '',
          type: account.type,
          balance: formatIndianNumberStr(String(account.initialBalance ?? 0)),
        });
      }
    } else {
      setDraft(EMPTY_DRAFT);
    }
  }, [id, accounts]);

  async function onSave() {
    const name = draft.name.trim();
    if (!name) {
      showAlert('Missing Name', 'Please enter an account name.');
      return;
    }

    const initialBalance = parseFloat(parseFormattedNumber(draft.balance)) || 0;

    if (isEditing && id) {
      const updateData: Partial<Account> = {
        name,
        accountNumber: draft.accountNumber.trim() || undefined,
        type: draft.type,
        initialBalance,
        currency: appCurrency,
      };
      await updateAccount(id, updateData);
    } else {
      const createData: CreateAccountInput = {
        name,
        accountNumber: draft.accountNumber.trim() || undefined,
        type: draft.type,
        initialBalance,
        balance: initialBalance,
        currency: appCurrency,
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
    showConfirm({
      title: 'Delete Account',
      message: `"${account?.name}" and all its transaction history will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await removeAccount(id);
          router.back();
        } catch (error) {
          showAlert('Unable To Delete', error instanceof Error ? error.message : 'This account could not be deleted.');
        }
      },
    });
  }

  const selectedType = ACCOUNT_TYPES.find((t) => t.key === draft.type);

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
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => accountNumberRef.current?.focus()}
          />
        </View>

        {/* Account Number */}
        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Account Number (Last 4)" palette={palette} />
          <InputField
            ref={accountNumberRef}
            palette={palette}
            value={draft.accountNumber}
            onChangeText={(v) => setDraft((s) => ({ ...s, accountNumber: v }))}
            placeholder="e.g. 1234"
            keyboardType="numeric"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => openingBalanceRef.current?.focus()}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <InputField
                ref={openingBalanceRef}
                palette={palette}
                value={draft.balance}
                onChangeText={(v) => {
                  const isNegative = v.trim().startsWith('-');
                  let clean = v.replace(/[^0-9.]/g, '');
                  if (!clean) {
                    setDraft((s) => ({ ...s, balance: isNegative ? '-' : '' }));
                    return;
                  }
                  const parts = clean.split('.');
                  if (parts.length > 2) clean = parts[0] + '.' + parts.slice(1).join('');
                  if (clean.length > 1 && clean.startsWith('0') && clean[1] !== '.') {
                    clean = clean.substring(1);
                  }
                  setDraft((s) => ({ ...s, balance: formatIndianNumberStr(`${isNegative ? '-' : ''}${clean}`) }));
                }}
                placeholder="0.00"
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                returnKeyType="done"
              />
            </View>
            <CalculatorTrigger
              palette={palette}
              onPress={() => runAfterKeyboardDismiss(() => setShowCalculator(true))}
              height={56}
              width={50}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            />
          </View>
        </View>
      </SettingsFormLayout>

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
      <CalculatorSheet
        visible={showCalculator}
        value={draft.balance.replace(/,/g, '')}
        palette={palette}
        brandColor={palette.transferText}
        brandSoft={palette.transferBg}
        brandOnColor={palette.onBrand}
        onClose={() => setShowCalculator(false)}
        onApply={(finalValue) => {
          setShowCalculator(false);
          setDraft((s) => ({ ...s, balance: formatIndianNumberStr(finalValue) }));
        }}
      />
      {dialog}
    </>
  );
}
