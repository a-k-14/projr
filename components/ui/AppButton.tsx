import { Text } from '@/components/ui/AppText';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { TouchableOpacity, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { BUTTON_TOKENS, PRIMARY_ACTION } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

type FilledTone = 'brand' | 'loan' | 'budget' | 'danger' | 'neutral';
type TextTone = 'brand' | 'loan' | 'danger' | 'default' | 'muted';

function getFilledColors(palette: AppThemePalette, tone: FilledTone, disabled?: boolean) {
  if (disabled) {
    return { backgroundColor: palette.textSoft, textColor: palette.textMuted };
  }
  switch (tone) {
    case 'loan':
      return { backgroundColor: palette.loan, textColor: palette.onLoan };
    case 'budget':
      return { backgroundColor: palette.budget, textColor: palette.onBudget };
    case 'danger':
      return { backgroundColor: palette.negative, textColor: palette.onBrand };
    case 'neutral':
      return { backgroundColor: palette.surface, textColor: palette.text };
    case 'brand':
    default:
      return { backgroundColor: palette.brand, textColor: palette.onBrand };
  }
}

function getTextColor(palette: AppThemePalette, tone: TextTone, disabled?: boolean) {
  if (disabled) return palette.textSoft;
  switch (tone) {
    case 'loan':
      return palette.loan;
    case 'danger':
      return palette.negative;
    case 'muted':
      return palette.textSecondary;
    case 'default':
      return palette.text;
    case 'brand':
    default:
      return palette.brand;
  }
}

type BaseButtonProps = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  palette: AppThemePalette;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  startIcon?: ReactNode;
};

export function FilledButton({
  label,
  onPress,
  palette,
  disabled,
  tone = 'brand',
  style,
  startIcon,
}: BaseButtonProps & { tone?: FilledTone }) {
  const colors = getFilledColors(palette, tone, disabled);
  return (
    <TouchableOpacity
      delayPressIn={0}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        {
          minHeight: PRIMARY_ACTION.height,
          borderRadius: PRIMARY_ACTION.radius,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.backgroundColor,
          paddingHorizontal: 20,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: startIcon ? 8 : 0 }}>
        {startIcon ? startIcon : null}
        <Text
          style={{
            fontSize: PRIMARY_ACTION.labelSize,
            fontWeight: PRIMARY_ACTION.labelWeight,
            color: colors.textColor,
          }}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function TextButton({
  label,
  onPress,
  palette,
  disabled,
  tone = 'brand',
  compact = false,
  style,
}: BaseButtonProps & { tone?: TextTone; compact?: boolean }) {
  return (
    <TouchableOpacity
      delayPressIn={0}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: compact ? 6 : 8,
          paddingHorizontal: compact ? 4 : 12,
        },
        style,
      ]}
    >
      <Text
        appWeight="medium"
        style={{
          fontSize: compact ? BUTTON_TOKENS.text.compactLabelSize : BUTTON_TOKENS.text.labelSize,
          fontWeight: compact ? BUTTON_TOKENS.text.compactLabelWeight : BUTTON_TOKENS.text.labelWeight,
          color: getTextColor(palette, tone, disabled),
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
