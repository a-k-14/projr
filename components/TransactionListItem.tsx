import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccountsStore } from '../stores/useAccountsStore';
import { formatCurrency, getTransactionCashflowImpact } from '../lib/derived';
import { HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT, getTxTypeConfig } from '../lib/layoutTokens';
import type { AppThemePalette } from '../lib/theme';
import type { Transaction } from '../types';

import { CARD_PADDING } from '../lib/design';

interface Props {
  tx: Transaction;
  sym: string;
  palette: AppThemePalette;
  isLast: boolean;
  categoryName?: string;
  accountName?: string;
  /** Padding applied to each row — defaults to the shared compact list spacing */
  padding?: number;
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
  categoryName,
  accountName,
  padding = HOME_LAYOUT.listRowPadding,
  iconSize = HOME_LAYOUT.listIconSize,
  onPress,
}: Props) {
  const accountNameSelected = useAccountsStore((state) =>
    accountName ?? state.accounts.find((account) => account.id === tx.accountId)?.name,
  );
  const typeConfigs = getTxTypeConfig(palette);
  const cfg = typeConfigs[tx.type] ?? typeConfigs.out;

  const subtitle = [categoryName, accountNameSelected].filter(Boolean).join(' · ');
  const cashflowImpact = getTransactionCashflowImpact(tx);
  const amountPrefix = cashflowImpact === 'in' ? '+' : cashflowImpact === 'out' ? '-' : '';

  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding,
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
        <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text, marginBottom: 2 }}>
          {tx.payee || cfg.label}
        </Text>
        <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
          {subtitle}
        </Text>
      </View>

      <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '500', color: palette.text }}>
        {amountPrefix ? `${amountPrefix} ${formatCurrency(tx.amount, sym)}` : formatCurrency(tx.amount, sym)}
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
