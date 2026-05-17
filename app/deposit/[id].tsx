import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { HeaderEditButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { AppConfirmDialog } from '../../components/ui/AppConfirmDialog';
import { ActionChip } from '../../components/ui/AppButton';
import { getScrollableBottomPadding } from '../../components/ui/safeBottom';
import { ScreenScaffold } from '../../components/ui/ScreenScaffold';
import { StatusPill } from '../../components/ui/StatusPill';
import { formatDate, toLocalDateKey } from '../../lib/dateUtils';
import { getDepositProgress, getDepositReturnAmount } from '../../lib/depositDisplay';
import { DEPOSIT_VISUAL } from '../../lib/depositVisuals';
import { formatCurrency } from '../../lib/derived';
import { FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT, PROGRESS } from '../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useFixedDepositsStore } from '../../stores/useFixedDepositsStore';
import { useUIStore } from '../../stores/useUIStore';
import type { DepositStatus } from '../../types';

const STATUS_LABEL: Record<DepositStatus, string> = {
  active: 'Active',
  closed: 'Closed',
};

export default function DepositDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const deposits = useFixedDepositsStore((s) => s.deposits);
  const isLoaded = useFixedDepositsStore((s) => s.isLoaded);
  const loadDeposits = useFixedDepositsStore((s) => s.load);
  const reopenDeposit = useFixedDepositsStore((s) => s.reopen);
  const removeDeposit = useFixedDepositsStore((s) => s.remove);
  const accounts = useAccountsStore((s) => s.accounts);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';

  const deposit = useMemo(() => deposits.find((d) => d.id === id), [deposits, id]);
  const sourceAccount = useMemo(
    () => (deposit ? accounts.find((a) => a.id === deposit.accountId) : undefined),
    [accounts, deposit],
  );

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const panelProgress = useSharedValue(0);

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
    height: panelProgress.value * 56, // 36 height + 20 vertical padding
    opacity: panelProgress.value,
  }));

  useEffect(() => {
    if (!isLoaded) {
      loadDeposits().catch(() => undefined);
    }
  }, [isLoaded, loadDeposits]);

  useEffect(() => {
    if (isLoaded && !deposit) {
      // Deposit was deleted or invalid id — bounce back.
      router.back();
    }
  }, [isLoaded, deposit]);

  if (!deposit) {
    return (
      <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Deposit" palette={palette} showBack onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.brand} />
        </View>
      </ScreenScaffold>
    );
  }

  const earnings = getDepositReturnAmount(deposit);
  const progress = getDepositProgress(deposit);

  const handleReopen = () => reopenDeposit(deposit.id);

  const today = toLocalDateKey(new Date().toISOString());

  const handleDelete = async () => {
    await removeDeposit(deposit.id);
    router.back();
  };
  const openEdit = () => router.push({ pathname: '/modals/add-transaction', params: { editDepositId: deposit.id, closeDepositId: '' } });
  const openClose = () => router.push({ pathname: '/modals/add-transaction', params: { closeDepositId: deposit.id, editDepositId: '' } });

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title="Deposit"
        palette={palette}
        showBack
        onBack={() => router.back()}
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <HeaderEditButton palette={palette} onPress={openEdit} />
            <TouchableOpacity
              delayPressIn={0}
              activeOpacity={0.75}
              onPress={toggleActions}
              style={{ width: 34, height: 34, borderRadius: HOME_RADIUS.full, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppIcon name={showActions ? 'x' : 'more-vertical'} size={18} color={palette.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        }
      />

      <Animated.View style={[actionsAnimatedStyle, { backgroundColor: palette.isDark ? palette.surface : '#EAEDF4', overflow: 'hidden' }]}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: SCREEN_GUTTER, paddingVertical: 10 }}>
          {deposit.status === 'active' && (
            <ActionChip icon="check-circle" label="Close deposit" palette={palette} onPress={() => { closePanel(); setShowCloseConfirm(true); }} />
          )}
          {deposit.status === 'closed' && (
            <ActionChip icon="rotate-ccw" label="Reopen" palette={palette} onPress={() => { closePanel(); setShowReopenConfirm(true); }} />
          )}
          <ActionChip icon="trash-2" label="Delete" destructive palette={palette} onPress={() => { closePanel(); setShowDeleteConfirm(true); }} />
        </View>
      </Animated.View>

      <ScrollView
        onScrollBeginDrag={closePanel}
        contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets) + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            marginHorizontal: SCREEN_GUTTER,
            marginTop: 12,
            marginBottom: HOME_SPACE.md,
            borderRadius: HOME_RADIUS.card,
            borderWidth: 1,
            borderColor: palette.borderSoft,
            backgroundColor: palette.surface,
            padding: HOME_SPACE.xl,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: HOME_RADIUS.chip,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: DEPOSIT_VISUAL.bg,
              }}
            >
              <AppIcon name={DEPOSIT_VISUAL.icon} size={21} color={DEPOSIT_VISUAL.tone} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: HOME_TEXT.sectionTitle,
                    fontWeight: FONT_WEIGHT.bold,
                    color: palette.text,
                  }}
                >
                  {deposit.name}
                </Text>
                <StatusPill
                  label={STATUS_LABEL[deposit.status]}
                  color={deposit.status === 'active' ? palette.positive : palette.brand}
                  backgroundColor={deposit.status === 'active' ? `${palette.positive}14` : palette.brandSoft}
                  palette={palette}
                />
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: HOME_SPACE.lg, marginBottom: HOME_SPACE.md }}>
            <HeroMetric label="Invested" value={formatCurrency(deposit.principalAmount, sym)} palette={palette} />
            <HeroMetric
              label="Return"
              value={`+${formatCurrency(earnings, sym)}`}
              palette={palette}
              valueColor={earnings > 0 ? palette.positive : palette.text}
              withDivider
            />
            <HeroMetric
              label={deposit.status === 'closed' ? 'Received' : 'Maturity'}
              value={formatCurrency(deposit.maturityValue ?? deposit.principalAmount, sym)}
              palette={palette}
              valueColor={palette.positive}
              withDivider
            />
          </View>

          <View style={{ paddingTop: HOME_SPACE.sm }}>
            <DepositProgressBar progress={progress.percent} label={progress.label} urgent={progress.isUrgent} palette={palette} />
          </View>
        </View>

        <View
          style={{
            marginHorizontal: SCREEN_GUTTER,
            borderRadius: HOME_RADIUS.card,
            borderWidth: 1,
            borderColor: palette.borderSoft,
            backgroundColor: palette.surface,
            overflow: 'hidden',
          }}
        >
          <DetailRow palette={palette} label="Source" value={sourceAccount?.name ?? '—'} />
          <DetailRow palette={palette} label="Start date" value={formatDate(deposit.startDate)} />
          {deposit.tenureMonths != null && (
            <DetailRow palette={palette} label="Tenure" value={`${deposit.tenureMonths} months`} />
          )}
          {deposit.interestRate != null && (
            <DetailRow palette={palette} label="Interest rate" value={`${deposit.interestRate}%`} />
          )}
          {deposit.maturityDate && (
            <DetailRow palette={palette} label="Maturity date" value={formatDate(deposit.maturityDate)} />
          )}
          {deposit.bankName && (
            <DetailRow palette={palette} label="Bank" value={deposit.bankName} />
          )}
          {deposit.note && (
            <DetailRow palette={palette} label="Notes" value={deposit.note} multiline last />
          )}
        </View>
      </ScrollView>

      <AppConfirmDialog
        visible={showDeleteConfirm}
        title="Delete deposit?"
        message="This permanently removes the deposit and its linked activity entries."
        confirm={{
          label: 'Delete',
          destructive: true,
          onPress: () => {
            setShowDeleteConfirm(false);
            handleDelete();
          },
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        palette={palette}
      />

      <AppConfirmDialog
        visible={showReopenConfirm}
        title="Reopen deposit?"
        message="This marks the deposit active again and removes the closure activity entry."
        confirm={{
          label: 'Reopen',
          onPress: () => {
            setShowReopenConfirm(false);
            handleReopen();
          },
        }}
        onCancel={() => setShowReopenConfirm(false)}
        palette={palette}
      />

      <AppConfirmDialog
        visible={showCloseConfirm}
        title="Close deposit?"
        message="This will mark the deposit closed and credit the source account with the maturity amount. You can edit the closure date / account / note on the next screen."
        confirm={{
          label: 'Continue',
          destructive: true,
          onPress: () => {
            setShowCloseConfirm(false);
            openClose();
          },
        }}
        onCancel={() => setShowCloseConfirm(false)}
        palette={palette}
      />

    </ScreenScaffold>
  );
}



