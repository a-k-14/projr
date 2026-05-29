import { Text } from '@/components/ui/AppText';
import { CARD_PADDING , FONT_WEIGHT} from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

export function ListHeading({
  label,
  subtitle,
  palette,
  paddingHorizontal = CARD_PADDING,
  paddingTop = 16,
  paddingBottom = 8,
  marginBottom = 0,
}: {
  label: string;
  subtitle?: string;
  palette: AppThemePalette;
  paddingHorizontal?: number;
  paddingTop?: number;
  paddingBottom?: number;
  marginBottom?: number;
}) {
  return (
    <Text
      style={{
        paddingHorizontal,
        paddingTop,
        paddingBottom,
        marginBottom,
      }}
    >
      <Text
        appWeight="medium"
        style={{
          fontSize: HOME_TEXT.tiny,
          fontWeight: FONT_WEIGHT.heavy,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: palette.textMuted,
        }}
      >
        {label}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontSize: HOME_TEXT.metaTiny,
            fontWeight: FONT_WEIGHT.regular,
            letterSpacing: 0.2,
            textTransform: 'none',
            color: palette.textSecondary,
          }}
        >
          {` — ${subtitle}`}
        </Text>
      ) : null}
    </Text>
  );
}
