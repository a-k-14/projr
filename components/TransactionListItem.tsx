import { AppIcon, IconName, isValidIcon } from '@/components/ui/AppIcon';
import React from 'react';
import { Text } from '@/components/ui/AppText';
import { View } from 'react-native';
import { formatCurrency, getLoanDisplayLabel, getLoanTransactionUserNote, getTransactionCashflowImpact } from '../lib/derived';
import { CARD_TEXT, HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, getTxTypeConfig } from '../lib/layoutTokens';
import { isEmojiIcon } from '../lib/ui-format';
import type { AppThemePalette } from '../lib/theme';
import { AppCard, CardSubtitleRow, CardTitleRow } from './ui/AppCard';
import type { Transaction } from '../types';

interface Props {
  tx: Transaction;
  sym: string;
  palette: AppThemePalette;
  isLast: boolean;
  displayAmount?: number;
  categoryName?: string;
  categoryIcon?: string;
  accountName?: string;
  linkedAccountName?: string;
  loanPersonName?: string;
  loanDirection?: 'lent' | 'borrowed';
  tertiaryText?: string;
  showAmountSign?: boolean;
  useTypeAmountColor?: boolean;
  hideNote?: boolean;
  paddingX?: number;
  paddingY?: number;
  /** Icon box size — defaults to the shared compact list icon size */
  iconSize?: number;
  /** Optional: navigate to edit screen when tapped */
  onPress?: (tx: Transaction) => void;
  /** Optional: custom container style */
  style?: any;
  /** If true, renders as a standalone card with borders/radius rather than a list item */
  isCard?: boolean;
}

