import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { ChoiceRow, FixedBottomActions, FormSection } from '../../components/settings-ui';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { DateTimePickerPopup } from '../../components/ui/DateTimePickerPopup';
import { sanitizeDecimalInput } from '../../components/ui/transaction-form-primitives';
import { AppChevron } from '../../components/ui/AppChevron';
import { InlineComboBox } from '../../components/ui/InlineComboBox';
import { APP_LOCALE, formatDate } from '../../lib/dateUtils';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { formatSignedCurrency, formatIndianNumberStr, getLoanSettlementLabel, getLoanTransactionUserNote, mergeLoanTransactionNote, parseFormattedNumber } from '../../lib/derived';
import { FONT_WEIGHT } from '../../lib/design';
import { getScrollableBottomPadding } from '../../components/ui/safeBottom';
import { HOME_TEXT, SCREEN_HEADER, FORM_TOKENS, HOME_RADIUS } from '../../lib/layoutTokens';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { getLoanById } from '../../services/loans';
import { getTransactionById, getRecentNotes } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useGlobalNotice } from '../../stores/useGlobalNotice';
import { ACCOUNT_TYPE_META } from '../../lib/settings-shared';
import type { Account } from '../../types';
import { useLoansStore } from '../../stores/useLoansStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';
import { updateAllReniWidgets } from '../../widgets/widgetTaskHandler';

