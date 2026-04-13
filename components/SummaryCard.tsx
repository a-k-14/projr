import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatCurrency } from '../lib/derived';
import { HOME_RADIUS, HOME_SURFACE, HOME_TEXT } from '../lib/layoutTokens';
import { AppThemePalette } from '../lib/theme';
import { CashflowSummary } from '../types';

interface SummaryCardProps {
  cashflow: CashflowSummary;
  sym: string;
  palette: AppThemePalette;
  onPressCategory?: (category: 'in' | 'out' | 'net') => void;
}

export function SummaryCard({ cashflow, sym, palette, onPressCategory }: SummaryCardProps) {
  const categories = [
    { key: 'in', label: 'In', color: palette.brand },
    { key: 'out', label: 'Out', color: palette.negative },
    { key: 'net', label: 'Net', color: palette.brand },
  ] as const;

  return (
    <View style={[styles.card, { backgroundColor: palette.card }]}>
      {categories.map((category, index) => (
        <TouchableOpacity
          key={category.key}
          onPress={onPressCategory ? () => onPressCategory(category.key) : undefined}
          disabled={!onPressCategory}
          activeOpacity={0.75}
          style={[
            styles.column,
            {
              borderLeftWidth: index === 0 ? 0 : 1,
              borderLeftColor: palette.divider,
            },
          ]}
        >
          <Text style={[styles.label, { color: palette.textMuted, fontWeight: '700' }]}>{category.label}</Text>
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
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: HOME_RADIUS.card,
    overflow: 'hidden',
    marginBottom: HOME_SURFACE.summaryCardBottom,
  },
  column: {
    flex: 1,
    paddingVertical: HOME_SURFACE.summaryColumnPaddingY,
    paddingHorizontal: HOME_SURFACE.summaryColumnPaddingX,
    alignItems: 'center',
  },
  label: {
    fontSize: HOME_TEXT.caption,
    marginBottom: 6,
  },
  value: {
    fontSize: HOME_TEXT.body,
    fontWeight: '600',
  },
});
