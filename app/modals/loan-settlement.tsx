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
import { formatAccountDisplayName } from '../../lib/account-utils';
import { formatDate, nowUTC } from '../../lib/dateUtils';
import { formatCurrency, formatIndianNumberStr, getLoanSettlementLabel, parseFormattedNumber } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { getLoanById } from '../../services/loans';
import { getTransactionById } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';

const ROW_LABEL_WIDTH = 92;
const ROW_MIN_HEIGHT = 62;
const ROW_COLUMN_GAP = 16;
const ROW_TRAILING_WIDTH = 24;

function sanitizeDecimalInput(value: string): string {
  let cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const parts = cleaned.split('.');
  if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
  if (cleaned.length > 1 && cleaned.startsWith('0') && cleaned[1] !== '.') cleaned = cleaned.substring(1);
  return cleaned;
}

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
          <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: palette.text }}>{title}</Text>
        </View>
      </SafeAreaView>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 132 }}>
        <View style={{ paddingBottom: 20 }}>
          <SectionCard palette={palette}>
            <InteractiveDateTimeRow date={date} palette={palette} onOpenDate={openDate} onOpenTime={openTime} />
            <FieldRow label="Loan" palette={palette}>
              <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>
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
                setTimeout(() => setShowAccountSheet(true), 50);
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
          <Text style={{ color: palette.onBrand, fontSize: 16, fontWeight: '600' }}>
            {isEditing ? 'Save changes' : loanDirection === 'lent' ? 'Add receipt' : 'Add repayment'}
          </Text>
        </TouchableOpacity>
        {isEditing ? (
          <TouchableOpacity onPress={handleDelete} style={{ alignItems: 'center' }}>
            <Text style={{ color: palette.negative, fontSize: 15, fontWeight: '500' }}>Delete transaction</Text>
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

function FieldRow({ label, children, palette }: { label: string; children: React.ReactNode; palette: AppThemePalette }) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
      <Text
        numberOfLines={1}
        style={{ fontSize: 13, fontWeight: '700', color: palette.textMuted, width: ROW_LABEL_WIDTH, paddingRight: ROW_COLUMN_GAP }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, minWidth: 0, minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingLeft: 4 }}>
        {children}
      </View>
    </View>
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
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: SCREEN_GUTTER, minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
      <Text
        numberOfLines={1}
        style={{ fontSize: 13, fontWeight: '700', color: palette.textMuted, width: ROW_LABEL_WIDTH, paddingRight: ROW_COLUMN_GAP }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0, minHeight: ROW_MIN_HEIGHT, paddingLeft: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: '400', color: placeholder ? palette.textMuted : palette.text, textAlign: 'left', flexShrink: 1 }} numberOfLines={1}>
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
    <View style={{ paddingHorizontal: SCREEN_GUTTER, minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textMuted, width: ROW_LABEL_WIDTH, paddingRight: ROW_COLUMN_GAP }}>
        Date
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: ROW_MIN_HEIGHT, paddingLeft: 4, gap: 8 }}>
        <TouchableOpacity onPress={onOpenDate} style={{ flex: 1.5, backgroundColor: palette.inputBg, paddingVertical: 9, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{dateStr}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenTime} style={{ flex: 0.9, backgroundColor: palette.inputBg, paddingVertical: 9, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{timeStr}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AmountRow({
  sym,
  amountStr,
  setAmountStr,
  palette,
  accentColor,
}: {
  sym: string;
  amountStr: string;
  setAmountStr: (value: string) => void;
  palette: AppThemePalette;
  accentColor: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
      <Text
        numberOfLines={1}
        style={{ fontSize: 13, fontWeight: '700', color: palette.textMuted, width: ROW_LABEL_WIDTH, paddingRight: ROW_COLUMN_GAP }}
      >
        Amount {sym ? `(${sym})` : ''}
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={amountStr}
            onChangeText={(value: string) => setAmountStr(formatIndianNumberStr(sanitizeDecimalInput(value)))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={palette.textSoft}
            style={{
              flex: 1,
              fontSize: 20,
              fontWeight: '500',
              color: accentColor,
              paddingBottom: 2,
              paddingTop: 0,
              paddingLeft: 4,
              textAlign: 'left',
              lineHeight: 24,
              borderBottomWidth: isFocused ? 1.5 : 1,
              borderBottomColor: isFocused ? accentColor : palette.borderSoft,
            }}
            cursorColor={accentColor}
            autoFocus
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </View>
      </View>
    </View>
  );
}

function getAccountName(accounts: Array<{ id: string; name: string }>, accountId: string) {
  return accounts.find((a) => a.id === accountId)?.name;
}
