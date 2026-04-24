import { Text } from '@/components/ui/AppText';
import React from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { CARD_TEXT, HOME_LAYOUT, HOME_RADIUS } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';

// ─── AppCard Components ───────────────────────────────────────────────────────

interface AppCardProps {
  palette: AppThemePalette;
  onPress?: () => void;
  icon?: React.ReactNode;
  iconBg?: string;
  topRow: React.ReactNode;
  bottomRow?: React.ReactNode;
  tertiaryRow?: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * A centralized card component used for Activity, Loans, and Budgets.
 * Enforces standardized padding, spacing, and typography hierarchy.
 */
export function AppCard({
  palette,
  onPress,
  icon,
  iconBg,
  topRow,
  bottomRow,
  tertiaryRow,
  footer,
  style,
  contentStyle,
}: AppCardProps) {
  const cardContent = (
    <View style={styles.row}>
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: iconBg || palette.inputBg }]}>
          {icon}
        </View>
      )}

      <View style={[styles.content, contentStyle]}>
        <View style={styles.topRow}>
          {topRow}
        </View>
        {bottomRow && (
          <View style={styles.bottomRow}>
            {bottomRow}
          </View>
        )}
        {tertiaryRow && (
          <View style={styles.tertiaryRow}>
            {tertiaryRow}
          </View>
        )}
        {footer && (
          <View style={styles.footer}>
            {footer}
          </View>
        )}
      </View>
    </View>
  );

  const cardStyle = [
    styles.card,
    { backgroundColor: palette.surface },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity delayPressIn={0} activeOpacity={0.75} onPress={onPress} style={cardStyle}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{cardContent}</View>;
}

// ─── Helper Components for Slots ──────────────────────────────────────────────

interface CardTitleRowProps {
  title: string;
  secondary?: string;
  amount?: string;
  palette: AppThemePalette;
  amountColor?: string;
  titleStyle?: StyleProp<TextStyle>;
  amountStyle?: StyleProp<TextStyle>;
  secondarySeparator?: string;
}

/** Standard Line 1 content: [Title › Secondary] [Amount] */
export function CardTitleRow({
  title,
  secondary,
  amount,
  palette,
  amountColor,
  titleStyle,
  amountStyle,
  secondarySeparator = ' \u203A ',
}: CardTitleRowProps) {
  return (
    <>
      <Text
        appWeight="medium"
        numberOfLines={1}
        style={[{ flex: 1, fontSize: CARD_TEXT.line1, color: palette.listText }, titleStyle]}
      >
        {title}
        {secondary ? (
          <Text appWeight="medium" style={{ color: palette.listText }}>
            {secondarySeparator}{secondary}
          </Text>
        ) : null}
      </Text>
      {amount !== undefined && (
        <Text
          appWeight="medium"
          style={[
            { fontSize: CARD_TEXT.line1, color: amountColor || palette.listText, textAlign: 'right' },
            amountStyle
          ]}
        >
          {amount}
        </Text>
      )}
    </>
  );
}

interface CardSubtitleRowProps {
  text: string;
  rightText?: string;
  palette: AppThemePalette;
  textStyle?: StyleProp<TextStyle>;
  rightTextStyle?: StyleProp<TextStyle>;
}

/** Standard Line 2 content: [Subtitle Text] [Right Support Text] */
export function CardSubtitleRow({
  text,
  rightText,
  palette,
  textStyle,
  rightTextStyle,
}: CardSubtitleRowProps) {
  return (
    <>
      <Text
        numberOfLines={1}
        style={[{ flex: 1, fontSize: CARD_TEXT.line2, color: palette.textSecondary }, textStyle]}
      >
        {text}
      </Text>
      {rightText !== undefined && (
        <Text
          style={[{ fontSize: CARD_TEXT.line2, color: palette.textSecondary, textAlign: 'right' }, rightTextStyle]}
        >
          {rightText}
        </Text>
      )}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: HOME_RADIUS.card,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: HOME_LAYOUT.listIconSize,
    height: HOME_LAYOUT.listIconSize,
    borderRadius: HOME_RADIUS.small,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  tertiaryRow: {
    marginTop: 4,
  },
  footer: {
    marginTop: 12,
  },
});
