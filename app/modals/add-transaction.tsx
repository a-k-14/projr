import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  LayoutAnimation,
} from 'react-native';
import { TouchableOpacity as RnghTouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChoiceRow } from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { formatDate, nowUTC } from '../../lib/dateUtils';
import { formatCurrency, formatIndianNumberStr, parseFormattedNumber } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { getTransactionById } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';
import type {
  Account,
  Category,
  CreateTransactionInput,
  Tag,
  TransactionType,
} from '../../types';

// We compute TYPE_CONFIG dynamically inside the component to use the derived palette

type SplitDraft = {
  id: string;
  categoryId: string;
  amountStr: string;
  openCategoryPicker?: boolean;
};

const ROW_LABEL_WIDTH = 92;
const ROW_MIN_HEIGHT = 62;
const ROW_COLUMN_GAP = 16;
const ROW_TRAILING_WIDTH = 24;

function sanitizeDecimalInput(value: string): string {
  // Remove any character that isn't a digit or a period
  let cleaned = value.replace(/[^0-9.]/g, '');

  // Handle empty input
  if (!cleaned) return '';

  // If we have multiple dots, keep only the first one
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }

  // Handle leading zeros (e.g., "05" -> "5", but "0.5" remains "0.5")
  if (cleaned.length > 1 && cleaned.startsWith('0') && cleaned[1] !== '.') {
    cleaned = cleaned.substring(1);
  }

  return cleaned;
}

