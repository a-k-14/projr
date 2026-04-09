import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccountsStore } from '../stores/useAccountsStore';
import { formatCurrency } from '../lib/derived';
import { HOME_RADIUS, HOME_TEXT, getTxTypeConfig } from '../lib/homeTokens';
import { AppThemePalette } from '../lib/theme';
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
  palette: AppThemePalette;
}

export function TransactionListItem({
  tx,
  sym,
  isLast,
  categoryName,
  padding = 12,
  iconSize = 40,
  palette,
}: Props) {
  const { getById } = useAccountsStore();
  const account = getById(tx.accountId);
  const cfg = getTxTypeConfig(palette)[tx.type] ?? getTxTypeConfig(palette).out;

  const subtitle = [categoryName, account?.name].filter(Boolean).join(' · ');

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
          marginRight: 12,
        }}
      >
        <Ionicons name={cfg.iconName as never} size={Math.round(iconSize * 0.45)} color={cfg.color} />
      </View>

      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text, marginBottom: 2 }}>
          {tx.payee || cfg.label}
        </Text>
        <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
          {subtitle}
        </Text>
      </View>

      <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: tx.type === 'in' ? palette.active : palette.text }}>
        {formatCurrency(tx.amount, sym)}
      </Text>
    </View>
  );
}
