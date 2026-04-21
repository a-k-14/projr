import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { Alert,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  
  View , TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChoiceRow } from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { DateTimePickerPopup } from '../../components/ui/DateTimePickerPopup';
import {
  AmountRow,
  InteractiveDateTimeRow,
  PickerRow,
  ROW_COLUMN_GAP,
  ROW_LABEL_WIDTH,
  ROW_MIN_HEIGHT,
  SectionCard } from '../../components/ui/transaction-form-primitives';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { nowUTC } from '../../lib/dateUtils';
import { formatCurrency, formatIndianNumberStr, getLoanSettlementLabel, parseFormattedNumber } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
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
  const insets = useSafeAreaInsets();

  const [resolvedLoanId, setResolvedLoanId] = useState(loanId ?? '');
  const [personName, setPersonName] = useState('');
  const [loanDirection, setLoanDirection] = useState<'lent' | 'borrowed'>('lent');
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(nowUTC());
  const [loading] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

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

  const amount = parseFloat(parseFormattedNumber(amountStr)) || 0;
  const isValid = !!resolvedLoanId && !!accountId && amount !== 0;
  const title = isEditing ? `Edit ${loanDirection === 'lent' ? 'receipt' : 'repayment'}` : loanDirection === 'lent' ? 'New receipt' : 'New repayment';

  const handleSave = async () => {
    if (!isValid) return;
    try {
      const payload = {
        type: 'loan' as const,
        amount,
        accountId,
        loanId: resolvedLoanId,
        note: getLoanSettlementLabel(loanDirection, personName),
        date };
      if (isEditing && editId) {
        await updateTransaction(editId, payload);
      } else {
        await addTransaction(payload);
      }
      router.back();
      // Background refresh after navigation
      Promise.all([refreshAccounts(), loadLoans()]).catch(() => {});
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  const handleDelete = () => {
    if (!editId) return;
    Alert.alert('Delete transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeTransaction(editId);
          router.back();
          Promise.all([refreshAccounts(), loadLoans()]).catch(() => {});
        } },
    ]);
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
          <TouchableOpacity delayPressIn={0} onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>{title}</Text>
        </View>
      </SafeAreaView>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 132 }}>
        <View style={{ paddingBottom: 20 }}>
          <SectionCard palette={palette}>
            <InteractiveDateTimeRow date={date} palette={palette} onOpenDate={openDate} onOpenTime={openTime} />
            <FieldRow label="Loan" palette={palette}>
              <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '500', color: palette.text }}>
                {personName || 'Loan'}
                <Text style={{ color: palette.textSecondary, fontWeight: '400' }}>
                  {' '}
                  {'\u2022'} {loanDirection === 'lent' ? 'Receipt' : 'Repayment'}
                </Text>
              </Text>
            </FieldRow>
            <AmountRow
              sym={displaySym}
              amountStr={amountStr}
              setAmountStr={setAmountStr}
              palette={palette}
              accentColor={palette.loan}
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
          </SectionCard>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: Math.max(insets.bottom, 12) + 12, paddingTop: 8 }}>
        <TouchableOpacity delayPressIn={0}
          onPress={handleSave}
          disabled={!isValid}
          style={{
            backgroundColor: isValid ? palette.loan : palette.textSoft,
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: 'center',
            marginBottom: 12 }}
        >
          <Text style={{ color: isValid ? palette.onLoan : palette.textMuted, fontSize: HOME_TEXT.rowLabel, fontWeight: '600' }}>
            {isEditing ? 'Save changes' : loanDirection === 'lent' ? 'Add receipt' : 'Add repayment'}
          </Text>
        </TouchableOpacity>
        {isEditing ? (
          <TouchableOpacity delayPressIn={0} onPress={handleDelete} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: palette.negative, fontSize: HOME_TEXT.sectionTitle, fontWeight: '500' }}>Delete transaction</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {showAccountSheet ? (
        <BottomSheet title="Select account" palette={palette} onClose={() => setShowAccountSheet(false)}>
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

      <DateTimePickerPopup
        visible={showDatePicker}
        mode={pickerMode}
        value={new Date(date)}
        palette={palette}
        accentColor={palette.loan}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(nextDate) => setDate(nextDate.toISOString())}
      />
    </KeyboardAvoidingView>
  );
}

function FieldRow({ label, children, palette }: { label: string; children: React.ReactNode; palette: AppThemePalette }) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
      <Text
        appWeight="medium"
        numberOfLines={1}
        style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted, width: ROW_LABEL_WIDTH, paddingRight: ROW_COLUMN_GAP }}
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