export default function AddTransactionModal() {
  const { editId, accountId: sourceAccountId, type: initialType } = useLocalSearchParams<{ editId?: string; accountId?: string; type?: string }>();
  const isEditing = !!editId;

  const addTransaction = useTransactionsStore((s) => s.add);
  const updateTransaction = useTransactionsStore((s) => s.update);
  const removeTransaction = useTransactionsStore((s) => s.remove);
  const addLoan = useLoansStore((s) => s.add);
  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const categories = useCategoriesStore((s) => s.categories);
  const tags = useCategoriesStore((s) => s.tags);
  const defaultAccountId = useUIStore((s) => s.settings.defaultAccountId);
  const sym = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const { palette } = useAppTheme();
  const draftCategoryId = useTransactionDraftStore((s) => s.categoryId);
  const calculatorValue = useTransactionDraftStore((s) => s.calculatorValue);
  const calculatorOpen = useTransactionDraftStore((s) => s.calculatorOpen);
  const setDraftCategoryId = useTransactionDraftStore((s) => s.setCategoryId);
  const setCalculatorValue = useTransactionDraftStore((s) => s.setCalculatorValue);
  const setCalculatorOpen = useTransactionDraftStore((s) => s.setCalculatorOpen);
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<TransactionType>((initialType as TransactionType) || 'out');
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
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showFromAccountSheet, setShowFromAccountSheet] = useState(false);
  const [showToAccountSheet, setShowToAccountSheet] = useState(false);
  const [showTagSheet, setShowTagSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | 'datetime'>('date');
  const splitIdSeed = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const TYPE_CONFIG = {
    in: { label: 'In', color: palette.positive, borderColor: palette.positive, bg: palette.inBg },
    out: { label: 'Out', color: palette.negative, borderColor: palette.negative, bg: palette.outBg },
    transfer: { label: 'Transfer', color: palette.transferText, borderColor: palette.transferText, bg: palette.transferBg },
    loan: { label: 'Loan', color: palette.loan, borderColor: palette.loan, bg: palette.loanBg },
  };

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      const preferred =
        sourceAccountId && sourceAccountId !== 'all' && accounts.some((account) => account.id === sourceAccountId)
          ? sourceAccountId
          : defaultAccountId || accounts[0].id;
      setAccountId(preferred);
      if (accounts.length > 1) setLinkedAccountId(accounts[1].id);
    }
  }, [accounts, accountId, defaultAccountId, sourceAccountId]);

  // One-way sync: when user picks a category in the external modal,
  // draftCategoryId changes → pull it into local state.
  // We guard with a ref so that our own setCategoryId calls don't re-trigger.
  const isSyncingCategory = useRef(false);
  useEffect(() => {
    if (isSyncingCategory.current) {
      isSyncingCategory.current = false;
      return;
    }
    if (draftCategoryId && draftCategoryId !== categoryId) {
      setCategoryId(draftCategoryId);
    }
  }, [draftCategoryId]);

  // Push local categoryId to draft store (for the category picker to read),
  // but only when local state changes and skip the initial empty value.
  useEffect(() => {
    if (categoryId) {
      isSyncingCategory.current = true;
      setDraftCategoryId(categoryId);
    }
  }, [categoryId, setDraftCategoryId]);

  // Only sync calculator value to amountStr when the calculator is closed
  // This prevents incomplete expressions like "94+" from appearing in the main form
  const prevCalculatorOpen = useRef(calculatorOpen);
  useEffect(() => {
    if (prevCalculatorOpen.current === true && calculatorOpen === false) {
      if (calculatorValue && calculatorValue !== '0') {
        // Strict sanitization: remove anything that isn't a number or period
        const clean = calculatorValue.replace(/[^0-9.]/g, '');
        setAmountStr(formatIndianNumberStr(clean));
      }
    }
    prevCalculatorOpen.current = calculatorOpen;
  }, [calculatorOpen, calculatorValue]);

  useEffect(() => {
    if (!isEditing || !editId) return;
    const task = InteractionManager.runAfterInteractions(() => {
      getTransactionById(editId).then((tx) => {
        if (!tx) return;
        setType(tx.type);
        setAmountStr(formatIndianNumberStr(String(tx.amount)));
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
    });
    return () => task.cancel();
  }, [editId, isEditing]);

  const amount = parseFloat(parseFormattedNumber(amountStr)) || 0;
  const activeConfig = TYPE_CONFIG[type];
  const displaySym = showCurrencySymbol ? sym : '';
  const splitTotal = splitRows.reduce((sum, row) => sum + (parseFloat(parseFormattedNumber(row.amountStr)) || 0), 0);
  const splitValid =
    splitRows.length === 0 ||
    (splitRows.every((row) => row.categoryId && (parseFloat(parseFormattedNumber(row.amountStr)) || 0) > 0) &&
      Math.abs(splitTotal - amount) / Math.max(amount, 1) < 0.001);

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
                amount: parseFloat(parseFormattedNumber(row.amountStr)) || 0,
              }))
              : []
            : undefined,
        linkedAccountId: type === 'transfer' ? linkedAccountId : undefined,
      };

      if (type === 'loan') {
        await addLoan({
          personName,
          direction: loanDirection,
          accountId,
          givenAmount: amount,
          note: note || undefined,
          tags: selectedTagIds,
          date,
        });
      } else if (isEditing && editId) {
        await updateTransaction(editId, data);
      } else {
        await addTransaction(data);
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
          if (editId) await removeTransaction(editId);
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

  const handleOpenCalculator = () => {
    Keyboard.dismiss();
    setCalculatorValue(amountStr);
    setCalculatorOpen(true);
    router.push({
      pathname: '/modals/calculator',
      params: { 
        brandColor: activeConfig.color, 
        brandSoft: activeConfig.bg 
      }
    });
  };

  const openDate = () => {
    Keyboard.dismiss();
    const current = new Date(date);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        display: 'calendar',
        onChange: (_event, selectedDate) => {
          if (selectedDate) {
            const final = new Date(date);
            final.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            setDate(final.toISOString());
          }
        },
      });
    } else {
      setPickerMode('date');
      setShowDatePicker(true);
    }
  };

  const openTime = () => {
    Keyboard.dismiss();
    const current = new Date(date);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'time',
        display: 'clock',
        is24Hour: false,
        onChange: (event, selectedTime) => {
          if (selectedTime) {
            const final = new Date(date);
            final.setHours(selectedTime.getHours());
            final.setMinutes(selectedTime.getMinutes());
            setDate(final.toISOString());
          }
        },
      });
    } else {
      setPickerMode('time');
      setShowDatePicker(true);
    }
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'ios' && selectedDate) {
      setDate(selectedDate.toISOString());
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
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
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: palette.text }}>
            {isEditing ? 'Edit transaction' : 'New transaction'}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingBottom: 132 + keyboardHeight }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingBottom: 20 }}>
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
                    borderColor: type === t ? TYPE_CONFIG[t].borderColor : palette.border,
                    backgroundColor: type === t ? TYPE_CONFIG[t].bg : palette.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: type === t ? TYPE_CONFIG[t].color : palette.textMuted,
                    }}
                  >
                    {TYPE_CONFIG[t].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {type === 'in' || type === 'out' ? (
            <SectionCard palette={palette}>
              <InteractiveDateTimeRow
                date={date}
                onOpenDate={openDate}
                onOpenTime={openTime}
                palette={palette}
              />
              <AmountRow
                sym={displaySym}
                activeConfig={activeConfig}
                amountStr={amountStr}
                setAmountStr={setAmountStr}
                onOpenCalculator={handleOpenCalculator}
                isEditing={isEditing}
                palette={palette}
              />
              <PickerRow
                label="Account"
                value={getAccountName(accounts, accountId)}
                placeholder={!accountId}
                palette={palette}
                onPress={() => {
                  Keyboard.dismiss();
                  setTimeout(() => {
                    setShowAccountSheet(true);
                  }, 50);
                }}
              />
              <PickerRow
                label="Category"
                value={getCategoryName(categories, categoryId)}
                placeholder={!categoryId}
                palette={palette}
                onPress={() => {
                  Keyboard.dismiss();
                  setTimeout(() => {
                    setDraftCategoryId(categoryId);
                    router.push({
                      pathname: '/modals/select-category',
                      params: { type },
                    });
                  }, 50);
                }}
              />
              <SplitSection
                amount={amount}
                amountStr={amountStr}
                currencySymbol={displaySym}
                splitRows={splitRows}
                splitTotal={splitTotal}
                categories={categories}
                type={type}
                onAddSplit={addSplitRow}
                onChangeSplit={updateSplitRow}
                onRemoveSplit={removeSplitRow}
                palette={palette}
              />
              <InlineInputRow label="Payee" value={payee} onChangeText={setPayee} placeholder="Add payee" palette={palette} activeConfig={activeConfig} />
              <ReceiptSection palette={palette} />
              <PickerRow
                label="Tag"
                value={selectedTagIds.length ? tagSummary(tags, selectedTagIds) : 'Add tag'}
                placeholder={!selectedTagIds.length}
                palette={palette}
                onPress={() => {
                  Keyboard.dismiss();
                  setTimeout(() => {
                    setShowTagSheet(true);
                  }, 50);
                }}
              />
              <NotesSection 
                note={note} 
                onChangeNote={setNote} 
                palette={palette} 
                activeConfig={activeConfig} 
                onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250)}
              />
            </SectionCard>
          ) : type === 'transfer' ? (
            <SectionCard palette={palette}>
              <InteractiveDateTimeRow date={date} palette={palette} onOpenDate={openDate} onOpenTime={openTime} />
              <PickerRow
                label="From account"
                value={getAccountName(accounts, accountId) || 'Select...'}
                placeholder={!accountId}
                palette={palette}
                onPress={() => {
                  Keyboard.dismiss();
                  setTimeout(() => setShowFromAccountSheet(true), 50);
                }}
              />
              <View style={{ alignItems: 'center', paddingVertical: 2 }}>
                <TouchableOpacity
                  onPress={() => {
                    const tmp = accountId;
                    setAccountId(linkedAccountId);
                    setLinkedAccountId(tmp);
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: activeConfig.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="swap-vertical" size={16} color={activeConfig.color} />
                </TouchableOpacity>
              </View>
              <PickerRow
                label="To account"
                value={getAccountName(accounts, linkedAccountId) || 'Select...'}
                placeholder={!linkedAccountId}
                palette={palette}
                onPress={() => {
                  Keyboard.dismiss();
                  setTimeout(() => setShowToAccountSheet(true), 50);
                }}
              />
              <AmountRow
                sym={displaySym}
                activeConfig={activeConfig}
                amountStr={amountStr}
                setAmountStr={setAmountStr}
                onOpenCalculator={handleOpenCalculator}
                isEditing={isEditing}
                palette={palette}
              />
              <NotesSection 
                note={note} 
                onChangeNote={setNote} 
                palette={palette} 
                activeConfig={activeConfig}
                onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250)}
              />
            </SectionCard>
          ) : (
            <SectionCard palette={palette}>
              <InteractiveDateTimeRow date={date} palette={palette} onOpenDate={openDate} onOpenTime={openTime} />
              <View style={{ marginTop: -8 }}>
                <FieldRow label="Direction" palette={palette}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['lent', 'borrowed'] as const).map((d) => {
                      const active = loanDirection === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          onPress={() => setLoanDirection(d)}
                          style={{
                            flex: 1,
                            paddingVertical: 11,
                            borderRadius: 14,
                            alignItems: 'center',
                            borderWidth: 1.5,
                            borderColor: active ? activeConfig.borderColor : palette.border,
                            backgroundColor: active ? activeConfig.bg : palette.surface,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '700',
                              color: active ? activeConfig.color : palette.textMuted,
                            }}
                          >
                            {d === 'lent' ? 'I lent' : 'I borrowed'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </FieldRow>
              </View>
              <InlineInputRow label="Person" value={personName} onChangeText={setPersonName} placeholder="Name" palette={palette} activeConfig={activeConfig} />
              <AmountRow
                sym={displaySym}
                activeConfig={activeConfig}
                amountStr={amountStr}
                setAmountStr={setAmountStr}
                onOpenCalculator={handleOpenCalculator}
                isEditing={isEditing}
                palette={palette}
              />
              <PickerRow
                label="Account"
                value={getAccountName(accounts, accountId) || 'Select...'}
                placeholder={!accountId}
                palette={palette}
                onPress={() => {
                  Keyboard.dismiss();
                  setTimeout(() => {
                    setShowAccountSheet(true);
                  }, 50);
                }}
              />
              <NotesSection 
                note={note} 
                onChangeNote={setNote} 
                palette={palette} 
                activeConfig={activeConfig}
                onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250)}
              />
            </SectionCard>
          )}

          {showDatePicker && Platform.OS === 'ios' && (
            <DateTimePicker
              value={new Date(date)}
              mode={pickerMode}
              display="default"
              onChange={onDateChange}
              textColor={palette.text}
              accentColor={palette.tabActive}
            />
          )}

        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: SCREEN_GUTTER,
          paddingBottom: (insets.bottom || 16) + 4,
          paddingTop: 12,
          backgroundColor: palette.background,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isValid || loading}
          style={{
            backgroundColor: isValid ? activeConfig.color : palette.textSoft,
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: palette.onBrand, fontSize: 16, fontWeight: '600' }}>{actionLabel}</Text>
        </TouchableOpacity>
        {isEditing && (
          <TouchableOpacity onPress={handleDelete} style={{ alignItems: 'center' }}>
            <Text style={{ color: palette.negative, fontSize: 15, fontWeight: '500' }}>
              Delete transaction
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {showAccountSheet ? (
        <BottomSheet title="Select account" palette={palette} onClose={() => setShowAccountSheet(false)}>
          {accounts.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: 14, paddingVertical: 12, paddingHorizontal: SCREEN_GUTTER }}>No accounts available</Text>
          ) : (
            accounts.map((account, index) => {
              return (
                <ChoiceRow
                  key={account.id}
                  title={formatAccountDisplayName(account?.name ?? '', account?.accountNumber)}
                  subtitle={`${account.type.charAt(0).toUpperCase() + account.type.slice(1)} · ${formatCurrency(account.balance, displaySym)}`}
                  selected={accountId === account.id}
                  palette={palette}
                  onPress={() => {
                    setAccountId(account.id);
                    setShowAccountSheet(false);
                  }}
                  noBorder={index === accounts.length - 1}
                />
              );
            })
          )}
        </BottomSheet>
      ) : null}

      {showFromAccountSheet ? (
        <BottomSheet title="Transfer from" palette={palette} onClose={() => setShowFromAccountSheet(false)}>
          {accounts.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: 14, paddingVertical: 12, paddingHorizontal: SCREEN_GUTTER }}>No accounts available</Text>
          ) : (
            accounts.map((account, index) => {
              if (account.id === linkedAccountId) return null;
              return (
                <ChoiceRow
                  key={account.id}
                  title={formatAccountDisplayName(account?.name ?? '', account?.accountNumber)}
                  subtitle={`${account.type.charAt(0).toUpperCase() + account.type.slice(1)} · ${formatCurrency(account.balance, displaySym)}`}
                  selected={accountId === account.id}
                  palette={palette}
                  onPress={() => {
                    setAccountId(account.id);
                    setShowFromAccountSheet(false);
                  }}
                  noBorder={index === accounts.length - 1}
                />
              );
            })
          )}
        </BottomSheet>
      ) : null}

      {showToAccountSheet ? (
        <BottomSheet title="Transfer to" palette={palette} onClose={() => setShowToAccountSheet(false)}>
          {accounts.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: 14, paddingVertical: 12, paddingHorizontal: SCREEN_GUTTER }}>No accounts available</Text>
          ) : (
            accounts.map((account, index) => {
              if (account.id === accountId) return null;
              return (
                <ChoiceRow
                  key={account.id}
                  title={formatAccountDisplayName(account?.name ?? '', account?.accountNumber)}
                  subtitle={`${account.type.charAt(0).toUpperCase() + account.type.slice(1)} · ${formatCurrency(account.balance, displaySym)}`}
                  selected={linkedAccountId === account.id}
                  palette={palette}
                  onPress={() => {
                    setLinkedAccountId(account.id);
                    setShowToAccountSheet(false);
                  }}
                  noBorder={index === accounts.length - 1}
                />
              );
            })
          )}
        </BottomSheet>
      ) : null}

      {showTagSheet ? (
        <BottomSheet
          title="Select tags"
          subtitle="Select one or more"
          palette={palette}
          onClose={() => setShowTagSheet(false)}
          footer={
            <View
              style={{
                paddingHorizontal: SCREEN_GUTTER,
                paddingTop: 10,
                paddingBottom: 10,
                borderTopWidth: 1,
                borderTopColor: palette.divider,
                backgroundColor: palette.surface,
              }}
            >
              <RnghTouchableOpacity
                onPress={() => setShowTagSheet(false)}
                style={{
                  backgroundColor: palette.tabActive,
                  borderRadius: 18,
                  minHeight: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: palette.onBrand, fontSize: 16, fontWeight: '700' }}>Done</Text>
              </RnghTouchableOpacity>
            </View>
          }
        >
          {tags.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: 14, paddingVertical: 12, paddingHorizontal: SCREEN_GUTTER }}>No tags created yet</Text>
          ) : (
            tags.map((tag, index) => {
              return (
                <ChoiceRow
                  key={tag.id}
                  title={tag.name}
                  selected={selectedTagIds.includes(tag.id)}
                  palette={palette}
                  leftElement={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tag.color }} />}
                  onPress={() => toggleTag(tag.id)}
                  noBorder={index === tags.length - 1}
                />
              );
            })
          )}
        </BottomSheet>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function SectionCard({ children, palette }: { children: React.ReactNode; palette: AppThemePalette }) {
  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: 24,
        marginHorizontal: SCREEN_GUTTER,
        borderWidth: 1,
        borderColor: palette.border,
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
  palette,
}: {
  label: string;
  children: React.ReactNode;
  noBorder?: boolean;
  palette: AppThemePalette;
}) {
  return (
    <View
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        paddingVertical: 14,
        borderBottomWidth: noBorder === false ? 1 : 0,
        borderBottomColor: palette.border,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textMuted, marginBottom: 8 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {children}
      </View>
    </View>
  );
}