function HeroMetric({
  label,
  value,
  palette,
  valueColor,
  withDivider,
}: {
  label: string;
  value: string;
  palette: AppThemePalette;
  valueColor?: string;
  withDivider?: boolean;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, paddingLeft: withDivider ? HOME_SPACE.md : 0 }}>
      {withDivider ? (
        <View
          style={{
            position: 'absolute',
            left: HOME_SPACE.md / 2,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: palette.inputBg,
          }}
        />
      ) : null}
      <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          fontSize: HOME_TEXT.heroLabel + 2,
          fontWeight: FONT_WEIGHT.bold,
          color: valueColor ?? palette.text,
          marginTop: HOME_SPACE.xs,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function DepositProgressBar({
  progress,
  label,
  urgent,
  palette,
}: {
  progress: number;
  label: string;
  urgent: boolean;
  palette: AppThemePalette;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          flex: 1,
          height: PROGRESS.heroHeight,
          borderRadius: PROGRESS.radius,
          backgroundColor: palette.divider,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(2, progress)}%`,
            height: '100%',
            borderRadius: PROGRESS.radius,
            backgroundColor: palette.brand,
          }}
        />
      </View>
      <Text
        numberOfLines={1}
        style={{
          minWidth: 54,
          textAlign: 'right',
          fontSize: HOME_TEXT.caption,
          fontWeight: FONT_WEIGHT.semibold,
          color: urgent ? palette.warning : palette.textMuted,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function DetailRow({
  palette,
  label,
  value,
  multiline,
  last,
}: {
  palette: ReturnType<typeof useAppTheme>['palette'];
  label: string;
  value: string;
  multiline?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: multiline ? 'column' : 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        minHeight: multiline ? undefined : 52,
        paddingHorizontal: HOME_SPACE.lg,
        paddingVertical: multiline ? 12 : 9,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.divider,
        gap: multiline ? 6 : 14,
      }}
    >
      <Text
        appWeight="medium"
        style={{
          fontSize: HOME_TEXT.body,
          fontWeight: FONT_WEIGHT.medium,
          color: palette.textSecondary,
          flexShrink: 0,
        }}
      >
        {label}
      </Text>
      <Text
        appWeight="medium"
        numberOfLines={multiline ? undefined : 1}
        style={{
          fontSize: HOME_TEXT.bodyLarge,
          fontWeight: FONT_WEIGHT.medium,
          color: palette.text,
          flex: multiline ? undefined : 1,
          textAlign: multiline ? 'left' : 'right',
          lineHeight: multiline ? 22 : undefined,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
