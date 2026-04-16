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
  TouchableOpacity,
  View,
  LayoutAnimation,
} from 'react-native';
import { TouchableOpacity as RnghTouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChoiceRow } from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import {
  AmountRow,
  FieldRow,
  InteractiveDateTimeRow,
  NotesSection,
  PickerRow,
  SectionCard,
  TextInputRow,
} from '../../components/ui/transaction-form-primitives';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { HOME_TEXT } from '../../lib/layoutTokens';
import { formatDate, nowUTC } from '../../lib/dateUtils';
import {
  formatCurrency,
  formatIndianNumberStr,
  getLoanSettlementLabel,
  getLoanTransactionKind,
  parseFormattedNumber,
} from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { getLoanById } from '../../services/loans';
import { createSplitTransactionGroup, getTransactionById, getTransactionsBySplitGroup, updateSplitTransactionGroup, updateTransferTransaction } from '../../services/transactions';
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

export default function AddTransactionModal() {
  const {
    editId,
    accountId: sourceAccountId,
    type: initialType,
    loanId: routeLoanId,
    settlement,
  } = useLocalSearchParams<{ editId?: string; accountId?: string; type?: string; loanId?: string; settlement?: string }>();
  const isEditing = !!editId;

  const addTransaction = useTransactionsStore((s) => s.add);
  const updateTransaction = useTransactionsStore((s) => s.update);
  const removeTransaction = useTransactionsStore((s) => s.remove);
  const reloadTransactions = useTransactionsStore((s) => s.load);
  const addLoan = useLoansStore((s) => s.add);
  const updateLoanOrigin = useLoansStore((s) => s.updateOrigin);
  const removeLoan = useLoansStore((s) => s.remove);
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
  const splitRows = useTransactionDraftStore((s) => s.splitRows);
  const setSplitRows = useTransactionDraftStore((s) => s.setSplitRows);
  const clearSplitRows = useTransactionDraftStore((s) => s.clearSplitRows);
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
  const [date, setDate] = useState(nowUTC());
  const [note, setNote] = useState('');
  const [personName, setPersonName] = useState('');
  const [loanDirection, setLoanDirection] = useState<'lent' | 'borrowed'>('lent');
  const [loanEditMode, setLoanEditMode] = useState<'new' | 'origin' | 'settlement'>('new');
  const [editingLoanId, setEditingLoanId] = useState('');
  const [editingSplitGroupId, setEditingSplitGroupId] = useState('');
  const [isTransferEdit, setIsTransferEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showFromAccountSheet, setShowFromAccountSheet] = useState(false);
  const [showToAccountSheet, setShowToAccountSheet] = useState(false);
  const [showTagSheet, setShowTagSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | 'datetime'>('date');
  const splitIdSeed = useRef(0);
  const hadSplitRows = useRef(false);
  const previousType = useRef<TransactionType>((initialType as TransactionType) || 'out');
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
  const skipInitialDraftCategorySync = useRef(!isEditing);
  
  // Clear category draft on mount for new transactions
  useEffect(() => {
    if (!isEditing) {
      setDraftCategoryId('');
      setCategoryId('');
      clearSplitRows();
    }
  }, [clearSplitRows, isEditing]);

  useEffect(() => {
    if (isSyncingCategory.current) {
      isSyncingCategory.current = false;
      return;
    }
    if (skipInitialDraftCategorySync.current) {
      skipInitialDraftCategorySync.current = false;
      return;
    }
    if (draftCategoryId && draftCategoryId !== categoryId) {
      setCategoryId(draftCategoryId);
    }
  }, [categoryId, draftCategoryId]);

  // Push local categoryId to draft store (for the category picker to read),
  // but only when local state changes and skip the initial empty value.
  useEffect(() => {
    if (categoryId) {
      isSyncingCategory.current = true;
      setDraftCategoryId(categoryId);
    }
  }, [categoryId, setDraftCategoryId]);

  // Validation: Reset category if it's incompatible with the current type
  useEffect(() => {
    if (!categoryId || type === 'transfer' || type === 'loan') return;
    const cat = categories.find(c => c.id === categoryId);
    if (cat && cat.type !== 'both' && cat.type !== type) {
      setCategoryId('');
      setDraftCategoryId('');
    }
  }, [type, categoryId, categories]);

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
      getTransactionById(editId).then(async (tx) => {
        if (!tx) return;
        setIsTransferEdit(!!tx.transferPairId);
        setType(tx.type);
        setAmountStr(formatIndianNumberStr(String(tx.amount)));
        setAccountId(tx.accountId);
        if (tx.linkedAccountId) setLinkedAccountId(tx.linkedAccountId);
        if (tx.categoryId) setCategoryId(tx.categoryId);
        if (tx.payee) setPayee(tx.payee);
        if (tx.tags?.length) setSelectedTagIds(tx.tags);
        setDate(tx.date);
        if (tx.note) setNote(tx.note);

        if (tx.splitGroupId) {
          const group = await getTransactionsBySplitGroup(tx.splitGroupId);
          if (group.length > 0) {
            const first = group[0];
            setEditingSplitGroupId(tx.splitGroupId);
            setType(first.type);
            setAccountId(first.accountId);
            setDate(first.date);
            setPayee(first.payee ?? '');
            setSelectedTagIds(first.tags ?? []);
            setNote(first.note ?? '');
            setCategoryId('');
            setSplitRows(
              group
                .slice()
                .reverse()
                .map((item) => ({
                  id: `split-${splitIdSeed.current++}`,
                  categoryId: item.categoryId ?? '',
                  amountStr: formatIndianNumberStr(String(item.amount)),
                }))
            );
          }
        }

        if (tx.transferPairId) {
          setType('transfer');
          const sourceAccountId = tx.type === 'out' ? tx.accountId : tx.linkedAccountId ?? '';
          const destinationAccountId = tx.type === 'out' ? tx.linkedAccountId ?? '' : tx.accountId;
          setAccountId(sourceAccountId);
          setLinkedAccountId(destinationAccountId);
          setCategoryId('');
          setSelectedTagIds([]);
        }

        if (tx.type === 'loan' && tx.loanId) {
          const loan = await getLoanById(tx.loanId);
          if (!loan) return;
          setEditingLoanId(loan.id);
          setPersonName(loan.personName);
          setLoanDirection(loan.direction);
          setSelectedTagIds(loan.tags ?? []);

          const kind = getLoanTransactionKind(tx, loan.direction);
          setLoanEditMode(kind === 'origin' ? 'origin' : 'settlement');

          if (kind === 'origin') {
            setAmountStr(formatIndianNumberStr(String(loan.givenAmount)));
            setAccountId(loan.accountId);
            setDate(loan.date);
            setNote(loan.note ?? '');
          }
        }
      });
    });
    return () => task.cancel();
  }, [editId, isEditing]);

  useEffect(() => {
    if (isEditing || !routeLoanId || settlement !== '1') return;
    const task = InteractionManager.runAfterInteractions(() => {
      getLoanById(routeLoanId).then((loan) => {
        if (!loan) return;
        setType('loan');
        setLoanEditMode('settlement');
        setEditingLoanId(loan.id);
        setPersonName(loan.personName);
        setLoanDirection(loan.direction);
        setAccountId(loan.accountId);
        setDate(nowUTC());
      });
    });
    return () => task.cancel();
  }, [isEditing, routeLoanId, settlement]);

  const amount = parseFloat(parseFormattedNumber(amountStr)) || 0;
  const activeConfig = TYPE_CONFIG[type];
  const lockTypeSelection = isEditing && (isTransferEdit || (type === 'loan' && !!editingLoanId));
  const displaySym = showCurrencySymbol ? sym : '';
  const splitTotal = splitRows.reduce((sum, row) => sum + (parseFloat(parseFormattedNumber(row.amountStr)) || 0), 0);
  const usableSplitRows = splitRows.filter(
    (row) => row.categoryId && (parseFloat(parseFormattedNumber(row.amountStr)) || 0) > 0,
  );

  useEffect(() => {
    if (type !== 'in' && type !== 'out') return;
    if (usableSplitRows.length === 0) {
      if (hadSplitRows.current) {
        setAmountStr('');
        setEditingSplitGroupId('');
      }
      hadSplitRows.current = false;
      return;
    }
    hadSplitRows.current = true;
    setAmountStr(formatIndianNumberStr(String(splitTotal)));
    if (categoryId) {
      setCategoryId('');
      setDraftCategoryId('');
    }
  }, [categoryId, setDraftCategoryId, splitTotal, type, usableSplitRows.length]);

  useEffect(() => {
    const previous = previousType.current;
    previousType.current = type;

    const switchedBetweenCashflowTypes =
      (previous === 'in' || previous === 'out') &&
      (type === 'in' || type === 'out') &&
      previous !== type;

    if ((type !== 'in' && type !== 'out') || switchedBetweenCashflowTypes) {
      if (splitRows.length > 0) {
        clearSplitRows();
        setEditingSplitGroupId('');
      }
    }
  }, [clearSplitRows, splitRows.length, type]);

  const isValid =
    type === 'transfer'
      ? amount > 0 && accountId && linkedAccountId && accountId !== linkedAccountId
      : type === 'loan'
        ? amount > 0 && accountId && personName.trim().length > 0
        : usableSplitRows.length > 0
          ? splitTotal > 0 && accountId
          : amount > 0 && accountId && categoryId;

  const actionLabel = isEditing
    ? 'Save Changes'
    : type === 'loan' && routeLoanId && settlement === '1'
      ? loanDirection === 'lent'
        ? 'Add Receipt'
        : 'Add Repayment'
    : type === 'in'
      ? 'Add Income'
      : type === 'transfer'
        ? 'Move Money'
        : type === 'loan'
          ? 'Add Loan'
          : 'Add Expense';

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
        linkedAccountId: type === 'transfer' ? linkedAccountId : undefined,
      };

      if ((type === 'in' || type === 'out') && usableSplitRows.length > 0) {
        const splitItems = usableSplitRows.map((row) => ({
          categoryId: row.categoryId,
          amount: parseFloat(parseFormattedNumber(row.amountStr)) || 0,
        }));

        if (isEditing && editId && editingSplitGroupId) {
          await updateSplitTransactionGroup(editingSplitGroupId, {
            type,
            accountId,
            payee: payee.trim() || undefined,
            note: note || undefined,
            tags: selectedTagIds,
            date,
            items: splitItems,
          });
        } else {
          await createSplitTransactionGroup({
            type,
            accountId,
            payee: payee.trim() || undefined,
            note: note || undefined,
            tags: selectedTagIds,
            date,
            items: splitItems,
          });
        }
        await reloadTransactions();
        await refreshAccounts();
        setEditingSplitGroupId('');
        clearSplitRows();
        router.back();
        return;
      }

      if (type === 'loan' && isEditing && editId && loanEditMode === 'origin' && editingLoanId) {
        await updateLoanOrigin(editingLoanId, {
          personName,
          direction: loanDirection,
          accountId,
          givenAmount: amount,
          note: note || undefined,
          tags: selectedTagIds,
          date,
        });
      } else if (type === 'loan' && isEditing && editId && loanEditMode === 'settlement' && editingLoanId) {
        await updateTransaction(editId, {
          type: 'loan',
          amount,
          accountId,
          loanId: editingLoanId,
          note: getLoanSettlementLabel(loanDirection, personName),
          date,
        });
      } else if (type === 'loan' && routeLoanId && settlement === '1') {
        await addTransaction({
          type: 'loan',
          amount,
          accountId,
          loanId: routeLoanId,
          note: getLoanSettlementLabel(loanDirection, personName),
          date,
        });
      } else if (type === 'loan') {
        await addLoan({
          personName,
          direction: loanDirection,
          accountId,
          givenAmount: amount,
          note: note || undefined,
          tags: selectedTagIds,
          date,
        });
      } else if (isEditing && editId && isTransferEdit) {
        await updateTransferTransaction(editId, {
          amount,
          accountId,
          linkedAccountId,
          date,
          note: note || undefined,
          payee: payee.trim() || undefined,
        });
      } else if (isEditing && editId) {
        await updateTransaction(editId, data);
      } else {
        await addTransaction(data);
      }
      await reloadTransactions();
      await refreshAccounts();
      clearSplitRows();
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
          if (type === 'loan' && loanEditMode === 'origin' && editingLoanId) {
            await removeLoan(editingLoanId);
          } else if (editId) {
            await removeTransaction(editId);
          }
          await refreshAccounts();
          setEditingSplitGroupId('');
          clearSplitRows();
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

  const runAfterKeyboardDismiss = (action: () => void) => {
    Keyboard.dismiss();
    InteractionManager.runAfterInteractions(action);
  };

  const handleOpenCalculator = () => {
    runAfterKeyboardDismiss(() => {
      setCalculatorValue(amountStr);
      setCalculatorOpen(true);
      router.push({
        pathname: '/modals/calculator',
        params: {
          brandColor: activeConfig.color,
          brandSoft: activeConfig.bg,
        },
      });
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
          <Text style={{ flex: 1, fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>
            {isEditing ? 'Edit Transaction' : 'New Transaction'}
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
                  onPress={() => {
                    if (lockTypeSelection && t !== type) return;
                    setType(t);
                  }}
                  disabled={lockTypeSelection && t !== type}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    alignItems: 'center',
                    borderColor: type === t ? TYPE_CONFIG[t].borderColor : palette.border,
                    backgroundColor: type === t ? TYPE_CONFIG[t].bg : palette.surface,
                    opacity: lockTypeSelection && t !== type ? 0.35 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: HOME_TEXT.bodySmall,
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
              <PickerRow
                label="Account"
                value={getAccountName(accounts, accountId)}
                placeholder={!accountId}
                palette={palette}
                onPress={() => runAfterKeyboardDismiss(() => setShowAccountSheet(true))}
              />
              <AmountRow
                sym={displaySym}
                amountStr={amountStr}
                setAmountStr={setAmountStr}
                onOpenCalculator={handleOpenCalculator}
                palette={palette}
                accentColor={activeConfig.color}
                autoFocus
                editable={usableSplitRows.length === 0}
              />
              <View style={{ paddingHorizontal: SCREEN_GUTTER, marginTop: -4, marginBottom: 2, alignItems: 'flex-end' }}>
                <TouchableOpacity
                  onPress={() =>
                    runAfterKeyboardDismiss(() =>
                      router.push({ pathname: '/modals/split-transaction', params: { type } })
                    )
                  }
                  style={{ minHeight: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="layers-outline" size={14} color={palette.brand} />
                  <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: '700', color: palette.brand }}>
                    Split
                  </Text>
                </TouchableOpacity>
              </View>
              {usableSplitRows.length > 0 ? (
                <PickerRow
                  label="Category"
                  value="Split"
                  palette={palette}
                  onPress={() =>
                    runAfterKeyboardDismiss(() =>
                      router.push({ pathname: '/modals/split-transaction', params: { type } })
                    )
                  }
                />
              ) : (
                <PickerRow
                  label="Category"
                  value={getCategoryName(categories, categoryId)}
                  placeholder={!categoryId}
                  palette={palette}
                  onPress={() =>
                    runAfterKeyboardDismiss(() => {
                      setDraftCategoryId(categoryId);
                      router.push({
                        pathname: '/modals/select-category',
                        params: { type },
                      });
                    })
                  }
                />
              )}
              <TextInputRow
                label="Payee"
                value={payee}
                onChangeText={setPayee}
                placeholder="Add payee"
                palette={palette}
                accentColor={activeConfig.color}
              />
              <ReceiptSection palette={palette} />
              <PickerRow
                label="Tag"
                value={selectedTagIds.length ? tagSummary(tags, selectedTagIds) : 'Add tag'}
                placeholder={!selectedTagIds.length}
                palette={palette}
                onPress={() => runAfterKeyboardDismiss(() => setShowTagSheet(true))}
              />
              <NotesSection 
                note={note} 
                onChangeNote={setNote} 
                palette={palette} 
                accentColor={activeConfig.color}
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
                onPress={() => runAfterKeyboardDismiss(() => setShowFromAccountSheet(true))}
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
                onPress={() => runAfterKeyboardDismiss(() => setShowToAccountSheet(true))}
              />
              <AmountRow
                sym={displaySym}
                amountStr={amountStr}
                setAmountStr={setAmountStr}
                onOpenCalculator={handleOpenCalculator}
                palette={palette}
                accentColor={activeConfig.color}
                autoFocus
              />
              <NotesSection 
                note={note} 
                onChangeNote={setNote} 
                palette={palette} 
                accentColor={activeConfig.color}
                onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250)}
              />
            </SectionCard>
          ) : (
            <SectionCard palette={palette}>
              <InteractiveDateTimeRow date={date} palette={palette} onOpenDate={openDate} onOpenTime={openTime} />
              {loanEditMode === 'settlement' ? (
                <FieldRow label="Loan" palette={palette}>
                  <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '500', color: palette.text }}>
                    {personName} {'\u2022'} {loanDirection === 'lent' ? 'Receipt' : 'Repayment'}
                  </Text>
                </FieldRow>
              ) : (
                <>
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
                                  fontSize: HOME_TEXT.bodySmall,
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
                  <TextInputRow
                    label="Person"
                    value={personName}
                    onChangeText={setPersonName}
                    placeholder="Name"
                    palette={palette}
                    accentColor={activeConfig.color}
                  />
                </>
              )}
              <AmountRow
                sym={displaySym}
                amountStr={amountStr}
                setAmountStr={setAmountStr}
                onOpenCalculator={handleOpenCalculator}
                palette={palette}
                accentColor={activeConfig.color}
                autoFocus
              />
              <PickerRow
                label="Account"
                value={getAccountName(accounts, accountId) || 'Select...'}
                placeholder={!accountId}
                palette={palette}
                onPress={() => runAfterKeyboardDismiss(() => setShowAccountSheet(true))}
              />
              {loanEditMode !== 'settlement' ? (
                <NotesSection 
                  note={note} 
                  onChangeNote={setNote} 
                  palette={palette} 
                  accentColor={activeConfig.color}
                  onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250)}
                />
              ) : null}
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
          <Text style={{ color: palette.onBrand, fontSize: HOME_TEXT.rowLabel, fontWeight: '600' }}>{actionLabel}</Text>
        </TouchableOpacity>
        {isEditing && (
          <TouchableOpacity onPress={handleDelete} style={{ alignItems: 'center' }}>
            <Text style={{ color: palette.negative, fontSize: HOME_TEXT.sectionTitle, fontWeight: '500' }}>
              Delete transaction
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {showAccountSheet ? (
        <BottomSheet title="Select account" palette={palette} onClose={() => setShowAccountSheet(false)}>
          {accounts.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, paddingVertical: 12, paddingHorizontal: SCREEN_GUTTER }}>No accounts available</Text>
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
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, paddingVertical: 12, paddingHorizontal: SCREEN_GUTTER }}>No accounts available</Text>
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
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, paddingVertical: 12, paddingHorizontal: SCREEN_GUTTER }}>No accounts available</Text>
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
                <Text style={{ color: palette.onBrand, fontSize: HOME_TEXT.rowLabel, fontWeight: '700' }}>Done</Text>
              </RnghTouchableOpacity>
            </View>
          }
        >
          {tags.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, paddingVertical: 12, paddingHorizontal: SCREEN_GUTTER }}>No tags created yet</Text>
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

function ReceiptSection({ palette }: { palette: AppThemePalette }) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: '700', letterSpacing: 0.8, color: palette.textMuted, marginBottom: 10 }}>
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
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text, fontWeight: '400' }}>Add receipt</Text>
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 2 }}>Tap camera to scan</Text>
        </View>
      </ScrollView>
    </View>
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
