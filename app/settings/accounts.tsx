import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { SCREEN_GUTTER } from '../../lib/design';
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
  ColorGrid,
  IconGrid,
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

    await update(selectedId, payload);
  }

  async function onDelete() {
    if (!selectedId) return;
    const account = accounts.find((a) => a.id === selectedId);
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
      ]
    );
  }

  return (
    <SettingsScreenShell palette={palette}>
      <SectionLabel label="Your Accounts" palette={palette} />
      <CardSection palette={palette}>
        {accounts.map((account, index) => {
          const selected = selectedId === account.id && !creating;
          return (
            <SettingsRow
              key={account.id}
              icon={(account.icon as keyof typeof Feather.glyphMap) ?? 'credit-card'}
              label={account.name}
              palette={palette}
              onPress={() => {
                setCreating(false);
                setSelectedId(account.id);
              }}
              noBorder={index === accounts.length - 1}
              rightElement={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ color: palette.textMuted, fontSize: 13, fontWeight: '500' }}>
                    {`${account.currency} · ${formatDisplayCurrency(account.balance, symbolFor(account.currency))}`}
                  </Text>
                  {selected ? (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: palette.tabActive, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="check" size={12} color="#FFFFFF" />
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={18} color={palette.divider} />
                  )
                  }
                </View>
              }
            />
          );
        })}
        {!accounts.length ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: palette.textMuted, fontSize: 14 }}>No accounts configured yet.</Text>
          </View>
        ) : null}
      </CardSection>

      <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: 24 }}>
        <ActionButton
          label="Add New Account"
          variant="secondary"
          palette={palette}
          onPress={() => {
            setSelectedId(null);
            setCreating(true);
          }}
        />
      </View>

      <SectionLabel label={creating ? 'CREATE NEW ACCOUNT' : 'EDIT ACCOUNT'} palette={palette} />
      <CardSection palette={palette}>
        <View style={{ padding: SCREEN_GUTTER }}>
          <View style={{ marginBottom: 20 }}>
            <FieldLabel label="Account Name" palette={palette} />
            <InputField
              palette={palette}
              value={draft.name}
              onChangeText={(value) => setDraft((state) => ({ ...state, name: value }))}
              placeholder="e.g. HDFC Bank"
            />
          </View>

          <View style={{ marginBottom: 20 }}>
            <FieldLabel label="Account Type" palette={palette} />
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
          </View>

          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Current Balance" palette={palette} />
                            <InputField
                palette={palette}
                value={draft.balance}
                onChangeText={(value) => setDraft((state) => ({ ...state, balance: value }))}
                placeholder="0.00"
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: 100 }}>
              <FieldLabel label="Currency" palette={palette} />
              <InputField
                palette={palette}
                value={draft.currency}
                onChangeText={(value) => setDraft((state) => ({ ...state, currency: value.toUpperCase() }))}
                placeholder="INR"
                autoCapitalize="characters"
                maxLength={3}
              />
            </View>
          </View>

          <View style={{ marginBottom: 20 }}>
            <FieldLabel label="Choose Icon" palette={palette} />
            <IconGrid
              icons={ACCOUNT_ICONS}
              selectedIcon={draft.icon}
              onSelect={(icon) => setDraft((state) => ({ ...state, icon }))}
              palette={palette}
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <FieldLabel label="Select Color Theme" palette={palette} />
            <ColorGrid
              colors={ACCOUNT_COLORS}
              selectedColor={draft.color}
              onSelect={(color) => setDraft((state) => ({ ...state, color }))}
              palette={palette}
            />
          </View>

          <View style={{ gap: 12 }}>
            <ActionButton
              label={creating ? 'Create Account' : 'Update Account'}
              variant="primary"
              palette={palette}
              onPress={onSave}
            />
            {selectedId && !creating ? (
              <ActionButton label="Remove Account" variant="danger" palette={palette} onPress={onDelete} />
            ) : null}
          </View>
        </View>
      </CardSection>
      {selectedAccount ? (
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 12 }}>
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
