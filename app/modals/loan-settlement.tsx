import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { ChoiceRow, FixedBottomActions } from '../../components/settings-ui';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { DateTimePickerPopup } from '../../components/ui/DateTimePickerPopup';
import {
  AmountRow,
  InteractiveDateTimeRow,
  NotesSection,
  PickerRow,
  ROW_COLUMN_GAP,
  ROW_LABEL_WIDTH,
  ROW_MIN_HEIGHT,
  SectionCard
} from '../../components/ui/transaction-form-primitives';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { nowUTC } from '../../lib/dateUtils';
import { formatCurrency, formatIndianNumberStr, getLoanSettlementLabel, getLoanTransactionUserNote, mergeLoanTransactionNote, parseFormattedNumber } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { HOME_TEXT, SCREEN_HEADER } from '../../lib/layoutTokens';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { getLoanById } from '../../services/loans';
import { getTransactionById } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';

export default function LoanSettlementModal() {
  const { editId, loanId } = useLocalSearchParams<{ editId?: string; loanId?: string }>();
  const isEditing = !!editId;
  const addTransaction = useTransactionsStore((s) => s.add);
  const updateTransaction = useTransactionsStore((s) => s.update);
  const removeTransaction = useTransactionsStore((s) => s.remove);
  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const loadLoans = useLoansStore((s) => s.load);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const displaySym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const { showAlert, showConfirm, dialog } = useAppDialog(palette);

  const [resolvedLoanId, setResolvedLoanId] = useState(loanId ?? '');
  const [personName, setPersonName] = useState('');
  const [loanDirection, setLoanDirection] = useState<'lent' | 'borrowed'>('lent');
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(nowUTC());
  const [note, setNote] = useState('');
  const [loanTransactionType, setLoanTransactionType] = useState<'principal' | 'interest' | 'others'>('principal');
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const amountInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      if (isEditing && editId) {
        getTransactionById(editId).then(async (tx) => {
          if (!tx?.loanId) return;
          const loan = await getLoanById(tx.loanId);
          if (!loan) return;
          setResolvedLoanId(loan.id);
          setPersonName(loan.personName);
          setLoanDirection(loan.direction);
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
        });
        return;
      }
      if (loanId) {
        getLoanById(loanId).then((loan) => {
          if (!loan) return;
          setResolvedLoanId(loan.id);
          setPersonName(loan.personName);
          setLoanDirection(loan.direction);
          setAccountId(loan.accountId);
          setDate(nowUTC());
        });
      }
    });
    return () => task.cancel();
  }, [editId, isEditing, loanId]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 250);
    });
    return () => task.cancel();
  }, []);

  const amount = parseFloat(parseFormattedNumber(amountStr)) || 0;
  const isValid = !!resolvedLoanId && !!accountId && amount !== 0;
  const title = isEditing ? `Edit ${loanDirection === 'lent' ? 'Receipt' : 'Payment'}` : loanDirection === 'lent' ? 'New Receipt' : 'New Payment';

  const handleSave = async () => {
    if (!isValid) return;
    try {
      const payload = {
        type: 'loan' as const,
        amount,
        accountId,
        loanId: resolvedLoanId,
        loanTransactionType,
        note: mergeLoanTransactionNote(getLoanSettlementLabel(loanDirection, personName), note),
        date
      };
      if (isEditing && editId) {
        await updateTransaction(editId, payload);
      } else {
        await addTransaction(payload);
      }
      router.back();
      // Background refresh after navigation
      Promise.all([refreshAccounts(), loadLoans()]).catch(() => { });
    } catch (e) {
      showAlert('Error', String(e));
    }
  };

  const handleDelete = () => {
    if (!editId) return;
    showConfirm({
      title: 'Delete Transaction',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        await removeTransaction(editId);
        router.back();
        Promise.all([refreshAccounts(), loadLoans()]).catch(() => { });
      },
    });
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
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity delayPressIn={0} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: SCREEN_HEADER.iconTitleGap }}>
            <AppIcon name="x" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text }}>{title}</Text>
        </View>
      </SafeAreaView>

      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 132 }}>
        <View style={{ paddingBottom: 20 }}>
          <SectionCard palette={palette}>
            <InteractiveDateTimeRow date={date} palette={palette} onOpenDate={openDate} onOpenTime={openTime} />
            <FieldRow label="Person" palette={palette}>
              <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '400', color: palette.text }}>
                {personName || 'Person'}
              </Text>
            </FieldRow>
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
                <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary }}>
                  Loan outstanding balance will not be affected.
                </Text>
              </View>
            )}
            <AmountRow
              inputRef={amountInputRef}
              sym={displaySym}
              amountStr={amountStr}
              setAmountStr={setAmountStr}
              palette={palette}
              accentColor={palette.loan}
              autoFocus
              onOpenCalculator={() => {
                Keyboard.dismiss();
                setShowCalculator(true);
              }}
            />
            <PickerRow
              label="Account"
              value={getAccountName(accounts, accountId) || 'Select...'}
              placeholder={!accountId}
              palette={palette}
              onPress={() => {
                Keyboard.dismiss();
                InteractionManager.runAfterInteractions(() => setShowAccountSheet(true));
              }}
            />
            <NotesSection
              note={note}
              onChangeNote={setNote}
              palette={palette}
              accentColor={palette.loan}
            />
          </SectionCard>
        </View>
      </ScrollView>

      <FixedBottomActions palette={palette}>
        <FilledButton
          label={isEditing ? 'Save changes' : loanDirection === 'lent' ? 'Add receipt' : 'Add payment'}
          onPress={handleSave}
          disabled={!isValid}
          palette={palette}
          tone="loan"
        />
        {isEditing ? (
          <TextButton label="Delete transaction" onPress={handleDelete} palette={palette} tone="danger" />
        ) : null}
      </FixedBottomActions>

      {showAccountSheet ? (
        <BottomSheet title="Select Account" palette={palette} onClose={() => setShowAccountSheet(false)}>
          {accounts.map((account, index) => (
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
          ))}
        </BottomSheet>
      ) : null}

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

      <CalculatorSheet
        visible={showCalculator}
        value={amountStr.replace(/,/g, '')}
        palette={palette}
        brandColor={palette.loan}
        brandSoft={palette.loanSoft}
        brandOnColor={palette.onLoan}
        onClose={() => setShowCalculator(false)}
        onApply={(finalValue) => {
          setShowCalculator(false);
          setAmountStr(formatIndianNumberStr(finalValue));
        }}
      />

      <DateTimePickerPopup
        visible={showDatePicker}
        mode={pickerMode}
        value={new Date(date)}
        palette={palette}
        accentColor={palette.loan}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(nextDate) => setDate(nextDate.toISOString())}
      />
      {dialog}
    </KeyboardAvoidingView>
  );
}

function FieldRow({ label, children, palette }: { label: string; children: React.ReactNode; palette: AppThemePalette }) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
      <Text
        appWeight="medium"
        numberOfLines={1}
        style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.textMuted, width: ROW_LABEL_WIDTH, paddingRight: ROW_COLUMN_GAP }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, minWidth: 0, minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingLeft: 4 }}>
        {children}
      </View>
    </View>
  );
}

function getAccountName(accounts: Array<{ id: string; name: string }>, accountId: string) {
  return accounts.find((a) => a.id === accountId)?.name;
}
