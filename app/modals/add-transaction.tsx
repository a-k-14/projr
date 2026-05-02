import { Text } from '@/components/ui/AppText';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { ChoiceRow, FixedBottomActions } from '../../components/settings-ui';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { AppChevron } from '../../components/ui/AppChevron';
import { AppIcon } from '../../components/ui/AppIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { CategoryPickerSheet } from '../../components/ui/CategoryPickerSheet';
import { DateTimePickerPopup } from '../../components/ui/DateTimePickerPopup';
import {
  AmountRow,
  DisplayRow,
  FieldRow,
  InteractiveDateTimeRow,
  NotesSection,
  PickerRow,
  ROW_LABEL_WIDTH,
  ROW_MIN_HEIGHT,
  SectionCard,
  TextInputRow
} from '../../components/ui/transaction-form-primitives';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { nowUTC } from '../../lib/dateUtils';
import {
  formatCurrency,
  formatIndianNumberStr,
  getLoanSettlementLabel,
  getLoanTransactionKind,
  getLoanTransactionUserNote,
  mergeLoanTransactionNote,
  parseFormattedNumber
} from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { BUTTON_TOKENS, HOME_TEXT, PRIMARY_ACTION, SCREEN_HEADER } from '../../lib/layoutTokens';
import { getAccountTypeLabel } from '../../lib/settings-shared';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { runAfterKeyboardDismiss } from '../../lib/ui-utils';
import { getLoanById } from '../../services/loans';
import { createSplitTransactionGroup, deleteTransaction, getRecentNotes, getRecentPayees, getTransactionById, getTransactionsBySplitGroup, updateSplitTransactionGroup, updateTransferTransaction } from '../../services/transactions';
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
  TransactionType
} from '../../types';

// We compute TYPE_CONFIG dynamically inside the component to use the derived palette

