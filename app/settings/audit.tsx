import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { useIsFocused } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, InteractionManager, Modal, Pressable, RefreshControl, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionDateHeader } from '../../components/DateGroupedTransactionList';
import { TransactionListItem } from '../../components/TransactionListItem';
import { getScrollableBottomPadding, SystemBottomGuard } from '../../components/ui/safeBottom';
import { SheetScrollTopButton } from '../../components/ui/SheetScrollTopButton';
import { TagBadge } from '../../components/ui/TagBadge';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { getCategoryDisplayIcon } from '../../lib/category-utils';
import { formatDate, toLocalDateKey } from '../../lib/dateUtils';
import { formatCurrency } from '../../lib/derived';
import { FONT_WEIGHT, SCREEN_GUTTER, SPACING, TYPE } from '../../lib/design';
import { CARD_TEXT, HOME_RADIUS } from '../../lib/layoutTokens';
import { STRINGS } from '../../lib/strings';
import { useAppTheme } from '../../lib/theme';
import { useTransactionPress } from '../../lib/useTransactionPress';
import { AuditLog, getAuditLogs } from '../../services/audit';
import { getTransactions, getTransactionById, getSplitGroupTotals } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useAssetsStore } from '../../stores/useAssetsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useFixedDepositsStore } from '../../stores/useFixedDepositsStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';
import type { Transaction } from '../../types';

const PAGE_SIZE = 30;

const PRESS_IN = { damping: 20, stiffness: 360, mass: 0.5 };
const PRESS_OUT = { damping: 18, stiffness: 320, mass: 0.6 };

interface FieldChange {
  field: string;
  beforeVal: string;
  afterVal: string;
}

// Diff calculators
const getTransactionDiff = (
  before: Transaction,
  after: Transaction,
  sym: string,
  accountsById: Map<string, string>,
  getCategoryFullDisplayName: any
): FieldChange[] => {
  const changes: FieldChange[] = [];

  const typeLabel = (t: string) => {
    if (t === 'in') return 'Income';
    if (t === 'out') return 'Expense';
    if (t === 'transfer') return 'Transfer';
    if (t === 'loan') return 'Loan';
    if (t === 'deposit') return 'Deposit';
    return t.toUpperCase();
  };

  if (before.type !== after.type) {
    changes.push({
      field: 'Type',
      beforeVal: typeLabel(before.type),
      afterVal: typeLabel(after.type),
    });
  }

  if (before.amount !== after.amount) {
    changes.push({
      field: 'Amount',
      beforeVal: formatCurrency(Math.abs(before.amount), sym),
      afterVal: formatCurrency(Math.abs(after.amount), sym),
    });
  }

  const isTransfer = !!(before.transferPairId || after.transferPairId);

  if (!isTransfer) {
    if (before.accountId !== after.accountId) {
      changes.push({
        field: 'Account',
        beforeVal: accountsById.get(before.accountId) || 'Deleted Account',
        afterVal: accountsById.get(after.accountId) || 'Deleted Account',
      });
    }
  } else {
    if (before.accountId !== after.accountId) {
      changes.push({
        field: 'From',
        beforeVal: accountsById.get(before.accountId) || 'Deleted Account',
        afterVal: accountsById.get(after.accountId) || 'Deleted Account',
      });
    }
    if (before.linkedAccountId !== after.linkedAccountId) {
      changes.push({
        field: 'To',
        beforeVal: before.linkedAccountId ? (accountsById.get(before.linkedAccountId) || 'Deleted Account') : 'None',
        afterVal: after.linkedAccountId ? (accountsById.get(after.linkedAccountId) || 'Deleted Account') : 'None',
      });
    }
  }

  if (before.categoryId !== after.categoryId) {
    const beforeCat = before.categoryId ? (getCategoryFullDisplayName(before.categoryId, ' › ') || 'Deleted Category') : 'None';
    const afterCat = after.categoryId ? (getCategoryFullDisplayName(after.categoryId, ' › ') || 'Deleted Category') : 'None';
    changes.push({
      field: 'Category',
      beforeVal: beforeCat,
      afterVal: afterCat,
    });
  }

  const beforePayee = (before.payee || '').trim();
  const afterPayee = (after.payee || '').trim();
  if (beforePayee !== afterPayee) {
    changes.push({
      field: 'Payee',
      beforeVal: beforePayee || 'None',
      afterVal: afterPayee || 'None',
    });
  }

  const beforeNote = (before.note || '').trim();
  const afterNote = (after.note || '').trim();
  if (beforeNote !== afterNote) {
    changes.push({
      field: 'Note',
      beforeVal: beforeNote || 'None',
      afterVal: afterNote || 'None',
    });
  }

  if (before.date !== after.date) {
    changes.push({
      field: 'Date',
      beforeVal: formatDate(before.date),
      afterVal: formatDate(after.date),
    });
  }

  const beforeTags = before.tags || [];
  const afterTags = after.tags || [];
  if (JSON.stringify([...beforeTags].sort()) !== JSON.stringify([...afterTags].sort())) {
    changes.push({
      field: 'Tags',
      beforeVal: JSON.stringify(beforeTags),
      afterVal: JSON.stringify(afterTags),
    });
  }

  const beforeReceipts = before.receiptImageUris || [];
  const afterReceipts = after.receiptImageUris || [];
  if (JSON.stringify([...beforeReceipts].sort()) !== JSON.stringify([...afterReceipts].sort())) {
    let beforeText = 'None';
    let afterText = 'None';

    if (beforeReceipts.length === 0 && afterReceipts.length > 0) {
      beforeText = 'None';
      afterText = 'Added';
    } else if (beforeReceipts.length > 0 && afterReceipts.length === 0) {
      beforeText = 'Added';
      afterText = 'Removed';
    } else if (beforeReceipts.length > 0 && afterReceipts.length > 0) {
      beforeText = 'Added';
      afterText = 'Updated';
    }

    changes.push({
      field: 'Images',
      beforeVal: beforeText,
      afterVal: afterText,
    });
  }

  return changes;
};

