import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { SCREEN_GUTTER, CARD_PADDING, RADIUS, SPACING } from '../../lib/design';
import {
  ACCOUNT_TYPES,
  ACCOUNT_ICONS,
  ENTITY_COLORS,
  symbolFor,
} from '../../lib/settings-shared';
import {
  ActionButton,
  ChoiceRow,
  ColorGrid,
  FieldLabel,
  IconGrid,
  InputField,
} from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';

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
  color: ENTITY_COLORS[0],
  icon: ACCOUNT_ICONS[0],
};

export default function AccountFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const { accounts, load, isLoaded, add, update, remove } = useAccountsStore();
  const scheme = useColorScheme();
  const theme = useUIStore((s) => s.settings.theme);
  const palette = getThemePalette(resolveTheme(theme, scheme));
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [showTypePicker, setShowTypePicker] = useState(false);

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
          color: account.color,
          icon: account.icon,
        });
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

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SCREEN_GUTTER, paddingBottom: SPACING.xl }}
        keyboardShouldPersistTaps="handled"
      >
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

        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Account Type" palette={palette} />
          <TouchableOpacity
            onPress={() => setShowTypePicker(true)}
            activeOpacity={0.7}
            style={{
              minHeight: 46,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: palette.border,
              backgroundColor: palette.surface,
              paddingHorizontal: CARD_PADDING,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: palette.text, fontSize: 15 }}>
              {selectedType?.label ?? ''}
            </Text>
            <Feather name="chevron-right" size={16} color={palette.textSoft} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.lg }}>
          <View style={{ flex: 1 }}>
            <FieldLabel label="Balance" palette={palette} />
            <InputField
              palette={palette}
              value={draft.balance}
              onChangeText={(v) => setDraft((s) => ({ ...s, balance: v }))}
              placeholder="0.00"
              keyboardType="numeric"
            />
          </View>
          <View style={{ width: 90 }}>
            <FieldLabel label="Currency" palette={palette} />
            <InputField
              palette={palette}
              value={draft.currency}
              onChangeText={(v) => setDraft((s) => ({ ...s, currency: v.toUpperCase() }))}
              placeholder="INR"
              autoCapitalize="characters"
              maxLength={3}
            />
          </View>
        </View>

        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Icon" palette={palette} />
          <IconGrid
            icons={ACCOUNT_ICONS}
            selectedIcon={draft.icon}
            onSelect={(icon) => setDraft((s) => ({ ...s, icon }))}
            palette={palette}
          />
        </View>

        <View style={{ marginBottom: SPACING.lg }}>
          <FieldLabel label="Color" palette={palette} />
          <ColorGrid
            colors={ENTITY_COLORS}
            selectedColor={draft.color}
            onSelect={(color) => setDraft((s) => ({ ...s, color }))}
            palette={palette}
          />
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
    </SafeAreaView>
  );
}
