import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { formatCurrency, getLoanDisplayLabel, getTransactionCashflowImpact } from '../lib/derived';
import { HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT, getTxTypeConfig } from '../lib/layoutTokens';
import type { AppThemePalette } from '../lib/theme';
import { useAccountsStore } from '../stores/useAccountsStore';
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
  useTypeAmountColor = false,
  paddingX = HOME_LAYOUT.listRowPaddingX,
  paddingY = HOME_LAYOUT.listRowPaddingY,
  iconSize = HOME_LAYOUT.listIconSize,
  onPress,
}: Props) {
  const accountNameSelected = useAccountsStore((state) =>
    accountName ?? state.accounts.find((account) => account.id === tx.accountId)?.name,
  );

  const typeConfigs = getTxTypeConfig(palette);
  const cfg = typeConfigs[tx.type] ?? typeConfigs.out;
  const cashflowImpact = getTransactionCashflowImpact(tx);

  let title = tx.payee || cfg.label;
  let titleSecondaryText: string | undefined;
  let subtitle = [categoryName, accountNameSelected].filter(Boolean).join(' · ');

  // 1. Specialized Title/Subtitle based on type
  if (tx.type === 'transfer' && linkedAccountName) {
    title = tx.payee || 'Transfer';
    // If we are seeing the "Outflow" side, current account is source
    // If we are seeing the "Inflow" side, current account is destination
    const from = cashflowImpact === 'out' ? accountNameSelected : linkedAccountName;
    const to = cashflowImpact === 'out' ? linkedAccountName : accountNameSelected;
    subtitle = `${from} → ${to}`;
  } else if (tx.type === 'loan' && loanPersonName) {
    const loanLabel = loanDirection ? getLoanDisplayLabel(loanDirection, cashflowImpact) : 'Loan';
    title = loanLabel.replace(/^Loan - /, '');
    titleSecondaryText = loanPersonName;
    subtitle = accountNameSelected || '';
  } else if (tx.type === 'in' || tx.type === 'out') {
    title = categoryName || (tx.type === 'in' ? 'Income' : 'Expense');
    subtitle = accountNameSelected || '';
  }

  const amountValue = displayAmount ?? tx.amount;
  const amountPrefix = showAmountSign ? (cashflowImpact === 'in' ? '+' : cashflowImpact === 'out' ? '-' : '') : '';
  const amountColor = useTypeAmountColor
    ? cfg.color
    : palette.text;

  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: paddingX,
        paddingVertical: paddingY,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.divider,
      }}
    >
      <View
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: HOME_RADIUS.small,
          backgroundColor: cfg.bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: HOME_SPACE.sm + 2,
        }}
      >
        <Ionicons
          name={(tx.type === 'loan' ? 'card-outline' : cfg.iconName) as never}
          size={Math.round(iconSize * 0.45)}
          color={cfg.color}
        />
      </View>

      <View style={{ flex: 1, paddingRight: CARD_PADDING - 4 }}>
        <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.body, fontWeight: '500', color: palette.text, marginBottom: 2 }}>
          {title}
          {titleSecondaryText ? (
            <Text style={{ color: palette.textSecondary, fontWeight: '400' }}>
              {' '}
              {'\u2022'} {titleSecondaryText}
            </Text>
          ) : null}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>
          {subtitle}
        </Text>
        {tertiaryText ? (
          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 1 }}>
            {tertiaryText}
          </Text>
        ) : null}
      </View>

      <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '500', color: amountColor }}>
        {amountPrefix ? `${amountPrefix} ${formatCurrency(amountValue, sym)}` : formatCurrency(amountValue, sym)}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.6} onPress={() => onPress(tx)}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
});
