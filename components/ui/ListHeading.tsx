import { Text } from 'react-native';
import { CARD_PADDING } from '../../lib/design';
import type { AppThemePalette } from '../../lib/theme';

export function ListHeading({
  label,
  palette,
  paddingHorizontal = CARD_PADDING,
  paddingTop = 16,
  paddingBottom = 8,
  marginBottom = 0,
}: {
  label: string;
  palette: AppThemePalette;
  paddingHorizontal?: number;
  paddingTop?: number;
  paddingBottom?: number;
  marginBottom?: number;
}) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: palette.textMuted,
        paddingHorizontal,
        paddingTop,
        paddingBottom,
        marginBottom,
      }}
    >
      {label}
    </Text>
  );
}
