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
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { formatCurrency } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
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

function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const [head, ...rest] = cleaned.split('.');
  const normalizedHead = head === '' ? '0' : head;
  if (rest.length === 0) return normalizedHead;
  return `${normalizedHead}.${rest.join('').replace(/\./g, '')}`;
}

export default function AddTransactionModal() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = !!editId;

  const { add, update, remove } = useTransactionsStore();
  const { accounts, refresh: refreshAccounts } = useAccountsStore();
  const { categories, tags } = useCategoriesStore();
  const { settings } = useUIStore();
  const {
    accountId: draftAccountId,
    categoryId: draftCategoryId,
    tagIds: draftTagIds,
    setAccountId: setDraftAccountId,
    setCategoryId: setDraftCategoryId,
    setTagIds: setDraftTagIds,
  } = useTransactionDraftStore();
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
    if (draftAccountId && draftAccountId !== accountId) setAccountId(draftAccountId);
  }, [accountId, draftAccountId]);

  useEffect(() => {
    if (draftCategoryId && draftCategoryId !== categoryId) setCategoryId(draftCategoryId);
  }, [categoryId, draftCategoryId]);

  useEffect(() => {
    const same =
      draftTagIds.length === selectedTagIds.length &&
      draftTagIds.every((id, index) => id === selectedTagIds[index]);
    if (!same) setSelectedTagIds(draftTagIds);
  }, [draftTagIds, selectedTagIds]);

  useEffect(() => {
    if (accountId !== draftAccountId) setDraftAccountId(accountId);
  }, [accountId, draftAccountId, setDraftAccountId]);

  useEffect(() => {
    if (categoryId !== draftCategoryId) setDraftCategoryId(categoryId);
  }, [categoryId, draftCategoryId, setDraftCategoryId]);

  useEffect(() => {
    const same =
      selectedTagIds.length === draftTagIds.length &&
      selectedTagIds.every((id, index) => id === draftTagIds[index]);
    if (!same) setDraftTagIds(selectedTagIds);
  }, [draftTagIds, selectedTagIds, setDraftTagIds]);

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
            paddingHorizontal: SCREEN_GUTTER,
            paddingTop: 8,
            paddingBottom: 12,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
            <Ionicons name="close" size={24} color="#0A0A0A" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: '#0A0A0A' }}>
            {isEditing ? 'Edit transaction' : 'New transaction'}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 132 }}>
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 2, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(Object.keys(TYPE_CONFIG) as TransactionType[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setType(t)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  alignItems: 'center',
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
          </View>
        </View>

        {type === 'out' ? (
          <SectionCard>
            <KeyValueRow label="Date">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 15, color: '#0A0A0A' }}>{formatDateTime(date)}</Text>
                <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
              </View>
            </KeyValueRow>
            <AmountRow
              sym={sym}
              activeConfig={activeConfig}
              amountStr={amountStr}
              setAmountStr={setAmountStr}
              amountPreview={amountPreview}
              isEditing={isEditing}
            />
            <PickerRow
              label="Account"
              value={getAccountName(accounts, accountId)}
              placeholder={!accountId}
              onPress={() => {
                setDraftAccountId(accountId);
                router.push('/modals/select-account');
              }}
            />
            <PickerRow
              label="Category"
              value={getCategoryName(categories, categoryId)}
              placeholder={!categoryId}
              onPress={() => {
                setDraftCategoryId(categoryId);
                router.push({
                  pathname: '/modals/select-category',
                  params: { type },
                });
              }}
            />
            <KeyValueRow label="Payee">
              <TextInput
                value={payee}
                onChangeText={setPayee}
                placeholder="Add payee"
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, fontSize: 15, color: '#0A0A0A', paddingVertical: 0, textAlign: 'left' }}
              />
            </KeyValueRow>
            <SplitSection
              amount={amount}
              amountStr={amountStr}
              currencySymbol={sym}
              splitRows={splitRows}
              splitTotal={splitTotal}
              categories={categories}
              type={type}
              onAddSplit={addSplitRow}
              onChangeSplit={updateSplitRow}
              onRemoveSplit={removeSplitRow}
            />
            <ReceiptSection />
            <PickerRow
              label="Tag"
              value={selectedTagIds.length ? tagSummary(tags, selectedTagIds) : 'Add tag'}
              placeholder={!selectedTagIds.length}
              onPress={() => {
                setDraftTagIds(selectedTagIds);
                router.push('/modals/select-tag');
              }}
            />
            <NotesSection note={note} onChangeNote={setNote} />
          </SectionCard>
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
          paddingHorizontal: SCREEN_GUTTER,
          paddingBottom: insets.bottom + 14,
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
        marginHorizontal: SCREEN_GUTTER,
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
        paddingHorizontal: SCREEN_GUTTER,
        paddingVertical: 14,
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: '#F3F4F6',
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '500', color: '#6B7280', marginBottom: 10 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {children}
      </View>
    </View>
  );
}

