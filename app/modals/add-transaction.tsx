import { Text } from '@/components/ui/AppText';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
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
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { ChoiceRow, FixedBottomActions } from '../../components/settings-ui';
import { ActionChip, FilledButton, TextButton } from '../../components/ui/AppButton';
import { HeaderMoreButton } from '../../components/ui/ScreenHeader';
import { ActionStrip } from '../../components/ui/ActionStrip';
import { AppChevron } from '../../components/ui/AppChevron';
import { AppSwitch } from '../../components/ui/AppSwitch';
import { AppIcon } from '../../components/ui/AppIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { CategoryPickerSheet } from '../../components/ui/CategoryPickerSheet';
import { DateTimePickerPopup } from '../../components/ui/DateTimePickerPopup';
import { InlineComboBox } from '../../components/ui/InlineComboBox';
import { PressableScale } from '../../components/ui/PressableScale';
import { getScrollableBottomPadding } from '../../components/ui/safeBottom';
import { TagBadge } from '../../components/ui/TagBadge';
import {
  sanitizeDecimalInput
} from '../../components/ui/transaction-form-primitives';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { addMonthsSafe, APP_LOCALE, formatDate, toLocalMonthStartISO } from '../../lib/dateUtils';
import {
  formatCurrency,
  formatIndianNumberStr,
  formatSignedCurrency,
  getLoanSettlementLabel,
  getLoanTransactionKind,
  getLoanTransactionUserNote,
  mergeLoanTransactionNote,
  parseFormattedNumber
} from '../../lib/derived';
import { FONT_WEIGHT } from '../../lib/design';
import { FORM_TOKENS, HOME_RADIUS, HOME_TEXT, PRIMARY_ACTION, SCREEN_HEADER } from '../../lib/layoutTokens';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../../lib/settings-shared';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { isEmojiIcon } from '../../lib/ui-format';
import { runAfterKeyboardDismiss } from '../../lib/ui-utils';
import { STRINGS } from '../../lib/strings';
import { getLoanById } from '../../services/loans';
import { createSplitTransactionGroup, createTransaction, deleteTransaction, getRecentNotes, getRecentPayees, getTransactionById, getTransactionsBySplitGroup, updateSplitTransactionGroup, updateTransferTransaction } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useFixedDepositsStore } from '../../stores/useFixedDepositsStore';
import { useGlobalNotice } from '../../stores/useGlobalNotice';
import { useLoansStore } from '../../stores/useLoansStore';
import { usePersonsStore } from '../../stores/usePersonsStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { updateAllReniWidgets } from '../../widgets/widgetTaskHandler';


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

function AnimatedFutureWarning({ visible, dateStr, palette }: { visible: boolean; dateStr: string; palette: AppThemePalette }) {
  const expansion = useSharedValue(visible ? 1 : 0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    expansion.value = withTiming(visible ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    height: expansion.value * contentHeight.value,
    opacity: expansion.value,
    overflow: 'hidden' as const,
  }));

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  }, [dateStr]);

  return (
    <Animated.View style={animStyle}>
      <View
        onLayout={(e) => {
          contentHeight.value = e.nativeEvent.layout.height;
        }}
        style={{ position: 'absolute', width: '100%' }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: FORM_TOKENS.gutter + 4,
            paddingTop: 8,
            paddingBottom: 4,
          }}
        >
          <AppIcon name="info" size={14} color={palette.textSecondary} />
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary }}>
            Future Date: Scheduled for {formattedDate}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function AnimatedBudgetPreview({
  visible,
  budget,
  palette,
  sym,
  amountStr,
}: {
  visible: boolean;
  budget: any;
  palette: AppThemePalette;
  sym: string;
  amountStr: string;
}) {
  const expansion = useSharedValue(visible ? 1 : 0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    expansion.value = withTiming(visible ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    height: expansion.value * contentHeight.value,
    opacity: expansion.value,
    overflow: 'hidden' as const,
  }));

  const limitText = budget ? formatCurrency(budget.amount, sym) : '';
  const remainingVal = budget ? budget.remaining : 0;
  const absRemaining = Math.abs(remainingVal);
  const formattedDiff = formatCurrency(absRemaining, sym);

  const isOver = budget ? budget.remaining < 0 : false;
  const percent = budget ? (budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0) : 0;

  const inputValue = useMemo(() => {
    if (!amountStr) return 0;
    const parsed = parseFormattedNumber(amountStr);
    return Number(parsed) || 0;
  }, [amountStr]);

  const projectedRemaining = remainingVal - inputValue;
  const isProjectedOver = projectedRemaining < 0;
  const absProjectedRemaining = Math.abs(projectedRemaining);
  const formattedProjectedDiff = formatCurrency(absProjectedRemaining, sym);

  const projectedSpent = budget ? budget.spent + inputValue : 0;
  const projectedPercent = budget && budget.amount > 0 ? (projectedSpent / budget.amount) * 100 : 0;

  const leftOrOver = isOver ? 'over' : 'left';
  const currentStatusColor = isOver
    ? palette.negative // red
    : percent > 85
      ? palette.warning // orange
      : palette.text; // normal text color

  const projectedStatusColor = isProjectedOver
    ? palette.negative // red
    : projectedPercent > 85
      ? palette.warning // orange
      : palette.text; // normal text color

  return (
    <Animated.View style={animStyle}>
      <View
        onLayout={(e) => {
          contentHeight.value = e.nativeEvent.layout.height;
        }}
        style={{ position: 'absolute', width: '100%' }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 4,
            paddingTop: 8,
            paddingBottom: 4,
            gap: 6,
          }}
        >
          <AppIcon name="info" size={14} color={palette.text} />
          {inputValue === 0 ? (
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text, fontWeight: FONT_WEIGHT.regular }}>
              <Text style={{ color: currentStatusColor }}>
                {formattedDiff}
              </Text>
              {` ${leftOrOver} of `}
              <Text>
                {limitText}
              </Text>
              {' budget'}
            </Text>
          ) : (
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text, fontWeight: FONT_WEIGHT.regular }}>
              {isOver ? (
                <>
                  <Text style={{ color: palette.negative }}>
                    {formattedDiff}
                  </Text>
                  {' over ('}
                  <Text style={{ color: palette.negative }}>
                    {formattedProjectedDiff}
                  </Text>
                  {' after this) of '}
                </>
              ) : isProjectedOver ? (
                <>
                  <Text style={{ color: currentStatusColor }}>
                    {formattedDiff}
                  </Text>
                  {' left ('}
                  <Text style={{ color: palette.negative }}>
                    will overspend by {formattedProjectedDiff}
                  </Text>
                  {') of '}
                </>
              ) : (
                <>
                  <Text style={{ color: currentStatusColor }}>
                    {formattedDiff}
                  </Text>
                  {' left ('}
                  <Text style={{ color: projectedStatusColor }}>
                    {formattedProjectedDiff}
                  </Text>
                  {' after this) of '}
                </>
              )}
              <Text>
                {limitText}
              </Text>
              {' budget'}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}




