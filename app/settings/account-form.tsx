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
import { ActionButton, ChoiceRow, FieldLabel, InputField } from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';

/** Auto-derives a sensible Feather icon name from the account type. */
const TYPE_ICON: Record<string, string> = {
  savings: 'archive',
  credit: 'credit-card',
  cash: 'dollar-sign',
  wallet: 'briefcase',
};

type Draft = {
  name: string;
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
    type: 'savings',
    balance: '0',
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
    }, 50);
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
          type: account.type,
          balance: String(account.balance),
          currency: account.currency,
        });
      }
    } else {
      setDraft({ name: '', type: 'savings', balance: '0', currency: settings.currency ?? 'INR' });
    }
  }, [id, accounts, settings.currency]);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? (draft.name || 'Edit Account') : 'New Account',
    });
  }, [draft.name, isEditing, navigation]);

  async function onSave() {
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('Missing name', 'Please enter an account name.');
      return;
    }
    const payload = {
      name,
      type: draft.type,
      balance: Number.parseFloat(draft.balance || '0') || 0,
      currency: draft.currency,
      color: ENTITY_COLORS[0],
      icon: TYPE_ICON[draft.type] ?? 'credit-card',
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
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
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

        {/* Account Type */}
        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Account Type" palette={palette} />
          <TouchableOpacity
            onPress={() => setShowTypePicker(true)}
            activeOpacity={0.7}
            style={pickerRowStyle(palette)}
          >
            <Text style={{ color: palette.text, fontSize: 15 }}>{selectedType?.label ?? ''}</Text>
            <Feather name="chevron-right" size={16} color={palette.textSoft} />
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Opening Balance" palette={palette} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            <View style={{ flex: 1 }}>
              <InputField
                palette={palette}
                value={draft.balance}
                onChangeText={(v) => setDraft((s) => ({ ...s, balance: v }))}
                placeholder="0.00"
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              onPress={handleOpenCalculator}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{
                width: 46,
                height: 46,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="calculator-outline" size={20} color={palette.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Currency */}
        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Currency" palette={palette} />
          <TouchableOpacity
            onPress={() => setShowCurrencyPicker(true)}
            activeOpacity={0.7}
            style={pickerRowStyle(palette)}
          >
            <Text style={{ color: palette.text, fontSize: 15 }}>
              {selectedCurrency.symbol} {selectedCurrency.code}
            </Text>
            <Feather name="chevron-right" size={16} color={palette.textSoft} />
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
          paddingBottom: insets.bottom + SPACING.md,
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
    minHeight: 46,
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
