import { Text } from '@/components/ui/AppText';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { TouchableOpacity, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { BUTTON_TOKENS, PRIMARY_ACTION , HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';
import { FONT_WEIGHT } from '../../lib/design';

type FilledTone = 'brand' | 'loan' | 'budget' | 'danger' | 'neutral';
type TextTone = 'brand' | 'loan' | 'danger' | 'default' | 'muted';
type OutlinedTone = 'brand' | 'default' | 'muted';

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
      return { backgroundColor: palette.uiNegative, textColor: palette.onBrand };
    case 'neutral':
      return { backgroundColor: palette.surface, textColor: palette.text };
    case 'brand':
    default:
      return { backgroundColor: palette.brand, textColor: palette.onBrand };
  }
}

function getOutlinedColors(palette: AppThemePalette, tone: OutlinedTone, disabled?: boolean) {
  if (disabled) return { borderColor: palette.borderSoft, textColor: palette.textSoft };
  switch (tone) {
    case 'muted':
      return { borderColor: palette.lines.borderStrong, textColor: palette.textSecondary };
    case 'default':
      return { borderColor: palette.lines.borderStrong, textColor: palette.text };
    case 'brand':
    default:
      return { borderColor: palette.brand, textColor: palette.brand };
  }
}

function getTextColor(palette: AppThemePalette, tone: TextTone, disabled?: boolean) {
  if (disabled) return palette.textSoft;
  switch (tone) {
    case 'loan':
      return palette.loan;
    case 'danger':
      return palette.uiNegative;
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
          borderRadius: HOME_RADIUS.pill,
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

export function OutlinedButton({
  label,
  onPress,
  palette,
  disabled,
  tone = 'brand',
  style,
}: BaseButtonProps & { tone?: OutlinedTone }) {
  const colors = getOutlinedColors(palette, tone, disabled);
  return (
    <TouchableOpacity
      delayPressIn={0}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[
        {
          height: 36,
          paddingHorizontal: 16,
          borderRadius: HOME_RADIUS.pill,
          borderWidth: 1,
          borderColor: colors.borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        },
        style,
      ]}
    >
      <Text
        appWeight="medium"
        style={{
          fontSize: HOME_TEXT.bodySmall,
          fontWeight: FONT_WEIGHT.semibold,
          color: colors.textColor,
        }}
      >
        {label}
      </Text>
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

import { AppIcon } from './AppIcon';

export function ActionChip({
  icon,
  label,
  destructive,
  palette,
  onPress,
}: {
  icon: string;
  label: string;
  destructive?: boolean;
  palette: AppThemePalette;
  onPress: () => void;
}) {
  const color = destructive ? palette.uiNegative : palette.text;
  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 36,
        paddingHorizontal: 14,
        borderRadius: HOME_RADIUS.button,
        borderWidth: 1,
        borderColor: destructive
          ? `${palette.uiNegative}60`
          : palette.lines.borderStrong,
        backgroundColor: destructive
          ? 'transparent'
          : palette.states.hoverBg,
      }}
    >
      <AppIcon name={icon} size={15} color={color} strokeWidth={1.9} />
      <Text
        style={{
          fontSize: HOME_TEXT.bodySmall,
          fontWeight: FONT_WEIGHT.medium,
          color,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

