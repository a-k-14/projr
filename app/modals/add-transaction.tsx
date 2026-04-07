import { useEffect, useRef, useState } from 'react';
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
import { nowUTC, formatDateTime } from '../../lib/dateUtils';
import type {
  TransactionType,
  CreateTransactionInput,
  Account,
  Category,
  Tag,
} from '../../types';
import { getTransactionById } from '../../services/transactions';

const TYPE_CONFIG = {
  in: { label: 'In', color: '#16A34A', borderColor: '#16A34A', bg: '#DCFCE7' },
  out: { label: 'Out', color: '#DC2626', borderColor: '#DC2626', bg: '#FEE2E2' },
  transfer: { label: 'Transfer', color: '#1E293B', borderColor: '#1E293B', bg: '#F1F5F9' },
  loan: { label: 'Loan', color: '#B45309', borderColor: '#B45309', bg: '#FEF3C7' },
};

type SplitDraft = {
  id: string;
  categoryId: string;
  amountStr: string;
};

export default function AddTransactionModal() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = !!editId;

  const { add, update, remove } = useTransactionsStore();
  const { accounts, refresh: refreshAccounts } = useAccountsStore();
  const { categories, tags } = useCategoriesStore();
  const { settings } = useUIStore();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<TransactionType>('out');
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [payee, setPayee] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [splitRows, setSplitRows] = useState<SplitDraft[]>([]);
  const [date, setDate] = useState(nowUTC());
  const [note, setNote] = useState('');
  const [personName, setPersonName] = useState('');
  const [loanDirection, setLoanDirection] = useState<'lent' | 'borrowed'>('lent');
  const [loading, setLoading] = useState(false);
  const splitIdSeed = useRef(0);

  const sym = settings.currencySymbol;

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(settings.defaultAccountId || accounts[0].id);
      if (accounts.length > 1) setLinkedAccountId(accounts[1].id);
    }
  }, [accounts, accountId, settings.defaultAccountId]);

  useEffect(() => {
    if (!isEditing || !editId) return;
    getTransactionById(editId).then((tx) => {
      if (!tx) return;
      setType(tx.type);
      setAmountStr(String(tx.amount));
      setAccountId(tx.accountId);
      if (tx.linkedAccountId) setLinkedAccountId(tx.linkedAccountId);
      if (tx.categoryId) setCategoryId(tx.categoryId);
      if (tx.payee) setPayee(tx.payee);
      if (tx.tags?.length) setSelectedTagIds(tx.tags);
      if (tx.splits?.length) {
        setSplitRows(
          tx.splits.map((split) => ({
            id: `split-${splitIdSeed.current++}`,
            categoryId: split.categoryId,
            amountStr: String(split.amount),
          }))
        );
      }
      setDate(tx.date);
      if (tx.note) setNote(tx.note);
    });
  }, [editId, isEditing]);

  const amount = parseFloat(amountStr) || 0;
  const activeConfig = TYPE_CONFIG[type];
  const amountPreview = amount > 0 ? formatCurrency(amount, sym) : '';
  const splitTotal = splitRows.reduce((sum, row) => sum + (parseFloat(row.amountStr) || 0), 0);
  const splitValid =
    splitRows.length === 0 ||
    (splitRows.every((row) => row.categoryId && (parseFloat(row.amountStr) || 0) > 0) &&
      Math.abs(splitTotal - amount) < 0.01);

  const isValid =
    type === 'transfer'
      ? amount > 0 && accountId && linkedAccountId && accountId !== linkedAccountId
      : type === 'loan'
        ? amount > 0 && accountId && personName.trim().length > 0
        : amount > 0 && accountId && categoryId && splitValid;

  const actionLabel = isEditing
    ? 'Save changes'
    : type === 'in'
      ? 'Add income'
      : type === 'transfer'
        ? 'Move money'
        : type === 'loan'
          ? 'Add loan'
          : 'Add expense';

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
        payee: payee.trim() || undefined,
        tags: selectedTagIds,
        splits:
          type === 'in' || type === 'out'
            ? splitRows.length > 0
              ? splitRows.map((row) => ({
                  categoryId: row.categoryId,
                  amount: parseFloat(row.amountStr) || 0,
                }))
              : []
            : undefined,
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

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    );
  };

  const addSplitRow = () => {
    const fallbackCategory = categoryId || getRelevantCategoryOptions(categories, type)[0]?.id || '';
    setSplitRows((current) => [
      ...current,
      {
        id: `split-${splitIdSeed.current++}`,
        categoryId: fallbackCategory,
        amountStr: current.length === 0 ? amountStr : '',
      },
    ]);
  };

  const updateSplitRow = (id: string, patch: Partial<SplitDraft>) => {
    setSplitRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const removeSplitRow = (id: string) => {
    setSplitRows((current) => current.filter((row) => row.id !== id));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F0F0F5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#F0F0F5' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 14,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
            <Ionicons name="close" size={24} color="#0A0A0A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#0A0A0A' }}>
              {isEditing ? 'Edit transaction' : 'New transaction'}
            </Text>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              {type === 'in'
                ? 'Money coming in'
                : type === 'out'
                  ? 'Money going out'
                  : type === 'transfer'
                    ? 'Move between accounts'
                    : 'Track what someone owes'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 132 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(Object.keys(TYPE_CONFIG) as TransactionType[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setType(t)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: type === t ? TYPE_CONFIG[t].borderColor : '#E5E7EB',
                  backgroundColor: type === t ? TYPE_CONFIG[t].bg : '#fff',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: type === t ? TYPE_CONFIG[t].color : '#6B7280',
                  }}
                >
                  {TYPE_CONFIG[t].label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {(type === 'in' || type === 'out') ? (
          <>
            <SectionCard>
              <DateTimeRow date={date} />
              <AmountRow
                sym={sym}
                activeConfig={activeConfig}
                amountStr={amountStr}
                setAmountStr={setAmountStr}
                amountPreview={amountPreview}
                isEditing={isEditing}
              />
              <FieldRow label="Account">
                <AccountPicker accounts={accounts} selectedId={accountId} onSelect={setAccountId} />
              </FieldRow>
              <FieldRow label="Category">
                <CategoryPicker
                  categories={categories}
                  selectedId={categoryId}
                  onSelect={setCategoryId}
                  type={type}
                />
              </FieldRow>
              <FieldRow label="Payee">
                <TextInput
                  value={payee}
                  onChangeText={setPayee}
                  placeholder="Who was it for?"
                  placeholderTextColor="#9CA3AF"
                  style={{ flex: 1, fontSize: 15, color: '#0A0A0A', paddingVertical: 0 }}
                />
              </FieldRow>
              <FieldRow label="Split">
                {splitRows.length === 0 ? (
                  <TouchableOpacity onPress={addSplitRow} style={{ paddingVertical: 6 }}>
                    <Text style={{ fontSize: 15, color: '#17673B', fontWeight: '600' }}>
                      + Add split
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flex: 1, gap: 12 }}>
                    {splitRows.map((row, index) => (
                      <SplitRowEditor
                        key={row.id}
                        row={row}
                        index={index}
                        categories={categories}
                        type={type}
                        onChange={updateSplitRow}
                        onRemove={removeSplitRow}
                      />
                    ))}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <TouchableOpacity onPress={addSplitRow}>
                        <Text style={{ fontSize: 14, color: '#17673B', fontWeight: '600' }}>
                          + Add split line
                        </Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 12, color: Math.abs(splitTotal - amount) < 0.01 ? '#6B7280' : '#DC2626' }}>
                        Total {formatCurrency(splitTotal, sym)} / {formatCurrency(amount, sym)}
                      </Text>
                    </View>
                  </View>
                )}
              </FieldRow>
              <FieldRow label="Receipt">
                <TouchableOpacity
                  onPress={() => Alert.alert('Receipt capture', 'Receipt capture is coming next.')}
                  style={{
                    paddingVertical: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Ionicons name="camera-outline" size={18} color="#17673B" />
                  <Text style={{ fontSize: 15, color: '#17673B', fontWeight: '600' }}>
                    + Capture receipt
                  </Text>
                </TouchableOpacity>
              </FieldRow>
              <FieldRow label="Tag">
                <TagPicker tags={tags} selectedIds={selectedTagIds} onToggle={toggleTag} />
              </FieldRow>
              <FieldRow label="Notes" noBorder>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a note..."
                  placeholderTextColor="#9CA3AF"
                  style={{ flex: 1, fontSize: 15, color: '#0A0A0A', paddingVertical: 0 }}
                  multiline
                />
              </FieldRow>
            </SectionCard>
          </>
        ) : type === 'transfer' ? (
          <SectionCard>
            <FieldRow label="From account">
              <AccountPicker
                accounts={accounts}
                selectedId={accountId}
                onSelect={setAccountId}
                excludeId={linkedAccountId}
              />
            </FieldRow>
            <View style={{ alignItems: 'center', paddingVertical: 2 }}>
              <TouchableOpacity
                onPress={() => {
                  const tmp = accountId;
                  setAccountId(linkedAccountId);
                  setLinkedAccountId(tmp);
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
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
            <DateTimeRow date={date} />
            <FieldRow label="Notes" noBorder>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a note..."
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, fontSize: 15, color: '#0A0A0A', paddingVertical: 0 }}
                multiline
              />
            </FieldRow>
          </SectionCard>
        ) : (
          <SectionCard>
            <FieldRow label="Account">
              <AccountPicker accounts={accounts} selectedId={accountId} onSelect={setAccountId} />
            </FieldRow>
            <FieldRow label="Person">
              <TextInput
                value={personName}
                onChangeText={setPersonName}
                placeholder="Name"
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, fontSize: 15, color: '#0A0A0A', paddingVertical: 0 }}
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
                      paddingVertical: 11,
                      borderRadius: 14,
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
            <DateTimeRow date={date} />
            <FieldRow label="Notes" noBorder>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a note..."
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, fontSize: 15, color: '#0A0A0A', paddingVertical: 0 }}
                multiline
              />
            </FieldRow>
          </SectionCard>
        )}
      </ScrollView>

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
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{actionLabel}</Text>
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

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 24,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E8EBF0',
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
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
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: '#F3F4F6',
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: '#9CA3AF', marginBottom: 10 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {children}
      </View>
    </View>
  );
}