function AnimatedWarningBox({ visible, children }: { visible: boolean; children: React.ReactNode }) {
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

export default function LoanSettlementModal() {
  const { editId, loanId } = useLocalSearchParams<{ editId?: string; loanId?: string }>();
  const isEditing = !!editId;
  const addTransaction = useTransactionsStore((s) => s.add);
  const removeTransaction = useTransactionsStore((s) => s.remove);
  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const loadLoans = useLoansStore((s) => s.load);
  const updateLoanSettlement = useLoansStore((s) => s.updateSettlement);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const displaySym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { showConfirm, dialog } = useAppDialog(palette);

  const [resolvedLoanId, setResolvedLoanId] = useState(loanId ?? '');
  const [personName, setPersonName] = useState('');
  const [loanDirection, setLoanDirection] = useState<'lent' | 'borrowed'>('lent');
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString());
  const [note, setNote] = useState('');
  const [loanTransactionType, setLoanTransactionType] = useState<'principal' | 'interest' | 'others'>('principal');
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const amountInputRef = useRef<TextInput | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [initialTx, setInitialTx] = useState<any | null>(null);
  const shakeOffset = useSharedValue(0);
  const [noteSuggestions, setNoteSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const term = note.trim();
    if (!term || term.length < 1) {
      setNoteSuggestions([]);
      return;
    }
    getRecentNotes(term, 5).then((results) => {
      setNoteSuggestions(results.filter((r) => r.toLowerCase() !== term.toLowerCase()));
    });
  }, [note]);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
  }));

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
          setInitialTx(tx);
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
          const initialDate = new Date().toISOString();
          setDate(initialDate);
        });
      }
    });
    return () => task.cancel();
  }, [editId, isEditing, loanId]);

  const scrollViewRef = useRef<ScrollView>(null);
  const currentScrollYRef = useRef(0);
  const preFocusScrollYRef = useRef<number | null>(null);

  const handleFieldFocus = (target: number) => {
    if (preFocusScrollYRef.current === null) {
      preFocusScrollYRef.current = currentScrollYRef.current;
    }
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: target, animated: true });
    }, 180);
  };

  useEffect(() => {
    if (!isEditing) {
      const task = InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          amountInputRef.current?.focus();
        }, 250);
      });
      return () => task.cancel();
    }
  }, [isEditing]);

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

  const checkIsDirty = () => {
    if (isEditing) {
      if (!initialTx) return false;
      const originalAmountStr = formatIndianNumberStr(String(initialTx.amount));
      const originalNote = getLoanTransactionUserNote(initialTx.note);
      const originalType = initialTx.loanTransactionType || 'principal';
      return (
        amountStr !== originalAmountStr ||
        accountId !== initialTx.accountId ||
        date !== initialTx.date ||
        note !== originalNote ||
        loanTransactionType !== originalType
      );
    }
    return amountStr !== '' || note !== '';
  };

  const closeScreen = () => {
    if (checkIsDirty()) {
      showConfirm({
        title: 'Discard Changes',
        message: 'Are you sure you want to discard your changes?',
        confirmLabel: 'Discard',
        onConfirm: () => {
          router.back();
        },
      });
      return;
    }
    router.back();
  };

  useEffect(() => {
    const onBackPress = () => {
      if (checkIsDirty()) {
        showConfirm({
          title: 'Discard Changes',
          message: 'Are you sure you want to discard your changes?',
          confirmLabel: 'Discard',
          onConfirm: () => {
            router.back();
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
  }, [initialTx, amountStr, accountId, date, note, loanTransactionType]);

  const amount = parseFloat(parseFormattedNumber(amountStr)) || 0;
  const isValid = !!resolvedLoanId && !!accountId && amount !== 0;
  const title = isEditing ? `Edit ${loanDirection === 'lent' ? 'Receipt' : 'Payment'}` : loanDirection === 'lent' ? 'New Receipt' : 'New Payment';
  const dt = new Date(date);
  const dayName = dt.toLocaleDateString(APP_LOCALE, { weekday: 'short' });
  const dateFormatted = `${dayName}, ${formatDate(date)}`;

  const closeAndRun = (work: () => Promise<unknown>, afterCommit?: () => Promise<unknown>) => {
    Keyboard.dismiss();
    router.back();
    // Wait 50ms to let the transition start smoothly before firing heavy queries
    setTimeout(() => {
      (async () => {
        try {
          await work();
          await afterCommit?.();
          updateAllReniWidgets().catch(() => undefined);
        } catch (e) {
          useGlobalNotice.getState().show(String(e));
        }
      })();
    }, 50);
  };

  const handleSave = () => {
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
    const payload = {
      type: 'loan' as const,
      amount,
      accountId,
      loanId: resolvedLoanId,
      loanTransactionType,
      note: mergeLoanTransactionNote(getLoanSettlementLabel(loanDirection, personName), note),
      date,
    };
    const work = isEditing && editId
      ? () => updateLoanSettlement(editId, payload)
      : () => addTransaction(payload);

    closeAndRun(
      work,
      isEditing
        ? () => refreshAccounts()
        : () => loadLoans()
    );
  };

  const handleDelete = () => {
    if (!editId) return;
    const id = editId;
    showConfirm({
      title: 'Delete Transaction',
      message: 'This cannot be undone.',
      confirmLabel: 'Confirm',
      destructive: true,
      onConfirm: () => {
        closeAndRun(() => removeTransaction(id));
      },
    });
  };

  const openDate = () => {
    Keyboard.dismiss();
    setPickerMode('date');
    setShowDatePicker(true);
  };


  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <TouchableOpacity delayPressIn={0} onPress={closeScreen} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: SCREEN_HEADER.iconTitleGap }}>
            <AppIcon name="x" size={18} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text }}>{title}</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        ref={scrollViewRef}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets, 120) + keyboardHeight }}
        onScroll={(e) => {
          currentScrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          preFocusScrollYRef.current = null;
        }}
      >
        <View style={{ paddingBottom: 20 }}>
          
          {/* Centered Large Amount Input pressable */}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center', position: 'relative' }}>
              {showCurrencySymbol && (
                <Text style={{ fontSize: 24, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginRight: 4 }}>
                  {currencySymbol}
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
                style={{
                  fontSize: 34,
                  fontWeight: FONT_WEIGHT.regular,
                  color: palette.brand,
                  letterSpacing: 0,
                  textAlign: 'center',
                  minWidth: 60,
                  paddingTop: 0,
                  paddingBottom: 2,
                  lineHeight: 38,
                }}
                autoFocus={!isEditing}
              />
            </View>
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
              <TouchableOpacity onPress={openDate} style={{ justifyContent: 'center' }}>
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary }}>
                  {dateFormatted}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setShowCalculator(true);
              }}
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

          {/* FormSection 1: Loan Details (Person and Type) */}
          <FormSection title="Loan Details" palette={palette}>
            {/* Person Row (Static PH Style) */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 62,
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
                <AppIcon name="user" size={21} color={palette.brand} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  appWeight="medium"
                  numberOfLines={1}
                  style={{
                    fontSize: HOME_TEXT.bodyLarge,
                    color: personName ? palette.text : palette.textMuted,
                    fontWeight: FONT_WEIGHT.semibold,
                  }}
                >
                  {personName || 'Person'}
                </Text>
              </View>
            </View>

            <PremiumDivider palette={palette} />

            {/* Type Row (Interactive) */}
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                InteractionManager.runAfterInteractions(() => setShowTypeSheet(true));
              }}
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
              <View
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="tag" size={21} color={palette.brand} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  appWeight="medium"
                  numberOfLines={1}
                  style={{ fontSize: HOME_TEXT.bodyLarge, fontWeight: FONT_WEIGHT.medium, color: palette.text }}
                >
                  {loanTransactionType === 'principal'
                    ? 'Principal'
                    : loanTransactionType === 'interest'
                      ? 'Interest'
                      : 'Others'}
                </Text>
              </View>
              <AppChevron direction="right" size={18} tone="secondary" color={palette.textMuted} palette={palette} />
            </TouchableOpacity>
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

          {/* FormSection 2: Account Selection */}
          <FormSection title="Account" palette={palette}>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                InteractionManager.runAfterInteractions(() => setShowAccountSheet(true));
              }}
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
                      <Text
                        appWeight="medium"
                        numberOfLines={1}
                        style={{ fontSize: HOME_TEXT.bodyLarge, fontWeight: FONT_WEIGHT.medium, color: palette.text }}
                      >
                        {formatAccountDisplayName(acc.name, acc.accountNumber)}
                      </Text>
                      <Text
                        appWeight="medium"
                        style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, marginTop: 1 }}
                      >
                        {formatSignedCurrency(acc.balance, displaySym)}
                      </Text>
                    </View>
                  </>
                );
              })() : (
                <>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppIcon name="credit-card" size={21} color={attemptedSubmit && !accountId ? palette.negative : palette.brand} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      appWeight="medium"
                      style={{
                        fontSize: HOME_TEXT.bodyLarge,
                        color: attemptedSubmit && !accountId ? palette.negative : palette.textSecondary,
                      }}
                    >
                      Select Account
                    </Text>
                  </View>
                </>
              )}
              <AppChevron direction="right" size={18} tone="secondary" color={palette.textMuted} palette={palette} />
            </TouchableOpacity>
          </FormSection>

          {/* FormSection 3: Notes */}
          <FormSection title="" palette={palette}>
            <InlineComboBox
              label="Notes"
              value={note}
              onChange={setNote}
              suggestions={noteSuggestions}
              multiline
              palette={palette}
              onFocus={() => {
                handleFieldFocus(450);
              }}
              leftIcon="file-text"
              hideLabel={true}
              placeholder="Notes"
            />
          </FormSection>
        </View>
      </ScrollView>

      <FixedBottomActions palette={palette}>
        <Animated.View style={[shakeStyle, { width: '100%' }]}>
          <FilledButton
            label={isEditing ? 'Save changes' : loanDirection === 'lent' ? 'Add receipt' : 'Add payment'}
            onPress={handleSave}
            disabled={false}
            palette={palette}
            tone="brand"
          />
        </Animated.View>
        {isEditing ? (
          <TextButton label="Delete transaction" onPress={handleDelete} palette={palette} tone="danger" />
        ) : null}
      </FixedBottomActions>

      {showAccountSheet ? (
        <BottomSheet title="Select Account" palette={palette} onClose={() => setShowAccountSheet(false)} fixedHeightRatio={0.80}>
          {accounts.map((account, index) => (
            <ChoiceRow
              key={account.id}
              title={formatAccountDisplayName(account?.name ?? '', account?.accountNumber)}
              subtitle={`${account.type.charAt(0).toUpperCase() + account.type.slice(1)} · ${formatSignedCurrency(account.balance, displaySym, { zeroPlaceholder: '0' })}`}
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
        brandColor={palette.brand}
        brandSoft={palette.brandSoft}
        brandOnColor={palette.onBrand}
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

function PremiumDivider({ palette }: { palette: AppThemePalette }) {
  return <View style={{ height: 1, backgroundColor: palette.borderSoft, marginLeft: FORM_TOKENS.dividerIndent }} />;
}

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

