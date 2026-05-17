import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, TouchableOpacity, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';

import { Text } from '@/components/ui/AppText';
import { HomeAccountPage } from '../(tabs)/index';
import { ScreenScaffold } from '../../components/ui/ScreenScaffold';
import type { HomeChartMode } from '../../components/HomeDonutChartBlock';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { getScrollableBottomPadding } from '../../components/ui/safeBottom';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { getTotalBalance } from '../../lib/derived';
import { formatDate, toLocalDayEndISO, toLocalDayStartISO } from '../../lib/dateUtils';
import { FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { AppIcon } from '@/components/ui/AppIcon';
import { ActionChip } from '../../components/ui/AppButton';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT, SCREEN_HEADER } from '../../lib/layoutTokens';
import { getAccountTypeLabel } from '../../lib/settings-shared';
import type { PeriodType } from '../../types';

type AccountPeriodType = 'today' | PeriodType;

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const isFocused = useIsFocused();

  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const categories = useCategoriesStore((s) => s.categories);
  const loadCategories = useCategoriesStore((s) => s.load);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);

  const settingsYearStart = useUIStore((s) => s.settings.yearStart);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);

  const account = accounts.find((a) => a.id === id);

  useEffect(() => {
    if (!isFocused) return;
    loadCategories().catch(() => undefined);
  }, [isFocused, loadCategories]);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);

  const verticalScrolls = useSharedValue<number[]>([0]);
  const indicatorY = useSharedValue(0);

  const [period, setPeriod] = useState<AccountPeriodType>('today');
  const [chartMode, setChartMode] = useState<HomeChartMode>('expense');
  const [selectedChartCategoryId, setSelectedChartCategoryId] = useState<string | null>(null);

  const [customRangeFrom, setCustomRangeFrom] = useState(() => toLocalDayStartISO(new Date()));
  const [customRangeTo, setCustomRangeTo] = useState(() => toLocalDayEndISO(new Date()));
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
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

  const handleCustomRangeDone = useCallback(() => {
    const fromDate = customDraftFrom <= customDraftTo ? customDraftFrom : customDraftTo;
    const toDate = customDraftTo >= customDraftFrom ? customDraftTo : customDraftFrom;
    setCustomDraftFrom(fromDate);
    setCustomDraftTo(toDate);
    setCustomRangeFrom(toLocalDayStartISO(fromDate));
    setCustomRangeTo(toLocalDayEndISO(toDate));
    setPeriod('custom');
    setCustomRangeOpen(false);
  }, [customDraftFrom, customDraftTo]);

  const openDatePicker = useCallback(
    (stage: 'from' | 'to') => {
      const value = stage === 'from' ? customDraftFrom : customDraftTo;
      const minDate = stage === 'to' ? customDraftFrom : undefined;
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        display: 'calendar',
        minimumDate: minDate,
        onChange: (_event, selected) => {
          if (!selected) return;
          if (stage === 'from') {
            setCustomDraftFrom(selected);
            if (selected > customDraftTo) {
              setCustomDraftTo(selected);
            }
          } else {
            setCustomDraftTo(selected < customDraftFrom ? customDraftFrom : selected);
          }
        }
      });
    },
    [customDraftFrom, customDraftTo],
  );

  const openCustomRange = useCallback(() => {
    setCustomDraftFrom(new Date(customRangeFrom));
    setCustomDraftTo(new Date(customRangeTo));
    setCustomRangeOpen(true);
  }, [customRangeFrom, customRangeTo]);

  if (!account) return null;

  return (
    <ScreenScaffold palette={palette}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          header: () => (
            <View style={{ paddingTop: insets.top, backgroundColor: palette.background }}>
              <ScreenHeader
                title="Account Details"
                onBack={() => router.back()}
                palette={palette}
                titleSize={SCREEN_HEADER.detailTitleSize}
                rightAction={
                  <TouchableOpacity
                    delayPressIn={0}
                    activeOpacity={0.75}
                    onPress={toggleActions}
                    style={{ width: 34, height: 34, borderRadius: HOME_RADIUS.full, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <AppIcon name={showActions ? 'x' : 'more-vertical'} size={18} color={palette.text} strokeWidth={2} />
                  </TouchableOpacity>
                }
              />
            </View>
          )
        }}
      />

      <Animated.View style={[actionsAnimatedStyle, { backgroundColor: palette.isDark ? palette.surface : '#EAEDF4', overflow: 'hidden' }]}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: SCREEN_GUTTER, paddingVertical: 10 }}>
          <ActionChip
            icon="edit"
            label="Edit Account"
            palette={palette}
            onPress={() => {
              closePanel();
              router.push({ pathname: '/settings/account-form', params: { id: account.id } });
            }}
          />
        </View>
      </Animated.View>

      <HomeAccountPage
        pageHeight={1000}
        accountId={account.id}
        accountName={formatAccountDisplayName(account.name, account.accountNumber)}
        accountTypeLabel={getAccountTypeLabel(account.type)}
        settingsYearStart={settingsYearStart}
        currencySymbol={showCurrencySymbol ? currencySymbol : ''}
        customRange={{ from: new Date(customRangeFrom), to: new Date(customRangeTo) }}
        onOpenCustomRange={() => openCustomRange()}
        totalBalance={account.balance}
        onRefresh={refreshAccounts}
        isSelected={true}
        pageIndex={0}
        verticalScrolls={verticalScrolls}
        indicatorY={indicatorY}
        period={period}
        onPeriodChange={setPeriod}
        chartMode={chartMode}
        onChartModeChange={setChartMode}
        selectedChartCategoryId={selectedChartCategoryId}
        onChartCategorySelect={setSelectedChartCategoryId}
        registerScrollTop={() => { }}
        isPageReady={true}
        accountsById={accountsById}
        categoriesById={categoriesById}
        loansById={loansById}
        getCategoryFullDisplayName={getCategoryFullDisplayName}
        loansLoaded={loansLoaded}
        loadLoans={loadLoans}
        contentBottomPadding={getScrollableBottomPadding(insets)}
        onScrollBeginDrag={closePanel}
      />

      <Modal
        visible={customRangeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomRangeOpen(false)}
      >
        <Pressable
          onPress={() => setCustomRangeOpen(false)}
          style={{ flex: 1, backgroundColor: palette.scrim, justifyContent: 'center', padding: 20 }}
        >
          <Pressable
            onPress={() => { }}
            style={{ backgroundColor: palette.card, borderRadius: HOME_RADIUS.large, padding: HOME_SPACE.xxl, borderWidth: 1, borderColor: palette.divider }}
          >
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: palette.text, marginBottom: 8 }}>
              Custom range
            </Text>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginBottom: 16 }}>
              Pick the from and to dates for this range.
            </Text>
            <View style={{ gap: HOME_SPACE.md, marginBottom: HOME_SPACE.lg }}>
              <TouchableOpacity delayPressIn={0} onPress={() => openDatePicker('from')} style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.inputBg, borderRadius: HOME_RADIUS.card, paddingHorizontal: HOME_SPACE.lg, paddingVertical: 12 }}>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>From</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  {formatDate(customDraftFrom.toISOString())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0} onPress={() => openDatePicker('to')} style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.inputBg, borderRadius: HOME_RADIUS.card, paddingHorizontal: HOME_SPACE.lg, paddingVertical: 12 }}>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  {formatDate(customDraftTo.toISOString())}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md, marginTop: HOME_SPACE.lg }}>
              <View style={{ flex: 1 }}>
                <TextButton label="Cancel" onPress={() => setCustomRangeOpen(false)} palette={palette} tone="default" style={{ minHeight: 48, borderRadius: HOME_RADIUS.tab, backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border }} />
              </View>
              <View style={{ flex: 1 }}>
                <FilledButton label="Done" onPress={handleCustomRangeDone} palette={palette} tone="brand" style={{ borderRadius: HOME_RADIUS.tab }} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenScaffold>
  );
}
