import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CashflowSummary } from '../types';
import { formatCurrency } from '../lib/derived';
import { HOME_COLORS, HOME_RADIUS, HOME_TEXT } from '../lib/homeTokens';

interface SummaryCardProps {
  cashflow: CashflowSummary;
  sym: string;
}

export function SummaryCard({ cashflow, sym }: SummaryCardProps) {
  const categories = [
    { key: 'in', label: 'In', color: HOME_COLORS.active },
    { key: 'out', label: 'Out', color: HOME_COLORS.negative },
    { key: 'net', label: 'Net', color: HOME_COLORS.active },
  ] as const;

  return (
    <View style={styles.card}>
      {categories.map((category, index) => (
        <View
          key={category.key}
          style={[
            styles.column,
            { borderLeftWidth: index === 0 ? 0 : 1 },
          ]}
        >
          <Text style={styles.label}>{category.label}</Text>
          <Text
            style={[
              styles.value,
              { color: category.color },
            ]}
          >
            {formatCurrency(cashflow[category.key], sym)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: HOME_COLORS.surface,
    borderRadius: HOME_RADIUS.card,
    overflow: 'hidden',
    marginBottom: 18,
  },
  column: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderLeftColor: HOME_COLORS.divider,
  },
  label: {
    fontSize: HOME_TEXT.caption,
    color: HOME_COLORS.textMuted,
    marginBottom: 6,
  },
  value: {
    fontSize: HOME_TEXT.body,
    fontWeight: '700',
  },
});