export const TransactionListItem = React.memo(function TransactionListItem({
  tx,
  sym,
  palette,
  isLast,
  displayAmount,
  categoryName,
  categoryIcon,
  accountName,
  linkedAccountName,
  loanPersonName,
  loanDirection,
  tertiaryText,
  showAmountSign = true,
  useTypeAmountColor = true,
  hideNote = false,
  paddingX = HOME_LAYOUT.listRowPaddingX,
  paddingY = HOME_LAYOUT.listRowPaddingY,
  iconSize = HOME_LAYOUT.listIconSize,
  onPress,
  style,
  isCard = false }: Props) {
  const effectiveType = tx.transferPairId ? 'transfer' : tx.type;
  const accountNameSelected = accountName;
  const inOutCategoryIcon = (tx.type === 'in' || tx.type === 'out') && categoryIcon ? categoryIcon : null;

  const typeConfigs = getTxTypeConfig(palette);
  const cfg = typeConfigs[effectiveType] ?? typeConfigs.out;
  const cashflowImpact = getTransactionCashflowImpact(tx);
  const displayImpact = getTransactionCashflowImpact(tx, { includeTransfers: true });

  let title = tx.payee || cfg.label;
  let titleSecondaryText: string | undefined;
  let subtitle = [categoryName, accountNameSelected].filter(Boolean).join(' \u2022 ');
  let noteLine: string | undefined;
  const hasReceipt = (tx.receiptImageUris?.length ?? 0) > 0;

  // specialized Title/Subtitle based on type
  if (tx.transferPairId && linkedAccountName) {
    title = 'Transfer';
    titleSecondaryText = tx.type === 'out' ? 'Out' : 'In';
    const from = tx.type === 'out' ? accountNameSelected : linkedAccountName;
    const to = tx.type === 'out' ? linkedAccountName : accountNameSelected;
    subtitle = `${from} \u2192 ${to}`;
  } else if (tx.type === 'loan' && loanPersonName) {
    const rawType = tx.loanTransactionType || 'principal';
    const typeLabel = rawType === 'principal'
      ? 'Principal'
      : rawType === 'interest'
        ? 'Interest'
        : 'Others';
    title = `Loan › ${typeLabel}`;
    titleSecondaryText = undefined;
    subtitle = [accountNameSelected, loanPersonName].filter(Boolean).join(' \u2022 ');
    noteLine = getLoanTransactionUserNote(tx.note) || undefined;
  }

  const shouldAllowCategoryWrap = !!categoryName?.includes(' › ') || title.includes(' › ');

  if (!tx.transferPairId && (tx.type === 'in' || tx.type === 'out')) {
    title = categoryName || (tx.type === 'in' ? 'Income' : 'Expense');
    titleSecondaryText = undefined;
    subtitle = [accountNameSelected, tx.payee].filter(Boolean).join(' \u2022 ');
    noteLine = hideNote ? undefined : (tx.note?.trim() || undefined);
  }

  if (hideNote) {
    noteLine = undefined;
  }

  const amountValue = displayAmount ?? tx.amount;
  const amountPrefix = getAmountPrefix(amountValue, displayImpact, showAmountSign);
  const amountDisplay = amountPrefix ? `${amountPrefix}${formatCurrency(Math.abs(amountValue), sym)}` : formatCurrency(Math.abs(amountValue), sym);
  const amountColor = useTypeAmountColor
    ? (displayImpact === 'in' ? palette.positive : displayImpact === 'out' ? palette.negative : palette.text)
    : palette.text;
  const tertiaryLine = [tertiaryText, noteLine].filter((value): value is string => !!value).join(' | ') || undefined;
  const supportIcons = tx.splitGroupId || hasReceipt ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minHeight: 18 }}>
      {tx.splitGroupId ? (
        <AppIcon name="layers" size={12} color={palette.textSecondary} />
      ) : null}
      {hasReceipt ? (
        <AppIcon name="image" size={12} color={palette.textSecondary} />
      ) : null}
    </View>
  ) : null;

  const iconName =
    tx.type === 'loan'
      ? 'credit-card'
      : inOutCategoryIcon && isValidIcon(inOutCategoryIcon)
        ? inOutCategoryIcon
        : cfg.iconName;
  const iconColor = palette.brand;

  return (
    <AppCard
      palette={palette}
      onPress={() => onPress && onPress(tx)}
      icon={inOutCategoryIcon && isEmojiIcon(inOutCategoryIcon) ? (
        <Text style={{ fontSize: HOME_LAYOUT.listIconInnerSize }}>{inOutCategoryIcon}</Text>
      ) : inOutCategoryIcon && isValidIcon(inOutCategoryIcon) ? (
        <AppIcon name={inOutCategoryIcon}
          size={HOME_LAYOUT.listIconInnerSize}
          color={iconColor}
          strokeWidth={HOME_LAYOUT.listIconStrokeWidth}
        />
      ) : (
        <AppIcon name={iconName as IconName}
          size={HOME_LAYOUT.listIconInnerSize}
          color={iconColor}
          strokeWidth={HOME_LAYOUT.listIconStrokeWidth}
        />
      )}
      topRow={
        <CardTitleRow
          title={title}
          secondary={titleSecondaryText}
          amount={amountDisplay}
          amountColor={amountColor}
          palette={palette}
          titleNumberOfLines={shouldAllowCategoryWrap ? 2 : 1}
        />
      }
      bottomRow={
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: CARD_TEXT.line2, color: palette.textSecondary }}>
            {subtitle}
          </Text>
          {supportIcons ? <View style={{ minWidth: 28 }}>{supportIcons}</View> : null}
        </View>
      }
      tertiaryRow={tertiaryLine ? (
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ fontSize: CARD_TEXT.tertiary, color: palette.textSecondary, lineHeight: 18 }}
        >
          {tertiaryLine}
        </Text>
      ) : null}
      style={[
        {
          paddingVertical: paddingY,
          borderRadius: isCard ? HOME_RADIUS.card : 0,
          backgroundColor: isCard ? palette.surface : 'transparent',
          borderBottomWidth: isCard ? 0 : (isLast ? 0 : 1),
          borderBottomColor: palette.divider,
        },
        isCard && {
          borderWidth: 1,
          borderColor: palette.border,
        },
        style
      ]}
    />
  );
});



function getAmountPrefix(amount: number, impact: 'in' | 'out' | 'neutral', showAmountSign: boolean) {
  if (amount < 0) return '-';
  if (!showAmountSign) return '';
  if (impact === 'in') return '+';
  if (impact === 'out') return '-';
  return '';
}