function FormSection({
  title,
  children,
  palette,
  rightElement,
  style,
}: {
  title: string;
  children: React.ReactNode;
  palette: AppThemePalette;
  rightElement?: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[{ marginHorizontal: FORM_TOKENS.gutter, marginTop: FORM_TOKENS.sectionGap }, style]}>
      {!!title && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text
            appWeight="medium"
            style={{
              fontSize: HOME_TEXT.caption,
              fontWeight: FONT_WEIGHT.bold,
              color: palette.textSecondary,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </Text>
          {rightElement}
        </View>
      )}
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: FORM_TOKENS.cardRadius,
          borderWidth: 1,
          borderColor: palette.borderSoft,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function FormDivider({ palette, indent = FORM_TOKENS.dividerIndent }: { palette: AppThemePalette; indent?: number }) {
  return <View style={{ height: 1, backgroundColor: palette.borderSoft, marginLeft: indent }} />;
}

/** Smoothly expands / collapses a suggestion chip strip (payee, person, etc.). */
function AnimatedSuggestionStrip({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const expansion = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  React.useEffect(() => {
    expansion.value = withTiming(visible ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    height: expansion.value * contentHeight.value,
    opacity: expansion.value,
    overflow: 'hidden' as const,
  }));

  return (
    <Animated.View style={animStyle}>
      <View
        onLayout={(e) => {
          contentHeight.value = e.nativeEvent.layout.height;
        }}
        style={{ position: 'absolute', width: '100%' }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

function AnimatedWarningBox({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const expansion = useSharedValue(visible ? 1 : 0);
  const contentHeight = useSharedValue(0);

  React.useEffect(() => {
    expansion.value = withTiming(visible ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    height: expansion.value * contentHeight.value,
    opacity: expansion.value,
    overflow: 'hidden' as const,
  }));

  return (
    <Animated.View style={animStyle}>
      <View
        onLayout={(e) => {
          contentHeight.value = e.nativeEvent.layout.height;
        }}
        style={{ position: 'absolute', width: '100%' }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

// We compute TYPE_CONFIG dynamically inside the component to use the derived palette

export default function AddTransactionModal() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const shakeOffset = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
  }));
  const swapRotation = useSharedValue(0);
  const swapAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swapRotation.value}deg` }]
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
  const [duplicateMode, setDuplicateMode] = useState(false);
  const isEditingDeposit = !!editDepositId && editDepositId !== '' && !duplicateMode;
  const isClosingDeposit = !!closeDepositId && closeDepositId !== '' && !isEditingDeposit;
  const isEditing = (!!editId || isEditingDeposit) && !duplicateMode;
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
  const [initialTx, setInitialTx] = useState<any | null>(null);
  const [initialDeposit, setInitialDeposit] = useState<any | null>(null);
  const [initialLoan, setInitialLoan] = useState<any | null>(null);

  const [showActions, setShowActions] = useState(false);
  const panelProgress = useSharedValue(0);
  const highlightProgress = useSharedValue(0);

  const toggleActions = () => {
    const nextShow = !showActions;
    setShowActions(nextShow);
    panelProgress.value = withTiming(nextShow ? 1 : 0, { duration: 220 });
  };
  const closePanel = () => {
    setShowActions(false);
    panelProgress.value = withTiming(0, { duration: 220 });
  };

  const actionsAnimatedStyle = useAnimatedStyle(() => ({
    height: panelProgress.value * 56,
    opacity: panelProgress.value,
  }));

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlightProgress.value,
  }));

  const handleCloneTransaction = () => {
    Keyboard.dismiss();
    setDuplicateMode(true);
    setEditingSplitGroupId('');
    setEditingLoanId('');
    setIsTransferEdit(false);
    originalSplitGroupIdRef.current = '';
    setReceiptImageUris([]);
    setDate(new Date().toISOString());
    closePanel();

    useGlobalNotice.getState().show(STRINGS.transactionCloned, 'info');

    // Trigger highlight sequence: fade in, hold, fade out
    highlightProgress.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1, { duration: 2000 }),
      withTiming(0, { duration: 1500 })
    );
  };

  // Refs to check dirty state of split transactions on discard check
  const initialSplitTotalRef = useRef<string>('');
  const initialSplitPayeeRef = useRef<string>('');
  const initialSplitNoteRef = useRef<string>('');
  const initialSplitTagsRef = useRef<string[]>([]);
  const initialSplitReceiptsRef = useRef<string[]>([]);
  const initialSplitRowsRef = useRef<Array<{ categoryId: string; amountStr: string }>>([]);

  // Refs to check dirty state of deposit closing on discard check
  const initialClosePrincipalRef = useRef<string>('');
  const initialCloseInterestRef = useRef<string>('');

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
  const [depositTenureUnit, setDepositTenureUnit] = useState<'months' | 'days'>('months');
  const [showTenureUnitSheet, setShowTenureUnitSheet] = useState(false);
  const [depositInterest, setDepositInterest] = useState('');
  const [depositMaturityStr, setDepositMaturityStr] = useState('');
  // Close-deposit split fields
  const [closePrincipalStr, setClosePrincipalStr] = useState('');
  const [closeInterestStr, setCloseInterestStr] = useState('');
  const [excludeFromTotals, setExcludeFromTotals] = useState(false);
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

  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);

  const dateMonthStr = useMemo(() => {
    try {
      const d = new Date(date);
      return toLocalMonthStartISO(d.getFullYear(), d.getMonth());
    } catch {
      return '';
    }
  }, [date]);

  useEffect(() => {
    if (dateMonthStr) {
      loadBudgets(dateMonthStr).catch(() => undefined);
    }
  }, [dateMonthStr, loadBudgets]);

  const isFutureDate = useMemo(() => {
    try {
      const txDate = new Date(date);
      const today = new Date();
      txDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      return txDate.getTime() > today.getTime();
    } catch {
      return false;
    }
  }, [date]);

  const activeBudget = useMemo(() => {
    if (!categoryId || type === 'transfer' || type === 'loan') return null;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return null;

    // Check if this category itself is the main budget category
    let match = budgets.find((b) => b.categoryId === categoryId);
    if (match) return match;

    // If it's a subcategory, check if its parent has a budget that covers it
    if (cat.parentId) {
      const parentBudget = budgets.find((b) => b.categoryId === cat.parentId);
      if (parentBudget) {
        // If subCategoryIds is empty/null, it means it covers all subcategories
        if (!parentBudget.subCategoryIds || parentBudget.subCategoryIds.length === 0) {
          return parentBudget;
        }
        // Otherwise, it must be explicitly selected in the budget
        if (parentBudget.subCategoryIds.includes(categoryId)) {
          return parentBudget;
        }
      }
    }
    return null;
  }, [budgets, categoryId, type, categories]);
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
  const currentScrollYRef = useRef(0);
  const preFocusScrollYRef = useRef<number | null>(null);
  const typeScrollViewRef = useRef<ScrollView>(null);
  const amountInputRef = useRef<TextInput>(null);
  const payeeInputRef = useRef<TextInput>(null);
  const personInputRef = useRef<TextInput>(null);
  const depositNameInputRef = useRef<TextInput>(null);
  const depositBankInputRef = useRef<TextInput>(null);
  const depositTenureInputRef = useRef<TextInput>(null);
  const depositInterestInputRef = useRef<TextInput>(null);
  const depositMaturityInputRef = useRef<TextInput>(null);
  const closePrincipalInputRef = useRef<TextInput>(null);
  const closeInterestInputRef = useRef<TextInput>(null);
  const suppressPersonBlurRef = useRef(false);
  const suppressPayeeBlurRef = useRef(false);
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

  const handleFieldFocus = (target: number | React.RefObject<any>) => {
    if (preFocusScrollYRef.current === null) {
      preFocusScrollYRef.current = currentScrollYRef.current;
    }
    setTimeout(() => {
      if (typeof target === 'number') {
        scrollViewRef.current?.scrollTo({ y: target, animated: true });
      } else if (target?.current && scrollViewRef.current) {
        target.current.measureLayout(
          scrollViewRef.current,
          (_x: number, y: number) => {
            scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 180), animated: true });
          },
          () => {}
        );
      }
    }, 180);
  };

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(e.endCoordinates.height);
    });

    const willHideSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', () => {
          if (preFocusScrollYRef.current !== null) {
            scrollViewRef.current?.scrollTo({ y: preFocusScrollYRef.current, animated: true });
            preFocusScrollYRef.current = null;
          }
        })
      : null;

    const didHideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (Platform.OS === 'ios') {
        setKeyboardHeight(0);
      } else {
        if (preFocusScrollYRef.current !== null) {
          scrollViewRef.current?.scrollTo({ y: preFocusScrollYRef.current, animated: true });
          preFocusScrollYRef.current = null;
        }
        setTimeout(() => {
          setKeyboardHeight(0);
        }, 250);
      }
    });

    return () => {
      showSub.remove();
      willHideSub?.remove();
      didHideSub.remove();
    };
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

    // Auto-focus amount field when switching forms (only for new transactions)
    if (!isEditing) {
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 150);
    }
  }, [type]);

  const TYPE_CONFIG = {
    in: { label: 'Income', color: palette.uiPositive, onColor: palette.onBrand, borderColor: palette.uiPositive, bg: palette.inBg },
    out: { label: 'Expense', color: palette.uiNegative, onColor: palette.onBrand, borderColor: palette.uiNegative, bg: palette.outBg },
    transfer: { label: 'Transfer', color: palette.brand, onColor: palette.onBrand, borderColor: palette.brand, bg: palette.brandSoft },
    loan: { label: 'Loan', color: palette.brand, onColor: palette.onBrand, borderColor: palette.brand, bg: palette.brandSoft },
    deposit: { label: 'Deposit', color: palette.brand, onColor: palette.onBrand, borderColor: palette.brand, bg: palette.brandSoft }
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
    if (!isEditing && !duplicateMode) {
      setCategoryId('');
      clearSplitRows();
    }
  }, [clearSplitRows, isEditing, duplicateMode]);

  // Sync state if deep-linked to a different transaction type while already mounted
  useEffect(() => {
    if (initialType && !isEditing && !isClosingDeposit && !isLoanAddMore && !duplicateMode) {
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
  }, [initialType, isEditing, isClosingDeposit, isLoanAddMore, clearSplitRows, duplicateMode]);

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
      loadDeposits().catch(() => { });
      return;
    }

    const found = deposits.find((d) => d.id === depositId);
    if (!found) return;

    setInitialDeposit(found);
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
      const pStr = formatIndianNumberStr(String(Math.round(principal)));
      const iStr = interest > 0 ? formatIndianNumberStr(String(interest)) : '';
      setClosePrincipalStr(pStr);
      setCloseInterestStr(iStr);
      initialClosePrincipalRef.current = pStr;
      initialCloseInterestRef.current = iStr;
    }

    setAmountStr(formatIndianNumberStr(String(Math.round(found.principalAmount))));
    setAccountId(found.accountId);
    if (!isClosingDeposit) setDate(found.startDate);
    setDepositName(found.name);
    setDepositBank(found.bankName ?? '');
    setDepositTenure(found.tenureMonths != null ? String(found.tenureMonths) : '');
    setDepositTenureUnit((found.tenureUnit as 'months' | 'days') || 'months');
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
      const quarters = depositTenureUnit === 'days' ? tenure / 90 : tenure / 3;
      const mv = principal * Math.pow(1 + interest / 400, quarters);
      setDepositMaturityStr(formatIndianNumberStr(String(Math.round(mv))));
    } else if (!isDepositHydratedRef.current) {
      setDepositMaturityStr('');
    }
  }, [amountStr, depositTenure, depositTenureUnit, depositInterest, type, isClosingDeposit]);

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
    setExcludeFromTotals(false);
    const task = InteractionManager.runAfterInteractions(() => {
      getTransactionById(editId).then(async (tx) => {
        if (!tx) return;
        setInitialTx(tx);
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
        setExcludeFromTotals(!!tx.excludeFromTotals);

        if (tx.splitGroupId) {
          const group = await getTransactionsBySplitGroup(tx.splitGroupId);
          if (group.length > 0) {
            const first = group[0];
            const total = group.reduce((sum, item) => sum + item.amount, 0);
            const totalStr = formatIndianNumberStr(String(total));
            const payeeVal = first.payee ?? '';
            const noteVal = first.note ?? '';
            const tagsVal = first.tags ?? [];
            const receiptsVal = first.receiptImageUris ?? [];

            setEditingSplitGroupId(tx.splitGroupId);
            originalSplitGroupIdRef.current = tx.splitGroupId;
            setType(first.type);
            setAmountStr(totalStr);
            setAccountId(first.accountId);
            setDate(first.date);
            setPayee(payeeVal);
            setSelectedTagIds(tagsVal);
            setNote(noteVal);
            setReceiptImageUris(receiptsVal);
            setCategoryId('');
            const mappedRows = group.map((item) => ({
              id: `split-${splitIdSeed.current++}`,
              categoryId: item.categoryId ?? '',
              amountStr: formatIndianNumberStr(String(item.amount)),
              note: item.note ?? undefined,
            }));
            setSplitRows(mappedRows);

            // Populate initial split references for checkIsDirty
            initialSplitTotalRef.current = totalStr;
            initialSplitPayeeRef.current = payeeVal;
            initialSplitNoteRef.current = noteVal;
            initialSplitTagsRef.current = tagsVal;
            initialSplitReceiptsRef.current = receiptsVal;
            initialSplitRowsRef.current = mappedRows.map(r => ({ categoryId: r.categoryId, amountStr: r.amountStr, note: r.note || undefined }));
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
          setInitialLoan(loan);
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
    if (isEditing || duplicateMode || !routeLoanId || (settlement !== '1' && addMore !== '1')) return;
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
  }, [addMore, isEditing, routeLoanId, settlement, duplicateMode]);

  const amount = parseFloat(parseFormattedNumber(amountStr)) || 0;
  const closePrincipal = parseFloat(parseFormattedNumber(closePrincipalStr)) || 0;
  const closeInterest = parseFloat(parseFormattedNumber(closeInterestStr)) || 0;
  const activeConfig = TYPE_CONFIG[type];

  const amountInputColor = palette.brand;
  const lockTypeSelection = isEditingDeposit || isClosingDeposit || (isEditing && (isTransferEdit || (type === 'loan' && !!editingLoanId)));
  const dt = new Date(date);
  const dayName = dt.toLocaleDateString(APP_LOCALE, { weekday: 'short' });
  const dateFormatted = `${dayName}, ${formatDate(date)}`;
  const lockLoanDirection = isLoanAddMore || (isEditing && type === 'loan' && !!editingLoanId);
  const displaySym = showCurrencySymbol ? sym : '';
  const splitTotal = splitRows.reduce((sum, row) => sum + (parseFloat(parseFormattedNumber(row.amountStr)) || 0), 0);
  const usableSplitRows = splitRows.filter(
    (row) => row.categoryId && (parseFloat(parseFormattedNumber(row.amountStr)) || 0) !== 0,
  );

  const checkIsDirty = () => {
    if (isHydratingEditRef.current) return false;

    if (isClosingDeposit) {
      if (!initialDeposit) return false;
      return (
        closePrincipalStr !== initialClosePrincipalRef.current ||
        closeInterestStr !== initialCloseInterestRef.current ||
        note !== ''
      );
    }

    if (isEditingDeposit) {
      if (!initialDeposit) return false;
      const originalAmountStr = formatIndianNumberStr(String(Math.round(initialDeposit.principalAmount)));
      return (
        depositName !== (initialDeposit.name ?? '') ||
        depositBank !== (initialDeposit.bankName ?? '') ||
        depositTenure !== (initialDeposit.tenureMonths != null ? String(initialDeposit.tenureMonths) : '') ||
        depositTenureUnit !== ((initialDeposit.tenureUnit as 'months' | 'days') || 'months') ||
        depositInterest !== (initialDeposit.interestRate != null ? String(initialDeposit.interestRate) : '') ||
        amountStr !== originalAmountStr ||
        note !== (initialDeposit.note ?? '')
      );
    }

    if (isEditing) {
      if (!initialTx) return false;
      const originalAmountStr = formatIndianNumberStr(String(initialTx.amount));

      if (isTransferEdit) {
        const originalSourceId = initialTx.type === 'out' ? initialTx.accountId : (initialTx.linkedAccountId ?? '');
        const originalDestId = initialTx.type === 'out' ? (initialTx.linkedAccountId ?? '') : initialTx.accountId;
        return (
          amountStr !== originalAmountStr ||
          accountId !== originalSourceId ||
          linkedAccountId !== originalDestId ||
          date !== initialTx.date ||
          note !== (initialTx.note ?? '')
        );
      }

      if (initialTx.type === 'loan' && initialTx.loanId) {
        if (!initialLoan) return false;
        const originalNote = getLoanTransactionUserNote(initialTx.note);
        if (loanEditMode === 'origin') {
          return (
            amountStr !== originalAmountStr ||
            accountId !== initialTx.accountId ||
            date !== initialTx.date ||
            note !== originalNote ||
            personName !== (initialLoan.personName ?? '') ||
            loanDirection !== (initialLoan.direction ?? 'lent') ||
            JSON.stringify(selectedTagIds.sort()) !== JSON.stringify((initialLoan.tags ?? []).sort())
          );
        } else {
          // settlement
          const originalType = initialTx.loanTransactionType || 'principal';
          return (
            amountStr !== originalAmountStr ||
            accountId !== initialTx.accountId ||
            date !== initialTx.date ||
            note !== originalNote ||
            loanTransactionType !== originalType
          );
        }
      }

        if (initialTx.transferPairId) {
        const originalSourceId = initialTx.type === 'out' ? initialTx.accountId : initialTx.linkedAccountId ?? '';
        const originalDestId = initialTx.type === 'out' ? initialTx.linkedAccountId ?? '' : initialTx.accountId;
        return (
          amountStr !== originalAmountStr ||
          accountId !== originalSourceId ||
          linkedAccountId !== originalDestId ||
          note !== (initialTx.note ?? '')
        );
      }

      const splitRowsChanged = JSON.stringify(
        splitRows.map(r => ({ categoryId: r.categoryId, amountStr: r.amountStr, note: r.note || undefined }))
      ) !== JSON.stringify(initialSplitRowsRef.current);

      if (initialTx.splitGroupId) {
        return (
          amountStr !== initialSplitTotalRef.current ||
          accountId !== initialTx.accountId ||
          date !== initialTx.date ||
          payee !== initialSplitPayeeRef.current ||
          note !== initialSplitNoteRef.current ||
          JSON.stringify([...selectedTagIds].sort()) !== JSON.stringify([...initialSplitTagsRef.current].sort()) ||
          JSON.stringify([...receiptImageUris].sort()) !== JSON.stringify([...initialSplitReceiptsRef.current].sort()) ||
          splitRowsChanged
        );
      }

      return (
        amountStr !== originalAmountStr ||
        accountId !== initialTx.accountId ||
        date !== initialTx.date ||
        categoryId !== (initialTx.categoryId ?? '') ||
        payee !== (initialTx.payee ?? '') ||
        note !== (initialTx.note ?? '') ||
        excludeFromTotals !== (!!initialTx.excludeFromTotals) ||
        JSON.stringify(selectedTagIds.sort()) !== JSON.stringify((initialTx.tags ?? []).sort()) ||
        JSON.stringify(receiptImageUris.sort()) !== JSON.stringify((initialTx.receiptImageUris ?? []).sort()) ||
        splitRowsChanged
      );
    }

    return (
      amountStr !== '' ||
      payee !== '' ||
      note !== '' ||
      categoryId !== '' ||
      excludeFromTotals ||
      selectedTagIds.length > 0 ||
      receiptImageUris.length > 0 ||
      splitRows.some(r => r.categoryId || r.amountStr || r.note) ||
      (type === 'loan' && personName !== '') ||
      (type === 'deposit' && (depositName !== '' || depositBank !== '' || depositTenure !== '' || depositInterest !== ''))
    );
  };

  useEffect(() => {
    if (!isFocused) return;
    const onBackPress = () => {
      if (checkIsDirty()) {
        showConfirm({
          title: 'Discard Changes',
          message: 'Are you sure you want to discard your changes?',
          confirmLabel: 'Discard',
          onConfirm: () => {
            setIsClosing(true);
            if (fromWidget === '1') {
              BackHandler.exitApp();
            } else if (!router.canGoBack()) {
              router.replace('/');
            } else {
              router.back();
            }
          },
        });
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      subscription.remove();
    };
  }, [
    isFocused,
    initialTx,
    initialDeposit,
    type,
    amountStr,
    accountId,
    linkedAccountId,
    categoryId,
    payee,
    selectedTagIds,
    note,
    date,
    receiptImageUris,
    splitRows,
    depositName,
    depositBank,
    depositTenure,
    depositInterest,
    depositMaturityStr,
    closePrincipalStr,
    closeInterestStr,
    personName,
    loanDirection,
    loanTransactionType
  ]);

  // Re-entrancy guard kept in a ref — using state here would trigger a wasted
  // re-render of the modal in the same React commit as the closeScreen()
  // navigation, which adds noticeable latency to the tap→transition window.
  const isSubmittingRef = useRef(false);

  const closeScreen = (isCancel: boolean | object = true) => {
    const isCancelBoolean = isCancel === true || typeof isCancel === 'object' || isCancel === undefined;
    if (isCancelBoolean && checkIsDirty()) {
      showConfirm({
        title: 'Discard Changes',
        message: 'Are you sure you want to discard your changes?',
        confirmLabel: 'Discard',
        onConfirm: () => {
          setIsClosing(true);
          clearSplitRows();
          if (fromWidget === '1') {
            BackHandler.exitApp();
          } else if (!router.canGoBack()) {
            router.replace('/');
          } else {
            router.back();
          }
        },
      });
      return;
    }
    setIsClosing(true);
    clearSplitRows();
    if (fromWidget === '1' && !isCancelBoolean) {
      BackHandler.exitApp();
    } else if (!router.canGoBack()) {
      router.replace('/');
    } else {
      router.back();
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
      return STRINGS.validation.enterAmount;
    }
    if (!accountId) {
      return STRINGS.validation.selectAccount;
    }
    if (type === 'transfer' && !linkedAccountId) {
      return STRINGS.validation.selectDestAccount;
    }
    if ((type === 'in' || type === 'out') && usableSplitRows.length === 0 && !categoryId) {
      return STRINGS.validation.selectCategory;
    }
    if (type === 'loan' && personName.trim().length === 0) {
      return STRINGS.validation.enterPersonName;
    }
    if (type === 'deposit' && !isClosingDeposit && depositName.trim().length === 0) {
      return STRINGS.validation.enterDepositName;
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

    if ((isEditing || isEditingDeposit || isClosingDeposit) && !checkIsDirty()) {
      closeScreen(false);
      return;
    }

    isSubmittingRef.current = true;

    // Every save path follows the same shape: await the mutation + store reloads
    // BEFORE closing the screen, so the list/balance are already correct when the
    // user lands back. SQLite writes are ~5ms and reloads ~30-50ms — imperceptible.
    // Widget updates are non-critical and fire in the background after close.
    const runMutationThenClose = async (
      work: () => Promise<unknown>,
      refresh?: { tx?: boolean; widgets?: boolean; accounts?: boolean },
    ) => {
      await work();
      const tasks: Promise<unknown>[] = [];
      if (refresh?.accounts !== false) tasks.push(refreshAccounts());
      if (refresh?.tx) tasks.push(reloadTransactions());
      await Promise.all(tasks);
      // These paths (splits, transfer edits, deposits, loans) write straight to
      // the service layer, bypassing the store's own mutationVersion bump. Bump
      // it now — after the DB-truth reload — so screens keyed on it refresh too.
      if (refresh?.tx) markTxMutated();
      closeScreen(false);
      // Widgets are non-critical — fire after the screen has closed.
      if (refresh?.widgets) updateAllReniWidgets().catch(() => undefined);
    };

    try {
      // lastUsedAccountId is persisted below — deferred for the in-app in/out
      // path so closeScreen lands with zero synchronous store writes.
      // For non-in/out branches (deposit, loan, transfer, split) we fire eagerly
      // since they aren't the hot path being micro-optimised.
      const shouldPersistLastAccount = !isEditing && !!accountId;
      const persistLastAccountEagerly = () => {
        if (shouldPersistLastAccount) {
          updateSettings({ lastUsedAccountId: accountId }).catch(() => { });
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
          persistLastAccountEagerly();
          await runMutationThenClose(() => closeDeposit(closeDepositId, payload), { tx: true, widgets: true });
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
          tenureUnit: depositTenureUnit,
          startDate: date,
          maturityDate,
          maturityValue,
          note: note.trim() || null,
        };
        const depositsStore = useFixedDepositsStore.getState();
        const depositWork = isEditingDeposit && editDepositId
          ? () => depositsStore.update(editDepositId, depositPayload)
          : () => depositsStore.add(depositPayload);
        persistLastAccountEagerly();
        await runMutationThenClose(depositWork, { tx: true, widgets: true });
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
        excludeFromTotals: (type === 'in' || type === 'out') ? excludeFromTotals : undefined,
        linkedAccountId: type === 'transfer' ? linkedAccountId : undefined
      };

      if ((type === 'in' || type === 'out') && usableSplitRows.length > 0) {
        const splitItems = usableSplitRows.map((row) => ({
          categoryId: row.categoryId,
          amount: parseFloat(parseFormattedNumber(row.amountStr)) || 0,
          note: row.note?.trim() || undefined,
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
          excludeFromTotals,
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
        persistLastAccountEagerly();
        await runMutationThenClose(splitWork, { tx: true, widgets: true });
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
        persistLastAccountEagerly();
        await runMutationThenClose(async () => {
          await deleteTransaction(oldGroupMemberId);
          await createTransaction({ ...data, splitGroupId: undefined });
        }, { tx: true, widgets: true });
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
        persistLastAccountEagerly();
        await runMutationThenClose(() => updateLoanOrigin(loanId, payload, txId), { tx: true, widgets: true });
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
        persistLastAccountEagerly();
        await runMutationThenClose(() => updateLoanSettlement(txId, payload), { tx: true, widgets: true });
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
        persistLastAccountEagerly();
        // The transaction store already reloads transactions/accounts and bumps
        // mutationVersion after commit, so avoid doing the same reads twice.
        await runMutationThenClose(() => addTransaction(payload), { accounts: false, widgets: true });
        return;
      }
      if (type === 'loan' && isLoanAddMore && routeLoanId) {
        const loanId = routeLoanId;
        const trimmedNote = note.trim();
        persistLastAccountEagerly();
        await runMutationThenClose(() => addLoanPrincipal(loanId, amount, accountId, date, trimmedNote), { tx: true, widgets: true });
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
        persistLastAccountEagerly();
        await runMutationThenClose(() => addLoan(payload), { tx: true, widgets: true });
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
        persistLastAccountEagerly();
        await runMutationThenClose(() => updateTransferTransaction(txId, payload), { tx: true, widgets: true });
        return;
      }
      const runMutation = isEditing && editId
        ? () => updateTransaction(editId, data)
        : () => addTransaction(data);

      if (fromWidget === '1') {
        if (showDatePicker) setShowDatePicker(false);
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

      if (showDatePicker) setShowDatePicker(false);
      persistLastAccountEagerly();
      // store.add/update does: DB write → reload txs + refresh accounts → bump
      // mutationVersion. Await it so data is fully fresh before screen closes.
      await runMutation();
      closeScreen(false);
      updateAllReniWidgets().catch(() => undefined);
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
        const work = isLoanOrigin
          ? () => removeLoan(editingLoanId!)
          : isDepositEdit
            ? () => removeDeposit(editDepositId!)
            : editId
              ? () => removeTransaction(editId)
              : async () => undefined;
        setEditingSplitGroupId('');
        clearSplitRows();
        // Await the delete BEFORE closing. store.remove() does: DB delete +
        // optimistic array filter + reload txs/accounts internally (~50ms total).
        (async () => {
          try {
            await work();
          } catch (e) {
            useGlobalNotice.getState().show(String(e));
          }
          closeScreen(false);
          updateAllReniWidgets().catch(() => undefined);
        })();
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
      setReceiptImageUris([nextUris[0]]);
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
    setShowDatePicker(true);
  };


  // Temporary bypass for unused receipts handlers
  if (false as any) {
    console.log(openReceiptPicker, openReceiptPreview, removeReceiptAtIndex, Image);
  }

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
            height: 52,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: FORM_TOKENS.gutter,
          }}
        >
          <TouchableOpacity delayPressIn={0} onPress={closeScreen} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: SCREEN_HEADER.iconTitleGap }}>
            <AppIcon name="x" size={18} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text }}>
            {screenTitle}
          </Text>
          {isEditing && (
            <HeaderMoreButton
              palette={palette}
              isOpen={showActions}
              onPress={toggleActions}
            />
          )}
        </View>
      </SafeAreaView>

      <ActionStrip palette={palette} animatedStyle={actionsAnimatedStyle}>
        <ActionChip
          icon="copy"
          label="Clone"
          palette={palette}
          onPress={handleCloneTransaction}
        />
      </ActionStrip>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets, 132) + keyboardHeight }}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          currentScrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          preFocusScrollYRef.current = null;
        }}
      >
        <Pressable onPress={Keyboard.dismiss} style={{ paddingBottom: 20 }}>
          <View style={{ paddingTop: 2, paddingBottom: 14 }}>
            <ScrollView
              ref={typeScrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: FORM_TOKENS.gutter, gap: 10 }}
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
                    paddingVertical: 9,
                    paddingHorizontal: 18,
                    borderRadius: HOME_RADIUS.full,
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
            <Pressable
              onPress={() => amountInputRef.current?.focus()}
              style={{
                marginHorizontal: FORM_TOKENS.gutter,
                marginTop: 8,
                paddingTop: 28,
                paddingBottom: 42,
                paddingHorizontal: 18,
                alignItems: 'center',
                backgroundColor: palette.surface,
                borderRadius: HOME_RADIUS.card,
                borderWidth: 1,
                borderColor: palette.borderSoft,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={usableSplitRows.length === 0}
                onPress={() => runAfterKeyboardDismiss(() => router.push({ pathname: '/modals/split-transaction', params: { type } }))}
                style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center', position: 'relative' }}
              >
                {showCurrencySymbol && (
                  <Text style={{ fontSize: 24, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginRight: 4 }}>
                    {sym}
                  </Text>
                )}
                <TextInput
                  ref={amountInputRef}
                  value={amountStr}
                  onChangeText={(value: string) => setAmountStr(formatIndianNumberStr(sanitizeDecimalInput(value)))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={palette.textSoft}
                  cursorColor={palette.isDark ? '#FFFFFF' : '#000000'}
                  editable={usableSplitRows.length === 0}
                  pointerEvents={usableSplitRows.length > 0 ? 'none' : 'auto'}
                  style={{
                    fontSize: 34,
                    fontWeight: FONT_WEIGHT.regular,
                    color: amountInputColor,
                    letterSpacing: 0,
                    textAlign: 'center',
                    minWidth: 60,
                    paddingTop: 0,
                    paddingBottom: 2,
                    lineHeight: 38,
                  }}
                  autoFocus={!isEditing && usableSplitRows.length === 0}
                />
              </TouchableOpacity>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 8,
                  justifyContent: 'center',
                }}
              >
                <TouchableOpacity onPress={openDate} style={{ justifyContent: 'center', position: 'relative' }}>
                  <Animated.View style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: palette.brandSoft,
                      borderRadius: HOME_RADIUS.chip,
                    },
                    highlightStyle
                  ]} />
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, paddingHorizontal: 8, paddingVertical: 2 }}>
                    {dateFormatted}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={handleOpenCalculator}
                activeOpacity={0.72}
                style={{
                  position: 'absolute',
                  right: 14,
                  bottom: 0,
                  width: 42,
                  height: 42,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                }}
              >
                <AppIcon name="calculator" size={21} color={palette.text} strokeWidth={1.9} />
              </TouchableOpacity>
            </Pressable>
          ) : null}

          <AnimatedFutureWarning
            visible={isFutureDate}
            dateStr={date}
            palette={palette}
          />

          {type === 'in' || type === 'out' ? (
            <>
              <FormSection title="Account" palette={palette}>
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setAccountSheetMode('account'))}
                  activeOpacity={0.76}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 72,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  {accountId && accounts.find(a => a.id === accountId) ? (() => {
                    const acc = accounts.find(a => a.id === accountId)!;
                    return (
                      <>
                        <AccountTypeBadge account={acc} palette={palette} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                            {formatAccountDisplayName(acc.name, acc.accountNumber)}
                          </Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, fontWeight: FONT_WEIGHT.regular, marginTop: 2 }}>
                            {formatSignedCurrency(acc.balance, displaySym)}
                          </Text>
                        </View>
                      </>
                    );
                  })() : (
                    <>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: HOME_RADIUS.full,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: palette.surfaceRaised,
                          borderWidth: 1,
                          borderColor: attemptedSubmit && !accountId ? palette.negative : palette.borderSoft,
                        }}
                      >
                        <AppIcon name="wallet" size={18} color={attemptedSubmit && !accountId ? palette.negative : palette.text} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: attemptedSubmit && !accountId ? palette.negative : palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>
                          Select account
                        </Text>
                      </View>
                    </>
                  )}
                  <AppChevron direction="right" size={18} tone="secondary" color={attemptedSubmit && !accountId ? palette.negative : palette.textSecondary} palette={palette} />
                </TouchableOpacity>
              </FormSection>

              <FormSection
                title="Category"
                palette={palette}
                rightElement={
                  <TouchableOpacity
                    onPress={() => runAfterKeyboardDismiss(() => router.push({ pathname: '/modals/split-transaction', params: { type } }))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2, paddingHorizontal: 6 }}
                  >
                    <AppIcon name="layers" size={13} color={palette.brand} strokeWidth={2.2} />
                    <Text
                      appWeight="medium"
                      style={{
                        fontSize: HOME_TEXT.caption,
                        fontWeight: FONT_WEIGHT.bold,
                        color: palette.brand,
                        letterSpacing: 0.2
                      }}
                    >
                      Split
                    </Text>
                  </TouchableOpacity>
                }
              >
                <TouchableOpacity
                  onPress={usableSplitRows.length > 0
                    ? () => runAfterKeyboardDismiss(() => router.push({ pathname: '/modals/split-transaction', params: { type } }))
                    : openCategorySheet}
                  activeOpacity={0.76}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 68,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {usableSplitRows.length > 0 ? (
                      <AppIcon name="layers" size={21} color={palette.brand} strokeWidth={1.5} />
                    ) : categoryId && getCategoryDisplayParts(categories, categoryId).fullName !== 'Select Category' ? (
                      isEmojiIcon(getCategoryDisplayParts(categories, categoryId).icon) ? (
                        <Text style={{ fontSize: 21 }}>{getCategoryDisplayParts(categories, categoryId).icon}</Text>
                      ) : (
                        <AppIcon name={getCategoryDisplayParts(categories, categoryId).icon as any} size={21} color={palette.brand} strokeWidth={1.5} />
                      )
                    ) : (
                      <AppIcon name="layout-grid" size={21} color={attemptedSubmit && !categoryId ? palette.negative : palette.brand} strokeWidth={1.5} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: HOME_TEXT.bodyLarge,
                        color: usableSplitRows.length > 0 || categoryId ? palette.text : attemptedSubmit && !categoryId ? palette.negative : palette.textMuted,
                        fontWeight: FONT_WEIGHT.medium,
                      }}
                      numberOfLines={1}
                    >
                      {usableSplitRows.length > 0
                        ? `Split (${usableSplitRows.length} items)`
                        : categoryId && getCategoryDisplayParts(categories, categoryId).fullName !== 'Select Category'
                          ? getCategoryDisplayParts(categories, categoryId).fullName
                          : 'Select category'}
                    </Text>
                  </View>
                  <AppChevron direction="right" size={18} tone="secondary" color={attemptedSubmit && !categoryId ? palette.negative : palette.textSecondary} palette={palette} />
                </TouchableOpacity>
              </FormSection>
              <View style={{ marginHorizontal: FORM_TOKENS.gutter }}>
                <AnimatedBudgetPreview
                  visible={!isEditing && !!activeBudget}
                  budget={activeBudget}
                  palette={palette}
                  sym={displaySym}
                  amountStr={amountStr}
                />
              </View>

              <FormSection title="" palette={palette}>
                {/* Payee */}
                <Pressable
                  onPress={() => payeeInputRef.current?.focus()}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    minHeight: 62,
                    gap: 12,
                  }}
                >
                  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                    <AppIcon name="user" size={18} color={palette.text} />
                  </View>
                  <TextInput
                    ref={payeeInputRef}
                    value={payee}
                    onChangeText={(text: string) => {
                      setPayee(text);
                    }}
                    placeholder="Payee"
                    placeholderTextColor={palette.textMuted}
                    cursorColor={palette.isDark ? '#FFFFFF' : palette.text}
                    onFocus={() => {
                      setIsPayeeFocused(true);
                      handleFieldFocus(payeeInputRef);
                    }}
                    onBlur={() => {
                      if (suppressPayeeBlurRef.current) {
                        suppressPayeeBlurRef.current = false;
                        return;
                      }
                      setIsPayeeFocused(false);
                    }}
                    style={{
                      flex: 1,
                      fontSize: HOME_TEXT.bodyLarge,
                      color: palette.text,
                      paddingVertical: 0,
                      minHeight: 28,
                      fontWeight: FONT_WEIGHT.regular,
                    }}
                  />
                </Pressable>

                <AnimatedSuggestionStrip visible={isPayeeFocused && payee.trim() !== '' && payeeSuggestions.length > 0}>
                  <View style={{ paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4 }}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                      keyboardShouldPersistTaps="handled"
                    >
                      {payeeSuggestions.map((suggestion) => (
                        <TouchableOpacity
                          key={suggestion}
                          onPressIn={() => { suppressPayeeBlurRef.current = true; }}
                          onPress={() => {
                            setPayee(suggestion);
                            setIsPayeeFocused(false);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: HOME_RADIUS.chip,
                            backgroundColor: palette.isDark ? palette.layers.surfaceSunken : palette.inputBg,
                            borderWidth: 1,
                            borderColor: palette.lines.borderStrong,
                          }}
                        >
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text }}>
                            {suggestion}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </AnimatedSuggestionStrip>

                <FormDivider palette={palette} />

                {/* Tags */}
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setShowTagSheet(true))}
                  activeOpacity={0.76}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 62,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                    <AppIcon name="tag" size={18} color={palette.text} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {selectedTagIds.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
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
                      <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>
                        Tags
                      </Text>
                    )}
                  </View>
                  <AppChevron direction="right" size={18} tone="secondary" color={palette.textSecondary} palette={palette} />
                </TouchableOpacity>

                {usableSplitRows.length === 0 && (
                  <>
                    <FormDivider palette={palette} />
                    {/* Notes (Hidden for split transactions since each row has its own note) */}
                    <InlineComboBox
                      label="Notes"
                      value={note}
                      onChange={setNote}
                      suggestions={noteSuggestions}
                      multiline
                      palette={palette}
                      onFocus={() => {
                        handleFieldFocus(460);
                      }}
                      leftIcon="file-text"
                      hideLabel={true}
                      placeholder="Notes"
                    />
                  </>
                )}
              </FormSection>

              {/* Not Mine Card (Receipt card hidden for now) */}
              <View style={{ marginHorizontal: FORM_TOKENS.gutter, marginTop: 10 }}>
                <Pressable
                  onPress={() => setExcludeFromTotals(!excludeFromTotals)}
                  style={{
                    backgroundColor: palette.card,
                    borderRadius: HOME_RADIUS.card,
                    borderWidth: 1,
                    borderColor: palette.borderSoft,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    minHeight: 82,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 26 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <AppIcon name="user-x" size={18} color={excludeFromTotals ? palette.brand : palette.text} />
                      <Text style={{ fontSize: HOME_TEXT.body, color: palette.text, fontWeight: FONT_WEIGHT.medium }}>
                        Not Mine
                      </Text>
                    </View>
                    <AppSwitch
                      value={excludeFromTotals}
                      onValueChange={setExcludeFromTotals}
                      palette={palette}
                      width={38}
                      height={22}
                      thumbSize={16}
                      padding={3}
                    />
                  </View>
                  <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 8, lineHeight: 15 }} numberOfLines={2}>
                    {type === 'out'
                      ? 'Excluded from expense totals & budgets, but updates account balance.'
                      : 'Excluded from income totals, but updates account balance.'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : type === 'transfer' ? (
            <>
              {/* From Account selection */}
              <FormSection title="From Account" palette={palette}>
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setAccountSheetMode('from'))}
                  activeOpacity={0.76}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 72,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  {accountId && accounts.find(a => a.id === accountId) ? (() => {
                    const acc = accounts.find(a => a.id === accountId)!;
                    return (
                      <>
                        <AccountTypeBadge account={acc} palette={palette} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                            {formatAccountDisplayName(acc.name, acc.accountNumber)}
                          </Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, fontWeight: FONT_WEIGHT.regular, marginTop: 2 }}>
                            {formatSignedCurrency(acc.balance, displaySym)}
                          </Text>
                        </View>
                      </>
                    );
                  })() : (
                    <>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: HOME_RADIUS.full,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: palette.surfaceRaised,
                          borderWidth: 1,
                          borderColor: attemptedSubmit && !accountId ? palette.negative : palette.borderSoft,
                        }}
                      >
                        <AppIcon name="wallet" size={18} color={attemptedSubmit && !accountId ? palette.negative : palette.text} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: attemptedSubmit && !accountId ? palette.negative : palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>
                          Select account
                        </Text>
                      </View>
                    </>
                  )}
                  <AppChevron direction="right" size={18} tone="secondary" color={attemptedSubmit && !accountId ? palette.negative : palette.textSecondary} palette={palette} />
                </TouchableOpacity>
              </FormSection>

              {/* Swap Button row */}
              <View style={{ alignItems: 'center', marginTop: 10, marginBottom: -8, zIndex: 10 }}>
                <PressableScale
                  onPress={() => {
                    const tmp = accountId;
                    setAccountId(linkedAccountId);
                    setLinkedAccountId(tmp);
                    swapRotation.value = withTiming(swapRotation.value + 180, { duration: 250 });
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: palette.surface,
                    borderWidth: 1,
                    borderColor: palette.borderSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Animated.View style={swapAnimatedStyle}>
                    <AppIcon name="repeat" size={15} color={palette.brand} />
                  </Animated.View>
                </PressableScale>
              </View>

              {/* To Account selection */}
              <FormSection title="To Account" palette={palette} style={{ marginTop: 0 }}>
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setAccountSheetMode('to'))}
                  activeOpacity={0.76}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 72,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  {linkedAccountId && accounts.find(a => a.id === linkedAccountId) ? (() => {
                    const acc = accounts.find(a => a.id === linkedAccountId)!;
                    return (
                      <>
                        <AccountTypeBadge account={acc} palette={palette} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                            {formatAccountDisplayName(acc.name, acc.accountNumber)}
                          </Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, fontWeight: FONT_WEIGHT.regular, marginTop: 2 }}>
                            {formatSignedCurrency(acc.balance, displaySym)}
                          </Text>
                        </View>
                      </>
                    );
                  })() : (
                    <>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: HOME_RADIUS.full,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: palette.surfaceRaised,
                          borderWidth: 1,
                          borderColor: attemptedSubmit && !linkedAccountId ? palette.negative : palette.borderSoft,
                        }}
                      >
                        <AppIcon name="wallet" size={18} color={attemptedSubmit && !linkedAccountId ? palette.negative : palette.text} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: attemptedSubmit && !linkedAccountId ? palette.negative : palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>
                          Select account
                        </Text>
                      </View>
                    </>
                  )}
                  <AppChevron direction="right" size={18} tone="secondary" color={attemptedSubmit && !linkedAccountId ? palette.negative : palette.textSecondary} palette={palette} />
                </TouchableOpacity>
              </FormSection>

              {accountId && linkedAccountId && accountId === linkedAccountId ? (
                <View style={{ paddingHorizontal: FORM_TOKENS.gutter + 8, marginTop: 8 }}>
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.negative, fontWeight: FONT_WEIGHT.medium }}>
                    Heads up: Same account transfer.
                  </Text>
                </View>
              ) : null}

              {/* Notes */}
              <FormSection title="" palette={palette}>
                <InlineComboBox
                  label="Notes"
                  value={note}
                  onChange={setNote}
                  suggestions={noteSuggestions}
                  multiline
                  palette={palette}
                  onFocus={() => {
                    handleFieldFocus(460);
                  }}
                  leftIcon="file-text"
                  hideLabel={true}
                  placeholder="Notes"
                />
              </FormSection>
            </>
          ) : type === 'loan' ? (
            <>
              <FormSection title="Loan Direction" palette={palette}>
                {loanEditMode === 'settlement' ? (
                  <>
                    {/* Person display */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        minHeight: 62,
                        gap: 12,
                      }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="user" size={18} color={palette.text} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                          {personName}
                        </Text>
                      </View>
                    </View>

                    <FormDivider palette={palette} />

                    {/* Type picker */}
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        InteractionManager.runAfterInteractions(() => setShowTypeSheet(true));
                      }}
                      activeOpacity={0.76}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        minHeight: 62,
                        gap: 12,
                      }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="layers" size={18} color={palette.text} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                          {loanTransactionType === 'principal'
                            ? 'Principal'
                            : loanTransactionType === 'interest'
                              ? 'Interest'
                              : 'Others'}
                        </Text>
                      </View>
                      <AppChevron direction="right" size={18} tone="secondary" color={palette.textSecondary} palette={palette} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {/* Direction */}
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                        {(['lent', 'borrowed'] as const).map((d) => {
                          const active = loanDirection === d;
                          return (
                            <TouchableOpacity
                              delayPressIn={0}
                              key={d}
                              onPress={lockLoanDirection ? undefined : () => setLoanDirection(d)}
                              disabled={lockLoanDirection}
                              style={{
                                flex: 1,
                                paddingVertical: 11,
                                borderRadius: HOME_RADIUS.pill,
                                alignItems: 'center',
                                borderWidth: 1.5,
                                borderColor: active ? palette.brand : palette.borderSoft,
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
                    </View>

                    {/* Person selection */}
                    {isLoanAddMore ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          minHeight: 62,
                          gap: 12,
                        }}
                      >
                        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                          <AppIcon name="user" size={18} color={palette.text} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                            {personName}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={{ paddingVertical: 2 }}>
                        <Pressable
                          onPress={() => personInputRef.current?.focus()}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            minHeight: 62,
                            gap: 12,
                          }}
                        >
                          <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                            <AppIcon name="user" size={18} color={palette.text} />
                          </View>
                          <TextInput
                            ref={personInputRef}
                            value={personName}
                            onChangeText={(text) => {
                              setPersonName(text);
                            }}
                            placeholder="Person"
                            placeholderTextColor={palette.textMuted}
                            cursorColor={palette.isDark ? '#FFFFFF' : palette.text}
                            onFocus={() => {
                              setIsPersonFocused(true);
                              handleFieldFocus(personInputRef);
                            }}
                            onBlur={() => {
                              if (suppressPersonBlurRef.current) {
                                suppressPersonBlurRef.current = false;
                                return;
                              }
                              setIsPersonFocused(false);
                            }}
                            style={{
                              flex: 1,
                              fontSize: HOME_TEXT.bodyLarge,
                              color: palette.text,
                              paddingVertical: 0,
                              minHeight: 28,
                              fontWeight: FONT_WEIGHT.semibold,
                            }}
                          />
                        </Pressable>

                        <AnimatedSuggestionStrip visible={isPersonFocused && personName.trim() !== ''}>
                          <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={{ gap: 8 }}
                              keyboardShouldPersistTaps="handled"
                            >
                              {!exactPersonMatch && (
                                <TouchableOpacity
                                  onPressIn={() => { suppressPersonBlurRef.current = true; }}
                                  onPress={() => {
                                    setPersonName(personName.trim());
                                    setIsPersonFocused(false);
                                  }}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: HOME_RADIUS.chip,
                                    backgroundColor: palette.brandSoft,
                                    borderWidth: 1,
                                    borderColor: `${palette.brand}75`,
                                  }}
                                >
                                  <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.brand, fontWeight: FONT_WEIGHT.regular }}>
                                    + Add "{personName.trim()}"
                                  </Text>
                                </TouchableOpacity>
                              )}
                              {filteredPersonSuggestions.map((suggestion) => (
                                <TouchableOpacity
                                  key={suggestion}
                                  onPressIn={() => { suppressPersonBlurRef.current = true; }}
                                  onPress={() => {
                                    setPersonName(suggestion);
                                    setIsPersonFocused(false);
                                  }}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: HOME_RADIUS.chip,
                                    backgroundColor: palette.isDark ? palette.layers.surfaceSunken : palette.inputBg,
                                    borderWidth: 1,
                                    borderColor: palette.lines.borderStrong,
                                  }}
                                >
                                  <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text }}>
                                    {suggestion}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        </AnimatedSuggestionStrip>
                      </View>
                    )}
                  </>
                )}
              </FormSection>

              <AnimatedWarningBox visible={loanTransactionType !== 'principal'}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 16,
                    marginTop: 6,
                    marginBottom: 2,
                  }}
                >
                  <AppIcon name="info" size={14} color={palette.textSecondary} strokeWidth={2} />
                  <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary, flex: 1 }}>
                    Loan outstanding balance will not be affected
                  </Text>
                </View>
              </AnimatedWarningBox>

              {/* Account selection */}
              <FormSection title="Account" palette={palette}>
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setAccountSheetMode('account'))}
                  activeOpacity={0.76}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 72,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  {accountId && accounts.find(a => a.id === accountId) ? (() => {
                    const acc = accounts.find(a => a.id === accountId)!;
                    return (
                      <>
                        <AccountTypeBadge account={acc} palette={palette} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                            {formatAccountDisplayName(acc.name, acc.accountNumber)}
                          </Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, fontWeight: FONT_WEIGHT.regular, marginTop: 2 }}>
                            {formatSignedCurrency(acc.balance, displaySym)}
                          </Text>
                        </View>
                      </>
                    );
                  })() : (
                    <>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: HOME_RADIUS.full,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: palette.surfaceRaised,
                          borderWidth: 1,
                          borderColor: attemptedSubmit && !accountId ? palette.negative : palette.borderSoft,
                        }}
                      >
                        <AppIcon name="wallet" size={18} color={attemptedSubmit && !accountId ? palette.negative : palette.text} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: attemptedSubmit && !accountId ? palette.negative : palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>
                          Select account
                        </Text>
                      </View>
                    </>
                  )}
                  <AppChevron direction="right" size={18} tone="secondary" color={attemptedSubmit && !accountId ? palette.negative : palette.textSecondary} palette={palette} />
                </TouchableOpacity>
              </FormSection>

              {/* Notes */}
              <FormSection title="" palette={palette}>
                <InlineComboBox
                  label="Notes"
                  value={note}
                  onChange={setNote}
                  suggestions={noteSuggestions}
                  multiline
                  palette={palette}
                  onFocus={() => {
                    handleFieldFocus(460);
                  }}
                  leftIcon="file-text"
                  hideLabel={true}
                  placeholder="Notes"
                />
              </FormSection>
            </>
          ) : type === 'deposit' ? (
            <>
              {/* Source Account selection */}
              <FormSection title="Source Account" palette={palette}>
                <TouchableOpacity
                  onPress={() => runAfterKeyboardDismiss(() => setAccountSheetMode('account'))}
                  activeOpacity={0.76}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 72,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  {accountId && accounts.find(a => a.id === accountId) ? (() => {
                    const acc = accounts.find(a => a.id === accountId)!;
                    return (
                      <>
                        <AccountTypeBadge account={acc} palette={palette} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.text, fontWeight: FONT_WEIGHT.medium }} numberOfLines={1}>
                            {formatAccountDisplayName(acc.name, acc.accountNumber)}
                          </Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, fontWeight: FONT_WEIGHT.regular, marginTop: 2 }}>
                            {formatSignedCurrency(acc.balance, displaySym)}
                          </Text>
                        </View>
                      </>
                    );
                  })() : (
                    <>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: HOME_RADIUS.full,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: palette.surfaceRaised,
                          borderWidth: 1,
                          borderColor: attemptedSubmit && !accountId ? palette.negative : palette.borderSoft,
                        }}
                      >
                        <AppIcon name="wallet" size={18} color={attemptedSubmit && !accountId ? palette.negative : palette.text} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: attemptedSubmit && !accountId ? palette.negative : palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>
                          Select account
                        </Text>
                      </View>
                    </>
                  )}
                  <AppChevron direction="right" size={18} tone="secondary" color={attemptedSubmit && !accountId ? palette.negative : palette.textSecondary} palette={palette} />
                </TouchableOpacity>
              </FormSection>

              {/* Deposit details */}
              <FormSection title={isClosingDeposit ? "Closing Details" : "Deposit Details"} palette={palette}>
                {isClosingDeposit ? (
                  <>
                    {/* Principal */}
                    <Pressable
                      onPress={() => closePrincipalInputRef.current?.focus()}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        minHeight: 62,
                        gap: 12,
                      }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="info" size={18} color={palette.text} />
                      </View>
                      <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: attemptedSubmit && closePrincipal <= 0 ? palette.negative : palette.textSecondary, width: 64 }}>
                        Principal
                      </Text>
                      <TextInput
                        ref={closePrincipalInputRef}
                        value={closePrincipalStr}
                        onChangeText={setClosePrincipalStr}
                        placeholder=""
                        placeholderTextColor={palette.textMuted}
                        cursorColor={palette.isDark ? '#FFFFFF' : palette.text}
                        keyboardType="decimal-pad"
                        autoFocus={focusField !== 'interest'}
                        style={{
                          flex: 1,
                          fontSize: HOME_TEXT.bodyLarge,
                          color: palette.text,
                          paddingVertical: 0,
                          minHeight: 28,
                          fontWeight: FONT_WEIGHT.regular,
                        }}
                      />
                    </Pressable>

                    <FormDivider palette={palette} />

                    {/* Interest */}
                    <Pressable
                      onPress={() => closeInterestInputRef.current?.focus()}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        minHeight: 62,
                        gap: 12,
                      }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="percent" size={18} color={palette.text} />
                      </View>
                      <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.textSecondary, width: 64 }}>
                        Interest
                      </Text>
                      <TextInput
                        ref={closeInterestInputRef}
                        value={closeInterestStr}
                        onChangeText={setCloseInterestStr}
                        placeholder=""
                        placeholderTextColor={palette.textMuted}
                        cursorColor={palette.isDark ? '#FFFFFF' : palette.text}
                        keyboardType="decimal-pad"
                        autoFocus={focusField === 'interest'}
                        style={{
                          flex: 1,
                          fontSize: HOME_TEXT.bodyLarge,
                          color: palette.text,
                          paddingVertical: 0,
                          minHeight: 28,
                          fontWeight: FONT_WEIGHT.regular,
                        }}
                      />
                    </Pressable>

                    {(closePrincipal > 0 || closeInterest > 0) && (
                      <>
                        <FormDivider palette={palette} />
                        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                          <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: palette.textSecondary }}>Total Received</Text>
                          <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
                            {displaySym}{formatCurrency(closePrincipal + closeInterest, '')}
                          </Text>
                        </View>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {/* Deposit Name */}
                    <Pressable
                       onPress={() => depositNameInputRef.current?.focus()}
                       style={{
                         flexDirection: 'row',
                         alignItems: 'center',
                         paddingHorizontal: 16,
                         paddingVertical: 12,
                         minHeight: 62,
                         gap: 12,
                       }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="info" size={18} color={palette.text} />
                      </View>
                      <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: attemptedSubmit && depositName.trim().length === 0 ? palette.negative : palette.textSecondary, width: 64 }}>
                        Name
                      </Text>
                      <TextInput
                        ref={depositNameInputRef}
                        value={depositName}
                        onChangeText={setDepositName}
                        placeholder=""
                        placeholderTextColor={palette.textMuted}
                        cursorColor={palette.isDark ? '#FFFFFF' : palette.text}
                        style={{
                          flex: 1,
                          fontSize: HOME_TEXT.bodyLarge,
                          color: palette.text,
                          paddingVertical: 0,
                          minHeight: 28,
                          fontWeight: FONT_WEIGHT.semibold,
                        }}
                      />
                    </Pressable>

                    <FormDivider palette={palette} indent={52} />

                    {/* Bank */}
                    <Pressable
                       onPress={() => depositBankInputRef.current?.focus()}
                       style={{
                         flexDirection: 'row',
                         alignItems: 'center',
                         paddingHorizontal: 16,
                         paddingVertical: 12,
                         minHeight: 62,
                         gap: 12,
                       }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="landmark" size={18} color={palette.text} />
                      </View>
                      <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.textSecondary, width: 64 }}>
                        Bank
                      </Text>
                      <TextInput
                        ref={depositBankInputRef}
                        value={depositBank}
                        onChangeText={setDepositBank}
                        placeholder=""
                        placeholderTextColor={palette.textMuted}
                        cursorColor={palette.isDark ? '#FFFFFF' : palette.text}
                        style={{
                          flex: 1,
                          fontSize: HOME_TEXT.bodyLarge,
                          color: palette.text,
                          paddingVertical: 0,
                          minHeight: 28,
                          fontWeight: FONT_WEIGHT.regular,
                        }}
                      />
                    </Pressable>

                    <FormDivider palette={palette} indent={52} />

                    {/* Tenure */}
                    <Pressable
                       onPress={() => depositTenureInputRef.current?.focus()}
                       style={{
                         flexDirection: 'row',
                         alignItems: 'center',
                         paddingHorizontal: 16,
                         paddingVertical: 12,
                         minHeight: 62,
                         gap: 12,
                       }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="calendar" size={18} color={palette.text} />
                      </View>
                      <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.textSecondary, width: 64 }}>
                        Tenure
                      </Text>
                      <TextInput
                        ref={depositTenureInputRef}
                        value={depositTenure}
                        onChangeText={setDepositTenure}
                        placeholder=""
                        placeholderTextColor={palette.textMuted}
                        cursorColor={palette.isDark ? '#FFFFFF' : palette.text}
                        keyboardType="number-pad"
                        style={{
                          flex: 1,
                          fontSize: HOME_TEXT.bodyLarge,
                          color: palette.text,
                          paddingVertical: 0,
                          minHeight: 28,
                          fontWeight: FONT_WEIGHT.regular,
                        }}
                      />
                      <TouchableOpacity
                        delayPressIn={0}
                        onPress={() => runAfterKeyboardDismiss(() => setShowTenureUnitSheet(true))}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: HOME_RADIUS.small,
                          borderWidth: 1,
                          borderColor: palette.borderSoft,
                          backgroundColor: 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary, fontWeight: FONT_WEIGHT.semibold }}>
                          {depositTenureUnit === 'months' ? 'Months' : 'Days'}
                        </Text>
                        <AppIcon name="chevron-down" size={12} color={palette.textSecondary} strokeWidth={2} />
                      </TouchableOpacity>
                    </Pressable>

                    <FormDivider palette={palette} indent={52} />

                    {/* Interest % */}
                    <Pressable
                       onPress={() => depositInterestInputRef.current?.focus()}
                       style={{
                         flexDirection: 'row',
                         alignItems: 'center',
                         paddingHorizontal: 16,
                         paddingVertical: 12,
                         minHeight: 62,
                         gap: 12,
                       }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="percent" size={18} color={palette.text} />
                      </View>
                      <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.textSecondary, width: 64 }}>
                        Interest
                      </Text>
                      <TextInput
                        ref={depositInterestInputRef}
                        value={depositInterest}
                        onChangeText={setDepositInterest}
                        placeholder=""
                        placeholderTextColor={palette.textMuted}
                        cursorColor={palette.isDark ? '#FFFFFF' : palette.text}
                        keyboardType="decimal-pad"
                        style={{
                          flex: 1,
                          fontSize: HOME_TEXT.bodyLarge,
                          color: palette.text,
                          paddingVertical: 0,
                          minHeight: 28,
                          fontWeight: FONT_WEIGHT.regular,
                        }}
                      />
                      <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary, marginLeft: 6 }}>% p.a.</Text>
                    </Pressable>

                    <FormDivider palette={palette} indent={52} />

                    {/* Maturity Value */}
                    <Pressable
                       onPress={() => depositMaturityInputRef.current?.focus()}
                       style={{
                         flexDirection: 'row',
                         alignItems: 'center',
                         paddingHorizontal: 16,
                         paddingVertical: 12,
                         minHeight: 62,
                         gap: 12,
                       }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="trending-up" size={18} color={palette.text} />
                      </View>
                      <Text style={{ fontSize: HOME_TEXT.bodyLarge, color: palette.textSecondary, width: 64 }}>
                        Maturity
                      </Text>
                      <TextInput
                        ref={depositMaturityInputRef}
                        value={depositMaturityStr}
                        onChangeText={(v) => setDepositMaturityStr(formatIndianNumberStr(parseFormattedNumber(v)) || v)}
                        placeholder=""
                        placeholderTextColor={palette.textMuted}
                        cursorColor={palette.isDark ? '#FFFFFF' : palette.text}
                        keyboardType="decimal-pad"
                        style={{
                          flex: 1,
                          fontSize: HOME_TEXT.bodyLarge,
                          color: palette.text,
                          paddingVertical: 0,
                          minHeight: 28,
                          fontWeight: FONT_WEIGHT.regular,
                        }}
                      />
                    </Pressable>
                  </>
                )}
              </FormSection>

              {/* Notes */}
              <FormSection title="" palette={palette}>
                <InlineComboBox
                  label="Notes"
                  value={note}
                  onChange={setNote}
                  suggestions={[]}
                  multiline
                  palette={palette}
                  onFocus={() => {
                    handleFieldFocus(460);
                  }}
                  leftIcon="file-text"
                  hideLabel={true}
                  placeholder="Notes"
                />
              </FormSection>
            </>
          ) : null}

        </Pressable>
      </ScrollView>

      <FixedBottomActions palette={palette}>
        {attemptedSubmit && getValidationErrorMessage() ? (
          <Animated.View style={[shakeStyle, { alignItems: 'center', marginBottom: 8, paddingHorizontal: FORM_TOKENS.gutter }]}>
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

      {showTenureUnitSheet ? (
        <BottomSheet title="Tenure" palette={palette} onClose={() => setShowTenureUnitSheet(false)}>
          {(['months', 'days'] as const).map((unit, index, arr) => (
            <ChoiceRow
              key={unit}
              title={unit === 'months' ? 'Months' : 'Days'}
              selected={depositTenureUnit === unit}
              palette={palette}
              onPress={() => {
                setDepositTenureUnit(unit);
                setShowTenureUnitSheet(false);
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
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, paddingVertical: 12, paddingHorizontal: FORM_TOKENS.gutter }}>No accounts available</Text>
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
                paddingHorizontal: FORM_TOKENS.gutter,
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
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.body, paddingVertical: 12, paddingHorizontal: FORM_TOKENS.gutter }}>No tags created yet</Text>
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
        mode="date"
        value={new Date(date)}
        palette={palette}
        accentColor={activeConfig.color}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(nextDate) => {
          // Preserve the original hours/minutes/seconds/ms from the existing date
          const originalDate = new Date(date);
          const combinedDate = new Date(nextDate);
          combinedDate.setHours(
            originalDate.getHours(),
            originalDate.getMinutes(),
            originalDate.getSeconds(),
            originalDate.getMilliseconds()
          );
          setDate(combinedDate.toISOString());
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
                <AppIcon name="camera" size={20} color={palette.textSecondary} />
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
                <AppIcon name="image" size={20} color={palette.textSecondary} />
                <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, fontWeight: FONT_WEIGHT.semibold }}>Choose Photo</Text>
              </TouchableOpacity>
              <View style={{ padding: 16, backgroundColor: palette.surface, alignItems: 'center' }}>
                <TouchableOpacity
                  delayPressIn={0}
                  onPress={() => setShowReceiptSheet(false)}
                  style={{ paddingVertical: 12, paddingHorizontal: 20 }}
                >
                  <Text style={{ fontSize: HOME_TEXT.body, color: palette.textSecondary, fontWeight: FONT_WEIGHT.semibold }}>Cancel</Text>
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
  if (!category) return { name: 'Select Category', fullName: 'Select Category', icon: 'layout-grid' };
  if (!category.parentId) return { name: category.name, fullName: category.name, icon: category.icon || 'layout-grid' };
  const parent = categories.find((item) => item.id === category.parentId);
  const parentName = parent?.name ?? 'Category';
  return {
    name: category.name,
    parentName,
    fullName: `${parentName} › ${category.name}`,
    icon: parent?.icon || category.icon || 'layout-grid',
  };
}