export default function AddTransactionModal() {
  const {
    editId,
    accountId: sourceAccountId,
    type: initialType,
    loanId: routeLoanId,
    settlement,
    addMore } = useLocalSearchParams<{ editId?: string; accountId?: string; type?: string; loanId?: string; settlement?: string; addMore?: string }>();
  const isEditing = !!editId;
  const isLoanAddMore = !isEditing && !!routeLoanId && addMore === '1';

  const addTransaction = useTransactionsStore((s) => s.add);
  const updateTransaction = useTransactionsStore((s) => s.update);
  const removeTransaction = useTransactionsStore((s) => s.remove);
  const reloadTransactions = useTransactionsStore((s) => s.load);
  const addLoan = useLoansStore((s) => s.add);
  const addLoanPrincipal = useLoansStore((s) => s.addPrincipal);
  const updateLoanOrigin = useLoansStore((s) => s.updateOrigin);
  const removeLoan = useLoansStore((s) => s.remove);
  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const categories = useCategoriesStore((s) => s.categories);
  const tags = useCategoriesStore((s) => s.tags);
  const defaultAccountId = useUIStore((s) => s.settings.defaultAccountId);
  const lastUsedAccountId = useUIStore((s) => s.settings.lastUsedAccountId);
  const updateSettings = useUIStore((s) => s.updateSettings);
  const sym = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const beginPrivacyGrace = useUIStore((s) => s.beginPrivacyGrace);
  const { palette } = useAppTheme();
  const { showAlert, showConfirm, dialog } = useAppDialog(palette);
  const draftCategoryId = useTransactionDraftStore((s) => s.categoryId);
  const setDraftCategoryId = useTransactionDraftStore((s) => s.setCategoryId);
  const splitRows = useTransactionDraftStore((s) => s.splitRows);
  const setSplitRows = useTransactionDraftStore((s) => s.setSplitRows);
  const clearSplitRows = useTransactionDraftStore((s) => s.clearSplitRows);
  const [type, setType] = useState<TransactionType>((initialType as TransactionType) || 'out');
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [payee, setPayee] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [date, setDate] = useState(nowUTC());
  const [note, setNote] = useState('');
  const [receiptImageUris, setReceiptImageUris] = useState<string[]>([]);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [receiptPreviewIndex, setReceiptPreviewIndex] = useState(0);
  const [showReceiptSheet, setShowReceiptSheet] = useState(false);
  const [personName, setPersonName] = useState('');
  const [loanDirection, setLoanDirection] = useState<'lent' | 'borrowed'>('lent');
  const [loanEditMode, setLoanEditMode] = useState<'new' | 'origin' | 'settlement'>('new');
  const [editingLoanId, setEditingLoanId] = useState('');
  const [editingSplitGroupId, setEditingSplitGroupId] = useState('');
  const [isTransferEdit, setIsTransferEdit] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showFromAccountSheet, setShowFromAccountSheet] = useState(false);
  const [showToAccountSheet, setShowToAccountSheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showTagSheet, setShowTagSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [loanTransactionType, setLoanTransactionType] = useState<'principal' | 'interest' | 'others'>('principal');
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const personInputRef = useRef<TextInput | null>(null);
  const [payeeSuggestions, setPayeeSuggestions] = useState<string[]>([]);
  const [noteSuggestions, setNoteSuggestions] = useState<string[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
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
    in: { label: 'In', color: palette.positive, onColor: palette.onBrand, borderColor: palette.positive, bg: palette.inBg },
    out: { label: 'Out', color: palette.negative, onColor: palette.onBrand, borderColor: palette.negative, bg: palette.outBg },
    transfer: { label: 'Transfer', color: palette.transferText, onColor: palette.onBrand, borderColor: palette.transferText, bg: palette.transferBg },
    loan: { label: 'Loan', color: palette.loan, onColor: palette.onLoan, borderColor: palette.loan, bg: palette.loanBg }
  };

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      const preferred =
        sourceAccountId && sourceAccountId !== 'all' && accounts.some((account) => account.id === sourceAccountId)
          ? sourceAccountId
          : defaultAccountId || lastUsedAccountId || accounts[0].id;
      setAccountId(preferred);
      if (accounts.length > 1) setLinkedAccountId(accounts[1].id);
    }
  }, [accounts, accountId, defaultAccountId, lastUsedAccountId, sourceAccountId]);

  // One-way sync: when user picks a category in the external modal,
  // draftCategoryId changes → pull it into local state.
  // We guard with a ref so that our own setCategoryId calls don't re-trigger.
  const isSyncingCategory = useRef(false);
  const skipInitialDraftCategorySync = useRef(true);

  // Clear category draft on mount for new transactions
  useEffect(() => {
    setDraftCategoryId('');
    if (!isEditing) {
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

  useEffect(() => {
    if (type === 'transfer' || type === 'loan') return;
    const term = payee.trim();
    if (!term || term.length < 1) {
      setPayeeSuggestions([]);
      return;
    }
    getRecentPayees(term, 5).then((results) => {
      setPayeeSuggestions(results.filter(r => r.toLowerCase() !== term.toLowerCase()));
    });
  }, [payee, type]);

  useEffect(() => {
    const term = note.trim();
    if (!term || term.length < 1) {
      setNoteSuggestions([]);
      return;
    }
    getRecentNotes(term, 5).then((results) => {
      setNoteSuggestions(results.filter(r => r.toLowerCase() !== term.toLowerCase()));
    });
  }, [note]);

  useEffect(() => {
    if (!isEditing || !editId) return;
    setEditingSplitGroupId('');
    setIsTransferEdit(false);
    setLoanEditMode('new');
    setEditingLoanId('');
    clearSplitRows();
    setCategoryId('');
    setPayee('');
    setSelectedTagIds([]);
    setNote('');
    setReceiptImageUris([]);
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
        setReceiptImageUris(tx.receiptImageUris ?? []);

        if (tx.splitGroupId) {
          const group = await getTransactionsBySplitGroup(tx.splitGroupId);
          if (group.length > 0) {
            const first = group[0];
            const total = group.reduce((sum, item) => sum + item.amount, 0);
            setEditingSplitGroupId(tx.splitGroupId);
            setType(first.type);
            setAmountStr(formatIndianNumberStr(String(total)));
            setAccountId(first.accountId);
            setDate(first.date);
            setPayee(first.payee ?? '');
            setSelectedTagIds(first.tags ?? []);
            setNote(first.note ?? '');
            setReceiptImageUris(first.receiptImageUris ?? []);
            setCategoryId('');
            setSplitRows(
              group
                .slice()
                .reverse()
                .map((item) => ({
                  id: `split-${splitIdSeed.current++}`,
                  categoryId: item.categoryId ?? '',
                  amountStr: formatIndianNumberStr(String(item.amount))
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
            setAmountStr(formatIndianNumberStr(String(tx.amount)));
            setAccountId(tx.accountId);
            setDate(tx.date);
            setNote(getLoanTransactionUserNote(tx.note));
          } else if (tx.type === 'loan' && kind === 'settlement') {
            setAmountStr(formatIndianNumberStr(String(tx.amount)));
            setAccountId(tx.accountId);
            setDate(tx.date);
            setNote(getLoanTransactionUserNote(tx.note));
            const type = tx.loanTransactionType || 'principal';
            setLoanTransactionType(
              type === 'interest' || type === 'others'
                ? type
                : type === 'principal'
                  ? 'principal'
                  : 'others'
            );
          }
        }
      });
    });
    return () => task.cancel();
  }, [clearSplitRows, editId, isEditing]);

  useEffect(() => {
    if (isEditing || !routeLoanId || (settlement !== '1' && addMore !== '1')) return;
    const task = InteractionManager.runAfterInteractions(() => {
      getLoanById(routeLoanId).then((loan) => {
        if (!loan) return;
        setType('loan');
        setLoanEditMode(settlement === '1' ? 'settlement' : 'origin');
        setEditingLoanId(loan.id);
        setPersonName(loan.personName);
        setLoanDirection(loan.direction);
        setAccountId(loan.accountId);
        setDate(nowUTC());
      });
    });
    return () => task.cancel();
  }, [addMore, isEditing, routeLoanId, settlement]);

  const amount = parseFloat(parseFormattedNumber(amountStr)) || 0;
  const activeConfig = TYPE_CONFIG[type];
  const lockTypeSelection = isEditing && (isTransferEdit || (type === 'loan' && !!editingLoanId));
  const lockLoanDirection = isLoanAddMore || (isEditing && type === 'loan' && !!editingLoanId);
  const displaySym = showCurrencySymbol ? sym : '';
  const splitTotal = splitRows.reduce((sum, row) => sum + (parseFloat(parseFormattedNumber(row.amountStr)) || 0), 0);
  const usableSplitRows = splitRows.filter(
    (row) => row.categoryId && (parseFloat(parseFormattedNumber(row.amountStr)) || 0) !== 0,
  );
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const selectedLinkedAccount = accounts.find((account) => account.id === linkedAccountId);

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

  const hasNonZeroAmount = Number.isFinite(amount) && amount !== 0;
  const isValid =
    type === 'transfer'
      ? amount > 0 && accountId && linkedAccountId
      : isLoanAddMore
        ? amount > 0 && accountId && personName.trim().length > 0
        : type === 'loan'
          ? hasNonZeroAmount && accountId && personName.trim().length > 0
          : usableSplitRows.length > 0
            ? splitTotal !== 0 && accountId
            : hasNonZeroAmount && accountId && categoryId;

  const actionLabel = isEditing
    ? 'Save Changes'
    : isLoanAddMore
      ? 'Add More'
      : type === 'loan' && routeLoanId && settlement === '1'
        ? loanDirection === 'lent'
          ? 'Add Receipt'
          : 'Add Payment'
        : type === 'in'
          ? 'Add Income'
          : type === 'transfer'
            ? 'Move Money'
            : type === 'loan'
              ? 'Add Loan'
              : 'Add Expense';
  const actionButtonColor = type === 'loan' ? palette.brand : activeConfig.color;
  const actionButtonTextColor = activeConfig.onColor;
  const screenTitle = isEditing
    ? type === 'in'
      ? 'Edit Income'
      : type === 'out'
        ? 'Edit Expense'
        : type === 'transfer'
          ? 'Edit Transfer'
          : loanEditMode === 'settlement'
            ? loanDirection === 'lent'
              ? 'Edit Receipt'
              : 'Edit Payment'
            : 'Edit Loan'
    : isLoanAddMore
      ? 'Add More'
      : 'New Transaction';

  const handleSubmit = async () => {
    if (!isValid) return;
    setShowDatePicker(false);
    try {
      if (!isEditing && accountId) {
        updateSettings({ lastUsedAccountId: accountId }).catch(() => { });
      }

      const data: CreateTransactionInput = {
        type,
        amount,
        accountId,
        date,
        note: note || undefined,
        receiptImageUris,
        categoryId: categoryId || undefined,
        payee: payee.trim() || undefined,
        tags: selectedTagIds,
        linkedAccountId: type === 'transfer' ? linkedAccountId : undefined
      };
      let shouldReloadTransactions = false;

      if ((type === 'in' || type === 'out') && usableSplitRows.length > 0) {
        const splitItems = usableSplitRows.map((row) => ({
          categoryId: row.categoryId,
          amount: parseFloat(parseFormattedNumber(row.amountStr)) || 0
        }));

        if (isEditing && editId && editingSplitGroupId) {
          await updateSplitTransactionGroup(editingSplitGroupId, {
            type,
            accountId,
            payee: payee.trim() || undefined,
            note: note || undefined,
            receiptImageUris,
            tags: selectedTagIds,
            date,
            items: splitItems
          });
        } else {
          await createSplitTransactionGroup({
            type,
            accountId,
            payee: payee.trim() || undefined,
            note: note || undefined,
            receiptImageUris,
            tags: selectedTagIds,
            date,
            items: splitItems
          });
          if (isEditing && editId) {
            await deleteTransaction(editId);
          }
        }
        clearSplitRows();
        router.back();
        // Background refresh after navigation
        Promise.all([reloadTransactions(), refreshAccounts()]).catch(() => { });
        return;
      }

      if (type === 'loan' && isEditing && editId && loanEditMode === 'origin' && editingLoanId) {
        await updateLoanOrigin(editingLoanId, {
          personName,
          direction: loanDirection,
          accountId,
          givenAmount: amount,
          note: note.trim(),
          tags: selectedTagIds,
          date,
        }, editId);
        shouldReloadTransactions = true;
      } else if (type === 'loan' && isEditing && editId && loanEditMode === 'settlement' && editingLoanId) {
        await updateTransaction(editId, {
          type: 'loan',
          amount,
          accountId,
          loanId: editingLoanId,
          loanTransactionType,
          note: mergeLoanTransactionNote(getLoanSettlementLabel(loanDirection, personName), note),
          date
        });
      } else if (type === 'loan' && routeLoanId && settlement === '1') {
        await addTransaction({
          type: 'loan',
          amount,
          accountId,
          loanId: routeLoanId,
          loanTransactionType,
          note: mergeLoanTransactionNote(getLoanSettlementLabel(loanDirection, personName), note),
          date
        });
      } else if (type === 'loan' && isLoanAddMore && routeLoanId) {
        await addLoanPrincipal(routeLoanId, amount, accountId, date, note.trim());
        shouldReloadTransactions = true;
      } else if (type === 'loan') {
        await addLoan({
          personName,
          direction: loanDirection,
          accountId,
          givenAmount: amount,
          note: note.trim(),
          tags: selectedTagIds,
          date
        });
        shouldReloadTransactions = true;
      } else if (isEditing && editId && isTransferEdit) {
        await updateTransferTransaction(editId, {
          amount,
          accountId,
          linkedAccountId,
          date,
          note: note.trim(),
          payee: payee.trim() || undefined
        });
        shouldReloadTransactions = true;
      } else if (isEditing && editId) {
        await updateTransaction(editId, data);
      } else {
        await addTransaction(data);
      }
      clearSplitRows();
      router.back();
      // Background refresh after navigation
      Promise.all([
        shouldReloadTransactions ? reloadTransactions() : Promise.resolve(),
        refreshAccounts()
      ]).catch(() => { });
    } catch (e) {
      showAlert('Error', String(e));
    }
  };

  const handleDelete = () => {
    const isLoanOrigin = type === 'loan' && loanEditMode === 'origin' && editingLoanId;
    showConfirm({
      title: isLoanOrigin ? 'Delete Loan' : 'Delete Transaction',
      message: isLoanOrigin
        ? 'This will delete the loan and all its recorded entries. This cannot be undone.'
        : 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        if (isLoanOrigin) {
          await removeLoan(editingLoanId!);
        } else if (editId) {
          await removeTransaction(editId);
        }
        await refreshAccounts();
        setEditingSplitGroupId('');
        clearSplitRows();
        router.back();
      },
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    );
  };


  const handleOpenCalculator = () => {
    runAfterKeyboardDismiss(() => {
      setShowCalculator(true);
    });
  };

  const setPickedReceipt = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const nextUris = result.assets.map((asset) => asset.uri).filter(Boolean);
    if (nextUris.length) {
      setReceiptImageUris((current) => [...current, ...nextUris]);
    }
  };

  const takeReceiptPhoto = async () => {
    beginPrivacyGrace(5 * 60 * 1000);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      beginPrivacyGrace(15000);
      showAlert('Camera Permission Needed', 'Allow camera access to take receipt photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.back,
      quality: 0.85,
    });
    beginPrivacyGrace(15000);
    setPickedReceipt(result);
  };

  const chooseReceiptImage = async () => {
    beginPrivacyGrace(5 * 60 * 1000);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
    if (!permission.granted) {
      beginPrivacyGrace(15000);
      showAlert('Photo Permission Needed', 'Allow photo access to attach a receipt image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    beginPrivacyGrace(15000);
    setPickedReceipt(result);
  };

  const openReceiptPicker = () => {
    runAfterKeyboardDismiss(() => {
      setShowReceiptSheet(true);
    });
  };

  const openReceiptPreview = (index: number) => {
    setReceiptPreviewIndex(index);
    setReceiptPreviewOpen(true);
  };

  const openCategorySheet = () => {
    runAfterKeyboardDismiss(() => {
      setDraftCategoryId(categoryId);
      setShowCategorySheet(true);
    });
  };

  const selectCategoryFromSheet = (id: string) => {
    setCategoryId(id);
    setDraftCategoryId(id);
    setShowCategorySheet(false);
  };

  const openCategoryManagerFromSheet = () => {
    setShowCategorySheet(false);
    router.push('/settings/categories');
  };

  const removeReceiptAtIndex = (index: number) => {
    setReceiptImageUris((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setReceiptPreviewIndex((current) => Math.max(0, Math.min(current, receiptImageUris.length - 2)));
    if (receiptImageUris.length <= 1) {
      setReceiptPreviewOpen(false);
    }
  };

  const openDate = () => {
    Keyboard.dismiss();
    setPickerMode('date');
    setShowDatePicker(true);
  };

  const openTime = () => {
    Keyboard.dismiss();
    setPickerMode('time');
    setShowDatePicker(true);
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
            paddingBottom: 12
          }}
        >
          <TouchableOpacity delayPressIn={0} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: SCREEN_HEADER.iconTitleGap }}>
            <AppIcon name="x" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text }}>
            {screenTitle}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: 132 + keyboardHeight }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingBottom: 20 }}>
          <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 2, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(Object.keys(TYPE_CONFIG) as TransactionType[]).map((t) => (
                <TouchableOpacity delayPressIn={0}
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
                    opacity: lockTypeSelection && t !== type ? 0.35 : 1
                  }}
                >
                  <Text
                    style={{
                      fontSize: HOME_TEXT.bodySmall,
                      fontWeight: '700',
                      color: type === t ? TYPE_CONFIG[t].color : palette.textMuted
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
                subtitle={selectedAccount ? formatCurrency(selectedAccount.balance, displaySym) : undefined}
                placeholder={!accountId}
                palette={palette}
                onPress={() => runAfterKeyboardDismiss(() => setShowAccountSheet(true))}
              />
              <AmountRow
                sym={displaySym}
                amountStr={amountStr}
                setAmountStr={setAmountStr}
                onOpenCalculator={usableSplitRows.length === 0 ? handleOpenCalculator : undefined}
                onPressAmount={
                  usableSplitRows.length > 0
                    ? () =>
                      runAfterKeyboardDismiss(() =>
                        router.push({ pathname: '/modals/split-transaction', params: { type } })
                      )
                    : undefined
                }
                palette={palette}
                accentColor={activeConfig.color}
                autoFocus
                editable={usableSplitRows.length === 0}
              />
              <View style={{ paddingRight: SCREEN_GUTTER + 6, marginBottom: -6, alignItems: 'flex-end' }}>
                <TouchableOpacity delayPressIn={0}
                  onPress={() =>
                    runAfterKeyboardDismiss(() =>
                      router.push({ pathname: '/modals/split-transaction', params: { type } })
                    )
                  }
                  style={{ minHeight: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}
                  activeOpacity={0.75}
                >
                  <AppIcon name="layers" size={14} color={palette.brand} />
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.caption, fontWeight: '700', color: palette.brand }}>
                    Split
                  </Text>
                </TouchableOpacity>
              </View>
              {usableSplitRows.length > 0 ? (
                <PickerRow
                  label="Category"
                  value="Split"
                  subtitle="Edit line items"
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
                  value={
                    <CategoryPickerValue
                      category={getCategoryDisplayParts(categories, categoryId)}
                      palette={palette}
                    />
                  }
                  placeholder={!categoryId}
                  palette={palette}
                  onPress={openCategorySheet}
                  custom
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
              {payeeSuggestions.length > 0 && (
                <View style={{ paddingHorizontal: SCREEN_GUTTER + ROW_LABEL_WIDTH, paddingBottom: 16, marginTop: -8 }}>
                  <View style={{ maxHeight: 200 }}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {payeeSuggestions.slice(0, 6).map((s) => (
                        <TouchableOpacity delayPressIn={0}
                          key={s}
                          onPress={() => setPayee(s)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 11,
                            backgroundColor: palette.inputBg,
                            borderWidth: 1,
                            borderColor: palette.divider
                          }}
                        >
                          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text, fontWeight: '500' }}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}
              <ReceiptSection
                palette={palette}
                receiptImageUris={receiptImageUris}
                onAdd={openReceiptPicker}
                onPreview={openReceiptPreview}
                onRemove={removeReceiptAtIndex}
              />
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
              {noteSuggestions.length > 0 && (
                <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 16, marginTop: -4 }}>
                  <View style={{ maxHeight: 200 }}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {noteSuggestions.slice(0, 6).map((s) => (
                        <TouchableOpacity delayPressIn={0}
                          key={s}
                          onPress={() => setNote(s)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 11,
                            backgroundColor: palette.inputBg,
                            borderWidth: 1,
                            borderColor: palette.divider
                          }}
                        >
                          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text, fontWeight: '500' }}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}
            </SectionCard>
          ) : type === 'transfer' ? (
            <SectionCard palette={palette}>
              <InteractiveDateTimeRow date={date} palette={palette} onOpenDate={openDate} onOpenTime={openTime} />
              <PickerRow
                label="From account"
                value={getAccountName(accounts, accountId) || 'Select...'}
                subtitle={selectedAccount ? formatCurrency(selectedAccount.balance, displaySym) : undefined}
                placeholder={!accountId}
                palette={palette}
                onPress={() => runAfterKeyboardDismiss(() => setShowFromAccountSheet(true))}
              />
              <View style={{ alignItems: 'center', paddingVertical: 2 }}>
                <TouchableOpacity delayPressIn={0}
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
                    justifyContent: 'center'
                  }}
                >
                  <AppIcon name="arrow-up-down" size={16} color={activeConfig.color} />
                </TouchableOpacity>
              </View>
              <PickerRow
                label="To account"
                value={getAccountName(accounts, linkedAccountId) || 'Select...'}
                subtitle={selectedLinkedAccount ? formatCurrency(selectedLinkedAccount.balance, displaySym) : undefined}
                placeholder={!linkedAccountId}
                palette={palette}
                onPress={() => runAfterKeyboardDismiss(() => setShowToAccountSheet(true))}
              />
              {accountId && linkedAccountId && accountId === linkedAccountId ? (
                <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 4 }}>
                  <Text style={{ marginLeft: ROW_LABEL_WIDTH + 4, fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>
                    Heads up: Same account transfer.
                  </Text>
                </View>
              ) : null}
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
              {noteSuggestions.length > 0 && (
                <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 16, marginTop: -4 }}>
                  <View style={{ maxHeight: 200 }}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {noteSuggestions.slice(0, 6).map((s) => (
                        <TouchableOpacity delayPressIn={0}
                          key={s}
                          onPress={() => setNote(s)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 11,
                            backgroundColor: palette.inputBg,
                            borderWidth: 1,
                            borderColor: palette.divider
                          }}
                        >
                          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text, fontWeight: '500' }}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}
            </SectionCard>
          ) : (
            <SectionCard palette={palette}>
              <InteractiveDateTimeRow date={date} palette={palette} onOpenDate={openDate} onOpenTime={openTime} />
              {loanEditMode === 'settlement' ? (
                <>
                  <DisplayRow
                    label="Person"
                    value={personName}
                    palette={palette}
                  />
                  <PickerRow
                    label="Type"
                    value={
                      loanTransactionType === 'principal'
                        ? 'Principal'
                        : loanTransactionType === 'interest'
                          ? 'Interest'
                          : 'Others'
                    }
                    palette={palette}
                    onPress={() => {
                      Keyboard.dismiss();
                      InteractionManager.runAfterInteractions(() => setShowTypeSheet(true));
                    }}
                  />
                  {loanTransactionType !== 'principal' && (
                    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 2, paddingBottom: 8 }}>
                      <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>
                        Loan outstanding balance will not be affected
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={{ marginTop: -8 }}>
                    <FieldRow label="Direction" palette={palette}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(['lent', 'borrowed'] as const).map((d) => {
                          const active = loanDirection === d;
                          return (
                            <TouchableOpacity delayPressIn={0}
                              key={d}
                              onPress={lockLoanDirection ? undefined : () => setLoanDirection(d)}
                              disabled={lockLoanDirection}
                              style={{
                                flex: 1,
                                paddingVertical: 11,
                                borderRadius: 14,
                                alignItems: 'center',
                                borderWidth: 1.5,
                                borderColor: active ? activeConfig.borderColor : palette.border,
                                backgroundColor: active ? activeConfig.bg : palette.surface,
                                opacity: lockLoanDirection && !active ? 0.5 : 1
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: HOME_TEXT.bodySmall,
                                  fontWeight: '700',
                                  color: active ? activeConfig.color : palette.textMuted
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
                  {isLoanAddMore ? (
                    <DisplayRow
                      label="Person"
                      value={personName}
                      palette={palette}
                    />
                  ) : (
                    <TextInputRow
                      inputRef={personInputRef}
                      label="Person"
                      value={personName}
                      onChangeText={setPersonName}
                      placeholder="Name"
                      palette={palette}
                      accentColor={activeConfig.color}
                      autoFocus={type === 'loan' && !isEditing && !isLoanAddMore}
                    />
                  )}
                </>
              )}
              <AmountRow
                sym={displaySym}
                amountStr={amountStr}
                setAmountStr={setAmountStr}
                onOpenCalculator={handleOpenCalculator}
                palette={palette}
                accentColor={activeConfig.color}
                autoFocus={type !== 'loan' || loanEditMode === 'settlement'}
              />
              <PickerRow
                label="Account"
                value={getAccountName(accounts, accountId) || 'Select...'}
                subtitle={selectedAccount ? formatCurrency(selectedAccount.balance, displaySym) : undefined}
                placeholder={!accountId}
                palette={palette}
                onPress={() => runAfterKeyboardDismiss(() => setShowAccountSheet(true))}
              />
              <NotesSection
                note={note}
                onChangeNote={setNote}
                palette={palette}
                accentColor={activeConfig.color}
                onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250)}
              />
              {noteSuggestions.length > 0 && (
                <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 16, marginTop: -4 }}>
                  <View style={{ maxHeight: 200 }}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {noteSuggestions.slice(0, 6).map((s) => (
                        <TouchableOpacity delayPressIn={0}
                          key={s}
                          onPress={() => setNote(s)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 11,
                            backgroundColor: palette.inputBg,
                            borderWidth: 1,
                            borderColor: palette.divider
                          }}
                        >
                          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text, fontWeight: '500' }}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}
            </SectionCard>
          )}


        </View>
      </ScrollView>

      <FixedBottomActions palette={palette}>
        <FilledButton
          label={actionLabel}
          onPress={handleSubmit}
          disabled={!isValid}
          palette={palette}
          tone={type === 'out' ? 'danger' : 'brand'}
          style={{ backgroundColor: isValid ? actionButtonColor : palette.textSoft }}
        />
        {isEditing && (
          <TextButton label="Delete transaction" onPress={handleDelete} palette={palette} tone="danger" />
        )}
      </FixedBottomActions>

      {showTypeSheet ? (
        <BottomSheet title="Select Type" palette={palette} onClose={() => setShowTypeSheet(false)}>
          {(['principal', 'interest', 'others'] as const).map((type, index, arr) => (
            <ChoiceRow
              key={type}
              title={
                type === 'principal'
                  ? 'Principal'
                  : type === 'interest'
                    ? 'Interest'
                    : 'Others'
              }
              selected={loanTransactionType === type}
              palette={palette}
              onPress={() => {
                setLoanTransactionType(type);
                setShowTypeSheet(false);
              }}
              noBorder={index === arr.length - 1}
            />
          ))}
        </BottomSheet>
      ) : null}

      {showAccountSheet ? (
        <BottomSheet
          title="Select Account"
          palette={palette}
          onClose={() => setShowAccountSheet(false)}
          headerRight={
            <TouchableOpacity delayPressIn={0} onPress={() => { setShowAccountSheet(false); router.push('/settings/accounts'); }} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.brand }}>Manage</Text>
            </TouchableOpacity>
          }
        >
          {accounts.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, paddingVertical: 12, paddingHorizontal: SCREEN_GUTTER }}>No accounts available</Text>
          ) : (
            accounts.map((account, index) => {
              return (
                <ChoiceRow
                  key={account.id}
                  title={formatAccountDisplayName(account?.name ?? '', account?.accountNumber)}
                  subtitle={`${getAccountTypeLabel(account.type)} · ${formatCurrency(account.balance, displaySym)}`}
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
        <BottomSheet
          title="Transfer From"
          palette={palette}
          onClose={() => setShowFromAccountSheet(false)}
          headerRight={
            <TouchableOpacity delayPressIn={0} onPress={() => { setShowFromAccountSheet(false); router.push('/settings/accounts'); }} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.brand }}>Manage</Text>
            </TouchableOpacity>
          }
        >
          {accounts.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, paddingVertical: 12, paddingHorizontal: SCREEN_GUTTER }}>No accounts available</Text>
          ) : (
            accounts.map((account, index) => {
              return (
                <ChoiceRow
                  key={account.id}
                  title={formatAccountDisplayName(account?.name ?? '', account?.accountNumber)}
                  subtitle={`${getAccountTypeLabel(account.type)} · ${formatCurrency(account.balance, displaySym)}`}
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
        <BottomSheet
          title="Transfer To"
          palette={palette}
          onClose={() => setShowToAccountSheet(false)}
          headerRight={
            <TouchableOpacity delayPressIn={0} onPress={() => { setShowToAccountSheet(false); router.push('/settings/accounts'); }} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.brand }}>Manage</Text>
            </TouchableOpacity>
          }
        >
          {accounts.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, paddingVertical: 12, paddingHorizontal: SCREEN_GUTTER }}>No accounts available</Text>
          ) : (
            accounts.map((account, index) => {
              return (
                <ChoiceRow
                  key={account.id}
                  title={formatAccountDisplayName(account?.name ?? '', account?.accountNumber)}
                  subtitle={`${getAccountTypeLabel(account.type)} · ${formatCurrency(account.balance, displaySym)}`}
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

      {showCategorySheet ? (
        <CategoryPickerSheet
          categories={categories}
          transactionType={type}
          selectedCategoryId={categoryId}
          palette={palette}
          onClose={() => setShowCategorySheet(false)}
          onManage={openCategoryManagerFromSheet}
          onSelect={selectCategoryFromSheet}
        />
      ) : null}

      {showTagSheet ? (
        <BottomSheet
          title="Select Tags"
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
                backgroundColor: palette.surface
              }}
            >
              <TouchableOpacity delayPressIn={0}
                onPress={() => setShowTagSheet(false)}
                style={{
                  backgroundColor: palette.tabActive,
                  borderRadius: 18,
                  minHeight: 54,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Text style={{ color: palette.onBrand, fontSize: HOME_TEXT.rowLabel, fontWeight: PRIMARY_ACTION.labelWeight }}>Done</Text>
              </TouchableOpacity>
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
      <DateTimePickerPopup
        visible={showDatePicker}
        mode={pickerMode}
        value={new Date(date)}
        palette={palette}
        accentColor={activeConfig.color}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(nextDate) => {
          setDate(nextDate.toISOString());
        }}
      />

      <CalculatorSheet
        visible={showCalculator}
        value={amountStr.replace(/,/g, '')}
        palette={palette}
        brandColor={activeConfig.color}
        brandSoft={activeConfig.bg}
        brandOnColor={activeConfig.onColor}
        onClose={() => {
          setShowCalculator(false);
        }}
        onApply={(finalValue) => {
          setShowCalculator(false);
          setAmountStr(formatIndianNumberStr(finalValue));
        }}
      />

      {showReceiptSheet && (
        <Modal visible={showReceiptSheet} transparent animationType="fade" onRequestClose={() => setShowReceiptSheet(false)}>
          <View style={{ flex: 1, backgroundColor: palette.scrimHeavy, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject }} onPress={() => setShowReceiptSheet(false)} />
            <View style={{ width: '100%', backgroundColor: palette.card, borderRadius: 24, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }}>
              <View style={{ padding: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: palette.border }}>
                <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, fontWeight: '700', marginBottom: 6 }}>Receipt image</Text>
                <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, textAlign: 'center' }}>Attach a receipt to this transaction</Text>
              </View>
              <TouchableOpacity
                delayPressIn={0}
                onPress={() => {
                  setShowReceiptSheet(false);
                  void takeReceiptPhoto();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface, gap: 12 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: palette.inputBg, alignItems: 'center', justifyContent: 'center' }}>
                  <AppIcon name="camera" size={20} color={palette.textSecondary} />
                </View>
                <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, fontWeight: '600' }}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                delayPressIn={0}
                onPress={() => {
                  setShowReceiptSheet(false);
                  void chooseReceiptImage();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, backgroundColor: palette.surface, gap: 12 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: palette.inputBg, alignItems: 'center', justifyContent: 'center' }}>
                  <AppIcon name="image" size={20} color={palette.textSecondary} />
                </View>
                <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, fontWeight: '600' }}>Choose Photo</Text>
              </TouchableOpacity>
              <View style={{ padding: 16, backgroundColor: palette.surface }}>
                <TouchableOpacity
                  delayPressIn={0}
                  onPress={() => setShowReceiptSheet(false)}
                  style={{ paddingVertical: 14, alignItems: 'center', backgroundColor: palette.inputBg, borderRadius: 12 }}
                >
                  <Text style={{ fontSize: HOME_TEXT.body, color: palette.text, fontWeight: BUTTON_TOKENS.text.labelWeight }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <Modal
        visible={receiptPreviewOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setReceiptPreviewOpen(false)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: '#000000',
            }}
          >
            <TouchableOpacity
              delayPressIn={0}
              onPress={() => setReceiptPreviewOpen(false)}
              style={{
                position: 'absolute',
                top: 48,
                left: 18,
                zIndex: 2,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(0,0,0,0.62)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.28)',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000000',
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
              }}
            >
              <AppChevron direction="left" size={28} color="#FFFFFF" palette={palette} />
            </TouchableOpacity>
            {receiptImageUris[receiptPreviewIndex] ? (
              <>
                <ZoomableReceiptImage uri={receiptImageUris[receiptPreviewIndex]} />
                {receiptImageUris.length > 1 ? (
                  <>
                    <TouchableOpacity
                      delayPressIn={0}
                      onPress={() => setReceiptPreviewIndex((index) => Math.max(0, index - 1))}
                      disabled={receiptPreviewIndex === 0}
                      style={{
                        position: 'absolute',
                        left: 18,
                        top: '50%',
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: 'rgba(0,0,0,0.62)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.28)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#000000',
                        shadowOpacity: 0.35,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 8,
                        opacity: receiptPreviewIndex === 0 ? 0.35 : 1,
                      }}
                    >
                      <AppChevron direction="left" size={24} color="#FFFFFF" palette={palette} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      delayPressIn={0}
                      onPress={() => setReceiptPreviewIndex((index) => Math.min(receiptImageUris.length - 1, index + 1))}
                      disabled={receiptPreviewIndex === receiptImageUris.length - 1}
                      style={{
                        position: 'absolute',
                        right: 18,
                        top: '50%',
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: 'rgba(0,0,0,0.62)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.28)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#000000',
                        shadowOpacity: 0.35,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 8,
                        opacity: receiptPreviewIndex === receiptImageUris.length - 1 ? 0.35 : 1,
                      }}
                    >
                      <AppChevron direction="right" size={24} color="#FFFFFF" palette={palette} />
                    </TouchableOpacity>
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 36,
                        alignSelf: 'center',
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 999,
                        backgroundColor: 'rgba(0,0,0,0.62)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.28)',
                      }}
                    >
                      <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: '700', color: '#FFFFFF' }}>
                        {receiptPreviewIndex + 1} / {receiptImageUris.length}
                      </Text>
                    </View>
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        </GestureHandlerRootView>
      </Modal>
      {dialog}
    </KeyboardAvoidingView>
  );
}

