import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { formatCurrency } from '../../lib/derived';
import { todayUTC, formatDate } from '../../lib/dateUtils';
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
  const { accounts, refresh: refreshAccounts } = useAccountsStore();
  const { categories, getCategoryDisplayName } = useCategoriesStore();
  const { settings } = useUIStore();

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
  const isValid = amount > 0 && accountId;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
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
  const outlineCategories = categories.filter((c) => !c.parentId && c.type !== 'in');
  const inlineCategories = categories.filter((c) => !c.parentId && c.type !== 'out');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F0F0F5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#F0F0F5' }}>
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
            <Ionicons name="close" size={24} color="#0A0A0A" />
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
                borderColor: type === t ? TYPE_CONFIG[t].borderColor : '#E5E7EB',
                backgroundColor: type === t ? TYPE_CONFIG[t].bg : '#fff',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: type === t ? TYPE_CONFIG[t].color : '#6B7280',
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
          <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 8 }}>Amount</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 32, color: '#9CA3AF', marginRight: 4 }}>{sym}</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
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
            backgroundColor: '#fff',
            borderRadius: 20,
            marginHorizontal: 16,
            overflow: 'hidden',
          }}
        >
          {/* Transfer: From/To accounts */}
          {type === 'transfer' ? (
            <>
              <FieldRow label="From account">
                <AccountPicker
                  accounts={accounts}
                  selectedId={accountId}
                  onSelect={setAccountId}
                  excludeId={linkedAccountId}
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
                    backgroundColor: '#F3F4F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="swap-vertical" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <FieldRow label="To account">
                <AccountPicker
                  accounts={accounts}
                  selectedId={linkedAccountId}
                  onSelect={setLinkedAccountId}
                  excludeId={accountId}
                />
              </FieldRow>
            </>
          ) : type === 'loan' ? (
            <>
              <FieldRow label="Account">
                <AccountPicker accounts={accounts} selectedId={accountId} onSelect={setAccountId} />
              </FieldRow>
              <FieldRow label="Person">
                <TextInput
                  value={personName}
                  onChangeText={setPersonName}
                  placeholder="Name"
                  placeholderTextColor="#9CA3AF"
                  style={{ fontSize: 15, color: '#0A0A0A', flex: 1 }}
                />
              </FieldRow>
              <FieldRow label="Direction">
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
                        borderColor: loanDirection === d ? '#1B4332' : '#E5E7EB',
                        backgroundColor: loanDirection === d ? '#DCFCE7' : '#fff',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: loanDirection === d ? '#1B4332' : '#6B7280',
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
              <FieldRow label="Category">
                <CategoryPicker
                  categories={categories.filter((c) => !c.parentId)}
                  allCategories={categories}
                  selectedId={categoryId}
                  onSelect={setCategoryId}
                  type={type}
                />
              </FieldRow>
              <FieldRow label="Account">
                <AccountPicker accounts={accounts} selectedId={accountId} onSelect={setAccountId} />
              </FieldRow>
            </>
          )}

          <FieldRow label="Date">
            <Text style={{ fontSize: 15, color: '#0A0A0A' }}>{formatDate(date)}</Text>
            <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
          </FieldRow>

          <FieldRow label="Note" noBorder>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note..."
              placeholderTextColor="#9CA3AF"
              style={{ fontSize: 15, color: '#0A0A0A', flex: 1 }}
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
          backgroundColor: '#F0F0F5',
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isValid || loading}
          style={{
            backgroundColor: isValid ? activeConfig.color : '#9CA3AF',
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
}: {
  label: string;
  children: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: '#F3F4F6',
      }}
    >
      <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {children}
      </View>
    </View>
  );
}

function AccountPicker({
  accounts,
  selectedId,
  onSelect,
  excludeId,
}: {
  accounts: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
  excludeId?: string;
}) {
  const filtered = accounts.filter((a) => a.id !== excludeId);
  const selected = filtered.find((a) => a.id === selectedId);

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
            backgroundColor: selectedId === acc.id ? '#1B4332' : '#F3F4F6',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: selectedId === acc.id ? '#fff' : '#6B7280',
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
}: {
  categories: Category[];
  allCategories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
  type: TransactionType;
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
        <Text style={{ fontSize: 15, color: '#0A0A0A', flex: 1 }}>
          {cat ? getCategoryDisplayName(selectedId) : 'Choose category...'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
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
              backgroundColor: '#F3F4F6',
            }}
          >
            <Text style={{ fontSize: 13, color: '#6B7280' }}>
              {children.length > 0 ? `${parent.name} › ${cat.name}` : cat.name}
            </Text>
          </TouchableOpacity>
        ));
      })}
    </ScrollView>
  );
}
