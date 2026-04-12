import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccountsStore } from '../stores/useAccountsStore';
import { formatCurrency } from '../lib/derived';
import { HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT, getTxTypeConfig } from '../lib/layoutTokens';
import { AppThemePalette } from '../lib/theme';
import type { Transaction } from '../types';

import { CARD_PADDING } from '../lib/design';

interface Props {
  tx: Transaction;
  sym: string;
  isLast: boolean;
  categoryName?: string;
  /** Padding applied to each row — defaults to the shared compact list spacing */
  padding?: number;
  /** Icon box size — defaults to the shared compact list icon size */
  iconSize?: number;
  palette: AppThemePalette;
}

export function TransactionListItem({
  tx,
  sym,
  isLast,
  categoryName,
  padding = HOME_LAYOUT.listRowPadding,
  iconSize = HOME_LAYOUT.listIconSize,
  palette,
}: Props) {
  const { getById } = useAccountsStore();
  const account = getById(tx.accountId);
  const cfg = getTxTypeConfig(palette)[tx.type] ?? getTxTypeConfig(palette).out;

  const subtitle = [categoryName, account?.name].filter(Boolean).join(' · ');
  const amountPrefix = tx.type === 'in' ? '+' : tx.type === 'out' || tx.type === 'loan' ? '-' : '';

  return (
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
        {amountPrefix}{formatCurrency(tx.amount, sym)}
      </Text>
    </View>
  );
}