function KeyValueRow({
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
        paddingHorizontal: SCREEN_GUTTER,
        paddingVertical: 14,
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: '#F3F4F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '500', color: '#6B7280' }}>
        {label}
      </Text>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>{children}</View>
    </View>
  );
}

function PickerRow({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string;
  placeholder?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '500', color: '#6B7280' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-start' }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: placeholder ? '#9CA3AF' : '#0A0A0A',
            textAlign: 'left',
            flexShrink: 1,
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

function DateTimeRow({ date }: { date: string }) {
  return (
    <KeyValueRow label="Date">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 15, color: '#0A0A0A' }} numberOfLines={1}>
          {formatDateTime(date)}
        </Text>
        <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
      </View>
    </KeyValueRow>
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
        paddingHorizontal: SCREEN_GUTTER,
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
          onChangeText={(value) => setAmountStr(sanitizeDecimalInput(value))}
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

function SplitSection({
  amount,
  amountStr,
  currencySymbol,
  splitRows,
  splitTotal,
  categories,
  type,
  onAddSplit,
  onChangeSplit,
  onRemoveSplit,
}: {
  amount: number;
  amountStr: string;
  currencySymbol: string;
  splitRows: SplitDraft[];
  splitTotal: number;
  categories: Category[];
  type: TransactionType;
  onAddSplit: () => void;
  onChangeSplit: (id: string, patch: Partial<SplitDraft>) => void;
  onRemoveSplit: (id: string) => void;
}) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: '#9CA3AF' }}>
          Split
        </Text>
        <TouchableOpacity onPress={onAddSplit}>
          <Text style={{ fontSize: 13, color: '#17673B', fontWeight: '600' }}>+ Add split</Text>
        </TouchableOpacity>
      </View>
      {splitRows.length > 0 ? (
        <View style={{ gap: 12 }}>
          {splitRows.map((row, index) => (
            <SplitRowEditor
              key={row.id}
              row={row}
              index={index}
              categories={categories}
              type={type}
              onChange={onChangeSplit}
              onRemove={onRemoveSplit}
            />
          ))}
          <Text style={{ fontSize: 12, color: Math.abs(splitTotal - amount) < 0.01 ? '#6B7280' : '#DC2626' }}>
            Total {formatCurrency(splitTotal, currencySymbol)} / {formatCurrency(amount, currencySymbol)}
          </Text>
        </View>
      ) : (
        <Text style={{ fontSize: 13, color: '#9CA3AF' }}>Split this transaction across categories.</Text>
      )}
    </View>
  );
}

function ReceiptSection() {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: '#9CA3AF', marginBottom: 10 }}>
        Receipt
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        <TouchableOpacity
          onPress={() => Alert.alert('Receipt capture', 'Receipt capture is coming next.')}
          style={{
            width: 58,
            height: 58,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#D1D5DB',
            backgroundColor: '#F8FAFC',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="camera-outline" size={22} color="#17673B" />
        </TouchableOpacity>
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="receipt-outline" size={22} color="#9CA3AF" />
        </View>
        <View style={{ justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '500' }}>Captured receipts</Text>
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Thumbnails appear here</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function NotesSection({
  note,
  onChangeNote,
}: {
  note: string;
  onChangeNote: (value: string) => void;
}) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: '#9CA3AF', marginBottom: 10 }}>
        Notes
      </Text>
      <TextInput
        value={note}
        onChangeText={onChangeNote}
        placeholder="Add a note..."
        placeholderTextColor="#9CA3AF"
        style={{ minHeight: 72, fontSize: 15, color: '#0A0A0A', paddingVertical: 0, textAlignVertical: 'top' }}
        multiline
      />
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
        onChangeText={(value) => onChange(row.id, { amountStr: sanitizeDecimalInput(value) })}
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

function tagSummary(tags: Tag[], selectedIds: string[]) {
  const names = selectedIds
    .map((id) => tags.find((tag) => tag.id === id)?.name)
    .filter((value): value is string => !!value);
  if (names.length === 0) return 'Add tag';
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

function getAccountName(accounts: Account[], accountId: string) {
  return accounts.find((account) => account.id === accountId)?.name ?? 'Select account';
}

function getCategoryName(categories: Category[], categoryId: string) {
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return 'Select category';
  return category.parentId
    ? `${categories.find((item) => item.id === category.parentId)?.name ?? 'Category'} › ${category.name}`
    : category.name;
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
