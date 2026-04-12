import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useColorScheme,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_GUTTER } from '../../lib/design';
import { useLoansStore } from '../../stores/useLoansStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { todayUTC, formatDate } from '../../lib/dateUtils';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { parseFormattedNumber } from '../../lib/derived';
import {
  HOME_RADIUS,
  HOME_SPACE,
  HOME_TEXT,
} from '../../lib/layoutTokens';

export default function AddLoanModal() {
  const { add } = useLoansStore();
  const { accounts, refresh } = useAccountsStore();
  const { settings } = useUIStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));

  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [personName, setPersonName] = useState('');
  const [direction, setDirection] = useState<'lent' | 'borrowed'>('lent');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayUTC());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const sym = settings.currencySymbol;

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(settings.defaultAccountId || accounts[0].id);
    }
  }, [accounts]);

  const amount = parseFloat(parseFormattedNumber(amountStr)) || 0;
  const isValid = amount > 0 && accountId && personName.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await add({
        personName: personName.trim(),
        direction,
        accountId,
        givenAmount: amount,
        note: note || undefined,
        date,
      });
      await refresh();
      router.back();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  };

  const openDate = () => {
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
          setShowDatePicker(false);
        },
      });
    } else {
      setShowDatePicker(true);
    }
  };

  const isLent = direction === 'lent';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: SCREEN_GUTTER,
            paddingTop: HOME_SPACE.sm,
            paddingBottom: HOME_SPACE.xl,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: HOME_SPACE.md, padding: HOME_SPACE.xs }}>
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>Add Loan</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Amount */}
        <View style={{ alignItems: 'center', paddingVertical: HOME_SPACE.xxl }}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginBottom: HOME_SPACE.sm }}>
            Amount
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 32, color: palette.textMuted, marginRight: HOME_SPACE.xs }}>{sym}</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={palette.textMuted}
              style={{
                fontSize: 40,
                fontWeight: '700',
                color: palette.loan,
                minWidth: 80,
                textAlign: 'center',
              }}
              autoFocus
            />
          </View>
        </View>

        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: HOME_RADIUS.large,
            marginHorizontal: SCREEN_GUTTER,
            overflow: 'hidden',
          }}
        >
          {/* Account */}
          <View
            style={{
              paddingHorizontal: HOME_SPACE.xl,
              paddingVertical: HOME_SPACE.lg,
              borderBottomWidth: 1,
              borderBottomColor: palette.inputBg,
            }}
          >
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: HOME_SPACE.sm }}>
              Account
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  onPress={() => setAccountId(acc.id)}
                    style={{
                      paddingHorizontal: HOME_SPACE.lg,
                      paddingVertical: HOME_SPACE.sm,
                      borderRadius: HOME_RADIUS.small,
                      marginRight: HOME_SPACE.sm,
                      backgroundColor: accountId === acc.id ? palette.loan : palette.inputBg,
                    }}
                >
                  <Text
                    style={{
                      fontSize: HOME_TEXT.body,
                      fontWeight: '500',
                      color: accountId === acc.id ? palette.onLoan : palette.textSecondary,
                    }}
                  >
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Person */}
          <View
            style={{
              paddingHorizontal: HOME_SPACE.xl,
              paddingVertical: HOME_SPACE.lg,
              borderBottomWidth: 1,
              borderBottomColor: palette.inputBg,
            }}
          >
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: HOME_SPACE.sm }}>
              Person
            </Text>
            <TextInput
              value={personName}
              onChangeText={setPersonName}
              placeholder="Name"
              placeholderTextColor={palette.textMuted}
              style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text }}
            />
          </View>

          {/* Direction */}
          <View
            style={{
              paddingHorizontal: HOME_SPACE.xl,
              paddingVertical: HOME_SPACE.lg,
              borderBottomWidth: 1,
              borderBottomColor: palette.inputBg,
            }}
          >
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: HOME_SPACE.sm }}>
              Direction
            </Text>
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md }}>
              {(['lent', 'borrowed'] as const).map((d) => {
                const active = direction === d;
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDirection(d)}
                    style={{
                      flex: 1,
                      paddingVertical: HOME_SPACE.md,
                      borderRadius: HOME_RADIUS.small,
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: active ? palette.loan : palette.divider,
                      backgroundColor: active ? palette.loanSoft : palette.surface,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: HOME_TEXT.body,
                        fontWeight: '600',
                        color: active ? palette.loan : palette.textSecondary,
                      }}
                    >
                      {d === 'lent' ? 'I lent' : 'I borrowed'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Date */}
          <TouchableOpacity
            onPress={openDate}
            style={{
              paddingHorizontal: HOME_SPACE.xl,
              paddingVertical: HOME_SPACE.lg,
              borderBottomWidth: 1,
              borderBottomColor: palette.inputBg,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Date</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: HOME_SPACE.sm }}>
              <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text }}>{formatDate(date)}</Text>
              <Ionicons name="calendar-outline" size={18} color={palette.textMuted} />
            </View>
          </TouchableOpacity>

          {showDatePicker && Platform.OS === 'ios' && (
            <DateTimePicker
              value={new Date(date)}
              mode="date"
              display="default"
              onChange={(_event, selectedDate) => {
                if (selectedDate) setDate(selectedDate.toISOString());
                setShowDatePicker(false);
              }}
              textColor={palette.text}
              accentColor={palette.loan}
            />
          )}

          {/* Note */}
          <View style={{ paddingHorizontal: HOME_SPACE.xl, paddingVertical: HOME_SPACE.lg }}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: HOME_SPACE.sm }}>
              Note
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note..."
              placeholderTextColor={palette.textMuted}
              style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text }}
            />
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: SCREEN_GUTTER,
          paddingBottom: insets.bottom + HOME_SPACE.xl,
          paddingTop: HOME_SPACE.md,
          backgroundColor: palette.background,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isValid || loading}
          style={{
            backgroundColor: isValid ? palette.loan : palette.textMuted,
            borderRadius: HOME_RADIUS.card,
            paddingVertical: HOME_SPACE.xl,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: palette.surface, fontSize: HOME_TEXT.heroLabel, fontWeight: '600' }}>
            Add
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
