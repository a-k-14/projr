import { AppIcon } from '@/components/ui/AppIcon';
import { HeaderMoreButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/AppText';
import { AppChevron } from '@/components/ui/AppChevron';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, TouchableOpacity, View, InteractionManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { TransactionListItem } from '../../components/TransactionListItem';
import { AppConfirmDialog } from '../../components/ui/AppConfirmDialog';
import { ActionChip } from '../../components/ui/AppButton';
import { ActionStrip } from '../../components/ui/ActionStrip';
import { getScrollableBottomPadding, SystemBottomGuard } from '../../components/ui/safeBottom';
import { StatusPill } from '../../components/ui/StatusPill';
import { formatDate, getRelativeDateLabel } from '../../lib/dateUtils';
import { formatCurrency, getLoanTransactionKind, getLoanTransactionUserNote, groupTransactionsByDate } from '../../lib/derived';
import { SCREEN_GUTTER , FONT_WEIGHT} from '../../lib/design';
import { getCategoryDisplayIcon } from '../../lib/category-utils';
import {
  ACTIVITY_LAYOUT,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_TEXT,
  PROGRESS
} from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';
import type { LoanWithSummary } from '../../types';

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const loans = useLoansStore((s) => s.loans);
  const updateLoan = useLoansStore((s) => s.update);
  const loadLoans = useLoansStore((s) => s.load);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const accounts = useAccountsStore((s) => s.accounts);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const { deleteLoanCascade } = require('../../services/loans');
  const tags = useCategoriesStore((s) => s.tags);
  const tagNamesById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags]);
  const categories = useCategoriesStore((s) => s.categories);
  const loadCategories = useCategoriesStore((s) => s.load);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [filterNonPrincipal, setFilterNonPrincipal] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [txnsReady, setTxnsReady] = useState(false);
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

  const loan = loans.find((l) => l.id === id);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setTxnsReady(true);
      // Note: loans + categories are loaded at app startup and refreshed after
      // mutations. We don't need to re-fetch on every detail mount.
      if (!loansLoaded) loadLoans();
      loadCategories().catch(() => undefined);
    });
    return () => task.cancel();
  }, [loadLoans, loadCategories, loansLoaded]);

  const account = loan ? accounts.find((a) => a.id === loan.accountId) : undefined;
  const isLent = loan?.direction === 'lent';
  // Progress bar & status pill: brand when open, muted when closed — same for both directions
  const progressColor = loan?.status === 'closed' ? palette.textSoft : palette.brand;
  const balanceColor = isLent ? palette.loan : palette.textSecondary;
  const displayedTransactions = useMemo(() => {
    if (!loan || !txnsReady) return [];
    if (!filterNonPrincipal) return loan.transactions;
    return loan.transactions.filter((tx) => {
      const type = tx.loanTransactionType || 'principal';
      return type === 'interest' || type === 'others' || type === 'charges' || type === 'adjustment';
    });
  }, [loan, filterNonPrincipal, txnsReady]);

  const grouped = useMemo(() => groupTransactionsByDate(displayedTransactions), [displayedTransactions]);

  const groupedByType = useMemo(() => {
    if (!filterNonPrincipal) return [];
    const interestItems = displayedTransactions.filter((tx) => (tx.loanTransactionType || 'principal') === 'interest');
    const othersItems = displayedTransactions.filter((tx) => {
      const type = tx.loanTransactionType || 'principal';
      return type !== 'principal' && type !== 'interest';
    });

    const result: { title: string; total: number; items: typeof interestItems }[] = [];
    if (interestItems.length > 0) {
      const total = interestItems.reduce((sum, t) => sum + t.amount, 0);
      result.push({ title: 'Interest', total, items: interestItems });
    }
    if (othersItems.length > 0) {
      const total = othersItems.reduce((sum, t) => sum + t.amount, 0);
      result.push({ title: 'Others', total, items: othersItems });
    }
    return result;
  }, [displayedTransactions, filterNonPrincipal]);
  const originTx = useMemo(() => {
    if (!loan) return undefined;
    return loan.transactions
      .filter((tx) => getLoanTransactionKind(tx, loan.direction) === 'origin')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  }, [loan]);
  const originTxNote = originTx ? getLoanTransactionUserNote(originTx.note) : '';
  const loanMetrics = [
    { key: 'given', label: isLent ? 'LENT' : 'BORROWED', value: formatCurrency(loan?.givenAmount ?? 0, sym), color: palette.text },
    { key: 'balance', label: 'BALANCE', value: formatCurrency(loan?.pendingAmount ?? 0, sym), color: balanceColor },
  ];

  const handleToggleStatus = async () => {
    if (!loan) return;
    const nextStatus = loan.status === 'open' ? 'closed' : 'open';
    if (nextStatus === 'closed') {
      setShowCloseConfirm(true);
      return;
    }
    await updateLoan(loan.id, { status: nextStatus });
  };

  if (!loan) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={palette.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          header: () => (
            <View style={{ paddingTop: insets.top, backgroundColor: palette.background }}>
              <ScreenHeader
                title={`${loan.personName} • ${isLent ? 'Lent' : 'Borrowed'}`}
                palette={palette}
                titleSize={25}
                rightAction={
                  <HeaderMoreButton palette={palette} isOpen={showActions} onPress={toggleActions} />
                }
              />
            </View>
          )
        }}
      />

      <View style={{ flex: 1 }}>
        {/* Action strip */}
        <ActionStrip palette={palette} animatedStyle={actionsAnimatedStyle}>
          <ActionChip
            icon="edit-2"
            label="Edit"
            palette={palette}
            onPress={() => {
              if (!originTx) return;
              closePanel();
              router.push({ pathname: '/modals/add-transaction', params: { editId: originTx.id } });
            }}
          />
          {loan.pendingAmount > 0 && (
            <ActionChip
              icon={isLent ? 'arrow-down-left' : 'arrow-up-right'}
              label={isLent ? 'Record Receipt' : 'Record Payment'}
              palette={palette}
              onPress={() => { closePanel(); router.push({ pathname: '/modals/loan-settlement', params: { loanId: loan.id } }); }}
            />
          )}
          <ActionChip
            icon="plus"
            label="Add More"
            palette={palette}
            onPress={() => { closePanel(); router.push({ pathname: '/modals/add-transaction', params: { loanId: loan.id, addMore: '1' } }); }}
          />
          <ActionChip
            icon="trash-2"
            label="Delete"
            palette={palette}
            destructive
            onPress={() => { closePanel(); setShowDeleteConfirm(true); }}
          />
        </ActionStrip>

        {/* Hero card — sticky outside ScrollView */}
        <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: HOME_RADIUS.card,
              padding: HOME_SPACE.xl,
              marginTop: 12,
              marginBottom: HOME_SPACE.md,
            }}
          >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: HOME_SPACE.md,
                  marginBottom: HOME_SPACE.md
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }} numberOfLines={1}>
                    {isLent ? 'You Lent' : 'You Borrowed'} · {account?.name} · {formatDate(loan.date)}
                  </Text>
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.semibold, color: palette.text, marginTop: HOME_SPACE.xs }} numberOfLines={1}>
                    {loan.personName}
                  </Text>
                </View>
                <StatusPill
                  label={loan.status === 'open' ? 'Open' : 'Closed'}
                  color={loan.status === 'open' ? palette.brand : palette.textSecondary}
                  backgroundColor={loan.status === 'open' ? palette.loanBg : palette.inputBg}
                  palette={palette}
                  onPress={handleToggleStatus}
                />
              </View>

              <View style={{ flexDirection: 'row', marginTop: HOME_SPACE.sm, marginBottom: HOME_SPACE.lg }}>
                {loanMetrics.map((item, index) => (
                  <View
                    key={item.key}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      marginLeft: index > 0 ? HOME_SPACE.md : 0,
                    }}
                  >
                    {index > 0 ? (
                      <View
                        style={{
                          position: 'absolute',
                          left: -HOME_SPACE.md / 2,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          backgroundColor: palette.inputBg,
                        }}
                      />
                    ) : null}
                    <Text appWeight="medium" style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0, textAlign: 'left' }}>
                      {item.label}
                    </Text>
                    <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.heroLabel + 2, fontWeight: FONT_WEIGHT.bold, color: item.color, marginTop: HOME_SPACE.xs, textAlign: 'left' }}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ paddingTop: HOME_SPACE.sm, paddingBottom: HOME_SPACE.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: HOME_SPACE.sm }}>
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted }}>
                    {isLent ? 'Received' : 'Repaid'} · {formatCurrency(loan.settledAmount, sym)}
                  </Text>
                  <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>{loan.repaidPercent}%</Text>
                </View>
                <View style={{ height: PROGRESS.cardHeight, backgroundColor: palette.divider, borderRadius: PROGRESS.radius, overflow: 'hidden' }}>
                  <View
                    style={{
                      height: PROGRESS.cardHeight,
                      width: `${Math.min(Math.max(loan.repaidPercent, 0), 100)}%`,
                      backgroundColor: progressColor,
                      borderRadius: PROGRESS.radius,
                    }}
                  />
                </View>
              </View>

              {(loan.interestAmount > 0 || loan.othersAmount > 0) ? (
                <TouchableOpacity
                  delayPressIn={0}
                  onPress={() => setFilterNonPrincipal(!filterNonPrincipal)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: HOME_SPACE.sm,
                    paddingVertical: HOME_SPACE.sm,
                    marginBottom: HOME_SPACE.xs,
                    borderTopWidth: 1,
                    borderTopColor: palette.inputBg,
                    minHeight: 32,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingRight: 32, marginTop: HOME_SPACE.xs }}>
                    {loan.interestAmount > 0 && (
                      <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.text }}>
                        Interest: <Text appWeight="medium" style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>{formatCurrency(loan.interestAmount, sym)}</Text>
                      </Text>
                    )}
                    {loan.interestAmount > 0 && loan.othersAmount > 0 && (
                      <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSoft, marginHorizontal: 6 }}>•</Text>
                    )}
                    {loan.othersAmount > 0 && (
                      <Text style={{ fontSize: HOME_TEXT.caption, color: palette.text }}>
                        Others: <Text appWeight="medium" style={{ fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>{formatCurrency(loan.othersAmount, sym)}</Text>
                      </Text>
                    )}
                  </View>
                  {filterNonPrincipal ? (
                    <TouchableOpacity
                      delayPressIn={0}
                      onPress={(e) => {
                        e.stopPropagation();
                        setFilterNonPrincipal(false);
                      }}
                      style={{
                        position: 'absolute',
                        right: 0,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 1,
                        borderColor: palette.brand,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AppIcon name="x" size={12} color={palette.brand} />
                    </TouchableOpacity>
                  ) : (
                    <View style={{ position: 'absolute', right: 4 }}>
                      <AppChevron direction="right" size={14} tone="secondary" palette={palette} />
                    </View>
                  )}
                </TouchableOpacity>
              ) : null}

              {originTxNote ? (
                <View style={{ paddingTop: HOME_SPACE.md, borderTopWidth: 1, borderTopColor: palette.inputBg }}>
                  <Text style={{ fontSize: HOME_TEXT.body, color: palette.textSecondary }}>{originTxNote}</Text>
                </View>
              ) : null}
            </View>
          </View>

        {filterNonPrincipal ? (
          <FlatList
            data={groupedByType}
            keyExtractor={(item) => item.title}
            style={{ flex: 1 }}
            onScrollBeginDrag={closePanel}
            contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: getScrollableBottomPadding(insets, 24) }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            removeClippedSubviews
            renderItem={({ item: { title, total, items } }) => {
              const groupedByDateForType = groupTransactionsByDate(items);
              return (
                <View style={{ marginBottom: HOME_SPACE.md }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: ACTIVITY_LAYOUT.groupHeaderBottom,
                        paddingRight: 10,
                      }}
                    >
                      <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                        {title}
                      </Text>
                      <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                        {formatCurrency(total, sym)}
                      </Text>
                    </View>

                    {groupedByDateForType.map(({ dateKey, items: dateItems }) => {
                      const { date, label } = getRelativeDateLabel(dateKey + 'T00:00:00.000Z');
                      return (
                        <View key={dateKey} style={{ marginBottom: HOME_SPACE.sm + 4 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              marginBottom: HOME_SPACE.sm,
                              paddingHorizontal: ACTIVITY_LAYOUT.groupHeaderPaddingX - SCREEN_GUTTER
                            }}
                          >
                            <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                              {date}
                            </Text>
                            {label ? (
                              <>
                                <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginHorizontal: 6 }}>•</Text>
                                <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{label}</Text>
                              </>
                            ) : null}
                          </View>
                          <View style={{ backgroundColor: palette.surface, borderRadius: HOME_RADIUS.card, overflow: 'hidden' }}>
                            {dateItems.map((tx, i) => (
                              <TransactionListItem
                                key={tx.id}
                                tx={{ ...tx, payee: describeLoanDetailTransaction(loan, tx) }}
                                sym={sym}
                                palette={palette}
                                isLast={i === dateItems.length - 1}
                                accountName={account?.name}
                                showAmountSign={false}
                                loanPersonName={loan.personName}
                                loanDirection={loan.direction}
                                tertiaryText={
                                  tx.tags.length > 0
                                    ? tx.tags
                                      .map((tagId) => tagNamesById.get(tagId))
                                      .filter((value): value is string => !!value)
                                      .join(' • ') || undefined
                                    : undefined
                                }
                                onPress={() =>
                                  router.push({
                                    pathname:
                                      getLoanTransactionKind(tx, loan.direction) === 'settlement'
                                        ? '/modals/loan-settlement'
                                        : '/modals/add-transaction',
                                    params: { editId: tx.id }
                                  })
                                }
                              />
                            ))}
                          </View>
                        </View>
                      );
                    })}
                </View>
              );
            }}
          />
        ) : (
          <FlatList
            data={grouped}
            keyExtractor={(item) => item.dateKey}
            style={{ flex: 1 }}
            onScrollBeginDrag={closePanel}
            contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: getScrollableBottomPadding(insets, 24) }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews
            renderItem={({ item: { dateKey, items } }) => {
              const { date, label } = getRelativeDateLabel(dateKey + 'T00:00:00.000Z');
              return (
                <View style={{ marginBottom: HOME_SPACE.sm + 4 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: HOME_SPACE.sm,
                        paddingHorizontal: ACTIVITY_LAYOUT.groupHeaderPaddingX - SCREEN_GUTTER
                      }}
                    >
                      <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                        {date}
                      </Text>
                      {label ? (
                        <>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginHorizontal: 6 }}>•</Text>
                          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{label}</Text>
                        </>
                      ) : null}
                    </View>
                    <View style={{ backgroundColor: palette.surface, borderRadius: HOME_RADIUS.card, overflow: 'hidden' }}>
                      {items.map((tx, i) => (
                        <TransactionListItem
                          key={tx.id}
                          tx={{ ...tx, payee: describeLoanDetailTransaction(loan, tx) }}
                          sym={sym}
                          palette={palette}
                          isLast={i === items.length - 1}
                          accountName={account?.name}
                          showAmountSign={false}
                          loanPersonName={loan.personName}
                          loanDirection={loan.direction}
                          categoryName={tx.categoryId ? getCategoryFullDisplayName(tx.categoryId, ' › ') : undefined}
                          categoryIcon={getCategoryDisplayIcon(categoriesById, tx.categoryId)}
                          tertiaryText={
                            tx.tags.length > 0
                              ? tx.tags
                                .map((tagId) => tagNamesById.get(tagId))
                                .filter((value): value is string => !!value)
                                .join(' • ') || undefined
                              : undefined
                          }
                          onPress={() =>
                            router.push({
                              pathname:
                                getLoanTransactionKind(tx, loan.direction) === 'settlement'
                                  ? '/modals/loan-settlement'
                                  : '/modals/add-transaction',
                              params: { editId: tx.id }
                            })
                          }
                        />
                      ))}
                    </View>
                </View>
              );
            }}
          />
        )}

      </View>
      <AppConfirmDialog
        visible={showCloseConfirm}
        title="Close Loan"
        message="This will mark the loan as closed. No further receipts or payments can be recorded until you reopen it."
        palette={palette}
        onCancel={() => setShowCloseConfirm(false)}
        confirm={{
          label: 'Close',
          destructive: true,
          onPress: () => {
            setShowCloseConfirm(false);
            updateLoan(loan.id, { status: 'closed' }).catch(() => undefined);
          },
        }}
      />
      <AppConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Loan"
        message="Are you sure you want to delete this loan? This will also delete all associated transactions."
        palette={palette}
        onCancel={() => setShowDeleteConfirm(false)}
        confirm={{
          label: 'Delete',
          destructive: true,
          onPress: async () => {
            setShowDeleteConfirm(false);
            try {
              await deleteLoanCascade(loan.id);
              router.back();
            } catch (error) {
              console.error('Failed to delete loan:', error);
            }
          },
        }}
      />
      <SystemBottomGuard />
    </View>
  );
}



function describeLoanDetailTransaction(loan: LoanWithSummary, tx: LoanWithSummary['transactions'][number]) {
  const kind = getLoanTransactionKind(tx, loan.direction);
  if (kind === 'origin') return loan.direction === 'lent' ? 'Lent' : 'Borrowed';
  if (kind === 'settlement') {
    const subType = tx.loanTransactionType || 'principal';
    const subTypeLabel = subType === 'principal'
      ? ''
      : subType === 'interest'
        ? 'Interest '
        : 'Others ';
    const actionLabel = loan.direction === 'lent' ? 'Receipt' : 'Payment';
    return `${subTypeLabel}${actionLabel}`;
  }
  return 'Loan';
}
