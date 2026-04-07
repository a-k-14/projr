import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import {
  ACCOUNT_COLORS,
  ACCOUNT_ICONS,
  ACCOUNT_TYPES,
  SettingsScreenShell,
  formatDisplayCurrency,
} from '../../lib/settings-shared';
import {
  ActionButton,
  CardSection,
  FieldLabel,
  InputField,
  PickerChip,
  SectionLabel,
  SettingsRow,
} from '../../components/settings-ui';

type Draft = {
  name: string;
  type: (typeof ACCOUNT_TYPES)[number]['key'];
  balance: string;
  currency: string;
  color: string;
  icon: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  type: 'savings',
  balance: '0',
  currency: 'INR',
  color: ACCOUNT_COLORS[0],
  icon: ACCOUNT_ICONS[0],
};

export default function AccountsScreen() {
  const { accounts, load, isLoaded, add, update, remove } = useAccountsStore();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    if (!isLoaded) {
      load().catch(() => undefined);
    }
  }, [isLoaded, load]);

  useEffect(() => {
    if (!creating && !selectedId && accounts[0]) {
      setSelectedId(accounts[0].id);
    }
  }, [accounts, creating, selectedId]);

  useEffect(() => {
    if (creating || !selectedId) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    const account = accounts.find((item) => item.id === selectedId);
    if (!account) return;
    setDraft({
      name: account.name,
      type: account.type,
      balance: String(account.balance),
      currency: account.currency,
      color: account.color,
      icon: account.icon,
    });
  }, [accounts, creating, selectedId]);

  const selectedAccount = useMemo(
    () => accounts.find((item) => item.id === selectedId),
    [accounts, selectedId]
  );

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
      currency: draft.currency.trim() || 'INR',
      color: draft.color,
      icon: draft.icon,
    };

    if (creating || !selectedId) {
      const created = await add(payload);
      setCreating(false);
      setSelectedId(created.id);
      return;
    }

    await update(selectedId, payload as any);
  }

  async function onDelete() {
    if (!selectedId) return;
    Alert.alert('Delete account?', 'This will remove the account from the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(selectedId);
            setSelectedId(accounts[1]?.id ?? null);
            setCreating(!accounts[1]);
          } catch (error) {
            Alert.alert(
              'Unable to delete',
              error instanceof Error ? error.message : 'This account could not be deleted.'
            );
          }
        },
      },
    ]);
  }

  return (
    <SettingsScreenShell palette={palette}>
      <SectionLabel label="Manage the accounts used across the app" palette={palette} />
      <CardSection palette={palette}>
        {accounts.map((account, index) => {
          const selected = selectedId === account.id && !creating;
          return (
            <SettingsRow
              key={account.id}
              icon={(account.icon as keyof typeof Feather.glyphMap) ?? 'credit-card'}
              label={account.name}
              value={
                selected
                  ? undefined
                  : `${account.currency} · ${formatDisplayCurrency(account.balance, symbolFor(account.currency))}`
              }
              palette={palette}
              onPress={() => {
                setCreating(false);
                setSelectedId(account.id);
              }}
              noBorder={index === accounts.length - 1}
              rightElement={
                selected ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: palette.textMuted, fontSize: 13 }}>
                      {`${account.currency} · ${formatDisplayCurrency(account.balance, symbolFor(account.currency))}`}
                    </Text>
                    <Feather name="check" size={18} color={palette.tabActive} />
                  </View>
                ) : undefined
              }
            />
          );
        })}
        {!accounts.length ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: palette.textMuted }}>No accounts yet.</Text>
          </View>
        ) : null}
      </CardSection>

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <ActionButton
          label="Add new account"
          variant="secondary"
          palette={palette}
          onPress={() => {
            setSelectedId(null);
            setCreating(true);
          }}
        />
      </View>

      <SectionLabel label={creating ? 'NEW ACCOUNT' : 'EDIT ACCOUNT'} palette={palette} />
      <CardSection palette={palette}>
        <View style={{ padding: 16 }}>
          <FieldLabel label="Name" palette={palette} />
          <InputField
            palette={palette}
            value={draft.name}
            onChangeText={(value) => setDraft((state) => ({ ...state, name: value }))}
            placeholder="SBI Savings Account"
          />

          <FieldLabel label="Type" palette={palette} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {ACCOUNT_TYPES.map((type) => (
              <View key={type.key} style={{ width: '48%' }}>
                <PickerChip
                  label={type.label}
                  selected={draft.type === type.key}
                  palette={palette}
                  onPress={() => setDraft((state) => ({ ...state, type: type.key }))}
                />
              </View>
            ))}
          </View>

          <FieldLabel label="Balance" palette={palette} />
          <InputField
            palette={palette}
            value={draft.balance}
            onChangeText={(value) => setDraft((state) => ({ ...state, balance: value }))}
            placeholder="0"
            keyboardType="numeric"
          />

          <FieldLabel label="Currency" palette={palette} />
          <InputField
            palette={palette}
            value={draft.currency}
            onChangeText={(value) => setDraft((state) => ({ ...state, currency: value.toUpperCase() }))}
            placeholder="INR"
            autoCapitalize="characters"
          />

          <FieldLabel label="Icon" palette={palette} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {ACCOUNT_ICONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                onPress={() => setDraft((state) => ({ ...state, icon }))}
                style={{
                  width: '18%',
                  minHeight: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: draft.icon === icon ? palette.tabActive : palette.border,
                  backgroundColor:
                    draft.icon === icon
                      ? palette.background === '#11161F'
                        ? '#182131'
                        : '#E8F3EC'
                      : palette.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather
                  name={icon as keyof typeof Feather.glyphMap}
                  size={16}
                  color={draft.icon === icon ? palette.tabActive : palette.iconTint}
                />
              </TouchableOpacity>
            ))}
          </View>

          <FieldLabel label="Color" palette={palette} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {ACCOUNT_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => setDraft((state) => ({ ...state, color }))}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: color,
                  borderWidth: draft.color === color ? 3 : 1,
                  borderColor: draft.color === color ? palette.text : palette.border,
                }}
              />
            ))}
          </View>

          <View style={{ marginTop: 16, gap: 10 }}>
            <ActionButton label="Save account" variant="primary" palette={palette} onPress={onSave} />
            {selectedId && !creating ? (
              <ActionButton label="Delete account" variant="danger" palette={palette} onPress={onDelete} />
            ) : null}
          </View>
        </View>
      </CardSection>
      {selectedAccount ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Text style={{ color: palette.textMuted, fontSize: 12 }}>
            Editing {selectedAccount.name}
          </Text>
        </View>
      ) : null}
    </SettingsScreenShell>
  );
}

function symbolFor(currency: string) {
  switch (currency) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return '₹';
  }
}
