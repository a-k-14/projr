import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text } from '@/components/ui/AppText';
import { View , TouchableOpacity } from 'react-native';
import { formatCurrency, getLoanDisplayLabel, getTransactionCashflowImpact } from '../lib/derived';
import { HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT, getTxTypeConfig } from '../lib/layoutTokens';
import { isEmojiIcon } from '../lib/ui-format';
import type { AppThemePalette } from '../lib/theme';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useCategoriesStore } from '../stores/useCategoriesStore';
import type { Transaction } from '../types';

import { CARD_PADDING } from '../lib/design';

interface Props {
  tx: Transaction;
  sym: string;
  palette: AppThemePalette;
  isLast: boolean;
  displayAmount?: number;
  categoryName?: string;
  accountName?: string;
  linkedAccountName?: string;
  loanPersonName?: string;
  loanDirection?: 'lent' | 'borrowed';
  tertiaryText?: string;
  showAmountSign?: boolean;
  useTypeAmountColor?: boolean;
  paddingX?: number;
  paddingY?: number;
  /** Icon box size — defaults to the shared compact list icon size */
  iconSize?: number;
  /** Optional: navigate to edit screen when tapped */
  onPress?: (tx: Transaction) => void;
}

export const TransactionListItem = React.memo(function TransactionListItem({
  tx,
  sym,
  palette,
  isLast,
  displayAmount,
  categoryName,
  accountName,
  linkedAccountName,
  loanPersonName,
  loanDirection,
  tertiaryText,
  showAmountSign = true,
  useTypeAmountColor = true,
  paddingX = HOME_LAYOUT.listRowPaddingX,
  paddingY = HOME_LAYOUT.listRowPaddingY,
  iconSize = HOME_LAYOUT.listIconSize,
  onPress }: Props) {
  const effectiveType = tx.transferPairId ? 'transfer' : tx.type;
  const accountNameSelected = useAccountsStore((state) =>
    accountName ?? state.accounts.find((account) => account.id === tx.accountId)?.name,
  );
  const category = useCategoriesStore((state) =>
    tx.categoryId ? state.categories.find((item) => item.id === tx.categoryId) : undefined,
  );

  const typeConfigs = getTxTypeConfig(palette);
  const cfg = typeConfigs[effectiveType] ?? typeConfigs.out;
  const cashflowImpact = getTransactionCashflowImpact(tx);
  const displayImpact = getTransactionCashflowImpact(tx, { includeTransfers: true });

  function isKnownFeatherIcon(icon: string) {
    return Object.prototype.hasOwnProperty.call(Feather.glyphMap, icon);
  }

  let title = tx.payee || cfg.label;
  let titleSecondaryText: string | undefined;
  let subtitle = [categoryName, accountNameSelected].filter(Boolean).join(' · ');
  let noteLine: string | undefined;
  const hasReceipt = (tx.receiptImageUris?.length ?? 0) > 0;

  // 1. Specialized Title/Subtitle based on type
  if (tx.transferPairId && linkedAccountName) {
    title = 'Transfer';
    titleSecondaryText = tx.type === 'out' ? 'Out' : 'In';
    // If we are seeing the "Outflow" side, current account is source
    // If we are seeing the "Inflow" side, current account is destination
    const from = tx.type === 'out' ? accountNameSelected : linkedAccountName;
    const to = tx.type === 'out' ? linkedAccountName : accountNameSelected;
    subtitle = `${from} → ${to}`;
  } else if (tx.type === 'loan' && loanPersonName) {
    const loanLabel = loanDirection ? getLoanDisplayLabel(loanDirection, cashflowImpact).replace(/^Loan - /, '') : 'Loan';
    title = 'Loan';
    titleSecondaryText = loanLabel;
    subtitle = [accountNameSelected, loanPersonName].filter(Boolean).join(' · ');
  } else if (tx.type === 'in' || tx.type === 'out') {
    title = categoryName || (tx.type === 'in' ? 'Income' : 'Expense');
    subtitle = [accountNameSelected, tx.payee].filter(Boolean).join(' · ');
    noteLine = tx.note?.trim() || undefined;
  }

  const amountValue = displayAmount ?? tx.amount;
  const amountPrefix = getAmountPrefix(amountValue, displayImpact, showAmountSign);
  const amountColor = useTypeAmountColor
    ? (displayImpact === 'in' ? palette.brand : displayImpact === 'out' ? palette.negative : palette.text)
    : palette.text;
  const displayAmountColor = amountColor === palette.text ? palette.listText : amountColor;
  const inOutCategoryIcon = (tx.type === 'in' || tx.type === 'out') && category?.icon ? category.icon : null;
  const iconName =
    tx.type === 'loan'
      ? 'card-outline'
      : inOutCategoryIcon && !isEmojiIcon(inOutCategoryIcon) && isKnownFeatherIcon(inOutCategoryIcon)
        ? inOutCategoryIcon
        : cfg.iconName;
  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: paddingX,
        paddingVertical: paddingY,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.divider }}
    >
      <View
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: HOME_RADIUS.small,
          backgroundColor: cfg.bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: HOME_SPACE.md }}
      >
        {inOutCategoryIcon && isEmojiIcon(inOutCategoryIcon) ? (
          <Text style={{ fontSize: Math.round(iconSize * 0.45) }}>{inOutCategoryIcon}</Text>
        ) : inOutCategoryIcon && isKnownFeatherIcon(inOutCategoryIcon) ? (
          <Feather
            name={inOutCategoryIcon as keyof typeof Feather.glyphMap}
            size={Math.round(iconSize * 0.45)}
            color={cfg.color}
          />
        ) : (
          <Ionicons
            name={iconName as never}
            size={Math.round(iconSize * 0.45)}
            color={cfg.color}
          />
        )}
      </View>

      <View style={{ flex: 1, paddingRight: CARD_PADDING - 4 }}>
        <Text appWeight="medium" numberOfLines={1} style={{ fontSize: 14, color: palette.listText, marginBottom: 2 }}>
          {title}
          {titleSecondaryText ? (
            <Text appWeight="medium" style={{ color: palette.listText }}>
              {' '}
              › {titleSecondaryText}
            </Text>
          ) : null}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 14, color: palette.listText, lineHeight: 18 }}>
          {subtitle}
        </Text>
        {noteLine ? (
          <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textSecondary, marginTop: 4, lineHeight: 18 }}>
            {noteLine}
          </Text>
        ) : null}
        {(tx.splitGroupId || hasReceipt || tertiaryText) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {tx.splitGroupId ? (
              <Ionicons name="layers-outline" size={13} color={palette.textSecondary} />
            ) : null}
            {hasReceipt ? (
              <Ionicons name="image-outline" size={13} color={palette.textSecondary} />
            ) : null}
            {tertiaryText ? (
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: palette.textSecondary, lineHeight: 18 }}>
                {tertiaryText}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={{ alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'center', paddingVertical: 1 }}>
        <Text appWeight="medium" style={{ fontSize: 14, fontWeight: '500', color: displayAmountColor }}>
          {amountPrefix ? `${amountPrefix} ${formatCurrency(Math.abs(amountValue), sym)}` : formatCurrency(Math.abs(amountValue), sym)}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity delayPressIn={0} activeOpacity={0.6} onPress={() => requestAnimationFrame(() => onPress(tx))}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
});

function getAmountPrefix(amount: number, impact: 'in' | 'out' | 'neutral', showAmountSign: boolean) {
  if (amount < 0) return '-';
  if (!showAmountSign) return '';
  if (impact === 'in') return '+';
  if (impact === 'out') return '-';
  return '';
}
