import React, { Fragment } from 'react';
import { Text } from '@/components/ui/AppText';
import { StyleSheet, View , TouchableOpacity } from 'react-native';
import { formatCurrency } from '../lib/derived';
import { FONT_WEIGHT } from '../lib/design';
import { HOME_RADIUS, HOME_SURFACE, HOME_TEXT } from '../lib/layoutTokens';
import { AppThemePalette } from '../lib/theme';
import { CashflowSummary } from '../types';

interface SummaryCardProps {
  cashflow: CashflowSummary;
  sym: string;
  palette: AppThemePalette;
  onPressCategory?: (category: 'in' | 'out' | 'net') => void;
  isCashflowMode?: boolean;
}

export function SummaryCard({ cashflow, sym, palette, onPressCategory, isCashflowMode }: SummaryCardProps) {
  const categories = [
    { key: 'in', label: isCashflowMode ? 'Inflow' : 'Income', color: palette.text },
    { key: 'out', label: isCashflowMode ? 'Outflow' : 'Expense', color: palette.text },
    { key: 'net', label: 'Net', color: cashflow.net < 0 ? palette.negative : palette.positive },
  ] as const;

  return (
    <View style={[styles.card, { backgroundColor: 'transparent', borderColor: palette.divider }]}>
      {categories.map((category, index) => (
        <Fragment key={category.key}>
          {index > 0 && (
            <View style={{ width: 1, height: 22, backgroundColor: palette.textSoft, alignSelf: 'center' }} />
          )}
          <TouchableOpacity delayPressIn={0}
            onPress={onPressCategory ? () => onPressCategory(category.key) : undefined}
            disabled={!onPressCategory}
            style={styles.column}
          >
            <Text appWeight="medium" style={[styles.label, { color: palette.textMuted }]}>{category.label}</Text>
            <Text
              appWeight="medium"
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              style={[
                styles.value,
                { color: cashflow[category.key] === 0 ? palette.textMuted : category.color },
              ]}
            >
              {cashflow[category.key] === 0 ? '—' : formatSummaryValue(category.key, cashflow[category.key], sym)}
            </Text>
          </TouchableOpacity>
        </Fragment>
      ))}
    </View>
  );
}

function formatSummaryValue(key: 'in' | 'out' | 'net', value: number, sym: string) {
  const abs = formatCurrency(Math.abs(value), sym);
  // Color carries the bucket role + direction. Only the unusual case (negative value
  // in income/expense) gets a leading '-' to call it out. Net is always unsigned —
  // the colored value carries the sign.
  if (key === 'net') return abs;
  return value < 0 ? `-${abs}` : abs;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: HOME_RADIUS.card,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1 },
  column: {
    flex: 1,
    paddingVertical: HOME_SURFACE.summaryColumnPaddingY,
    paddingHorizontal: HOME_SURFACE.summaryColumnPaddingX,
    alignItems: 'center' },
  label: {
    fontSize: HOME_TEXT.caption,
    marginBottom: 6 },
  value: {
    fontSize: HOME_TEXT.body,
    fontWeight: FONT_WEIGHT.medium } });
