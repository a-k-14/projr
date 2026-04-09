import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccountsStore } from '../stores/useAccountsStore';
import { formatCurrency } from '../lib/derived';
import { HOME_COLORS, HOME_RADIUS, HOME_TEXT, TX_TYPE_CONFIG } from '../lib/homeTokens';
import type { Transaction } from '../types';

interface Props {
  tx: Transaction;
  sym: string;
  isLast: boolean;
  categoryName?: string;
  /** Padding applied to each row — defaults to 12 */
  padding?: number;
  /** Icon box size — defaults to 40 */
  iconSize?: number;
}

export function TransactionListItem({
  tx,
  sym,
  isLast,
  categoryName,
  padding = 12,
  iconSize = 40,
}: Props) {
  const { getById } = useAccountsStore();
  const account = getById(tx.accountId);
  const cfg = TX_TYPE_CONFIG[tx.type] ?? TX_TYPE_CONFIG.out;

  const subtitle = [categoryName, account?.name].filter(Boolean).join(' · ');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: HOME_COLORS.divider,
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
          marginRight: 12,
        }}
      >
        <Ionicons name={cfg.iconName as never} size={Math.round(iconSize * 0.45)} color={cfg.color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: HOME_TEXT.body, fontWeight: '500', color: HOME_COLORS.neutral }}
          numberOfLines={1}
        >
          {tx.note ?? tx.type}
        </Text>
        {subtitle ? (
          <Text
            style={{ fontSize: HOME_TEXT.caption, color: HOME_COLORS.textSoft, marginTop: 1 }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Text
        style={{
          fontSize: HOME_TEXT.body,
          fontWeight: '600',
          color: tx.type === 'in' ? HOME_COLORS.positive : HOME_COLORS.neutral,
        }}
      >
        {formatCurrency(tx.amount, sym)}
      </Text>
    </View>
  );
}
