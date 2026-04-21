import { Text } from '@/components/ui/AppText';
import { StyleSheet, View , TouchableOpacity } from 'react-native';
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
    { key: 'net', label: 'Net', color: cashflow.net < 0 ? palette.negative : palette.brand },
  ] as const;

  return (
    <View style={[styles.card, { backgroundColor: palette.card }]}>
      {categories.map((category, index) => (
        <TouchableOpacity delayPressIn={0}
          key={category.key}
          onPress={onPressCategory ? () => onPressCategory(category.key) : undefined}
          disabled={!onPressCategory}
          style={[
            styles.column,
            {
              borderLeftWidth: index === 0 ? 0 : 1,
              borderLeftColor: palette.divider },
          ]}
        >
          <Text appWeight="medium" style={[styles.label, { color: palette.textMuted }]}>{category.label}</Text>
          <Text
            appWeight="medium"
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            style={[
              styles.value,
              { color: category.color },
            ]}
          >
            {formatCurrency(Math.abs(cashflow[category.key]), sym)}
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
    marginBottom: HOME_SURFACE.summaryCardBottom },
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
    fontWeight: '500' } });
