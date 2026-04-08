import { useState, useEffect, type ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useColorScheme,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { todayUTC, formatDate, toUTCMidnight } from '../../lib/dateUtils';
import {
  HOME_COLORS,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_TEXT,
  TX_TYPE_CONFIG,
} from '../../lib/homeTokens';
import type { TransactionType, CreateTransactionInput, Account, Category } from '../../types';
import { getTransactionById } from '../../services/transactions';

export default function AddTransactionModal() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = !!editId;

  const { add, update, remove } = useTransactionsStore();
  const { add: addLoan } = useLoansStore();
  const { accounts, refresh: refreshAccounts } = useAccountsStore();
  const { categories, getCategoryDisplayName } = useCategoriesStore();
  const { settings } = useUIStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));

  const [type, setType] = useState<TransactionType>('out');
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayUTC());
  const [note, setNote] = useState('');
  const [personName, setPersonName] = useState('');
  const [loanDirection, setLoanDirection] = useState<'lent' | 'borrowed'>('lent');
  const [loading, setLoading] = useState(false);
  const [showIosDatePicker, setShowIosDatePicker] = useState(false);
  const insets = useSafeAreaInsets();

  const sym = settings.currencySymbol;

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(settings.defaultAccountId || accounts[0].id);
      if (accounts.length > 1) setLinkedAccountId(accounts[1].id);
    }
  }, [accounts]);

  useEffect(() => {
    if (isEditing && editId) {
      getTransactionById(editId).then((tx) => {
        if (!tx) return;
        setType(tx.type);
        // Guard: ensure parseFloat never receives undefined/null
        setAmountStr(tx.amount != null ? String(tx.amount) : '');
        setAccountId(tx.accountId);
        if (tx.linkedAccountId) setLinkedAccountId(tx.linkedAccountId);
        if (tx.categoryId) setCategoryId(tx.categoryId);
        setDate(tx.date);
        if (tx.note) setNote(tx.note);
      });
    }
  }, [editId]);

  const amount = parseFloat(amountStr) || 0;
  const isValid =
    amount > 0 &&
    accountId.length > 0 &&
    (type !== 'loan' || personName.trim().length > 0);

  const openDatePicker = () => {
    const current = new Date(date);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        display: 'calendar',
        onChange: (_event: unknown, selected?: Date) => {
          if (selected) setDate(toUTCMidnight(selected));
        },
      });
    } else {
      setShowIosDatePicker(true);
    }
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      if (!isEditing && type === 'loan') {
        // Loan creation must go through the loan service to create a proper
        // loan record with personName/direction and a linked transaction.
        await addLoan({
          personName: personName.trim(),
          direction: loanDirection,
          accountId,
          givenAmount: amount,
          note: note || undefined,
          date,
        });
      } else {
        const data: CreateTransactionInput = {
          type,
          amount,
          accountId,
          date,
          note: note || undefined,
          categoryId: categoryId || undefined,
          linkedAccountId: type === 'transfer' ? linkedAccountId : undefined,
        };
        if (isEditing && editId) {
          await update(editId, data);
        } else {
          await add(data);
        }
      }
      await refreshAccounts();
      router.back();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (editId) await remove(editId);
          await refreshAccounts();
          router.back();
        },
      },
    ]);
  };

  const activeConfig = TX_TYPE_CONFIG[type];
  const types = Object.keys(TX_TYPE_CONFIG) as TransactionType[];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        {/* Header: close button + title + 2×2 type grid */}
        <View style={{ paddingHorizontal: HOME_SPACE.screen, paddingTop: HOME_SPACE.sm, paddingBottom: HOME_SPACE.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: HOME_SPACE.md }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: HOME_SPACE.xl, padding: HOME_SPACE.xs }}>
              <Ionicons name="close" size={24} color={palette.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>
              {isEditing ? 'Edit transaction' : 'Add transaction'}
            </Text>
          </View>

          {/* 2×2 type selector — avoids clipping on small screens */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: HOME_SPACE.sm }}>
            {types.map((t) => {
              const cfg = TX_TYPE_CONFIG[t];
              const selected = type === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setType(t)}
                  style={{
                    paddingHorizontal: HOME_SPACE.xl,
                    paddingVertical: HOME_SPACE.sm,
                    borderRadius: HOME_RADIUS.pill,
                    borderWidth: 1.5,
                    borderColor: selected ? cfg.borderColor : HOME_COLORS.divider,
                    backgroundColor: selected ? cfg.bg : palette.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: HOME_TEXT.bodySmall,
                      fontWeight: '600',
                      color: selected ? cfg.color : HOME_COLORS.textSecondary,
                    }}
                  >
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Amount */}
        <View style={{ alignItems: 'center', paddingVertical: HOME_SPACE.xxl }}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginBottom: HOME_SPACE.sm }}>
            Amount
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 32, color: palette.textMuted, marginRight: HOME_SPACE.xs }}>{sym}</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={palette.textMuted}
              style={{
                fontSize: 40,
                fontWeight: '700',
                color: activeConfig.color,
                minWidth: 80,
                textAlign: 'center',
              }}
              autoFocus={!isEditing}
            />
          </View>
        </View>

        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: HOME_RADIUS.large,
            marginHorizontal: HOME_SPACE.screen,
            overflow: 'hidden',
          }}
        >
          {type === 'transfer' ? (
            <>
              <FieldRow label="From account" palette={palette}>
                <AccountPicker
                  accounts={accounts}
                  selectedId={accountId}
                  onSelect={setAccountId}
                  excludeId={linkedAccountId}
                  palette={palette}
                />
              </FieldRow>
              <View style={{ alignItems: 'center', paddingVertical: HOME_SPACE.xs }}>
                <TouchableOpacity
                  onPress={() => {
                    const tmp = accountId;
                    setAccountId(linkedAccountId);
                    setLinkedAccountId(tmp);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: HOME_COLORS.inputBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="swap-vertical" size={16} color={HOME_COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <FieldRow label="To account" palette={palette}>
                <AccountPicker
                  accounts={accounts}
                  selectedId={linkedAccountId}
                  onSelect={setLinkedAccountId}
                  excludeId={accountId}
                  palette={palette}
                />
              </FieldRow>
            </>
          ) : type === 'loan' ? (
            <>
              <FieldRow label="Account" palette={palette}>
                <AccountPicker accounts={accounts} selectedId={accountId} onSelect={setAccountId} palette={palette} />
              </FieldRow>
              <FieldRow label="Person" palette={palette}>
                <TextInput
                  value={personName}
                  onChangeText={setPersonName}
                  placeholder="Name"
                  placeholderTextColor={palette.textMuted}
                  style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, flex: 1 }}
                />
              </FieldRow>
              <FieldRow label="Direction" palette={palette}>
                <View style={{ flexDirection: 'row', gap: HOME_SPACE.sm }}>
                  {(['lent', 'borrowed'] as const).map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setLoanDirection(d)}
                      style={{
                        flex: 1,
                        paddingVertical: HOME_SPACE.md,
                        borderRadius: HOME_RADIUS.small,
                        alignItems: 'center',
                        borderWidth: 1.5,
                        borderColor: loanDirection === d ? HOME_COLORS.active : HOME_COLORS.divider,
                        backgroundColor: loanDirection === d ? HOME_COLORS.inBg : palette.surface,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: HOME_TEXT.bodySmall,
                          fontWeight: '600',
                          color: loanDirection === d ? HOME_COLORS.active : HOME_COLORS.textSecondary,
                        }}
                      >
                        {d === 'lent' ? 'I lent' : 'I borrowed'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FieldRow>
            </>
          ) : (
            <>
              <FieldRow label="Category" palette={palette}>
                <CategoryPicker
                  categories={categories.filter((c) => !c.parentId)}
                  allCategories={categories}
                  selectedId={categoryId}
                  onSelect={setCategoryId}
                  type={type}
                  palette={palette}
                />
              </FieldRow>
              <FieldRow label="Account" palette={palette}>
                <AccountPicker accounts={accounts} selectedId={accountId} onSelect={setAccountId} palette={palette} />
              </FieldRow>
            </>
          )}

          <FieldRow label="Date" palette={palette} onPress={openDatePicker}>
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text }}>{formatDate(date)}</Text>
            <Ionicons name="calendar-outline" size={18} color={palette.textMuted} />
          </FieldRow>

          {Platform.OS === 'ios' && showIosDatePicker ? (
            <View style={{ borderTopWidth: 1, borderTopColor: palette.divider }}>
              <DateTimePicker
                value={new Date(date)}
                mode="date"
                display="spinner"
                onChange={(_event: unknown, selected?: Date) => {
                  setShowIosDatePicker(false);
                  if (selected) setDate(toUTCMidnight(selected));
                }}
              />
            </View>
          ) : null}

          <FieldRow label="Note" noBorder palette={palette}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note..."
              placeholderTextColor={palette.textMuted}
              style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, flex: 1 }}
            />
          </FieldRow>
        </View>
      </ScrollView>

      {/* Bottom buttons */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: HOME_SPACE.screen,
          paddingBottom: insets.bottom + HOME_SPACE.xl,
          paddingTop: HOME_SPACE.md,
          backgroundColor: palette.background,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isValid || loading}
          style={{
            backgroundColor: isValid ? activeConfig.color : palette.textMuted,
            borderRadius: HOME_RADIUS.card,
            paddingVertical: HOME_SPACE.xl,
            alignItems: 'center',
            marginBottom: HOME_SPACE.md,
          }}
        >
          <Text style={{ color: HOME_COLORS.surface, fontSize: HOME_TEXT.heroLabel, fontWeight: '600' }}>
            {isEditing ? 'Save changes' : 'Add'}
          </Text>
        </TouchableOpacity>
        {isEditing && (
          <TouchableOpacity onPress={handleDelete} style={{ alignItems: 'center' }}>
            <Text style={{ color: HOME_COLORS.negative, fontSize: HOME_TEXT.sectionTitle, fontWeight: '500' }}>
              Delete transaction
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

import type { AppThemePalette } from '../../lib/theme';

function FieldRow({
  label,
  children,
  noBorder,
  onPress,
  palette,
}: {
  label: string;
  children: ReactNode;
  noBorder?: boolean;
  onPress?: () => void;
  palette: AppThemePalette;
}) {
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      onPress={onPress}
      style={{
        paddingHorizontal: HOME_SPACE.xl,
        paddingVertical: HOME_SPACE.lg,
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: HOME_COLORS.inputBg,
      }}
    >
      <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: HOME_SPACE.sm }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {children}
      </View>
    </Container>
  );
}

