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
import type { TransactionType, CreateTransactionInput, Account, Category } from '../../types';
import { getTransactionById } from '../../services/transactions';

const TYPE_CONFIG = {
  in: { label: 'In', color: '#16A34A', borderColor: '#16A34A', bg: '#DCFCE7' },
  out: { label: 'Out', color: '#DC2626', borderColor: '#DC2626', bg: '#FEE2E2' },
  transfer: { label: 'Transfer', color: '#1E293B', borderColor: '#1E293B', bg: '#F1F5F9' },
  loan: { label: 'Loan', color: '#B45309', borderColor: '#B45309', bg: '#FEF3C7' },
};

export default function AddTransactionModal() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = !!editId;

  const { add, update, remove } = useTransactionsStore();
  const { add: addLoan } = useLoansStore();
  const { accounts, refresh: refreshAccounts } = useAccountsStore();
  const { categories, getCategoryDisplayName } = useCategoriesStore();
  const { settings } = useUIStore();
  const systemScheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, systemScheme));

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
        setAmountStr(String(tx.amount));
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

  const activeConfig = TYPE_CONFIG[type];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        {/* Header type selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16, padding: 4 }}>
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
          {(Object.keys(TYPE_CONFIG) as TransactionType[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setType(t)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                marginRight: 8,
                borderWidth: 1.5,
                borderColor: type === t ? TYPE_CONFIG[t].borderColor : palette.border,
                backgroundColor: type === t ? TYPE_CONFIG[t].bg : palette.surface,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: type === t ? TYPE_CONFIG[t].color : palette.textMuted,
                }}
              >
                {TYPE_CONFIG[t].label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Amount */}
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ fontSize: 13, color: palette.textSoft, marginBottom: 8 }}>Amount</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 32, color: palette.textSoft, marginRight: 4 }}>{sym}</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={palette.textSoft}
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
            borderRadius: 20,
            marginHorizontal: 16,
            overflow: 'hidden',
          }}
        >
          {/* Transfer: From/To accounts */}
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
              <View style={{ alignItems: 'center', paddingVertical: 4 }}>
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
                    backgroundColor: palette.divider,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="swap-vertical" size={16} color={palette.textMuted} />
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
                  placeholderTextColor={palette.textSoft}
                  style={{ fontSize: 15, color: palette.text, flex: 1 }}
                />
              </FieldRow>
              <FieldRow label="Direction" palette={palette}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['lent', 'borrowed'] as const).map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setLoanDirection(d)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        alignItems: 'center',
                        borderWidth: 1.5,
                        borderColor: loanDirection === d ? '#1B4332' : palette.border,
                        backgroundColor: loanDirection === d ? '#DCFCE7' : palette.surface,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: loanDirection === d ? '#1B4332' : palette.textMuted,
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
            <Text style={{ fontSize: 15, color: palette.text }}>{formatDate(date)}</Text>
            <Ionicons name="calendar-outline" size={18} color={palette.textSoft} />
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
              placeholderTextColor={palette.textSoft}
              style={{ fontSize: 15, color: palette.text, flex: 1 }}
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
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
          backgroundColor: palette.background,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isValid || loading}
          style={{
            backgroundColor: isValid ? activeConfig.color : palette.textSoft,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {isEditing ? 'Save changes' : 'Add'}
          </Text>
        </TouchableOpacity>
        {isEditing && (
          <TouchableOpacity onPress={handleDelete} style={{ alignItems: 'center' }}>
            <Text style={{ color: '#DC2626', fontSize: 15, fontWeight: '500' }}>
              Delete transaction
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

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
  palette: ReturnType<typeof getThemePalette>;
}) {
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: palette.divider,
      }}
    >
      <Text style={{ fontSize: 12, color: palette.textSoft, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {children}
      </View>
    </Container>
  );
}

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
  palette: ReturnType<typeof getThemePalette>;
}) {
  const filtered = accounts.filter((a) => a.id !== excludeId);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {filtered.map((acc) => (
        <TouchableOpacity
          key={acc.id}
          onPress={() => onSelect(acc.id)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            marginRight: 8,
            backgroundColor: selectedId === acc.id ? palette.tabActive : palette.divider,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: selectedId === acc.id ? '#fff' : palette.textMuted,
            }}
          >
            {acc.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

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
  palette: ReturnType<typeof getThemePalette>;
}) {
  const { getCategoryDisplayName } = useCategoriesStore();
  const relevantParents = categories.filter(
    (c) => c.type === type || c.type === 'both'
  );

  if (selectedId) {
    const cat = allCategories.find((c) => c.id === selectedId);
    return (
      <TouchableOpacity
        onPress={() => onSelect('')}
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
      >
        <Text style={{ fontSize: 15, color: palette.text, flex: 1 }}>
          {cat ? getCategoryDisplayName(selectedId) : 'Choose category...'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={palette.textSoft} />
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
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              marginRight: 8,
              backgroundColor: palette.divider,
            }}
          >
            <Text style={{ fontSize: 13, color: palette.textMuted }}>
              {children.length > 0 ? `${parent.name} › ${cat.name}` : cat.name}
            </Text>
          </TouchableOpacity>
        ));
      })}
    </ScrollView>
  );
}
