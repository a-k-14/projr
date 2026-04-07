import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '../types';
import { formatCurrency } from '../lib/derived';
import { HOME_COLORS, HOME_RADIUS, HOME_TEXT } from '../lib/homeTokens';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useCategoriesStore } from '../stores/useCategoriesStore';

interface TransactionItemProps {
  tx: Transaction;
  sym: string;
  isLast?: boolean;
  onPress?: () => void;
}

export function TransactionItem({ 
  tx, 
  sym, 
  isLast, 
}: TransactionItemProps) {
  const { getById } = useAccountsStore();
  const { getCategoryDisplayName } = useCategoriesStore();
  
  const account = getById(tx.accountId);
  const categoryName = tx.categoryId ? getCategoryDisplayName(tx.categoryId) : undefined;

  const iconName =
    tx.type === 'in'
      ? 'arrow-down'
      : tx.type === 'out'
        ? 'arrow-up'
        : tx.type === 'transfer'
          ? 'swap-horizontal'
          : 'cash';

  const iconBg =
    tx.type === 'in'
      ? '#DCFCE7'
      : tx.type === 'out'
        ? '#FEE2E2'
        : '#F1F5F9';

  const iconColor =
    tx.type === 'in'
      ? HOME_COLORS.positive
      : tx.type === 'out'
        ? '#DC2626'
        : '#1E293B';

  const subtitle = [categoryName, account?.name].filter(Boolean).join(' · ');

  return (
    <View
      style={[
        styles.container,
        { borderBottomWidth: isLast ? 0 : 1 },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: iconBg },
        ]}
      >
        <Ionicons name={iconName as never} size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.note} numberOfLines={1}>
          {tx.note || tx.type}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.amount,
          { color: tx.type === 'in' ? HOME_COLORS.positive : HOME_COLORS.neutral },
        ]}
      >
        {formatCurrency(tx.amount, sym)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomColor: HOME_COLORS.divider,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: HOME_RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  note: {
    fontSize: HOME_TEXT.body,
    fontWeight: '500',
    color: HOME_COLORS.neutral,
  },
  subtitle: {
    fontSize: HOME_TEXT.caption,
    color: HOME_COLORS.textSoft,
    marginTop: 1,
  },
  amount: {
    fontSize: HOME_TEXT.body,
    fontWeight: '600',
  },
});