function InlinePickerRow({
  label,
  value,
  onPress,
  placeholder,
  icon,
  showChevron = true,
  noBorder,
  valueStyle,
  palette,
}: {
  label: string;
  value: string;
  onPress: () => void;
  placeholder?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  showChevron?: boolean;
  noBorder?: boolean;
  valueStyle?: object;
  palette: AppThemePalette;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: palette.textMuted,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: ROW_MIN_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: noBorder === false ? 1 : 0,
          borderBottomColor: palette.border,
          paddingLeft: 4,
        }}
      >
        <Text
          style={[
            {
              fontSize: 15,
              fontWeight: '400',
              color: placeholder ? palette.textMuted : palette.text,
              textAlign: 'left',
              flexShrink: 1,
            },
            valueStyle,
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {icon ? (
            <View style={{ width: ROW_TRAILING_WIDTH + 14, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: palette.inputBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon} size={15} color={palette.text} />
              </View>
            </View>
          ) : null}
          {showChevron ? (
            <View style={{ width: ROW_TRAILING_WIDTH, alignItems: 'flex-start', justifyContent: 'center' }}>
              <Ionicons name="chevron-forward" size={15} color={palette.textSoft} />
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function PickerRow({
  label,
  value,
  placeholder,
  onPress,
  palette,
}: {
  label: string;
  value: string;
  placeholder?: boolean;
  onPress: () => void;
  palette: AppThemePalette;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: palette.textMuted,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flex: 1,
          minWidth: 0,
          minHeight: ROW_MIN_HEIGHT,
          borderBottomWidth: 0,
          borderBottomColor: palette.border,
          paddingLeft: 4,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: '400',
            color: placeholder ? palette.textMuted : palette.text,
            textAlign: 'left',
            flexShrink: 1,
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
        <View style={{ width: ROW_TRAILING_WIDTH, alignItems: 'flex-start', justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={15} color={palette.textSoft} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function InteractiveDateTimeRow({
  date,
  palette,
  onOpenDate,
  onOpenTime,
}: {
  date: string;
  palette: AppThemePalette;
  onOpenDate: () => void;
  onOpenTime: () => void;
}) {
  const dt = new Date(date);
  const dateStr = formatDate(date);
  const timeStr = dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

  return (
    <View
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: palette.textMuted,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP,
        }}
      >
        Date
      </Text>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 0,
          borderBottomColor: palette.border,
          minHeight: ROW_MIN_HEIGHT,
          paddingLeft: 4,
          gap: 8,
        }}
      >
        <TouchableOpacity
          onPress={onOpenDate}
          style={{
            flex: 1.5, // Priority to date
            backgroundColor: palette.inputBg,
            paddingVertical: 9,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{dateStr}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onOpenTime}
          style={{
            flex: 0.9, // Slightly expanded time
            backgroundColor: palette.inputBg,
            paddingVertical: 9,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{timeStr}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AmountRow({
  sym,
  activeConfig,
  amountStr,
  setAmountStr,
  onOpenCalculator,
  isEditing,
  palette,
}: {
  sym: string;
  activeConfig: any;
  amountStr: string;
  setAmountStr: (value: string) => void;
  onOpenCalculator: () => void;
  isEditing: boolean;
  palette: AppThemePalette;
}) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: palette.textMuted,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP,
        }}
      >
        Amount {sym ? `(${sym})` : ''}
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TextInput
            value={amountStr}
            onChangeText={(value) => setAmountStr(formatIndianNumberStr(sanitizeDecimalInput(value)))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={palette.textSoft}
            style={{
              flex: 1,
              fontSize: 20,
              fontWeight: '500',
              color: activeConfig.color,
              paddingBottom: 2,
              paddingTop: 0,
              paddingLeft: 4,
              textAlign: 'left',
              lineHeight: 24, // Consistent baseline
              borderBottomWidth: isFocused ? 1.5 : 1,
              borderBottomColor: isFocused ? activeConfig.color : palette.borderSoft,
            }}
            cursorColor={activeConfig.color}
            autoFocus={true}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </View>
        <TouchableOpacity
          onPress={onOpenCalculator}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          style={{
            marginLeft: SCREEN_GUTTER,
            width: ROW_TRAILING_WIDTH + 24,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: palette.inputBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="calculator-outline" size={22} color={palette.text} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InlineInputRow({
  label,
  value,
  onChangeText,
  placeholder,
  palette,
  activeConfig,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  palette: AppThemePalette;
  placeholder?: string;
  activeConfig?: any;
}) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: palette.textMuted,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textSoft}
          cursorColor={activeConfig?.color || palette.tabActive}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 15,
            fontWeight: '400',
            color: palette.text,
            paddingBottom: 2,
            paddingTop: 0,
            paddingLeft: 4,
            textAlign: 'left',
            lineHeight: 20,
            borderBottomWidth: isFocused ? 1.5 : 1,
            borderBottomColor: isFocused ? (activeConfig?.color || palette.tabActive) : palette.borderSoft,
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
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
  palette,
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
  palette: AppThemePalette;
}) {
  const diff = amount - splitTotal;
  const isBalanced = Math.abs(diff) < 0.01;

  return (
    <View style={{ marginVertical: 4 }}>
      <View style={{
        paddingHorizontal: SCREEN_GUTTER,
        height: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: palette.surface,
        marginTop: 4,
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: palette.textSoft, textTransform: 'uppercase' }}>
          Splits
        </Text>
        <TouchableOpacity onPress={onAddSplit} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="add" size={14} color={palette.tabActive} />
          <Text style={{ fontSize: 12, color: palette.tabActive, fontWeight: '600', marginLeft: 2 }}>Add Split</Text>
        </TouchableOpacity>
      </View>

      {splitRows.length > 0 ? (
        <View>
          {splitRows.map((row, index) => (
            <SplitRowEditor
              key={row.id}
              row={row}
              index={index}
              categories={categories}
              type={type}
              onChange={onChangeSplit}
              onRemove={onRemoveSplit}
              palette={palette}
            />
          ))}

          {!isBalanced && (
            <View style={{
              paddingHorizontal: SCREEN_GUTTER,
              paddingVertical: 10,
              flexDirection: 'row',
              justifyContent: 'flex-end',
              backgroundColor: palette.negative + '08'
            }}>
              <Text style={{ fontSize: 13, color: palette.negative, fontWeight: '500' }}>
                Remaining: {formatCurrency(diff, currencySymbol)}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          onPress={onAddSplit}
          style={{
            paddingHorizontal: SCREEN_GUTTER,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Text style={{ fontSize: 13, color: palette.textSoft }}>This transaction is in one category. Tap to split it.</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ReceiptSection({ palette }: { palette: AppThemePalette }) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: palette.textMuted, marginBottom: 10 }}>
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
            borderColor: palette.border,
            backgroundColor: palette.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="camera-outline" size={22} color={palette.tabActive} />
        </TouchableOpacity>
        <View style={{ justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, color: palette.text, fontWeight: '400' }}>Add receipt</Text>
          <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 2 }}>Tap camera to scan</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function NotesSection({
  note,
  onChangeNote,
  palette,
  activeConfig,
  onFocus,
}: {
  note: string;
  onChangeNote: (value: string) => void;
  palette: AppThemePalette;
  activeConfig?: any;
  onFocus?: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textMuted, marginBottom: 10 }}>
        Notes
      </Text>
      <TextInput
        value={note}
        onChangeText={onChangeNote}
        onFocus={onFocus}
        placeholder="Add a note..."
        placeholderTextColor={palette.textSoft}
        cursorColor={activeConfig?.color || palette.tabActive}
        style={{ minHeight: 72, fontSize: 15, color: palette.text, paddingVertical: 0, textAlignVertical: 'top' }}
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
  palette,
}: {
  accounts: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
  excludeId?: string;
  palette: AppThemePalette;
}) {
  const filtered = accounts.filter((a) => a.id !== excludeId);
  if (filtered.length === 0) {
    return <Text style={{ fontSize: 13, color: palette.textMuted }}>No account available</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
      {filtered.map((acc) => (
        <TouchableOpacity
          key={acc.id}
          onPress={() => onSelect(acc.id)}
          style={{
            paddingHorizontal: SCREEN_GUTTER,
            paddingVertical: 8,
            borderRadius: 12,
            marginRight: 8,
            backgroundColor: selectedId === acc.id ? palette.tabActive : palette.surface,
            borderWidth: 1,
            borderColor: selectedId === acc.id ? palette.tabActive : palette.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: selectedId === acc.id ? palette.onBrand : palette.textMuted,
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
  palette,
}: {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
  type: TransactionType;
  palette: AppThemePalette;
}) {
  const options = getRelevantCategoryOptions(categories, type);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.id}
          onPress={() => onSelect(option.id)}
          style={{
            paddingHorizontal: SCREEN_GUTTER,
            paddingVertical: 8,
            borderRadius: 12,
            marginRight: 8,
            backgroundColor: selectedId === option.id ? palette.tabActive : palette.surface,
            borderWidth: 1,
            borderColor: selectedId === option.id ? palette.tabActive : palette.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: selectedId === option.id ? palette.onBrand : palette.textMuted,
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
  palette,
}: {
  row: SplitDraft;
  index: number;
  categories: Category[];
  type: TransactionType;
  onChange: (id: string, patch: Partial<SplitDraft>) => void;
  onRemove: (id: string) => void;
  palette: AppThemePalette;
}) {
  const categoryName = categories.find(c => c.id === row.categoryId)?.name || 'Select Category';
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'flex-end',
      minHeight: ROW_MIN_HEIGHT,
      paddingHorizontal: SCREEN_GUTTER,
      paddingBottom: 6,
    }}>
      <TouchableOpacity
        onPress={() => {
          Keyboard.dismiss();
          setTimeout(() => {
            onChange(row.id, { id: row.id, openCategoryPicker: true });
          }, 50);
        }}
        style={{
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP,
          paddingBottom: 6,
        }}
      >
        <Text numberOfLines={1} style={{ fontSize: 13, color: row.categoryId ? palette.text : palette.textSoft, fontWeight: '500' }}>
          {categoryName}
        </Text>
      </TouchableOpacity>

      <View style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderBottomWidth: isFocused ? 1.5 : 1,
        borderBottomColor: isFocused ? palette.tabActive : palette.borderSoft,
        paddingBottom: 5.5,
      }}>
        <TextInput
          value={row.amountStr}
          onChangeText={(value) => onChange(row.id, { amountStr: formatIndianNumberStr(sanitizeDecimalInput(value)) })}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={palette.textSoft}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            fontSize: 15,
            color: palette.text,
            paddingVertical: 0,
            lineHeight: 20,
          }}
        />
        <TouchableOpacity
          onPress={() => onRemove(row.id)}
          style={{ paddingLeft: 12, paddingBottom: 2 }}
        >
          <Ionicons name="trash-outline" size={16} color={palette.negative} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TagPicker({
  tags,
  selectedIds,
  onToggle,
  palette,
}: {
  tags: Tag[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  palette: AppThemePalette;
}) {
  if (tags.length === 0) {
    return <Text style={{ fontSize: 13, color: palette.textSoft }}>No tags yet</Text>;
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
              paddingHorizontal: SCREEN_GUTTER,
              paddingVertical: 8,
              borderRadius: 12,
              marginRight: 8,
              backgroundColor: selected ? tag.color : palette.surface,
              borderWidth: 1,
              borderColor: selected ? tag.color : palette.border,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: selected ? palette.onBrand : palette.textMuted,
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