const getDepositDiff = (before: any, after: any, sym: string): FieldChange[] => {
  const changes: FieldChange[] = [];
  if (before.name !== after.name) {
    changes.push({ field: 'Name', beforeVal: before.name || 'None', afterVal: after.name || 'None' });
  }
  if (before.bankName !== after.bankName) {
    changes.push({ field: 'Bank Name', beforeVal: before.bankName || 'None', afterVal: after.bankName || 'None' });
  }
  if (before.principalAmount !== after.principalAmount) {
    changes.push({
      field: 'Principal',
      beforeVal: formatCurrency(before.principalAmount, sym),
      afterVal: formatCurrency(after.principalAmount, sym),
    });
  }
  if (before.interestRate !== after.interestRate) {
    changes.push({
      field: 'Interest Rate',
      beforeVal: before.interestRate ? `${before.interestRate}%` : 'None',
      afterVal: after.interestRate ? `${after.interestRate}%` : 'None',
    });
  }
  if (before.tenureMonths !== after.tenureMonths) {
    changes.push({
      field: 'Tenure',
      beforeVal: before.tenureMonths ? `${before.tenureMonths} Months` : 'None',
      afterVal: after.tenureMonths ? `${after.tenureMonths} Months` : 'None',
    });
  }
  if (before.startDate !== after.startDate) {
    changes.push({
      field: 'Start Date',
      beforeVal: formatDate(before.startDate),
      afterVal: formatDate(after.startDate),
    });
  }
  if (before.maturityDate !== after.maturityDate) {
    changes.push({
      field: 'Maturity Date',
      beforeVal: before.maturityDate ? formatDate(before.maturityDate) : 'None',
      afterVal: after.maturityDate ? formatDate(after.maturityDate) : 'None',
    });
  }
  if (before.maturityValue !== after.maturityValue) {
    changes.push({
      field: 'Maturity Value',
      beforeVal: before.maturityValue ? formatCurrency(before.maturityValue, sym) : 'None',
      afterVal: after.maturityValue ? formatCurrency(after.maturityValue, sym) : 'None',
    });
  }
  if (before.status !== after.status) {
    changes.push({
      field: 'Status',
      beforeVal: before.status || 'None',
      afterVal: after.status || 'None',
    });
  }
  const beforeNote = (before.note || '').trim();
  const afterNote = (after.note || '').trim();
  if (beforeNote !== afterNote) {
    changes.push({ field: 'Note', beforeVal: beforeNote || 'None', afterVal: afterNote || 'None' });
  }
  return changes;
};

