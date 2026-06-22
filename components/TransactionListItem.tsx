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
import { FONT_WEIGHT } from '../lib/design';
import { useCategoriesStore } from '../stores/useCategoriesStore';
import { TagBadge } from './ui/TagBadge';

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
  paddingY?: number;
  /** Optional: navigate to edit screen when tapped */
  onPress?: (tx: Transaction) => void;
  /** Optional: custom container style */
  style?: any;
  /** If true, renders as a standalone card with borders/radius rather than a list item */
  isCard?: boolean;
  /** Optional date text to show below amount/icons on the right */
  dateText?: string;
  /** Optional flag to hide payee names in the subtitle */
  hidePayee?: boolean;
  /** Optional flag to hide category/type icon */
  hideIcon?: boolean;
  /** Optional flag to hide tags */
  hideTags?: boolean;
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
  tertiaryText,
  showAmountSign = true,
  useTypeAmountColor = true,
  hideNote = false,
  paddingY = HOME_LAYOUT.listRowPaddingY + 2,
  onPress,
  style,
  isCard = false,
  dateText,
  hidePayee = false,
  hideIcon = false,
  hideTags = false }: Props) {
  const tags = useCategoriesStore((state) => state.tags);
  const txTags = (tx.tags || [])
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is typeof tags[number] => !!t);

  const effectiveType = tx.transferPairId ? 'transfer' : tx.type;
  const accountNameSelected = accountName;
  const inOutCategoryIcon = !tx.transferPairId && (tx.type === 'in' || tx.type === 'out') && categoryIcon ? categoryIcon : null;

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
  } else if (tx.type === 'loan' && loanPersonName && (!tx.loanTransactionType || tx.loanTransactionType === 'principal')) {
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
        <Text style={{ fontSize: CARD_TEXT.line1, color: palette.listText, fontWeight: FONT_WEIGHT.medium }}>
          Loan ›{' '}
        </Text>
        <View
          style={{
            backgroundColor: palette.borderSoft,
            paddingHorizontal: 6,
            paddingVertical: 1.5,
            borderRadius: HOME_RADIUS.small,
            borderWidth: 0.5,
            borderColor: palette.border,
          }}
        >
          <Text
            style={{
              fontSize: CARD_TEXT.line1,
              color: palette.listText,
              fontWeight: FONT_WEIGHT.medium,
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

  if (!tx.transferPairId && (tx.type === 'in' || tx.type === 'out')) {
    title = categoryName || (tx.type === 'in' ? 'Income' : 'Expense');
    titleSecondaryText = undefined;
    if (tx.loanId && loanPersonName) {
      subtitle = [accountNameSelected, loanPersonName].filter(Boolean).join(' \u2022 ');
      noteLine = hideNote ? undefined : (getLoanTransactionUserNote(tx.note) || undefined);
    } else if (tx.depositId && depositName) {
      subtitle = [accountNameSelected, depositName].filter(Boolean).join(' \u2022 ');
      noteLine = hideNote ? undefined : (tx.note?.trim() || undefined);
    } else {
      subtitle = [accountNameSelected, (hidePayee ? undefined : tx.payee) || loanPersonName].filter(Boolean).join(' \u2022 ');
      noteLine = hideNote ? undefined : (tx.note?.trim() || undefined);
    }
  }

  // Deposit transaction (mirrors loan rendering pattern).
  if (tx.type === 'deposit') {
    const state = tx.depositTransactionType === 'closed' ? 'Closed' : 'New';
    title = `Deposit \u203a ${state}`;
    titleSecondaryText = undefined;
    subtitle = [accountNameSelected, depositName].filter(Boolean).join(' \u2022 ');
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
      onPress={onPress ? () => onPress(tx) : undefined}
      icon={hideIcon ? undefined : (inOutCategoryIcon && isEmojiIcon(inOutCategoryIcon) ? (
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
      ))}
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
          {(supportIcons || dateText) ? (
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {supportIcons}
              {dateText ? (
                <Text style={{ fontSize: CARD_TEXT.tertiary, color: palette.textSecondary }}>
                  {dateText}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      }
      tertiaryRow={
        (noteLine || (!hideTags && txTags.length > 0) || tertiaryText) ? (
          <View style={{ gap: 6, marginTop: 2 }}>
            {noteLine ? (
              <Text
                numberOfLines={2}
                ellipsizeMode="tail"
                style={{ fontSize: CARD_TEXT.tertiary, color: palette.textSecondary, lineHeight: 18 }}
              >
                {noteLine}
              </Text>
            ) : null}
            {!hideTags && txTags.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                {txTags.map((tag) => (
                  <TagBadge
                    key={tag.id}
                    name={tag.name}
                    color={tag.color}
                    palette={palette}
                  />
                ))}
              </View>
            ) : tertiaryText ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                {tertiaryText.split(' • ').map((tag) => (
                  <TagBadge
                    key={tag}
                    name={tag}
                    neutral
                    palette={palette}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null
      }
      style={[
        {
          paddingVertical: paddingY,
          borderRadius: isCard ? HOME_RADIUS.card : 0,
          backgroundColor: isCard ? palette.card : 'transparent',
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
  if (prev.paddingY !== next.paddingY) return false;
  if (prev.onPress !== next.onPress) return false;
  if (prev.isCard !== next.isCard) return false;
  if (prev.dateText !== next.dateText) return false;
  if (prev.hidePayee !== next.hidePayee) return false;
  if (prev.hideIcon !== next.hideIcon) return false;
  if (prev.hideTags !== next.hideTags) return false;
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
