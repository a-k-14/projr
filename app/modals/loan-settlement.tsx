import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChoiceRow } from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import {
  AmountRow,
  InteractiveDateTimeRow,
  PickerRow,
  ROW_COLUMN_GAP,
  ROW_LABEL_WIDTH,
  ROW_MIN_HEIGHT,
  SectionCard,
} from '../../components/ui/transaction-form-primitives';
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
  const [loading, setLoading] = useState(false);
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
  const isValid = !!resolvedLoanId && !!accountId && amount > 0;
  const title = isEditing ? `Edit ${loanDirection === 'lent' ? 'receipt' : 'repayment'}` : loanDirection === 'lent' ? 'New receipt' : 'New repayment';

  const handleSave = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const payload = {
        type: 'loan' as const,
        amount,
        accountId,
        loanId: resolvedLoanId,
        note: getLoanSettlementLabel(loanDirection, personName),
        date,
      };
      if (isEditing && editId) {
        await updateTransaction(editId, payload);
      } else {
        await addTransaction(payload);
      }
      await refreshAccounts();
      await loadLoans();
      router.back();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
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
          await refreshAccounts();
          await loadLoans();
          router.back();
        },
      },
    ]);
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
        onChange: (_event, selectedTime) => {
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
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
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
        <TouchableOpacity
          onPress={handleSave}
          disabled={!isValid || loading}
          style={{
            backgroundColor: isValid ? palette.loan : palette.textSoft,
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: palette.onBrand, fontSize: HOME_TEXT.rowLabel, fontWeight: '600' }}>
            {isEditing ? 'Save changes' : loanDirection === 'lent' ? 'Add receipt' : 'Add repayment'}
          </Text>
        </TouchableOpacity>
        {isEditing ? (
          <TouchableOpacity onPress={handleDelete} style={{ alignItems: 'center' }}>
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

      {showDatePicker && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={new Date(date)}
          mode={pickerMode}
          display="default"
          onChange={onDateChange}
          textColor={palette.text}
          accentColor={palette.tabActive}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function FieldRow({ label, children, palette }: { label: string; children: React.ReactNode; palette: AppThemePalette }) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
      <Text
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