const getLoanDiff = (before: any, after: any, sym: string, accountsById: Map<string, string>): FieldChange[] => {
  const changes: FieldChange[] = [];
  if (before.personName !== after.personName) {
    changes.push({ field: 'Person Name', beforeVal: before.personName || 'None', afterVal: after.personName || 'None' });
  }
  if (before.direction !== after.direction) {
    changes.push({
      field: 'Direction',
      beforeVal: before.direction === 'lent' ? 'Lent' : 'Borrowed',
      afterVal: after.direction === 'lent' ? 'Lent' : 'Borrowed',
    });
  }
  if (before.accountId !== after.accountId) {
    changes.push({
      field: 'Account',
      beforeVal: accountsById.get(before.accountId) || 'Deleted Account',
      afterVal: accountsById.get(after.accountId) || 'Deleted Account',
    });
  }
  if (before.givenAmount !== after.givenAmount) {
    changes.push({
      field: 'Given Amount',
      beforeVal: formatCurrency(before.givenAmount, sym),
      afterVal: formatCurrency(after.givenAmount, sym),
    });
  }
  if (before.status !== after.status) {
    changes.push({
      field: 'Status',
      beforeVal: before.status || 'None',
      afterVal: after.status || 'None',
    });
  }
  const beforeNote = (before.note || '').trim();
  const afterNote = (after.note || '').trim();
  if (beforeNote !== afterNote) {
    changes.push({ field: 'Note', beforeVal: beforeNote || 'None', afterVal: afterNote || 'None' });
  }
  const beforeTags = before.tags || [];
  const afterTags = after.tags || [];
  if (JSON.stringify([...beforeTags].sort()) !== JSON.stringify([...afterTags].sort())) {
    changes.push({
      field: 'Tags',
      beforeVal: JSON.stringify(beforeTags),
      afterVal: JSON.stringify(afterTags),
    });
  }
  return changes;
};

const getAssetDiff = (before: any, after: any, sym: string): FieldChange[] => {
  const changes: FieldChange[] = [];
  if (before.name !== after.name) {
    changes.push({ field: 'Name', beforeVal: before.name || 'None', afterVal: after.name || 'None' });
  }
  if (before.icon !== after.icon) {
    changes.push({ field: 'Icon', beforeVal: before.icon || 'None', afterVal: after.icon || 'None' });
  }
  if (before.value !== after.value) {
    changes.push({
      field: 'Value',
      beforeVal: formatCurrency(before.value, sym),
      afterVal: formatCurrency(after.value, sym),
    });
  }
  const beforeNote = (before.note || '').trim();
  const afterNote = (after.note || '').trim();
  if (beforeNote !== afterNote) {
    changes.push({ field: 'Note', beforeVal: beforeNote || 'None', afterVal: afterNote || 'None' });
  }
  return changes;
};

const mapDepositToVirtualTx = (dep: any): Transaction => {
  return {
    id: dep.id,
    type: 'deposit',
    amount: dep.principalAmount,
    accountId: dep.accountId,
    date: dep.startDate,
    note: dep.note || '',
    tags: [],
    createdAt: dep.createdAt,
    depositId: dep.id,
    depositTransactionType: 'new',
  };
};

const mapLoanToVirtualTx = (loan: any): Transaction => {
  return {
    id: loan.id,
    type: 'loan',
    amount: loan.givenAmount,
    accountId: loan.accountId,
    date: loan.date,
    note: loan.note || '',
    tags: loan.tags || [],
    createdAt: loan.createdAt,
    loanId: loan.id,
  };
};

const mapAssetToVirtualTx = (asset: any): Transaction => {
  return {
    id: asset.id,
    type: 'in',
    amount: asset.value,
    accountId: '',
    date: asset.createdAt,
    note: asset.note || '',
    tags: [],
    createdAt: asset.createdAt,
    payee: asset.name,
  };
};

