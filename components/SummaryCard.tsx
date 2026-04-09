import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CashflowSummary } from '../types';
import { formatCurrency } from '../lib/derived';
import { HOME_RADIUS, HOME_TEXT } from '../lib/homeTokens';
import { AppThemePalette } from '../lib/theme';

interface SummaryCardProps {
  cashflow: CashflowSummary;
  sym: string;
  palette: AppThemePalette;
}

export function SummaryCard({ cashflow, sym, palette }: SummaryCardProps) {
  const categories = [
    { key: 'in', label: 'In', color: palette.active },
    { key: 'out', label: 'Out', color: palette.negative },
    { key: 'net', label: 'Net', color: palette.active },
  ] as const;

  return (
    <View style={[styles.card, { backgroundColor: palette.card }]}>
      {categories.map((category, index) => (
        <View
          key={category.key}
          style={[
            styles.column,
            { 
              borderLeftWidth: index === 0 ? 0 : 1,
              borderLeftColor: palette.divider 
            },
          ]}
        >
          <Text style={[styles.label, { color: palette.textMuted }]}>{category.label}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit={true}
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
    borderRadius: HOME_RADIUS.card,
    overflow: 'hidden',
    marginBottom: 18,
  },
  column: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  label: {
    fontSize: HOME_TEXT.caption,
    marginBottom: 6,
  },
  value: {
    fontSize: HOME_TEXT.body,
    fontWeight: '700',
  },
});