function ReceiptSection({
  palette,
  receiptImageUris,
  onAdd,
  onPreview,
  onRemove,
}: {
  palette: AppThemePalette;
  receiptImageUris: string[];
  onAdd: () => void;
  onPreview: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.textMuted, marginBottom: 10 }}>
        Receipt
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, alignItems: 'center' }}>
        {receiptImageUris.map((uri, index) => (
          <View key={`${uri}-${index}`} style={{ width: 76, height: 76 }}>
            <TouchableOpacity
              delayPressIn={0}
              onPress={() => onPreview(index)}
              style={{
                width: 76,
                height: 76,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                overflow: 'hidden',
              }}
            >
              <Image source={{ uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            </TouchableOpacity>
            <TouchableOpacity
              delayPressIn={0}
              onPress={() => onRemove(index)}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: 'rgba(0,0,0,0.58)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="x" size={17} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          delayPressIn={0}
          onPress={onAdd}
          style={{
            width: receiptImageUris.length ? 76 : 58,
            height: receiptImageUris.length ? 76 : 58,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppIcon name={receiptImageUris.length ? 'plus' : 'camera'} size={22} color={palette.tabActive} />
        </TouchableOpacity>
        {!receiptImageUris.length ? (
          <View style={{ justifyContent: 'center' }}>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text, fontWeight: '500' }}>
              Add receipt
            </Text>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 2 }}>
              Take photos or choose images
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ZoomableReceiptImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY, uri]);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .shouldCancelWhenOutside(false)
        .onUpdate((event) => {
          scale.value = Math.min(4, Math.max(1, savedScale.value * event.scale));
        })
        .onEnd(() => {
          savedScale.value = scale.value;
          if (scale.value <= 1.02) {
            scale.value = withTiming(1);
            savedScale.value = 1;
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
          }
        }),
    [savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .shouldCancelWhenOutside(false)
        .onUpdate((event) => {
          if (scale.value <= 1) return;
          translateX.value = savedTranslateX.value + event.translationX;
          translateY.value = savedTranslateY.value + event.translationY;
        })
        .onEnd(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        }),
    [savedTranslateX, savedTranslateY, scale, translateX, translateY],
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
      <Animated.View collapsable={false} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.Image
          source={{ uri }}
          resizeMode="contain"
          style={[
            {
              width: '100%',
              height: '100%',
            },
            imageStyle,
          ]}
        />
      </Animated.View>
    </GestureDetector>
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

function getCategoryDisplayParts(
  categories: Category[],
  categoryId: string,
): { name: string; parentName?: string; fullName: string; icon: string } {
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return { name: 'Select Category', fullName: 'Select Category', icon: 'tag' };
  if (!category.parentId) return { name: category.name, fullName: category.name, icon: category.icon || 'tag' };
  const parentName = categories.find((item) => item.id === category.parentId)?.name ?? 'Category';
  return {
    name: category.name,
    parentName,
    fullName: `${parentName} • ${category.name}`,
    icon: category.icon || 'tag',
  };
}

function CategoryPickerValue({
  category,
  palette,
}: {
  category: ReturnType<typeof getCategoryDisplayParts>;
  palette: AppThemePalette;
}) {
  const isPlaceholder = category.fullName === 'Select Category';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: ROW_MIN_HEIGHT, paddingVertical: 10 }}>
      <Text
        style={{
          flex: 1,
          fontSize: HOME_TEXT.sectionTitle,
          fontWeight: '400',
          color: isPlaceholder ? palette.textMuted : palette.text,
          lineHeight: 21,
        }}
        numberOfLines={2}
      >
        {category.fullName}
      </Text>
    </View>
  );
}
