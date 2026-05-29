import { Text } from '@/components/ui/AppText';
import React from 'react';
import { StyleSheet, TextInputProps, View } from 'react-native';
import { FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import { AppThemePalette } from '../../lib/theme';

interface MoreFiltersAmountRangeProps {
  amountMinStr: string;
  setAmountMinStr: (val: string) => void;
  amountMaxStr: string;
  setAmountMaxStr: (val: string) => void;
  palette: AppThemePalette;
  TextInputComponent: React.ComponentType<TextInputProps>;
}

export function MoreFiltersAmountRange({
  amountMinStr,
  setAmountMinStr,
  amountMaxStr,
  setAmountMaxStr,
  palette,
  TextInputComponent
}: MoreFiltersAmountRangeProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <TextInputComponent
        value={amountMinStr}
        onChangeText={setAmountMinStr}
        keyboardType="numeric"
        placeholder="Min"
        placeholderTextColor={palette.textMuted}
        style={[
          styles.amountField,
          { borderColor: palette.divider, backgroundColor: palette.background, color: palette.text }
        ]}
      />
      <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.rowLabel }}>—</Text>
      <TextInputComponent
        value={amountMaxStr}
        onChangeText={setAmountMaxStr}
        keyboardType="numeric"
        placeholder="Max"
        placeholderTextColor={palette.textMuted}
        style={[
          styles.amountField,
          { borderColor: palette.divider, backgroundColor: palette.background, color: palette.text }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  amountField: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderRadius: HOME_RADIUS.chip,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: HOME_TEXT.body,
    fontWeight: FONT_WEIGHT.regular
  }
});
