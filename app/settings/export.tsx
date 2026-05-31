import { Text } from '@/components/ui/AppText';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { AppIcon } from '../../components/ui/AppIcon';
import { FilledButton } from '../../components/ui/AppButton';
import { FixedBottomActions, SettingsScreenLayout } from '../../components/settings-ui';
import { ActivityPeriodHeader } from '../../components/activity/ActivityPeriodHeader';
import { AccountFilterSheet } from '../../components/activity/AccountFilterSheet';
import { PeriodFilterSheet, type FilterPeriod } from '../../components/activity/PeriodFilterSheet';
import { AccountPickerButton } from '../../components/ui/AccountPickerButton';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { FONT_WEIGHT, HOME_TEXT, SCREEN_GUTTER, SPACING } from '../../lib/design';
import { getNavigableDateRange, getPeriodNavLabel } from '../../lib/dateUtils';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { exportTransactionsCsv } from '../../services/export';
import type { TransactionFilters } from '../../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function ddMmmYyyy(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

export default function ExportScreen() {
  const { palette } = useAppTheme();
  const accounts = useAccountsStore((s) => s.accounts);
  const yearStart = useUIStore((s) => s.settings.yearStart);

  const [period, setPeriod] = useState<FilterPeriod>('all');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState<string | undefined>();
  const [customTo, setCustomTo] = useState<string | undefined>();
  const [accountId, setAccountId] = useState<string | 'all'>('all');

  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmAllPending, setConfirmAllPending] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ rowCount: number } | null>(null);

  const shakeOffset = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeOffset.value }] }));

  // Check-mark badge that appears over the mascot when an export completes.
  // Scales in (spring), holds, then fades + scales out as we clear successInfo.
  const successScale = useSharedValue(0);
  const successOpacity = useSharedValue(0);
  const successStyle = useAnimatedStyle(() => ({ opacity: successOpacity.value, transform: [{ scale: successScale.value }] }));
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (successInfo) {
      successScale.value = withSpring(1, { damping: 11, stiffness: 240, mass: 0.5 });
      successOpacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
      // Auto-clear after a short hold so the screen returns to its normal state.
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => setSuccessInfo(null), 3000);
    } else {
      successOpacity.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) });
      successScale.value = withDelay(120, withTiming(0, { duration: 0 }));
    }
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, [successInfo, successScale, successOpacity]);

  const dateRange = useMemo(() => {
    if (period === 'all') return null;
    if (period === 'custom') return customFrom && customTo ? { from: customFrom, to: customTo } : null;
    return getNavigableDateRange(period, periodOffset, yearStart);
  }, [period, periodOffset, customFrom, customTo, yearStart]);

  // Label shown on the period control (absolute, e.g. "March 2026").
  const periodLabel = useMemo(() => {
    if (period === 'all' || !dateRange) return 'All Time';
    return getPeriodNavLabel(period, dateRange.from, dateRange.to);
  }, [period, dateRange]);

  // Dynamic summary phrasing:
  //   - Custom range  → just the dates (no relative name to fall back on).
  //   - Today/Yesterday → "Today (27-May-2026)".
  //   - This Week/Month/Year (offset 0) → "This Month (Mar 2026)".
  //   - Past Day → "Mon, 26 May" (single date, no period name needed).
  //   - Past Week/Month/Year → just the absolute range label ("Feb 2026", "2025", "23 – 29 Mar").
  //   - All Time → "All Time".
  const summaryPeriodText = useMemo(() => {
    if (period === 'all') return 'All Time';
    if (!dateRange) return periodLabel;
    if (period === 'custom') {
      const from = ddMmmYyyy(new Date(dateRange.from));
      const to = ddMmmYyyy(new Date(dateRange.to));
      return from === to ? from : `${from} – ${to}`;
    }
    if (period === 'day') {
      const date = ddMmmYyyy(new Date(dateRange.from));
      if (periodOffset === 0) return `Today (${date})`;
      if (periodOffset === -1) return `Yesterday (${date})`;
      return date;
    }
    if (periodOffset === 0) {
      const relative = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'This Year';
      return `${relative} (${periodLabel})`;
    }
    return periodLabel;
  }, [period, periodOffset, periodLabel, dateRange]);

  const account = accountId === 'all' ? null : accounts.find((a) => a.id === accountId);
  const accountLabel = account ? account.name : 'All Accounts';
  const canGoNext = period !== 'all' && period !== 'custom' && periodOffset < 0;
  const isFullExport = period === 'all' && accountId === 'all';
  const resetConfirm = () => setConfirmAllPending(false);

  const handleExport = async () => {
    if (isFullExport && !confirmAllPending) {
      setConfirmAllPending(true);
      shakeOffset.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      return;
    }

    setExporting(true);
    try {
      const filters: TransactionFilters = {
        accountId: accountId === 'all' ? undefined : accountId,
        fromDate: dateRange?.from,
        toDate: dateRange?.to,
      };
      const slug = `${summaryPeriodText}_${accountLabel}`.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const fileName = `transactions_${slug}_${ddMmmYyyy(new Date())}.csv`;
      const result = await exportTransactionsCsv(filters, fileName);
      if (result.status === 'success') {
        setSuccessInfo({ rowCount: result.rowCount });
      } else if (result.status === 'empty') {
        Alert.alert('Nothing to Export', 'No transactions match the selected period and account.');
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message ?? 'Could not export CSV.');
    } finally {
      setExporting(false);
      setConfirmAllPending(false);
    }
  };

  return (
    <>
      <SettingsScreenLayout
        palette={palette}
        bottomAction={
          <FixedBottomActions palette={palette}>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 12 }}>
              Exporting data for <Text style={{ color: palette.text, fontWeight: FONT_WEIGHT.semibold }}>{summaryPeriodText}</Text>
              {' for '}
              <Text style={{ color: palette.text, fontWeight: FONT_WEIGHT.semibold }}>{accountLabel}</Text>
            </Text>
            {confirmAllPending ? (
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.negative, textAlign: 'center', marginBottom: 10 }}>
                You are exporting all the data as no filters are selected. Tap again to continue export.
              </Text>
            ) : null}
            <Animated.View style={[shakeStyle, { width: '100%' }]}>
              <FilledButton
                label={exporting ? 'Exporting…' : 'Export CSV'}
                onPress={handleExport}
                palette={palette}
                disabled={exporting}
                startIcon={<AppIcon name="download" size={18} color={palette.onBrand} strokeWidth={2} />}
              />
            </Animated.View>
          </FixedBottomActions>
        }
      >
        <View style={{ alignItems: 'center', paddingTop: SPACING.xl, paddingBottom: SPACING.lg }}>
          <View>
            <FinanceEmptyMascot palette={palette} variant="activity" mood="bright" />
            {/* Check-mark badge overlaid on the mascot when an export completes. */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  right: -6,
                  bottom: -2,
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: palette.positive,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: palette.background,
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 6,
                  elevation: 4,
                },
                successStyle,
              ]}
            >
              <AppIcon name="check" size={26} color={palette.onBrand} strokeWidth={3.2} />
            </Animated.View>
          </View>
          <Text style={{ marginTop: SPACING.md, fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.semibold, color: successInfo ? palette.positive : palette.text, textAlign: 'center' }}>
            {successInfo ? 'Export Complete' : 'Take your data with you'}
          </Text>
          <Text style={{ marginTop: 6, fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, textAlign: 'center', paddingHorizontal: SCREEN_GUTTER, lineHeight: 19 }}>
            {successInfo
              ? `${successInfo.rowCount} transaction${successInfo.rowCount === 1 ? '' : 's'} exported to CSV.`
              : 'Export your transactions as a CSV file you can open in any spreadsheet.'}
          </Text>
        </View>
        <View style={{ paddingHorizontal: SCREEN_GUTTER, gap: SPACING.md, marginTop: SPACING.md }}>
          <FilterRow label="Period" palette={palette}>
            <ActivityPeriodHeader
              period={period}
              periodLabel={periodLabel}
              goPrev={() => { if (period !== 'all' && period !== 'custom') { resetConfirm(); setPeriodOffset((v) => v - 1); } }}
              goNext={() => { if (canGoNext) { resetConfirm(); setPeriodOffset((v) => v + 1); } }}
              canGoNext={canGoNext}
              setShowPeriodSheet={() => { resetConfirm(); setShowPeriodSheet(true); }}
              palette={palette}
              largeArrows
            />
          </FilterRow>
          <FilterRow label="Account" palette={palette}>
            <View style={{ flex: 1 }}>
              <AccountPickerButton
                label={accountLabel}
                onPress={() => { resetConfirm(); setShowAccountSheet(true); }}
                palette={palette}
              />
            </View>
          </FilterRow>
        </View>
      </SettingsScreenLayout>

      {showPeriodSheet ? (
        <PeriodFilterSheet
          period={period}
          periodOffset={periodOffset}
          customFrom={customFrom}
          customTo={customTo}
          yearStart={yearStart}
          palette={palette}
          onSelectPeriod={(p, offset) => {
            resetConfirm();
            setPeriod(p);
            setPeriodOffset(offset);
            setCustomFrom(undefined);
            setCustomTo(undefined);
            setShowPeriodSheet(false);
          }}
          onApplyCustom={(from, to) => {
            resetConfirm();
            setPeriod('custom');
            setPeriodOffset(0);
            setCustomFrom(from);
            setCustomTo(to);
            setShowPeriodSheet(false);
          }}
          onClose={() => setShowPeriodSheet(false)}
        />
      ) : null}

      {showAccountSheet ? (
        <AccountFilterSheet
          accounts={accounts}
          selectedAccountId={accountId}
          onSelect={(id) => { resetConfirm(); setAccountId(id); setShowAccountSheet(false); }}
          onClose={() => setShowAccountSheet(false)}
          palette={palette}
        />
      ) : null}

    </>
  );
}

function FilterRow({ label, children, palette }: { label: string; children: React.ReactNode; palette: ReturnType<typeof useAppTheme>['palette'] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.text, width: 64 }}>
        {label}
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
        {children}
      </View>
    </View>
  );
}