const AuditLogItem = React.memo(({
  item,
  index,
  logs,
  palette,
  sym,
  categoriesById,
  tagsById,
  accountsById,
  loansById,
  depositsById,
  getCategoryFullDisplayName,
  handleTransactionPress,
  showAlert,
  splitGroupTotals,
}: {
  item: AuditLog;
  index: number;
  logs: AuditLog[];
  palette: any;
  sym: string;
  categoriesById: any;
  tagsById: Map<string, { name: string; color: string }>;
  accountsById: any;
  loansById: any;
  depositsById: any;
  getCategoryFullDisplayName: any;
  handleTransactionPress: any;
  showAlert: any;
  splitGroupTotals: Record<string, number>;
}) => {
  const dateKey = toLocalDateKey(item.timestamp);
  const prevDateKey = index > 0 ? toLocalDateKey(logs[index - 1].timestamp) : null;
  const showHeader = dateKey !== prevDateKey;

  const parsedBefore = item.payloadBefore ? JSON.parse(item.payloadBefore) : null;
  const parsedAfter = item.payloadAfter ? JSON.parse(item.payloadAfter) : null;

  let activeTx: Transaction | null = null;
  if (item.tableName === 'deposits') {
    const dep = parsedAfter || parsedBefore;
    if (dep) activeTx = mapDepositToVirtualTx(dep);
  } else if (item.tableName === 'loans') {
    const loan = parsedAfter || parsedBefore;
    if (loan) activeTx = mapLoanToVirtualTx(loan);
  } else if (item.tableName === 'assets') {
    const asset = parsedAfter || parsedBefore;
    if (asset) activeTx = mapAssetToVirtualTx(asset);
  } else {
    activeTx = parsedAfter || parsedBefore;
  }

  if (!activeTx) return null;

  if (activeTx.splitGroupId && splitGroupTotals) {
    activeTx.splitGroupTotal = splitGroupTotals[activeTx.splitGroupId];
  }

  // Resolve card properties
  let catName = activeTx.categoryId ? getCategoryFullDisplayName(activeTx.categoryId, ' › ') : undefined;
  let catIcon = activeTx.categoryId ? getCategoryDisplayIcon(categoriesById, activeTx.categoryId) : undefined;

  if (item.tableName === 'assets') {
    const asset = parsedAfter || parsedBefore;
    catName = 'Asset';
    catIcon = asset?.icon ?? undefined;
  }

  const accName = accountsById.get(activeTx.accountId);
  const linkedAccName = activeTx.linkedAccountId ? accountsById.get(activeTx.linkedAccountId) : undefined;
  const loanPerson = activeTx.loanId ? (loansById.get(activeTx.loanId)?.personName ?? (parsedAfter?.personName || parsedBefore?.personName)) : undefined;
  const loanDir = activeTx.loanId ? (loansById.get(activeTx.loanId)?.direction ?? (parsedAfter?.direction || parsedBefore?.direction)) : undefined;
  const depName = activeTx.depositId ? (depositsById.get(activeTx.depositId)?.name ?? (parsedAfter?.name || parsedBefore?.name)) : undefined;
  const depBank = activeTx.depositId ? (depositsById.get(activeTx.depositId)?.bankName ?? (parsedAfter?.bankName || parsedBefore?.bankName)) : undefined;

  const timeStr = new Date(item.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();

  const actionColor =
    item.action === 'create' ? palette.numberPositive :
      item.action === 'delete' ? palette.numberNegative :
        palette.brand;

  const actionText =
    item.action === 'create' ? 'Added' :
      item.action === 'delete' ? 'Deleted' :
        'Edited';

  // Diff details
  let changes: FieldChange[] = [];
  if (item.action === 'update' && parsedBefore && parsedAfter) {
    if (item.tableName === 'deposits') {
      changes = getDepositDiff(parsedBefore, parsedAfter, sym);
    } else if (item.tableName === 'loans') {
      changes = getLoanDiff(parsedBefore, parsedAfter, sym, accountsById);
    } else if (item.tableName === 'assets') {
      changes = getAssetDiff(parsedBefore, parsedAfter, sym);
    } else {
      changes = getTransactionDiff(parsedBefore, parsedAfter, sym, accountsById, getCategoryFullDisplayName);
    }
  }

  // Handle Card Press
  const handleCardPress = async () => {
    if (item.action === 'delete') {
      return;
    }
    if (item.tableName === 'loans') {
      try {
        const txs = await getTransactions({ loanId: item.recordId });
        const originTx = txs.find(t => t.type === 'loan' && !t.loanTransactionType);
        if (originTx) {
          handleTransactionPress(originTx);
        } else {
          showAlert(STRINGS.audit.alerts.errorTitle, STRINGS.audit.alerts.errorOriginNotFound);
        }
      } catch {
        showAlert(STRINGS.audit.alerts.errorTitle, STRINGS.audit.alerts.errorGetLoanTx);
      }
    } else if (item.tableName === 'assets') {
      const assetExists = useAssetsStore.getState().assets.some(a => a.id === item.recordId);
      if (assetExists) {
        router.push({ pathname: '/modals/asset-form', params: { id: item.recordId } });
      } else {
        showAlert('Asset Deleted', 'This asset has been deleted and cannot be opened.');
      }
    } else if (activeTx) {
      if (activeTx.depositId) {
        const depositExists = depositsById.has(activeTx.depositId);
        if (depositExists) {
          handleTransactionPress(activeTx);
        } else {
          showAlert('Deposit Deleted', 'This deposit has been deleted and cannot be opened.');
        }
        return;
      }
      try {
        const exists = await getTransactionById(activeTx.id);
        if (exists) {
          handleTransactionPress(exists);
        } else {
          showAlert('Transaction Deleted', 'This transaction has been deleted and cannot be opened.');
        }
      } catch {
        showAlert('Error', 'Failed to verify transaction existence.');
      }
    }
  };


  const transactionItem = (
    <TransactionListItem
      tx={activeTx}
      sym={sym}
      palette={palette}
      isLast={true}
      isCard={false}
      categoryName={catName}
      categoryIcon={catIcon}
      accountName={accName}
      linkedAccountName={linkedAccName}
      loanPersonName={loanPerson}
      loanDirection={loanDir}
      depositName={depName}
      depositBankName={depBank}
      showAmountSign={false}
      paddingY={16}
      dateText={formatDate(activeTx.date)}
      hidePayee={item.action !== 'delete'}
      hideIcon={item.action !== 'delete'}
      hideTags={item.action !== 'delete'}
      hideNote={item.action !== 'delete'}
    />
  );

  const cardContent = item.action === 'delete' ? (
    <View style={{ opacity: 0.55 }}>{transactionItem}</View>
  ) : (
    transactionItem
  );

  // Reanimated Scale Value
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.985, PRESS_IN);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, PRESS_OUT);
  };

  return (
    <View style={{ marginHorizontal: SCREEN_GUTTER }}>
      {showHeader && (
        <TransactionDateHeader
          dateKey={dateKey}
          palette={palette}
          style={{
            marginTop: index === 0 ? 4 : 16,
            marginBottom: 10,
          }}
        />
      )}

      <View style={{ flexDirection: 'row' }}>
        {/* Left Column: Vertical Timeline Line and Dot Node */}
        <View style={{ width: 24, alignItems: 'center', position: 'relative' }}>
          {/* Connecting Line */}
          <View
            style={{
              position: 'absolute',
              width: 1.5,
              backgroundColor: palette.border,
              top: 0,
              bottom: index === logs.length - 1 ? undefined : 0,
              height: index === logs.length - 1 ? 13 : undefined,
              left: 11.25,
            }}
          />
          {/* The Dot Node representing the activity event time */}
          <View
            style={{
              position: 'absolute',
              width: 7.5,
              height: 7.5,
              borderRadius: 3.5,
              backgroundColor: actionColor,
              borderWidth: 1.5,
              borderColor: palette.surface,
              left: 8.5,
              top: 13,
            }}
          />
        </View>

        {/* Right Column: Time and Details Card */}
        <View style={{ flex: 1, paddingBottom: 20 }}>
          {/* Activity Time and Action description */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 8, paddingRight: 14 }}>
            <Text style={{ fontSize: 11.5, color: actionColor, fontWeight: FONT_WEIGHT.bold }}>
              {actionText}
            </Text>
            <Text style={{ fontSize: 11.5, color: palette.textSecondary, fontWeight: FONT_WEIGHT.medium }}>
              {timeStr}
            </Text>
          </View>

          {/* Animated visual spring-scaling block for the entire card */}
          <Pressable
            disabled={item.action === 'delete'}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleCardPress}
          >
            <Animated.View
              style={[
                {
                  backgroundColor: palette.surface,
                  borderRadius: HOME_RADIUS.card,
                  borderWidth: 1,
                  borderColor: palette.border,
                  overflow: 'hidden',
                },
                animStyle,
              ]}
            >
              {cardContent}

              {/* Bottom section: details/diffs */}
              {item.action === 'update' && changes.length > 0 && (
                <View
                  style={{
                    paddingHorizontal: 14,
                    paddingTop: 10,
                    paddingBottom: 10,
                    gap: 8,
                    borderTopWidth: 1,
                    borderTopColor: palette.divider,
                  }}
                >
                  {changes.map((change) => {
                    const isCategory = change.field === 'Category';
                    const isImages = change.field === 'Images';
                    const isTags = change.field === 'Tags';

                    // Render tag IDs array as badge rows
                    if (isTags) {
                      let beforeIds: string[] = [];
                      let afterIds: string[] = [];
                      try { beforeIds = JSON.parse(change.beforeVal); } catch { beforeIds = []; }
                      try { afterIds = JSON.parse(change.afterVal); } catch { afterIds = []; }

                      const renderTagBadges = (ids: string[]) => {
                        if (ids.length === 0) {
                          return <Text style={{ fontSize: CARD_TEXT.tertiary, color: palette.textMuted, marginTop: 2 }}>None</Text>;
                        }
                        return (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 2 }}>
                            {ids.map(id => {
                              const tag = tagsById.get(id);
                              const name = tag?.name ?? id;
                              const color = tag?.color ?? '#888';
                              return (
                                <TagBadge
                                  key={id}
                                  name={name}
                                  color={color}
                                  palette={palette}
                                  size="small"
                                />
                              );
                            })}
                          </View>
                        );
                      };

                      return (
                        <View key="Tags" style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ width: 80, fontSize: CARD_TEXT.tertiary, color: palette.textSecondary, fontWeight: FONT_WEIGHT.semibold }}>Tags</Text>
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingRight: 14 }}>
                            {renderTagBadges(beforeIds)}
                            <Text style={{ fontSize: CARD_TEXT.tertiary, color: palette.textSecondary, marginHorizontal: 2, marginTop: 2 }}>
                              {'\u2192'}
                            </Text>
                            {renderTagBadges(afterIds)}
                          </View>
                        </View>
                      );
                    }

                    return (
                      <View key={change.field} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <Text style={{ width: 80, fontSize: CARD_TEXT.tertiary, color: palette.textSecondary, fontWeight: FONT_WEIGHT.semibold }}>
                          {change.field}
                        </Text>
                        <View style={{ flex: 1, paddingRight: 14 }}>
                          {isCategory ? (
                            <>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: CARD_TEXT.tertiary, color: palette.textMuted, textDecorationLine: 'line-through', textAlign: 'left', flexShrink: 1 }}>
                                  {change.beforeVal}
                                </Text>
                                <Text style={{ fontSize: CARD_TEXT.tertiary, color: palette.textSecondary, marginLeft: 8 }}>
                                  {'\u2192'}
                                </Text>
                              </View>
                              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: CARD_TEXT.tertiary, color: palette.text, fontWeight: FONT_WEIGHT.medium, textAlign: 'left', marginTop: 4 }}>
                                {change.afterVal}
                              </Text>
                            </>
                          ) : isImages ? (
                            <Text numberOfLines={1} style={{ fontSize: CARD_TEXT.tertiary, color: palette.text, fontWeight: FONT_WEIGHT.medium, textAlign: 'left' }}>
                              {change.afterVal}
                            </Text>
                          ) : (
                            <Text numberOfLines={change.field === 'Note' ? 2 : 1} style={{ fontSize: CARD_TEXT.tertiary, color: palette.text, textAlign: 'left' }}>
                              <Text style={{ color: palette.textMuted, textDecorationLine: 'line-through' }}>
                                {change.beforeVal}
                              </Text>
                              <Text style={{ color: palette.textSecondary }}>
                                {'  \u2192  '}
                              </Text>
                              <Text style={{ fontWeight: FONT_WEIGHT.medium }}>
                                {change.afterVal}
                              </Text>
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

export default function AuditScreen() {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { showAlert, dialog } = useAppDialog(palette);
  const handleTransactionPress = useTransactionPress();
  const isFocused = useIsFocused();

  // Lookup data from stores
  const accounts = useAccountsStore((s) => s.accounts);
  const categories = useCategoriesStore((s) => s.categories);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const tags = useCategoriesStore((s) => s.tags);
  const loans = useLoansStore((s) => s.loans);
  const deposits = useFixedDepositsStore((s) => s.deposits);

  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';

  const mutationVersion = useTransactionsStore((s) => s.mutationVersion);
  const lastLoadedVersionRef = useRef(mutationVersion);

  // Local state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [splitGroupTotals, setSplitGroupTotals] = useState<Record<string, number>>({});

  // Scroll and Info Header Button States
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollTop(offsetY > 150);
  };

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // Initialize store cache if needed
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      if (accounts.length === 0) useAccountsStore.getState().load().catch(() => undefined);
      if (categories.length === 0) useCategoriesStore.getState().load().catch(() => undefined);
      if (loans.length === 0) useLoansStore.getState().load().catch(() => undefined);
      if (deposits.length === 0) useFixedDepositsStore.getState().refresh().catch(() => undefined);
      if (!useAssetsStore.getState().isLoaded) useAssetsStore.getState().load().catch(() => undefined);
    });
    return () => task.cancel();
  }, []);

  // Construct Lookup Maps
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, { name: t.name, color: t.color }])), [tags]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);
  const depositsById = useMemo(() => new Map(deposits.map((d) => [d.id, { name: d.name, bankName: d.bankName }])), [deposits]);

  // Load audit logs function
  const fetchLogs = async (currentOffset: number, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (currentOffset > 0) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const rawResults = await getAuditLogs(PAGE_SIZE, currentOffset, 30);
      const filteredResults = rawResults.filter((log) => {
        if (log.tableName === 'transactions') {
          const parsedBefore: Transaction | null = log.payloadBefore ? JSON.parse(log.payloadBefore) : null;
          const parsedAfter: Transaction | null = log.payloadAfter ? JSON.parse(log.payloadAfter) : null;
          const activeTx = parsedAfter || parsedBefore;
          if (!activeTx) return false;
          // Filter out incoming transfer leg
          if (activeTx.transferPairId && activeTx.type === 'in') {
            return false;
          }
          // Filter out 'transactions' update logs if they are linked to a deposit or loan (avoiding duplicates)
          if (log.action === 'update' && (activeTx.depositId || activeTx.loanId)) {
            return false;
          }
          return true;
        } else if (log.tableName === 'deposits' || log.tableName === 'loans') {
          // Display updates only (creates and deletes are shown via transaction logs)
          return log.action === 'update';
        } else if (log.tableName === 'assets') {
          // Display all asset logs
          return true;
        }
        return false;
      });

      // Batch load split group totals for split transactions present in the loaded logs
      const splitGroupIds = new Set<string>();
      filteredResults.forEach((log) => {
        if (log.tableName === 'transactions') {
          const parsedBefore: Transaction | null = log.payloadBefore ? JSON.parse(log.payloadBefore) : null;
          const parsedAfter: Transaction | null = log.payloadAfter ? JSON.parse(log.payloadAfter) : null;
          const activeTx = parsedAfter || parsedBefore;
          if (activeTx?.splitGroupId) {
            splitGroupIds.add(activeTx.splitGroupId);
          }
        }
      });

      if (splitGroupIds.size > 0) {
        const totalsMap = await getSplitGroupTotals(Array.from(splitGroupIds));
        setSplitGroupTotals((prev) => {
          const next = { ...prev };
          totalsMap.forEach((val, key) => {
            next[key] = val;
          });
          return next;
        });
      }

      if (isRefresh) {
        setLogs(filteredResults);
        setOffset(0);
        setHasMore(rawResults.length === PAGE_SIZE);
      } else {
        setLogs((prev) => (currentOffset === 0 ? filteredResults : [...prev, ...filteredResults]));
        setHasMore(rawResults.length === PAGE_SIZE);
      }
    } catch (error) {
      showAlert(STRINGS.audit.alerts.errorTitle, STRINGS.audit.alerts.errorGetLogs);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      const hasMutated = lastLoadedVersionRef.current !== mutationVersion;
      if (hasMutated || logs.length === 0) {
        const task = InteractionManager.runAfterInteractions(() => {
          fetchLogs(0, true);
          lastLoadedVersionRef.current = mutationVersion;
        });
        return () => task.cancel();
      }
    }
  }, [isFocused, mutationVersion, logs.length]);

  const handleRefresh = () => {
    fetchLogs(0, true);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore || loading) return;
    const nextOffset = offset + PAGE_SIZE;
    setOffset(nextOffset);
    fetchLogs(nextOffset);
  };

  const renderAuditLogItem = ({ item, index }: { item: AuditLog; index: number }) => {
    return (
      <AuditLogItem
        item={item}
        index={index}
        logs={logs}
        palette={palette}
        sym={sym}
        categoriesById={categoriesById}
        tagsById={tagsById}
        accountsById={accountsById}
        loansById={loansById}
        depositsById={depositsById}
        getCategoryFullDisplayName={getCategoryFullDisplayName}
        handleTransactionPress={handleTransactionPress}
        showAlert={showAlert}
        splitGroupTotals={splitGroupTotals}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <SheetScrollTopButton
                visible={showScrollTop}
                onPress={scrollToTop}
                palette={palette}
              />
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={0.65}
                onPress={() => setShowInfoModal(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AppIcon name="info" size={20} color={palette.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {loading && offset === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={logs}
          renderItem={renderAuditLogItem}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingVertical: SPACING.md,
            paddingBottom: getScrollableBottomPadding(insets, 40),
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={palette.brand}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={{ flex: 1, padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 80 }}>
              <AppIcon name="history" size={40} color={palette.textMuted} style={{ marginBottom: 12 }} />
              <Text appWeight="medium" style={{ color: palette.textMuted, fontSize: TYPE.rowLabel, textAlign: 'center' }}>
                {STRINGS.audit.empty.title}
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: TYPE.caption, textAlign: 'center', marginTop: 4 }}>
                {STRINGS.audit.empty.subtitle}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={palette.brand} />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      <SystemBottomGuard />
      {dialog}

      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <Pressable
          onPress={() => setShowInfoModal(false)}
          style={{
            flex: 1,
            backgroundColor: palette.scrim,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
        >
          <Pressable
            onPress={() => { }}
            style={{
              width: '100%',
              maxWidth: 340,
              borderRadius: HOME_RADIUS.card,
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.divider,
              padding: 20,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: palette.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="info" size={16} color={palette.brand} strokeWidth={2} />
              </View>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                {STRINGS.audit.modal.title}
              </Text>
            </View>

            {/* Description */}
            <Text style={{ fontSize: 13.5, lineHeight: 20, color: palette.text, marginBottom: 16 }}>
              {STRINGS.audit.modal.description}
            </Text>

            {/* Legend */}
            <View style={{ gap: 22, marginBottom: 20, padding: 12, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: HOME_RADIUS.small }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.numberPositive }} />
                <Text style={{ fontSize: 12.5, color: palette.textSecondary }}>
                  <Text style={{ fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>{STRINGS.audit.modal.added}</Text> {STRINGS.audit.modal.addedDesc}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.brand }} />
                <Text style={{ fontSize: 12.5, color: palette.textSecondary }}>
                  <Text style={{ fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>{STRINGS.audit.modal.edited}</Text> {STRINGS.audit.modal.editedDesc}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.numberNegative }} />
                <Text style={{ fontSize: 12.5, color: palette.textSecondary }}>
                  <Text style={{ fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>{STRINGS.audit.modal.deleted}</Text> {STRINGS.audit.modal.deletedDesc}
                </Text>
              </View>
            </View>

            {/* Button */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={0.8}
                onPress={() => setShowInfoModal(false)}
                style={{
                  backgroundColor: palette.brand,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 24,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: FONT_WEIGHT.semibold, color: palette.onBrand }}>
                  {STRINGS.audit.modal.gotIt}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
