import { Text } from '@/components/ui/AppText';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  BackHandler,
  TextInput
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { ChoiceRow, FixedBottomActions } from '../../components/settings-ui';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { AppChevron } from '../../components/ui/AppChevron';
import { AppIcon } from '../../components/ui/AppIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { CategoryPickerSheet } from '../../components/ui/CategoryPickerSheet';
import { DateTimePickerPopup } from '../../components/ui/DateTimePickerPopup';
import { getScrollableBottomPadding } from '../../components/ui/safeBottom';
import {
  DisplayRow,
  FieldRow,
  PickerRow,
  SectionCard,
  sanitizeDecimalInput
} from '../../components/ui/transaction-form-primitives';
import { isEmojiIcon } from '../../lib/ui-format';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { APP_LOCALE, formatDate, addMonthsSafe } from '../../lib/dateUtils';
import {
  formatCurrency,
  formatSignedCurrency,
  formatIndianNumberStr,
  getLoanSettlementLabel,
  getLoanTransactionKind,
  getLoanTransactionUserNote,
  mergeLoanTransactionNote,
  parseFormattedNumber
} from '../../lib/derived';
import { SCREEN_GUTTER , FONT_WEIGHT} from '../../lib/design';
const FORM_GUTTER = 16;
import { BUTTON_TOKENS, HOME_TEXT, PRIMARY_ACTION, SCREEN_HEADER , HOME_RADIUS, HOME_LAYOUT} from '../../lib/layoutTokens';
import { runAfterKeyboardDismiss } from '../../lib/ui-utils';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../../lib/settings-shared';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { getLoanById } from '../../services/loans';
import { createSplitTransactionGroup, createTransaction, deleteTransaction, getRecentNotes, getRecentPayees, getTransactionById, getTransactionsBySplitGroup, updateSplitTransactionGroup, updateTransferTransaction } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useFixedDepositsStore } from '../../stores/useFixedDepositsStore';
import { usePersonsStore } from '../../stores/usePersonsStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';
import { updateAllReniWidgets } from '../../widgets/widgetTaskHandler';
import { InlineComboBox } from '../../components/ui/InlineComboBox';
import { TagBadge } from '../../components/ui/TagBadge';