function DateTimeRow({ date }: { date: string }) {
  return (
    <FieldRow label="Date / time">
      <Text style={{ fontSize: 15, color: '#0A0A0A' }}>{formatDateTime(date)}</Text>
      <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
    </FieldRow>
  );
}

function AmountRow({
  sym,
  activeConfig,
  amountStr,
  setAmountStr,
  amountPreview,
  isEditing,
}: {
  sym: string;
  activeConfig: (typeof TYPE_CONFIG)[TransactionType];
  amountStr: string;
  setAmountStr: (value: string) => void;
  amountPreview: string;
  isEditing: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: '#9CA3AF', marginBottom: 10 }}>
        AMOUNT
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: activeConfig.bg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: activeConfig.color }}>{sym}</Text>
        </View>
        <TextInput
          value={amountStr}
          onChangeText={setAmountStr}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#C1C7D0"
          style={{
            flex: 1,
            fontSize: 42,
            fontWeight: '800',
            color: activeConfig.color,
            paddingVertical: 0,
          }}
          autoFocus={!isEditing}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Fast, natural entry</Text>
        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{amountPreview || ' '}</Text>
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
  const ordered = [
    ...filtered.filter((a) => a.id === selectedId),
    ...filtered.filter((a) => a.id !== selectedId),
  ];

  if (ordered.length === 0) {
    return <Text style={{ fontSize: 13, color: '#9CA3AF' }}>No account available</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
      {ordered.map((acc) => (
        <TouchableOpacity
          key={acc.id}
          onPress={() => onSelect(acc.id)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 12,
            marginRight: 8,
            backgroundColor: selectedId === acc.id ? '#1B4332' : '#F3F4F6',
            borderWidth: 1,
            borderColor: selectedId === acc.id ? '#1B4332' : '#F3F4F6',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: selectedId === acc.id ? '#fff' : '#6B7280',
            }}
            numberOfLines={1}
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
  selectedId,
  onSelect,
  type,
}: {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
  type: TransactionType;
}) {
  const options = getRelevantCategoryOptions(categories, type);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.id}
          onPress={() => onSelect(option.id)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 12,
            marginRight: 8,
            backgroundColor: selectedId === option.id ? '#17673B' : '#F3F4F6',
            borderWidth: 1,
            borderColor: selectedId === option.id ? '#17673B' : '#F3F4F6',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: selectedId === option.id ? '#fff' : '#6B7280',
            }}
            numberOfLines={1}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function SplitRowEditor({
  row,
  index,
  categories,
  type,
  onChange,
  onRemove,
}: {
  row: SplitDraft;
  index: number;
  categories: Category[];
  type: TransactionType;
  onChange: (id: string, patch: Partial<SplitDraft>) => void;
  onRemove: (id: string) => void;
}) {
  const options = getRelevantCategoryOptions(categories, type);

  return (
    <View style={{ borderRadius: 16, backgroundColor: '#F9FAFB', padding: 12, borderWidth: 1, borderColor: '#EEF2F7' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: '#9CA3AF' }}>
          Split {index + 1}
        </Text>
        <TouchableOpacity onPress={() => onRemove(row.id)}>
          <Ionicons name="close" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.id}
            onPress={() => onChange(row.id, { categoryId: option.id })}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 12,
              marginRight: 8,
              backgroundColor: row.categoryId === option.id ? '#17673B' : '#fff',
              borderWidth: 1,
              borderColor: row.categoryId === option.id ? '#17673B' : '#E5E7EB',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: row.categoryId === option.id ? '#fff' : '#6B7280',
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TextInput
        value={row.amountStr}
        onChangeText={(value) => onChange(row.id, { amountStr: value })}
        keyboardType="decimal-pad"
        placeholder="Split amount"
        placeholderTextColor="#9CA3AF"
        style={{
          minHeight: 42,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          backgroundColor: '#fff',
          paddingHorizontal: 12,
          color: '#0A0A0A',
          fontSize: 14,
        }}
      />
    </View>
  );
}

function TagPicker({
  tags,
  selectedIds,
  onToggle,
}: {
  tags: Tag[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  if (tags.length === 0) {
    return <Text style={{ fontSize: 13, color: '#9CA3AF' }}>No tags yet</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
      {tags.map((tag) => {
        const selected = selectedIds.includes(tag.id);
        return (
          <TouchableOpacity
            key={tag.id}
            onPress={() => onToggle(tag.id)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 12,
              marginRight: 8,
              backgroundColor: selected ? tag.color : '#F3F4F6',
              borderWidth: 1,
              borderColor: selected ? tag.color : '#F3F4F6',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: selected ? '#fff' : '#6B7280',
              }}
            >
              {tag.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function getRelevantCategoryOptions(categories: Category[], type: TransactionType) {
  const relevantParents = categories.filter((category) => category.type === type || category.type === 'both');
  return relevantParents.flatMap((parent) => {
    const children = categories.filter((category) => category.parentId === parent.id);
    if (children.length > 0) {
      return children.map((child) => ({
        id: child.id,
        label: `${parent.name} › ${child.name}`,
      }));
    }
    return [{ id: parent.id, label: parent.name }];
  });
}
