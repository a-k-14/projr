import { AppIcon, IconName, isValidIcon } from '@/components/ui/AppIcon';
import React, { memo } from 'react';
import { Text } from '@/components/ui/AppText';
import { StyleSheet, View } from 'react-native';
import { formatCurrency, getLoanTransactionUserNote, getTransactionCashflowImpact } from '../lib/derived';
import { CARD_TEXT, HOME_LAYOUT, HOME_RADIUS, getTxTypeConfig } from '../lib/layoutTokens';
import { isEmojiIcon } from '../lib/ui-format';
import type { AppThemePalette } from '../lib/theme';
import { AppCard, CardTitleRow } from './ui/AppCard';
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
  depositName?: string;
  depositBankName?: string;
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

function TransactionListItemBase({
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
  depositName,
  depositBankName,
  tertiaryText,
  showAmountSign = true,
  useTypeAmountColor = true,
  hideNote = false,
  paddingX = HOME_LAYOUT.listRowPaddingX,
  paddingY = HOME_LAYOUT.listRowPaddingY + 2,
  iconSize = HOME_LAYOUT.listIconSize,
  onPress,
  style,
  isCard = false }: Props) {
  const effectiveType = tx.transferPairId ? 'transfer' : tx.type;
  const accountNameSelected = accountName;
  const isInterestOrCharges = !!tx.loanId && (tx.loanTransactionType === 'interest' || tx.loanTransactionType === 'others' || tx.loanTransactionType === 'charges');
  const inOutCategoryIcon = !tx.transferPairId && (tx.type === 'in' || tx.type === 'out' || isInterestOrCharges) && categoryIcon ? categoryIcon : null;

  const typeConfigs = getTxTypeConfig(palette);
  const cfg = typeConfigs[effectiveType] ?? typeConfigs.out;
  const displayImpact = getTransactionCashflowImpact(tx, { includeTransfers: true });

  let title: React.ReactNode = tx.payee || cfg.label;
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
  } else if (tx.type === 'loan' && loanPersonName && !isInterestOrCharges) {
    const rawType = tx.loanTransactionType || 'principal';
    let typeLabel = 'Principal';
    if (rawType === 'principal') {
      if (loanDirection === 'lent') {
        typeLabel = displayImpact === 'out' ? 'Lent' : 'Recovered';
      } else if (loanDirection === 'borrowed') {
        typeLabel = displayImpact === 'in' ? 'Borrowed' : 'Repaid';
      }
    }
    title = (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: CARD_TEXT.line1, color: palette.listText, fontWeight: '500' }}>
          Loan ›{' '}
        </Text>
        <View
          style={{
            backgroundColor: palette.borderSoft,
            paddingHorizontal: 6,
            paddingVertical: 1.5,
            borderRadius: 10,
            borderWidth: 0.5,
            borderColor: palette.border,
          }}
        >
          <Text
            style={{
              fontSize: CARD_TEXT.line1,
              color: palette.listText,
              fontWeight: '500',
            }}
          >
            {typeLabel}
          </Text>
        </View>
      </View>
    );
    titleSecondaryText = undefined;
    subtitle = [accountNameSelected, loanPersonName].filter(Boolean).join(' \u2022 ');
    noteLine = getLoanTransactionUserNote(tx.note) || undefined;
  }

  const shouldAllowCategoryWrap = !!categoryName?.includes(' › ') || (typeof title === 'string' && title.includes(' › '));

  if (!tx.transferPairId && (tx.type === 'in' || tx.type === 'out' || isInterestOrCharges)) {
    title = categoryName || (tx.type === 'in' ? 'Income' : 'Expense');
    titleSecondaryText = undefined;
    subtitle = [accountNameSelected, tx.payee || loanPersonName].filter(Boolean).join(' \u2022 ');
    noteLine = hideNote ? undefined : (tx.note?.trim() || undefined);
  }

  // Deposit transaction (mirrors loan rendering pattern).
  if (tx.type === 'deposit') {
    const state = tx.depositTransactionType === 'closed' ? 'Closed' : 'New';
    title = `Deposit \u203a ${state}`;
    titleSecondaryText = undefined;
    subtitle = [depositBankName, depositName].filter(Boolean).join(' \u2022 ');
    noteLine = hideNote ? undefined : (tx.note?.trim() || undefined);
  }

  if (hideNote) {
    noteLine = undefined;
  }

  const amountValue = displayAmount ?? tx.amount;
  const amountPrefix = getAmountPrefix(amountValue, displayImpact, showAmountSign);
  const amountDisplay = amountPrefix ? `${amountPrefix}${formatCurrency(Math.abs(amountValue), sym)}` : formatCurrency(Math.abs(amountValue), sym);
  const amountColor = useTypeAmountColor
    ? (displayImpact === 'in' ? palette.numberPositive : displayImpact === 'out' ? palette.numberNegative : palette.text)
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
    tx.type === 'deposit'
      ? 'vault'
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
          borderWidth: 0,
          borderBottomWidth: isCard ? 0 : (isLast ? 0 : 1),
          borderBottomColor: palette.divider,
        },
        isCard && {
          borderWidth: 1,
          borderColor: palette.borderSoft,
        },
        style
      ]}
    />
  );
}

export const TransactionListItem = memo(TransactionListItemBase, areTransactionListItemPropsEqual);



function getAmountPrefix(amount: number, impact: 'in' | 'out' | 'neutral', showAmountSign: boolean) {
  if (amount < 0) return '-';
  if (!showAmountSign) return '';
  if (impact === 'in') return '+';
  if (impact === 'out') return '-';
  return '';
}

function areTransactionListItemPropsEqual(prev: Props, next: Props) {
  if (prev.tx !== next.tx) return false;
  if (prev.sym !== next.sym) return false;
  if (prev.palette !== next.palette) return false;
  if (prev.isLast !== next.isLast) return false;
  if (prev.displayAmount !== next.displayAmount) return false;
  if (prev.categoryName !== next.categoryName) return false;
  if (prev.categoryIcon !== next.categoryIcon) return false;
  if (prev.accountName !== next.accountName) return false;
  if (prev.linkedAccountName !== next.linkedAccountName) return false;
  if (prev.loanPersonName !== next.loanPersonName) return false;
  if (prev.loanDirection !== next.loanDirection) return false;
  if (prev.depositName !== next.depositName) return false;
  if (prev.depositBankName !== next.depositBankName) return false;
  if (prev.tertiaryText !== next.tertiaryText) return false;
  if (prev.showAmountSign !== next.showAmountSign) return false;
  if (prev.useTypeAmountColor !== next.useTypeAmountColor) return false;
  if (prev.hideNote !== next.hideNote) return false;
  if (prev.paddingX !== next.paddingX) return false;
  if (prev.paddingY !== next.paddingY) return false;
  if (prev.iconSize !== next.iconSize) return false;
  if (prev.onPress !== next.onPress) return false;
  if (prev.isCard !== next.isCard) return false;
  if (!isStyleEqual(prev.style, next.style)) return false;
  return true;
}

function isStyleEqual(prevStyle: Props['style'], nextStyle: Props['style']) {
  if (prevStyle === nextStyle) return true;
  const prevFlat = StyleSheet.flatten(prevStyle) ?? {};
  const nextFlat = StyleSheet.flatten(nextStyle) ?? {};
  const prevKeys = Object.keys(prevFlat);
  const nextKeys = Object.keys(nextFlat);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    if ((prevFlat as Record<string, unknown>)[key] !== (nextFlat as Record<string, unknown>)[key]) {
      return false;
    }
  }
  return true;
}
