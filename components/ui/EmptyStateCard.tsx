import { ReactNode } from 'react';
import { Text } from '@/components/ui/AppText';
import { View } from 'react-native';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

export function EmptyStateCard({
  palette,
  title,
  subtitle,
  illustration,
  backgroundColor,
  horizontalPadding = 24,
  verticalPadding = 20,
}: {
  palette: AppThemePalette;
  title: string;
  subtitle?: string;
  illustration?: ReactNode;
  backgroundColor?: string;
  horizontalPadding?: number;
  verticalPadding?: number;
}) {
  return (
    <View
      style={{
        borderRadius: HOME_RADIUS.card,
        backgroundColor: backgroundColor ?? palette.surface,
        paddingHorizontal: horizontalPadding,
        paddingVertical: verticalPadding,
        alignItems: 'center',
      }}
    >
      {illustration}
      <Text
        appWeight="medium"
        style={{
          color: palette.text,
          fontSize: HOME_TEXT.body,
          marginTop: illustration ? HOME_SPACE.md : 0,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            color: palette.textMuted,
            fontSize: HOME_TEXT.caption,
            marginTop: HOME_SPACE.xs,
            textAlign: 'center',
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