// ─── AccountPicker ────────────────────────────────────────────────────────────

function AccountPicker({
  accounts,
  selectedId,
  onSelect,
  excludeId,
  palette,
}: {
  accounts: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
  excludeId?: string;
  palette: AppThemePalette;
}) {
  const filtered = accounts.filter((a) => a.id !== excludeId);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {filtered.map((acc) => (
        <TouchableOpacity
          key={acc.id}
          onPress={() => onSelect(acc.id)}
          style={{
            paddingHorizontal: HOME_SPACE.md,
            paddingVertical: HOME_SPACE.sm,
            borderRadius: HOME_RADIUS.small,
            marginRight: HOME_SPACE.sm,
            backgroundColor: selectedId === acc.id ? HOME_COLORS.active : HOME_COLORS.inputBg,
          }}
        >
          <Text
            style={{
              fontSize: HOME_TEXT.bodySmall,
              fontWeight: '500',
              color: selectedId === acc.id ? HOME_COLORS.surface : HOME_COLORS.textSecondary,
            }}
          >
            {acc.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── CategoryPicker ───────────────────────────────────────────────────────────

function CategoryPicker({
  categories,
  allCategories,
  selectedId,
  onSelect,
  type,
  palette,
}: {
  categories: Category[];
  allCategories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
  type: TransactionType;
  palette: AppThemePalette;
}) {
  const { getCategoryDisplayName } = useCategoriesStore();
  const relevantParents = categories.filter((c) => c.type === type || c.type === 'both');

  if (selectedId) {
    const cat = allCategories.find((c) => c.id === selectedId);
    return (
      <TouchableOpacity
        onPress={() => onSelect('')}
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
      >
        <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, flex: 1 }}>
          {cat ? getCategoryDisplayName(selectedId) : 'Choose category...'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {relevantParents.map((parent) => {
        const children = allCategories.filter((c) => c.parentId === parent.id);
        const toShow = children.length > 0 ? children : [parent];
        return toShow.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            style={{
              paddingHorizontal: HOME_SPACE.md,
              paddingVertical: HOME_SPACE.sm,
              borderRadius: HOME_RADIUS.small,
              marginRight: HOME_SPACE.sm,
              backgroundColor: HOME_COLORS.inputBg,
            }}
          >
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: HOME_COLORS.textSecondary }}>
              {children.length > 0 ? `${parent.name} › ${cat.name}` : cat.name}
            </Text>
          </TouchableOpacity>
        ));
      })}
    </ScrollView>
  );
}