import type {
  Account,
  Category,
  CreateTransactionInput,
  TransactionType
} from '../../types';
function AccountTypeBadge({ account, palette: _palette }: { account: Account; palette: AppThemePalette }) {
  const typeMeta = ACCOUNT_TYPE_META[account.type];

  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: HOME_RADIUS.chip,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${typeMeta.color}18`,
        borderWidth: 1,
        borderColor: `${typeMeta.color}30`,
      }}
    >
      <AppIcon name={typeMeta.icon as any} size={19} color={typeMeta.color} strokeWidth={1.6} />
    </View>
  );
}


function CardDivider({ palette }: { palette: AppThemePalette }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: palette.divider,
      }}
    />
  );
}

// We compute TYPE_CONFIG dynamically inside the component to use the derived palette

export default function AddTransactionModal() {
  const insets = useSafeAreaInsets();
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const shakeOffset = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
  }));
  const {
    editId,
    accountId: sourceAccountId,
    type: initialType,
    loanId: routeLoanId,
    settlement,
    addMore,
    editDepositId,
    closeDepositId,
    focusField,
    fromWidget
  } = useLocalSearchParams<{ editId?: string; accountId?: string; type?: string; loanId?: string; settlement?: string; addMore?: string; editDepositId?: string; closeDepositId?: string; focusField?: string; fromWidget?: string }>();
  const isEditingDeposit = !!editDepositId && editDepositId !== '';
  const isClosingDeposit = !!closeDepositId && closeDepositId !== '' && !isEditingDeposit;
  const isEditing = !!editId || isEditingDeposit;
  const isLoanAddMore = !isEditing && !!routeLoanId && addMore === '1';

  const addTransaction = useTransactionsStore((s) => s.add);
  const updateTransaction = useTransactionsStore((s) => s.update);
  const removeTransaction = useTransactionsStore((s) => s.remove);
  const reloadTransactions = useTransactionsStore((s) => s.load);
  const markTxMutated = useTransactionsStore((s) => s.markMutated);
  const addLoan = useLoansStore((s) => s.add);
  const addLoanPrincipal = useLoansStore((s) => s.addPrincipal);
  const updateLoanOrigin = useLoansStore((s) => s.updateOrigin);
  const updateLoanSettlement = useLoansStore((s) => s.updateSettlement);
  const removeLoan = useLoansStore((s) => s.remove);
  const deposits = useFixedDepositsStore((s) => s.deposits);
  const isDepositsLoaded = useFixedDepositsStore((s) => s.isLoaded);
  const loadDeposits = useFixedDepositsStore((s) => s.load);
  const removeDeposit = useFixedDepositsStore((s) => s.remove);
  const closeDeposit = useFixedDepositsStore((s) => s.close);
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
  const [type, setType] = useState<TransactionType | 'deposit'>(() => {
    if (isEditingDeposit || isClosingDeposit || editDepositId || closeDepositId) {
      return 'deposit';
    }
    if (routeLoanId) {
      return 'loan';
    }
    if (editId) {
      const tx = useTransactionsStore.getState().transactions.find((t) => t.id === editId);
      if (tx) {
        return tx.type === 'loan' ? 'loan' : (tx.transferPairId ? 'transfer' : tx.type);
      }
    }
    return (initialType as TransactionType | 'deposit') || 'out';
  });
  // Deposit-only fields (used when type === 'deposit')
  const [depositName, setDepositName] = useState('');
  const [depositBank, setDepositBank] = useState('');
  const [depositTenure, setDepositTenure] = useState('');
  const [depositInterest, setDepositInterest] = useState('');
  const [depositMaturityStr, setDepositMaturityStr] = useState('');
  // Close-deposit split fields
  const [closePrincipalStr, setClosePrincipalStr] = useState('');
  const [closeInterestStr, setCloseInterestStr] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [payee, setPayee] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [date, setDate] = useState(new Date().toISOString());
  const [note, setNote] = useState('');
  const [receiptImageUris, setReceiptImageUris] = useState<string[]>([]);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [receiptPreviewIndex, setReceiptPreviewIndex] = useState(0);
  const [showReceiptSheet, setShowReceiptSheet] = useState(false);
  const persons = usePersonsStore((s) => s.persons);
  const personsLoaded = usePersonsStore((s) => s.isLoaded);
  const loadPersons = usePersonsStore((s) => s.load);
  const [personName, setPersonName] = useState('');
  const [loanDirection, setLoanDirection] = useState<'lent' | 'borrowed'>('lent');
  const [loanEditMode, setLoanEditMode] = useState<'new' | 'origin' | 'settlement'>('new');
  const [editingLoanId, setEditingLoanId] = useState(() => {
    if (editId) {
      const tx = useTransactionsStore.getState().transactions.find((t) => t.id === editId);
      return tx?.loanId || '';
    }
    return '';
  });
  const [editingSplitGroupId, setEditingSplitGroupId] = useState('');
  const [isTransferEdit, setIsTransferEdit] = useState(() => {
    if (editId) {
      const tx = useTransactionsStore.getState().transactions.find((t) => t.id === editId);
      return !!tx?.transferPairId;
    }
    return false;
  });
  const [accountSheetMode, setAccountSheetMode] = useState<'none' | 'account' | 'from' | 'to'>('none');
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showTagSheet, setShowTagSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [loanTransactionType, setLoanTransactionType] = useState<'principal' | 'interest' | 'others'>('principal');
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [payeeSuggestions, setPayeeSuggestions] = useState<string[]>([]);
  const [noteSuggestions, setNoteSuggestions] = useState<string[]>([]);
  const [isPayeeFocused, setIsPayeeFocused] = useState(false);
  const [isPersonFocused, setIsPersonFocused] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const splitIdSeed = useRef(0);
  const hadSplitRows = useRef(false);
  // The split group this edit was opened on (if any). Survives clearing the
  // split rows so a split → single conversion can delete the whole original
  // group instead of orphaning its sibling rows.
  const originalSplitGroupIdRef = useRef('');
  const previousType = useRef<TransactionType | 'deposit'>((initialType as TransactionType | 'deposit') || 'out');
  const isHydratingEditRef = useRef(false);
  const isDepositHydratedRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const typeScrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const normalizedPersonQuery = personName.trim().toLowerCase();
  const filteredPersonSuggestions = useMemo(() => {
    if (!normalizedPersonQuery) return [];
    return persons.filter((p) => p.toLowerCase().includes(normalizedPersonQuery));
  }, [persons, normalizedPersonQuery]);

  const exactPersonMatch = useMemo(() => {
    if (!normalizedPersonQuery) return false;
    return persons.some((p) => p.toLowerCase() === normalizedPersonQuery);
  }, [persons, normalizedPersonQuery]);


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

  useEffect(() => {
    if (type === 'deposit' || type === 'loan') {
      setTimeout(() => {
        typeScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 120);
    } else if (type === 'in' || type === 'out') {
      setTimeout(() => {
        typeScrollViewRef.current?.scrollTo({ x: 0, animated: true });
      }, 120);
    }
  }, [type]);

  const TYPE_CONFIG = {
    in: { label: 'Income', color: palette.uiPositive, onColor: palette.onBrand, borderColor: palette.uiPositive, bg: palette.inBg },
    out: { label: 'Expense', color: palette.uiNegative, onColor: palette.onBrand, borderColor: palette.uiNegative, bg: palette.outBg },
    transfer: { label: 'Transfer', color: palette.brand, onColor: palette.onBrand, borderColor: palette.brand, bg: palette.brandSoft },
    deposit: { label: 'Deposit', color: palette.brand, onColor: palette.onBrand, borderColor: palette.brand, bg: palette.brandSoft },
    loan: { label: 'Loan', color: palette.brand, onColor: palette.onBrand, borderColor: palette.brand, bg: palette.brandSoft }
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

  // Sync state if deep-linked to a different transaction type while already mounted
  useEffect(() => {
    if (initialType && !isEditing && !isClosingDeposit && !isLoanAddMore) {
      setType(initialType as TransactionType);
      // Reset form fields to ensure a clean state
      setAmountStr('');
      setCategoryId('');
      setPayee('');
      setSelectedTagIds([]);
      setNote('');
      setReceiptImageUris([]);
      clearSplitRows();
    }
  }, [initialType, isEditing, isClosingDeposit, isLoanAddMore, clearSplitRows]);

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

  // Hydrate form from existing deposit when editing or closing.
  useEffect(() => {
    const depositId = editDepositId || closeDepositId;
    if ((!isEditingDeposit && !isClosingDeposit) || !depositId) return;
    // Only hydrate once — prevent dep-change re-runs from overwriting user edits.
    if (isDepositHydratedRef.current) return;

    if (!isDepositsLoaded) {
      loadDeposits().catch(() => {});
      return;
    }

    const found = deposits.find((d) => d.id === depositId);
    if (!found) return;

    isDepositHydratedRef.current = true;
    setType('deposit');

    // When closing: compute principal + interest split for the two-field form.
    if (isClosingDeposit) {
      const principal = found.principalAmount;
      let maturity = found.maturityValue ?? principal;
      if (!found.maturityValue && found.tenureMonths && found.interestRate) {
        maturity = principal * Math.pow(1 + found.interestRate / 400, found.tenureMonths / 3);
      }
      const interest = Math.max(0, Math.round(maturity - principal));
      setClosePrincipalStr(formatIndianNumberStr(String(Math.round(principal))));
      setCloseInterestStr(interest > 0 ? formatIndianNumberStr(String(interest)) : '');
    }

    setAmountStr(formatIndianNumberStr(String(Math.round(found.principalAmount))));
    setAccountId(found.accountId);
    if (!isClosingDeposit) setDate(found.startDate);
    setDepositName(found.name);
    setDepositBank(found.bankName ?? '');
    setDepositTenure(found.tenureMonths != null ? String(found.tenureMonths) : '');
    setDepositInterest(found.interestRate != null ? String(found.interestRate) : '');
    if (!isClosingDeposit && found.maturityValue != null) {
      setDepositMaturityStr(formatIndianNumberStr(String(Math.round(found.maturityValue))));
    }
    setNote(isClosingDeposit ? '' : found.note ?? '');
  }, [closeDepositId, editDepositId, isClosingDeposit, isEditingDeposit, deposits, isDepositsLoaded, loadDeposits]);

  // Auto-compute maturity value from principal + tenure + interest rate.
  // Runs for new deposits and whenever the user changes core inputs while editing.
  useEffect(() => {
    if (type !== 'deposit' || isClosingDeposit) return;
    const principal = parseFloat(parseFormattedNumber(amountStr)) || 0;
    const tenure = parseInt(depositTenure.trim(), 10);
    const interest = parseFloat(depositInterest.trim());
    if (principal > 0 && Number.isFinite(tenure) && tenure > 0 && Number.isFinite(interest) && interest > 0) {
      const quarters = tenure / 3;
      const mv = principal * Math.pow(1 + interest / 400, quarters);
      setDepositMaturityStr(formatIndianNumberStr(String(Math.round(mv))));
    } else if (!isDepositHydratedRef.current) {
      setDepositMaturityStr('');
    }
  }, [amountStr, depositTenure, depositInterest, type, isClosingDeposit]);

  useEffect(() => {
    if (!isEditing || !editId) return;
    isHydratingEditRef.current = true;
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
            originalSplitGroupIdRef.current = tx.splitGroupId;
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
      }).finally(() => {
        isHydratingEditRef.current = false;
      });
    });
    return () => {
      isHydratingEditRef.current = false;
      task.cancel();
    };
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
        setDate(new Date().toISOString());
      });
    });
    return () => task.cancel();
  }, [addMore, isEditing, routeLoanId, settlement]);

  const amount = parseFloat(parseFormattedNumber(amountStr)) || 0;
  const closePrincipal = parseFloat(parseFormattedNumber(closePrincipalStr)) || 0;
  const closeInterest = parseFloat(parseFormattedNumber(closeInterestStr)) || 0;
  const activeConfig = TYPE_CONFIG[type];
  const amountInputColor = palette.brand;
  const lockTypeSelection = isEditingDeposit || isClosingDeposit || (isEditing && (isTransferEdit || (type === 'loan' && !!editingLoanId)));
  const dt = new Date(date);
  const dayName = dt.toLocaleDateString(APP_LOCALE, { weekday: 'short' });
  const dateFormatted = `${dayName}, ${formatDate(date)}`;
  const timeFormatted = dt.toLocaleTimeString(APP_LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true });
  const lockLoanDirection = isLoanAddMore || (isEditing && type === 'loan' && !!editingLoanId);
  const displaySym = showCurrencySymbol ? sym : '';
  const splitTotal = splitRows.reduce((sum, row) => sum + (parseFloat(parseFormattedNumber(row.amountStr)) || 0), 0);
  const usableSplitRows = splitRows.filter(
    (row) => row.categoryId && (parseFloat(parseFormattedNumber(row.amountStr)) || 0) !== 0,
  );

  // Re-entrancy guard kept in a ref — using state here would trigger a wasted
  // re-render of the modal in the same React commit as the closeScreen()
  // navigation, which adds noticeable latency to the tap→transition window.
  const isSubmittingRef = useRef(false);

  const closeScreen = (isCancel: boolean | object = true) => {
    setIsClosing(true);
    const isCancelBoolean = isCancel === true || typeof isCancel === 'object' || isCancel === undefined;
    if (fromWidget === '1' && !isCancelBoolean) {
      BackHandler.exitApp();
    } else if (!router.canGoBack()) {
      router.replace('/');
    } else {
      router.back();
    }
  };

  const closeScreenAndExecute = (
    runWork: () => void,
    isSynchronous = false
  ) => {
    if (isSynchronous) {
      runWork();
      closeScreen(false);
    } else {
      closeScreen(false);
      InteractionManager.runAfterInteractions(runWork);
    }
  };

  // Listen for incoming deep links while the modal is already mounted
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      try {
        const parsed = Linking.parse(event.url);
        const typeParam = Array.isArray(parsed.queryParams?.type)
          ? parsed.queryParams.type[0]
          : parsed.queryParams?.type;

        if (typeParam === 'in' || typeParam === 'out' || typeParam === 'transfer') {
          setType(typeParam as TransactionType);
          setAmountStr('');
          setCategoryId('');
          setPayee('');
          setSelectedTagIds([]);
          setNote('');
          setReceiptImageUris([]);
          clearSplitRows();
        }
      } catch (err) {
        console.warn('Failed to parse incoming deep link url:', err);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => {
      subscription.remove();
    };
  }, [clearSplitRows]);

  // Load persons list lazily when the loan form is active
  useEffect(() => {
    if (type !== 'loan') return;
    if (!personsLoaded) loadPersons().catch(() => undefined);
  }, [type, personsLoaded, loadPersons]);

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
    if (isHydratingEditRef.current) return;
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
    isClosingDeposit
      ? closePrincipal > 0 && !!accountId
      : type === 'deposit'
      ? amount > 0 && !!accountId && depositName.trim().length > 0
      : type === 'transfer'
        ? amount > 0 && accountId && linkedAccountId
        : isLoanAddMore
          ? amount > 0 && accountId && personName.trim().length > 0
          : type === 'loan'
            ? amount > 0 && accountId && personName.trim().length > 0
            : usableSplitRows.length > 0
              ? splitTotal !== 0 && accountId
              : hasNonZeroAmount && accountId && categoryId;

  const getValidationErrorMessage = () => {
    const amountVal = isClosingDeposit ? closePrincipal : amount;
    if (amountVal <= 0 || (usableSplitRows.length > 0 && splitTotal === 0)) {
      return 'Please enter an amount';
    }
    if (!accountId) {
      return 'Please select an account';
    }
    if (type === 'transfer' && !linkedAccountId) {
      return 'Please select a destination account';
    }
    if ((type === 'in' || type === 'out') && usableSplitRows.length === 0 && !categoryId) {
      return 'Please select a category';
    }
    if (type === 'loan' && personName.trim().length === 0) {
      return 'Please enter a person name';
    }
    if (type === 'deposit' && !isClosingDeposit && depositName.trim().length === 0) {
      return 'Please enter a deposit name';
    }
    return null;
  };

  const actionLabel = (() => {
    if (isEditing) return 'Save Changes';
    if (isClosingDeposit) return 'Close Deposit';
    if (isLoanAddMore) return 'Add More';
    if (type === 'loan' && routeLoanId && settlement === '1') {
      return loanDirection === 'lent' ? 'Add Receipt' : 'Add Payment';
    }
    if (type === 'in') return 'Add Income';
    if (type === 'transfer') return 'Move Money';
    if (type === 'loan') return loanDirection === 'lent' ? 'Lend Money' : 'Borrow Money';
    if (type === 'deposit') return 'Create Deposit';
    return 'Add Expense';
  })();
  const actionButtonColor = palette.brand;
  const screenTitle = isEditing
    ? type === 'deposit'
      ? 'Deposit Details'
      : type === 'transfer'
        ? 'Transfer Details'
        : type === 'loan'
          ? 'Loan Details'
          : 'Transaction Details'
    : isClosingDeposit
      ? 'Close Deposit'
    : isLoanAddMore
      ? 'Add More'
      : type === 'deposit'
        ? 'New Deposit'
        : 'New Transaction';

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!isValid) {
      setAttemptedSubmit(true);
      shakeOffset.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      return;
    }
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    // Every save path follows the same shape: close the modal immediately, run the
    // mutation in the background, refresh dependent stores after, and surface any
    // error via showAlert. This keeps the UI responsive even when the DB write or
    // a subsequent reload takes a moment.
    const runInBackground = (
      work: () => Promise<unknown>,
      refresh?: { tx?: boolean; widgets?: boolean },
    ) => {
      (async () => {
        try {
          await work();
          const tasks: Promise<unknown>[] = [refreshAccounts()];
          if (refresh?.tx) tasks.push(reloadTransactions());
          await Promise.all(tasks);
          // These background paths (splits, transfer edits, deposits, loans) write
          // straight to the service layer, bypassing the store's own mutationVersion
          // bump. Bump it now — after the DB-truth reload — so screens keyed on it
          // (account detail, home hero) refresh too.
          if (refresh?.tx) markTxMutated();
          if (refresh?.widgets) updateAllReniWidgets().catch(() => undefined);
        } catch (e) {
          showAlert('Error', String(e));
        }
      })();
    };

    try {
      // lastUsedAccountId is persisted below — deferred for the in-app in/out
      // path so closeScreen lands with zero synchronous store writes.
      // For non-in/out branches (deposit, loan, transfer, split) we fire eagerly
      // since they aren't the hot path being micro-optimised.
      const shouldPersistLastAccount = !isEditing && !!accountId;
      const persistLastAccountEagerly = () => {
        if (shouldPersistLastAccount) {
          updateSettings({ lastUsedAccountId: accountId }).catch(() => {});
        }
      };



      if (type === 'deposit') {
        if (isClosingDeposit && closeDepositId) {
          const payload = {
            principalAmount: closePrincipal,
            interestAmount: closeInterest > 0 ? closeInterest : undefined,
            accountId,
            date,
            note: note.trim() || undefined,
          };
          closeScreenAndExecute(() => {
            persistLastAccountEagerly();
            runInBackground(() => closeDeposit(closeDepositId, payload), { tx: true, widgets: true });
          }, true);
          return;
        }

        const tenureRaw = depositTenure.trim() ? parseInt(depositTenure.trim(), 10) : NaN;
        const interestRaw = depositInterest.trim() ? parseFloat(depositInterest.trim()) : NaN;
        const tenureMonths = Number.isFinite(tenureRaw) ? tenureRaw : undefined;
        const interestRate = Number.isFinite(interestRaw) ? interestRaw : undefined;

        // Auto-compute maturity date from tenure if provided. Full ISO format
        // matches startDate and the rest of the app's date storage.
        let maturityDate: string | null = null;
        if (tenureMonths) {
          const start = new Date(date);
          const end = addMonthsSafe(start, tenureMonths);
          maturityDate = end.toISOString();
        }
        // Use the maturity value from the editable field (auto-computed or user-overridden).
        let maturityValue: number | null = null;
        const maturityParsed = parseFloat(parseFormattedNumber(depositMaturityStr));
        if (Number.isFinite(maturityParsed) && maturityParsed > 0) {
          maturityValue = maturityParsed;
        } else if (tenureMonths && interestRate) {
          // Fallback: quarterly-compounded estimate if field was empty.
          maturityValue = amount * Math.pow(1 + interestRate / 400, tenureMonths / 3);
        }

        const depositPayload = {
          name: depositName.trim(),
          bankName: depositBank.trim() || null,
          accountId,
          principalAmount: amount,
          interestRate: interestRate ?? null,
          tenureMonths: tenureMonths ?? null,
          startDate: date,
          maturityDate,
          maturityValue,
          note: note.trim() || null,
        };
        const depositsStore = useFixedDepositsStore.getState();
        const depositWork = isEditingDeposit && editDepositId
          ? () => depositsStore.update(editDepositId, depositPayload)
          : () => depositsStore.add(depositPayload);
        closeScreenAndExecute(() => {
          persistLastAccountEagerly();
          runInBackground(depositWork, { tx: true, widgets: true });
        }, true);
        return;
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

      if ((type === 'in' || type === 'out') && usableSplitRows.length > 0) {
        const splitItems = usableSplitRows.map((row) => ({
          categoryId: row.categoryId,
          amount: parseFloat(parseFormattedNumber(row.amountStr)) || 0
        }));
        const splitPayload = {
          type,
          accountId,
          payee: payee.trim() || undefined,
          note: note || undefined,
          receiptImageUris,
          tags: selectedTagIds,
          date,
          items: splitItems,
        };
        const splitWork = isEditing && editId && editingSplitGroupId
          ? async () => {
              await updateSplitTransactionGroup(editingSplitGroupId, splitPayload);
            }
          : async () => {
              await createSplitTransactionGroup(splitPayload);
              // Convert single → split: drop the now-orphaned original row.
              if (isEditing && editId) await deleteTransaction(editId);
            };
        closeScreenAndExecute(() => {
          clearSplitRows();
          persistLastAccountEagerly();
          runInBackground(splitWork, { tx: true, widgets: true });
        }, true);
        return;
      }

      // Split → single conversion: the edit opened on a split group but the user
      // removed every split row. updateTransaction would only touch the tapped
      // row, leaving its siblings (and their split icons) behind — so instead drop
      // the whole original group (deleteTransaction cascades by splitGroupId) and
      // write one clean single row.
      if (
        (type === 'in' || type === 'out') &&
        isEditing &&
        editId &&
        originalSplitGroupIdRef.current &&
        usableSplitRows.length === 0
      ) {
        const oldGroupMemberId = editId;
        closeScreenAndExecute(() => {
          clearSplitRows();
          persistLastAccountEagerly();
          runInBackground(async () => {
            await deleteTransaction(oldGroupMemberId);
            await createTransaction({ ...data, splitGroupId: undefined });
          }, { tx: true, widgets: true });
        }, true);
        return;
      }

      if (type === 'loan' && isEditing && editId && loanEditMode === 'origin' && editingLoanId) {
        const loanId = editingLoanId;
        const txId = editId;
        const payload = {
          personName,
          direction: loanDirection,
          accountId,
          givenAmount: amount,
          note: note.trim(),
          tags: selectedTagIds,
          date,
        };
        closeScreenAndExecute(() => {
          clearSplitRows();
          persistLastAccountEagerly();
          runInBackground(() => updateLoanOrigin(loanId, payload, txId), { tx: true, widgets: true });
        }, true);
        return;
      }
      if (type === 'loan' && isEditing && editId && loanEditMode === 'settlement' && editingLoanId) {
        const txId = editId;
        const loanId = editingLoanId;
        const payload = {
          type: 'loan' as const,
          amount,
          accountId,
          loanId,
          loanTransactionType,
          note: mergeLoanTransactionNote(getLoanSettlementLabel(loanDirection, personName), note),
          date,
        };
        closeScreenAndExecute(() => {
          clearSplitRows();
          persistLastAccountEagerly();
          runInBackground(() => updateLoanSettlement(txId, payload), { tx: true, widgets: true });
        }, true);
        return;
      }
      if (type === 'loan' && routeLoanId && settlement === '1') {
        const payload = {
          type: 'loan' as const,
          amount,
          accountId,
          loanId: routeLoanId,
          loanTransactionType,
          note: mergeLoanTransactionNote(getLoanSettlementLabel(loanDirection, personName), note),
          date,
        };
        closeScreenAndExecute(() => {
          clearSplitRows();
          persistLastAccountEagerly();
          runInBackground(() => addTransaction(payload), { tx: true, widgets: true });
        }, true);
        return;
      }
      if (type === 'loan' && isLoanAddMore && routeLoanId) {
        const loanId = routeLoanId;
        const trimmedNote = note.trim();
        closeScreenAndExecute(() => {
          clearSplitRows();
          persistLastAccountEagerly();
          runInBackground(() => addLoanPrincipal(loanId, amount, accountId, date, trimmedNote), { tx: true, widgets: true });
        }, true);
        return;
      }
      if (type === 'loan') {
        const payload = {
          personName,
          direction: loanDirection,
          accountId,
          givenAmount: amount,
          note: note.trim(),
          tags: selectedTagIds,
          date,
        };
        closeScreenAndExecute(() => {
          clearSplitRows();
          persistLastAccountEagerly();
          runInBackground(() => addLoan(payload), { tx: true, widgets: true });
        }, true);
        return;
      }
      if (isEditing && editId && isTransferEdit) {
        const txId = editId;
        const payload = {
          amount,
          accountId,
          linkedAccountId,
          date,
          note: note.trim(),
          payee: payee.trim() || undefined,
        };
        closeScreenAndExecute(() => {
          clearSplitRows();
          persistLastAccountEagerly();
          runInBackground(() => updateTransferTransaction(txId, payload), { tx: true, widgets: true });
        }, true);
        return;
      }
      // For in/out add + edit, the store's optimistic patch runs SYNCHRONOUSLY
      // (balance delta + transaction insert) before its first await. We apply it
      // BEFORE navigating so the screen underneath the modal (home/account/activity/
      // etc.) re-renders with correct values while still occluded — when the modal
      // slides away it's already up to date, with no visible "tick". The DB write
      // and reni widget refresh continue in the background.
      const runMutation = isEditing && editId
        ? () => updateTransaction(editId, data)
        : () => addTransaction(data);

      if (fromWidget === '1') {
        if (showDatePicker) setShowDatePicker(false);
        clearSplitRows();
        persistLastAccountEagerly();
        try {
          await runMutation();
          try {
            await updateAllReniWidgets();
          } catch (widgetErr) {
            console.warn('Failed to update widgets:', widgetErr);
          }
          // Pop the modal off the stack BEFORE exiting so the restored
          // navigation state on next launch doesn't drop us back on this form.
          if (router.canGoBack()) router.back();
          BackHandler.exitApp();
        } catch (e) {
          showAlert('Error', String(e));
          isSubmittingRef.current = false;
        }
        return;
      }

      const applyMutationOptimistically = () => {
        if (showDatePicker) setShowDatePicker(false);
        clearSplitRows();
        persistLastAccountEagerly();
        runMutation()
          .then(() => updateAllReniWidgets().catch(() => undefined))
          .catch((e) => showAlert('Error', String(e)));
      };
      closeScreenAndExecute(applyMutationOptimistically, true);
    } catch (e) {
      showAlert('Error', String(e));
      isSubmittingRef.current = false;
    }
  };

  const handleDelete = () => {
    const isLoanOrigin = type === 'loan' && loanEditMode === 'origin' && editingLoanId;
    const isDepositEdit = isEditingDeposit && editDepositId;
    showConfirm({
      title: isLoanOrigin ? 'Delete Loan' : isDepositEdit ? 'Delete Deposit' : 'Delete Transaction',
      message: isLoanOrigin
        ? 'This will delete the loan and all its recorded entries. This cannot be undone.'
        : isDepositEdit
          ? 'This will delete the deposit and its linked activity entries. This cannot be undone.'
        : 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => {
        // Close first, then run the delete in the background. The optimistic
        // remove() in useTransactionsStore makes plain in/out deletes instant;
        // loans/deposits/splits cascade in the store but a redundant DB-truth
        // refresh follows for safety.
        const work = isLoanOrigin
          ? () => removeLoan(editingLoanId!)
          : isDepositEdit
            ? () => removeDeposit(editDepositId!)
            : editId
              ? () => removeTransaction(editId)
              : async () => undefined;
        const runAfterDeleteClose = () => {
          setEditingSplitGroupId('');
          clearSplitRows();
          (async () => {
            try {
              await work();
              await refreshAccounts();
              await reloadTransactions();
              updateAllReniWidgets().catch(() => undefined);
            } catch (e) {
              showAlert('Error', String(e));
            }
          })();
        };
        closeScreenAndExecute(runAfterDeleteClose, true);
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

  if (isClosing) {
    return <View style={{ flex: 1, backgroundColor: palette.background }} />;
  }

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
            paddingHorizontal: FORM_GUTTER,
            paddingTop: 8,
            paddingBottom: 12
          }}
        >
          <TouchableOpacity delayPressIn={0} onPress={closeScreen} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: SCREEN_HEADER.iconTitleGap }}>
            <AppIcon name="x" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text }}>
            {screenTitle}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets, 132) + keyboardHeight }}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={Keyboard.dismiss} style={{ paddingBottom: 20 }}>
          <View style={{ paddingTop: 2, paddingBottom: 12 }}>
            <ScrollView
              ref={typeScrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: FORM_GUTTER, gap: 8 }}
              keyboardShouldPersistTaps="handled"
            >
              {(Object.keys(TYPE_CONFIG) as Array<TransactionType | 'deposit'>).map((t) => (
                <TouchableOpacity delayPressIn={0}
                  key={t}
                  onPress={() => {
                    if (lockTypeSelection && t !== type) return;
                    setType(t);
                    setAttemptedSubmit(false);
                  }}
                  disabled={lockTypeSelection && t !== type}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 18,
                    borderRadius: HOME_RADIUS.card,
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
                      fontWeight: FONT_WEIGHT.medium,
                      color: type === t ? TYPE_CONFIG[t].color : palette.textMuted
                    }}
                  >
                    {TYPE_CONFIG[t].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {type !== 'deposit' || !isClosingDeposit ? (
            <View style={{ paddingHorizontal: FORM_GUTTER, paddingTop: 10, paddingBottom: 10, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center', position: 'relative' }}>
                <TextInput
                  value={amountStr}
                  onChangeText={(value: string) => setAmountStr(formatIndianNumberStr(sanitizeDecimalInput(value)))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={palette.textSoft}
                  cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                  style={{
                    fontSize: 36,
                    fontWeight: '500',
                    color: amountInputColor,
                    letterSpacing: -0.5,
                    textAlign: 'center',
                    minWidth: 100,
                    paddingTop: 0,
                    paddingBottom: 2,
                    lineHeight: 38,
                  }}
                  autoFocus={!isEditing}
                />
              </View>
            </View>
          ) : null}

          {/* Centered Date & Time Clickable Text and Calculator */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: FORM_GUTTER,
            position: 'relative',
            marginTop: 2,
            marginBottom: 0,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, justifyContent: 'center' }}>
              <TouchableOpacity onPress={openDate} style={{ justifyContent: 'center', height: '100%' }}>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.textSecondary }}>
                  {dateFormatted}
                </Text>
              </TouchableOpacity>
              <View style={{ justifyContent: 'center', height: '100%' }}>
                <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted }}>|</Text>
              </View>
              <TouchableOpacity onPress={openTime} style={{ justifyContent: 'center', height: '100%' }}>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.textSecondary }}>
                  {timeFormatted}
                </Text>
              </TouchableOpacity>
            </View>

            {type !== 'deposit' || !isClosingDeposit ? (
              <TouchableOpacity
                onPress={handleOpenCalculator}
                activeOpacity={0.7}
                style={{
                  position: 'absolute',
                  right: FORM_GUTTER,
                  top: '50%',
                  marginTop: -22,
                  width: 44,
                  height: 44,
                  borderRadius: HOME_RADIUS.button,
                  backgroundColor: 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="calculator" size={22} color={palette.textSecondary} strokeWidth={1.9} />
              </TouchableOpacity>
            ) : null}
          </View>

          {type === 'in' || type === 'out' ? (
            <SectionCard palette={palette} horizontalInset={SCREEN_GUTTER}>
              {/* Field 1: Account */}
              <View style={{ paddingVertical: 10, paddingHorizontal: FORM_GUTTER }}>
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setAccountSheetMode('account'))}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    minHeight: 40,
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: attemptedSubmit && !accountId ? palette.negative : palette.textSecondary, width: 80 }}>
                    Account
                  </Text>
                  {accountId && accounts.find(a => a.id === accountId) ? (() => {
                    const acc = accounts.find(a => a.id === accountId)!;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <AccountTypeBadge account={acc} palette={palette} />
                        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                          <Text style={{ fontSize: HOME_TEXT.body, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                            {formatAccountDisplayName(acc.name, acc.accountNumber)}
                          </Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, fontWeight: FONT_WEIGHT.regular, marginTop: 2 }}>
                            {formatSignedCurrency(acc.balance, displaySym)}
                          </Text>
                        </View>
                      </View>
                    );
                  })() : (
                    <Text style={{ fontSize: HOME_TEXT.body, color: attemptedSubmit && !accountId ? palette.negative : palette.textMuted, flex: 1 }}>
                      Select Account
                    </Text>
                  )}
                  <AppChevron direction="right" size={16} tone="secondary" color={attemptedSubmit && !accountId ? palette.negative : undefined} palette={palette} />
                </TouchableOpacity>
              </View>

              <CardDivider palette={palette} />

              {/* Field 2: Category & Split */}
              <View style={{ paddingVertical: 10, paddingHorizontal: FORM_GUTTER }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: attemptedSubmit && !categoryId && usableSplitRows.length === 0 ? palette.negative : palette.textSecondary }}>
                    Category
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      runAfterKeyboardDismiss(() =>
                        router.push({ pathname: '/modals/split-transaction', params: { type } })
                      )
                    }
                    hitSlop={{ top: 12, bottom: 12, left: 20, right: 10 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    activeOpacity={0.75}
                  >
                    <AppIcon name="layers" size={14} color={palette.brand} />
                    <Text appWeight="medium" style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.medium, color: palette.brand }}>
                      Split
                    </Text>
                  </TouchableOpacity>
                </View>
                {usableSplitRows.length > 0 ? (
                  <TouchableOpacity
                    onPress={() =>
                      runAfterKeyboardDismiss(() =>
                        router.push({ pathname: '/modals/split-transaction', params: { type } })
                      )
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 8,
                      minHeight: 40,
                      gap: 8
                    }}
                  >
                    <AppIcon name="layers" size={16} color={palette.textSecondary} />
                    <Text style={{ fontSize: HOME_TEXT.body, color: palette.text, fontWeight: FONT_WEIGHT.medium, flex: 1 }}>
                      Split ({usableSplitRows.length} items)
                    </Text>
                    <AppChevron direction="right" size={16} tone="secondary" palette={palette} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={openCategorySheet}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 8,
                      minHeight: 40,
                      gap: 8
                    }}
                  >
                    {categoryId && getCategoryDisplayParts(categories, categoryId).fullName !== 'Select Category' ? (
                      <>
                        {isEmojiIcon(getCategoryDisplayParts(categories, categoryId).icon) ? (
                          <Text style={{ fontSize: HOME_LAYOUT.listIconInnerSize }}>{getCategoryDisplayParts(categories, categoryId).icon}</Text>
                        ) : (
                          <AppIcon name={getCategoryDisplayParts(categories, categoryId).icon as any} size={HOME_LAYOUT.listIconInnerSize} color={palette.brand} />
                        )}
                        <Text style={{ fontSize: HOME_TEXT.body, color: palette.text, fontWeight: FONT_WEIGHT.medium, flex: 1 }} numberOfLines={1}>
                          {getCategoryDisplayParts(categories, categoryId).fullName}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={{ fontSize: HOME_TEXT.body, color: attemptedSubmit && !categoryId ? palette.negative : palette.textMuted, flex: 1 }}>
                          Select Category
                        </Text>
                      </>
                    )}
                    <AppChevron direction="right" size={16} tone="secondary" color={attemptedSubmit && !categoryId ? palette.negative : undefined} palette={palette} />
                  </TouchableOpacity>
                )}
              </View>

              <CardDivider palette={palette} />

              {/* Field 3: Payee autocomplete suggestions (only on typing and active focus) */}
              <View style={{ paddingVertical: 10, paddingHorizontal: FORM_GUTTER }}>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginBottom: 6 }}>
                  Payee
                </Text>
                <TextInput
                  value={payee}
                  onChangeText={(text: string) => setPayee(text)}
                  placeholder=""
                  placeholderTextColor={palette.textSoft}
                  cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                  onFocus={() => setIsPayeeFocused(true)}
                  onBlur={() => {
                    setTimeout(() => setIsPayeeFocused(false), 200);
                  }}
                  style={{
                    fontSize: HOME_TEXT.bodyLarge,
                    color: palette.text,
                    paddingVertical: 8,
                    minHeight: 40,
                  }}
                />
                {isPayeeFocused && payee.trim() !== '' && payeeSuggestions.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                      keyboardShouldPersistTaps="handled"
                    >
                      {payeeSuggestions.map((suggestion) => (
                        <TouchableOpacity
                          key={suggestion}
                          onPress={() => setPayee(suggestion)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: HOME_RADIUS.chip,
                            backgroundColor: palette.isDark ? palette.layers.surfaceSunken : palette.inputBg,
                            borderWidth: 1,
                            borderColor: palette.divider,
                          }}
                        >
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text }}>
                            {suggestion}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <CardDivider palette={palette} />

              {/* Field 4: Receipts */}
              <ReceiptSection
                palette={palette}
                receiptImageUris={receiptImageUris}
                onAdd={openReceiptPicker}
                onPreview={openReceiptPreview}
                onRemove={removeReceiptAtIndex}
              />

              <CardDivider palette={palette} />

              {/* Field 5: Tags */}
              <View style={{ paddingVertical: 14, paddingHorizontal: FORM_GUTTER }}>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginBottom: 8 }}>
                  Tags
                </Text>
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setShowTagSheet(true))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 4,
                    gap: 8,
                    minHeight: 32,
                  }}
                >
                  <AppIcon name="tag" size={16} color={palette.textMuted} />
                  {selectedTagIds.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                      {selectedTagIds.map((tagId) => {
                        const tag = tags.find(t => t.id === tagId);
                        if (!tag) return null;
                        return (
                          <TagBadge
                            key={tag.id}
                            name={tag.name}
                            color={tag.color}
                            palette={palette}
                          />
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted, fontWeight: FONT_WEIGHT.medium, flex: 1 }} numberOfLines={1}>
                      Select tags
                    </Text>
                  )}
                  <AppChevron direction="right" size={16} tone="secondary" palette={palette} />
                </TouchableOpacity>
              </View>

              <CardDivider palette={palette} />

              <InlineComboBox
                label="Notes"
                value={note}
                onChange={setNote}
                suggestions={noteSuggestions}
                multiline
                palette={palette}
                onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250)}
              />
            </SectionCard>
          ) : type === 'transfer' ? (
            <SectionCard palette={palette} horizontalInset={SCREEN_GUTTER}>
              {/* From Account selection */}
              <View style={{ paddingVertical: 10, paddingHorizontal: FORM_GUTTER }}>
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setAccountSheetMode('from'))}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    minHeight: 40,
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: attemptedSubmit && !accountId ? palette.negative : palette.textSecondary, width: 100 }}>
                    From Account
                  </Text>
                  {accountId && accounts.find(a => a.id === accountId) ? (() => {
                    const acc = accounts.find(a => a.id === accountId)!;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <AccountTypeBadge account={acc} palette={palette} />
                        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                          <Text style={{ fontSize: HOME_TEXT.body, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                            {formatAccountDisplayName(acc.name, acc.accountNumber)}
                          </Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, fontWeight: FONT_WEIGHT.regular, marginTop: 2 }}>
                            {formatSignedCurrency(acc.balance, displaySym)}
                          </Text>
                        </View>
                      </View>
                    );
                  })() : (
                    <Text style={{ fontSize: HOME_TEXT.body, color: attemptedSubmit && !accountId ? palette.negative : palette.textMuted, flex: 1 }}>
                      Select Account
                    </Text>
                  )}
                  <AppChevron direction="right" size={16} tone="secondary" color={attemptedSubmit && !accountId ? palette.negative : undefined} palette={palette} />
                </TouchableOpacity>
              </View>

              <CardDivider palette={palette} />
              <View style={{ alignItems: 'center', marginVertical: -10, zIndex: 10 }}>
                <TouchableOpacity delayPressIn={0}
                  onPress={() => {
                    const tmp = accountId;
                    setAccountId(linkedAccountId);
                    setLinkedAccountId(tmp);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: palette.isDark ? palette.layers.surfaceSunken : palette.background,
                    borderWidth: 1,
                    borderColor: palette.divider,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="repeat" size={15} color={palette.brand} />
                </TouchableOpacity>
              </View>
              <CardDivider palette={palette} />

              {/* To Account selection */}
              <View style={{ paddingVertical: 10, paddingHorizontal: FORM_GUTTER }}>
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setAccountSheetMode('to'))}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    minHeight: 40,
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: attemptedSubmit && !linkedAccountId ? palette.negative : palette.textSecondary, width: 100 }}>
                    To Account
                  </Text>
                  {linkedAccountId && accounts.find(a => a.id === linkedAccountId) ? (() => {
                    const acc = accounts.find(a => a.id === linkedAccountId)!;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <AccountTypeBadge account={acc} palette={palette} />
                        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                          <Text style={{ fontSize: HOME_TEXT.body, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                            {formatAccountDisplayName(acc.name, acc.accountNumber)}
                          </Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, fontWeight: FONT_WEIGHT.regular, marginTop: 2 }}>
                            {formatSignedCurrency(acc.balance, displaySym)}
                          </Text>
                        </View>
                      </View>
                    );
                  })() : (
                    <Text style={{ fontSize: HOME_TEXT.body, color: attemptedSubmit && !linkedAccountId ? palette.negative : palette.textMuted, flex: 1 }}>
                      Select Account
                    </Text>
                  )}
                  <AppChevron direction="right" size={16} tone="secondary" color={attemptedSubmit && !linkedAccountId ? palette.negative : undefined} palette={palette} />
                </TouchableOpacity>
              </View>

              {accountId && linkedAccountId && accountId === linkedAccountId ? (
                <>
                  <CardDivider palette={palette} />
                  <View style={{ paddingHorizontal: FORM_GUTTER, paddingVertical: 10 }}>
                    <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>
                      Heads up: Same account transfer.
                    </Text>
                  </View>
                </>
              ) : null}

              <CardDivider palette={palette} />

              <InlineComboBox
                label="Notes"
                value={note}
                onChange={setNote}
                suggestions={noteSuggestions}
                multiline
                palette={palette}
                onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250)}
              />
            </SectionCard>
          ) : type === 'loan' ? (
            <SectionCard palette={palette} horizontalInset={SCREEN_GUTTER}>
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
                    <View style={{ paddingHorizontal: FORM_GUTTER, paddingTop: 2, paddingBottom: 8 }}>
                      <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>
                        Loan outstanding balance will not be affected
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={{ marginTop: 8 }}>
                    <FieldRow label="Direction" palette={palette} noBorder>
                      <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
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
                                borderRadius: HOME_RADIUS.pill,
                                alignItems: 'center',
                                borderWidth: 1.5,
                                borderColor: active ? palette.brand : palette.border,
                                backgroundColor: active ? palette.brandSoft : palette.surface,
                                opacity: lockLoanDirection && !active ? 0.5 : 1
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: HOME_TEXT.bodySmall,
                                  fontWeight: FONT_WEIGHT.bold,
                                  color: active ? palette.brand : palette.textMuted
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

                  <CardDivider palette={palette} />

                  {isLoanAddMore ? (
                    <View style={{ paddingVertical: 10, paddingHorizontal: FORM_GUTTER }}>
                      <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginBottom: 6 }}>
                        Person
                      </Text>
                      <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, paddingVertical: 8 }}>
                        {personName}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ paddingVertical: 10, paddingHorizontal: FORM_GUTTER }}>
                      <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: attemptedSubmit && personName.trim().length === 0 ? palette.negative : palette.textSecondary, marginBottom: 6 }}>
                        Person
                      </Text>
                      <TextInput
                        value={personName}
                        onChangeText={setPersonName}
                        placeholder=""
                        placeholderTextColor={palette.textSoft}
                        cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                        onFocus={() => setIsPersonFocused(true)}
                        onBlur={() => {
                          setTimeout(() => setIsPersonFocused(false), 200);
                        }}
                        autoFocus={type === 'loan' && !isEditing && !isLoanAddMore}
                        style={{
                          fontSize: HOME_TEXT.bodyLarge,
                          color: palette.text,
                          paddingVertical: 8,
                          minHeight: 40,
                        }}
                      />
                      {isPersonFocused && personName.trim() !== '' && (
                        <View style={{ marginTop: 10 }}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 8 }}
                            keyboardShouldPersistTaps="handled"
                          >
                            {!exactPersonMatch && (
                              <TouchableOpacity
                                onPress={() => setPersonName(personName.trim())}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 6,
                                  borderRadius: HOME_RADIUS.chip,
                                  backgroundColor: palette.brandSoft,
                                  borderWidth: 1,
                                  borderColor: `${palette.brand}55`,
                                }}
                              >
                                <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.brand, fontWeight: FONT_WEIGHT.bold }}>
                                  + Add "{personName.trim()}"
                                </Text>
                              </TouchableOpacity>
                            )}
                            {filteredPersonSuggestions.map((suggestion) => (
                              <TouchableOpacity
                                key={suggestion}
                                onPress={() => setPersonName(suggestion)}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 6,
                                  borderRadius: HOME_RADIUS.chip,
                                  backgroundColor: palette.isDark ? palette.layers.surfaceSunken : palette.inputBg,
                                  borderWidth: 1,
                                  borderColor: palette.divider,
                                }}
                              >
                                <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text }}>
                                  {suggestion}
                                </Text>
                              </TouchableOpacity>

                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}

              <CardDivider palette={palette} />

              {/* Account selection */}
              <View style={{ paddingVertical: 10, paddingHorizontal: FORM_GUTTER }}>
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setAccountSheetMode('account'))}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    minHeight: 40,
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: attemptedSubmit && !accountId ? palette.negative : palette.textSecondary, width: 80 }}>
                    Account
                  </Text>
                  {accountId && accounts.find(a => a.id === accountId) ? (() => {
                    const acc = accounts.find(a => a.id === accountId)!;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <AccountTypeBadge account={acc} palette={palette} />
                        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                          <Text style={{ fontSize: HOME_TEXT.body, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                            {formatAccountDisplayName(acc.name, acc.accountNumber)}
                          </Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, fontWeight: FONT_WEIGHT.regular, marginTop: 2 }}>
                            {formatSignedCurrency(acc.balance, displaySym)}
                          </Text>
                        </View>
                      </View>
                    );
                  })() : (
                    <Text style={{ fontSize: HOME_TEXT.body, color: attemptedSubmit && !accountId ? palette.negative : palette.textMuted, flex: 1 }}>
                      Select Account
                    </Text>
                  )}
                  <AppChevron direction="right" size={16} tone="secondary" color={attemptedSubmit && !accountId ? palette.negative : undefined} palette={palette} />
                </TouchableOpacity>
              </View>

              <CardDivider palette={palette} />

              <InlineComboBox
                label="Notes"
                value={note}
                onChange={setNote}
                suggestions={noteSuggestions}
                multiline
                palette={palette}
                onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250)}
              />
            </SectionCard>
          ) : type === 'deposit' ? (
            <SectionCard palette={palette} horizontalInset={SCREEN_GUTTER}>
              {/* Source Account selection */}
              <View style={{ paddingVertical: 10, paddingHorizontal: FORM_GUTTER }}>
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setAccountSheetMode('account'))}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    minHeight: 40,
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: attemptedSubmit && !accountId ? palette.negative : palette.textSecondary, width: 110 }}>
                    Source Account
                  </Text>
                  {accountId && accounts.find(a => a.id === accountId) ? (() => {
                    const acc = accounts.find(a => a.id === accountId)!;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <AccountTypeBadge account={acc} palette={palette} />
                        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                          <Text style={{ fontSize: HOME_TEXT.body, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                            {formatAccountDisplayName(acc.name, acc.accountNumber)}
                          </Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, fontWeight: FONT_WEIGHT.regular, marginTop: 2 }}>
                            {formatSignedCurrency(acc.balance, displaySym)}
                          </Text>
                        </View>
                      </View>
                    );
                  })() : (
                    <Text style={{ fontSize: HOME_TEXT.body, color: attemptedSubmit && !accountId ? palette.negative : palette.textMuted, flex: 1 }}>
                      Select Account
                    </Text>
                  )}
                  <AppChevron direction="right" size={16} tone="secondary" color={attemptedSubmit && !accountId ? palette.negative : undefined} palette={palette} />
                </TouchableOpacity>
              </View>

              <CardDivider palette={palette} />

              {isClosingDeposit ? (
                <>
                  <View style={{ paddingVertical: 14, paddingHorizontal: FORM_GUTTER }}>
                    <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: attemptedSubmit && closePrincipal <= 0 ? palette.negative : palette.textSecondary, marginBottom: 8 }}>
                      Principal
                    </Text>
                    <TextInput
                      value={closePrincipalStr}
                      onChangeText={setClosePrincipalStr}
                      placeholder=""
                      placeholderTextColor={palette.textSoft}
                      cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                      keyboardType="decimal-pad"
                      autoFocus={focusField !== 'interest'}
                      style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, paddingVertical: 6, minHeight: 36 }}
                    />
                  </View>
                  <CardDivider palette={palette} />
                  <View style={{ paddingVertical: 14, paddingHorizontal: FORM_GUTTER }}>
                    <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginBottom: 8 }}>
                      Interest
                    </Text>
                    <TextInput
                      value={closeInterestStr}
                      onChangeText={setCloseInterestStr}
                      placeholder=""
                      placeholderTextColor={palette.textSoft}
                      cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                      keyboardType="decimal-pad"
                      autoFocus={focusField === 'interest'}
                      style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, paddingVertical: 6, minHeight: 36 }}
                    />
                  </View>
                  {(closePrincipal > 0 || closeInterest > 0) && (
                    <View style={{ paddingHorizontal: FORM_GUTTER, paddingTop: 2, paddingBottom: 10, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                      <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: palette.textSecondary }}>Total Received</Text>
                      <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
                        {displaySym}{formatCurrency(closePrincipal + closeInterest, '')}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={{ paddingVertical: 14, paddingHorizontal: FORM_GUTTER }}>
                    <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: attemptedSubmit && depositName.trim().length === 0 ? palette.negative : palette.textSecondary, marginBottom: 8 }}>
                      Deposit Name
                    </Text>
                    <TextInput
                      value={depositName}
                      onChangeText={setDepositName}
                      placeholder=""
                      placeholderTextColor={palette.textSoft}
                      cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                      style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, paddingVertical: 6, minHeight: 36 }}
                    />
                  </View>
                  <CardDivider palette={palette} />
                  <View style={{ paddingVertical: 14, paddingHorizontal: FORM_GUTTER }}>
                    <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginBottom: 8 }}>
                      Bank
                    </Text>
                    <TextInput
                      value={depositBank}
                      onChangeText={setDepositBank}
                      placeholder=""
                      placeholderTextColor={palette.textSoft}
                      cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                      style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, paddingVertical: 6, minHeight: 36 }}
                    />
                  </View>
                  <CardDivider palette={palette} />
                  <View style={{ paddingVertical: 14, paddingHorizontal: FORM_GUTTER }}>
                    <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginBottom: 8 }}>
                      Tenure <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>months</Text>
                    </Text>
                    <TextInput
                      value={depositTenure}
                      onChangeText={setDepositTenure}
                      placeholder=""
                      placeholderTextColor={palette.textSoft}
                      cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                      keyboardType="number-pad"
                      style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, paddingVertical: 6, minHeight: 36 }}
                    />
                  </View>
                  <CardDivider palette={palette} />
                  <View style={{ paddingVertical: 14, paddingHorizontal: FORM_GUTTER }}>
                    <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginBottom: 8 }}>
                      Interest % <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>p.a.</Text>
                    </Text>
                    <TextInput
                      value={depositInterest}
                      onChangeText={setDepositInterest}
                      placeholder=""
                      placeholderTextColor={palette.textSoft}
                      cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                      keyboardType="decimal-pad"
                      style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, paddingVertical: 6, minHeight: 36 }}
                    />
                  </View>
                  <CardDivider palette={palette} />
                  <View style={{ paddingVertical: 14, paddingHorizontal: FORM_GUTTER }}>
                    <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginBottom: 8 }}>
                      Maturity Value
                    </Text>
                    <TextInput
                      value={depositMaturityStr}
                      onChangeText={(v) => setDepositMaturityStr(formatIndianNumberStr(parseFormattedNumber(v)) || v)}
                      placeholder=""
                      placeholderTextColor={palette.textSoft}
                      cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                      keyboardType="decimal-pad"
                      style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, paddingVertical: 6, minHeight: 36 }}
                    />
                  </View>
                </>
              )}

              <CardDivider palette={palette} />

              <InlineComboBox
                label="Notes"
                value={note}
                onChange={setNote}
                suggestions={[]}
                multiline
                palette={palette}
                onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250)}
              />
            </SectionCard>
          ) : null}


        </Pressable>
      </ScrollView>

      <FixedBottomActions palette={palette}>
        {attemptedSubmit && getValidationErrorMessage() ? (
          <Animated.View style={[shakeStyle, { alignItems: 'center', marginBottom: 8, paddingHorizontal: FORM_GUTTER }]}>
            <Text style={{ fontSize: HOME_TEXT.bodySmall + 1, color: palette.negative, fontWeight: FONT_WEIGHT.semibold, textAlign: 'center' }}>
              {getValidationErrorMessage()}
            </Text>
          </Animated.View>
        ) : null}
        {isEditing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TextButton
                label="Delete"
                onPress={handleDelete}
                palette={palette}
                tone="danger"
                style={{
                  minHeight: PRIMARY_ACTION.height,
                  justifyContent: 'center',
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Animated.View style={[shakeStyle, { width: '100%' }]}>
                <FilledButton
                  label="Save"
                  onPress={handleSubmit}
                  disabled={false}
                  palette={palette}
                  tone="brand"
                  style={{
                    backgroundColor: actionButtonColor,
                  }}
                />
              </Animated.View>
            </View>
          </View>
        ) : (
          <Animated.View style={[shakeStyle, { width: '100%' }]}>
            <FilledButton
              label={actionLabel}
              onPress={handleSubmit}
              disabled={false}
              palette={palette}
              tone="brand"
              style={{
                backgroundColor: actionButtonColor,
              }}
            />
          </Animated.View>
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

      {accountSheetMode !== 'none' ? (
        <BottomSheet
          title={
            accountSheetMode === 'account'
              ? "Select Account"
              : accountSheetMode === 'from'
                ? "Transfer From"
                : "Transfer To"
          }
          palette={palette}
          onClose={() => setAccountSheetMode('none')}
          fixedHeightRatio={0.80}
          headerRight={
            <TouchableOpacity delayPressIn={0} onPress={() => { setAccountSheetMode('none'); router.push('/settings/accounts'); }} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.brand }}>Manage</Text>
            </TouchableOpacity>
          }
        >
          {accounts.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, paddingVertical: 12, paddingHorizontal: FORM_GUTTER }}>No accounts available</Text>
          ) : (
            accounts.map((account, index) => {
              const isSelected = accountSheetMode === 'to' ? linkedAccountId === account.id : accountId === account.id;
              return (
                <ChoiceRow
                  key={account.id}
                  title={formatAccountDisplayName(account?.name ?? '', account?.accountNumber)}
                  subtitle={`${getAccountTypeLabel(account.type)} · ${formatSignedCurrency(account.balance, displaySym, { zeroPlaceholder: '0' })}`}
                  selected={isSelected}
                  palette={palette}
                  leftElement={<AccountTypeBadge account={account} palette={palette} />}
                  onPress={() => {
                    if (accountSheetMode === 'to') {
                      setLinkedAccountId(account.id);
                    } else {
                      setAccountId(account.id);
                    }
                    setAccountSheetMode('none');
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
          transactionType={type === 'deposit' ? undefined : type}
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
          maxHeightRatio={0.80}
          footer={
            <View
              style={{
                paddingHorizontal: FORM_GUTTER,
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
                  borderRadius: HOME_RADIUS.cardSm,
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
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, paddingVertical: 12, paddingHorizontal: FORM_GUTTER }}>No tags created yet</Text>
          ) : (
            tags.map((tag, index) => {
              return (
                <ChoiceRow
                  key={tag.id}
                  title={tag.name}
                  selected={selectedTagIds.includes(tag.id)}
                  palette={palette}
                  leftElement={<View style={{ width: 12, height: 12, borderRadius: HOME_RADIUS.xs ?? 3, backgroundColor: tag.color }} />}
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
        brandColor={palette.brand}
        brandSoft={palette.brandSoft}
        brandOnColor={palette.onBrand}
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
            <View style={{ width: '100%', backgroundColor: palette.card, borderRadius: HOME_RADIUS.large, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }}>
              <View style={{ padding: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: palette.border }}>
                <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, fontWeight: FONT_WEIGHT.bold, marginBottom: 6 }}>Receipt image</Text>
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
                <View style={{ width: 34, height: 34, borderRadius: HOME_RADIUS.chip, backgroundColor: palette.inputBg, alignItems: 'center', justifyContent: 'center' }}>
                  <AppIcon name="camera" size={20} color={palette.textSecondary} />
                </View>
                <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, fontWeight: FONT_WEIGHT.semibold }}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                delayPressIn={0}
                onPress={() => {
                  setShowReceiptSheet(false);
                  void chooseReceiptImage();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, backgroundColor: palette.surface, gap: 12 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: HOME_RADIUS.chip, backgroundColor: palette.inputBg, alignItems: 'center', justifyContent: 'center' }}>
                  <AppIcon name="image" size={20} color={palette.textSecondary} />
                </View>
                <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, fontWeight: FONT_WEIGHT.semibold }}>Choose Photo</Text>
              </TouchableOpacity>
              <View style={{ padding: 16, backgroundColor: palette.surface }}>
                <TouchableOpacity
                  delayPressIn={0}
                  onPress={() => setShowReceiptSheet(false)}
                  style={{ paddingVertical: 14, alignItems: 'center', backgroundColor: palette.inputBg, borderRadius: HOME_RADIUS.chip }}
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
                top: insets.top + 8,
                left: 18,
                zIndex: 2,
                width: 44,
                height: 44,
                borderRadius: HOME_RADIUS.card,
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
                        borderRadius: HOME_RADIUS.full,
                        backgroundColor: 'rgba(0,0,0,0.62)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.28)',
                      }}
                    >
                      <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.bold, color: '#FFFFFF' }}>
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
    <View style={{ paddingHorizontal: FORM_GUTTER, paddingVertical: 10 }}>
      <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginBottom: 6 }}>
        Receipts
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Fixed Camera Button on the Left */}
        <TouchableOpacity
          delayPressIn={0}
          onPress={onAdd}
          style={{
            width: 40,
            height: 40,
            borderRadius: HOME_RADIUS.button,
            borderWidth: 1.5,
            borderColor: palette.borderSoft,
            backgroundColor: 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppIcon name="camera" size={18} color={palette.brand} />
        </TouchableOpacity>

        {/* Scrollable attached thumbnails to the right */}
        {receiptImageUris.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
            {receiptImageUris.map((uri, index) => (
              <View key={`${uri}-${index}`} style={{ width: 40, height: 40 }}>
                <TouchableOpacity
                  delayPressIn={0}
                  onPress={() => onPreview(index)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: HOME_RADIUS.button,
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
                    top: -3,
                    right: -3,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: 'rgba(0,0,0,0.58)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="x" size={10} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
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


function getCategoryDisplayParts(
  categories: Category[],
  categoryId: string,
): { name: string; parentName?: string; fullName: string; icon: string } {
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return { name: 'Select Category', fullName: 'Select Category', icon: 'tag' };
  if (!category.parentId) return { name: category.name, fullName: category.name, icon: category.icon || 'tag' };
  const parent = categories.find((item) => item.id === category.parentId);
  const parentName = parent?.name ?? 'Category';
  return {
    name: category.name,
    parentName,
    fullName: `${parentName} › ${category.name}`,
    icon: parent?.icon || category.icon || 'tag',
  };
}
