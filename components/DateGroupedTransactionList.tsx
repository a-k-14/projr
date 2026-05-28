import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { TransactionListItem } from '@/components/TransactionListItem';
import { getCategoryDisplayIcon } from '@/lib/category-utils';
import { toLocalDateKey, getRelativeDateLabel } from '@/lib/dateUtils';
import { FONT_WEIGHT } from '@/lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '@/lib/layoutTokens';
import type { AppThemePalette } from '@/lib/theme';
import type { Category, LoanWithSummary, Transaction } from '@/types';

interface Props {
  transactions: Transaction[];
  palette: AppThemePalette;
  sym: string;
  categoriesById: Map<string, Category>;
  accountsById?: Map<string, string>;
  loansById?: Map<string, LoanWithSummary>;
  /** Pass a Map from deposit id → { name, bankName } to show deposit info on rows. */
  depositsById?: Map<string, { name: string; bankName?: string | null }>;
  /** Pass a Map from tag id → tag name to show tags on rows. */
  tagNamesById?: Map<string, string>;
  getCategoryFullDisplayName?: (id: string, sep?: string) => string;
  onTransactionPress?: (tx: Transaction) => void;
  /** Shown when transactions is empty. Defaults to "No transactions". */
  emptyText?: string;
}

export function DateGroupedTransactionList({
  transactions,
  palette,
  sym,
  categoriesById,
  accountsById,
  loansById,
  depositsById,
  tagNamesById,
  getCategoryFullDisplayName,
  onTransactionPress,
  emptyText = 'No transactions',
}: Props) {
  if (transactions.length === 0) {
    return (
      <View style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }}>
        <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.bodySmall, textAlign: 'center', paddingVertical: 20 }}>
          {emptyText}
        </Text>
      </View>
    );
  }

  const groups: { dateKey: string; items: Transaction[] }[] = [];
  for (const tx of transactions) {
    const key = toLocalDateKey(tx.date);
    const last = groups[groups.length - 1];
    if (last?.dateKey === key) last.items.push(tx);
    else groups.push({ dateKey: key, items: [tx] });
  }

  return (
    <View style={{ gap: HOME_SPACE.xxl }}>
      {groups.map(({ dateKey, items }) => {
        const { date, label } = getRelativeDateLabel(dateKey + 'T00:00:00');
        return (
          <View key={dateKey}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: HOME_SPACE.sm, paddingHorizontal: 2 }}>
              <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>{date}</Text>
              {label ? (
                <>
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginHorizontal: 5 }}>•</Text>
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{label}</Text>
                </>
              ) : null}
            </View>
            <View style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' }}>
              {items.map((tx, index) => (
                <TransactionListItem
                  key={tx.id}
                  tx={tx}
                  sym={sym}
                  palette={palette}
                  isLast={index === items.length - 1}
                  categoryName={tx.categoryId ? (getCategoryFullDisplayName?.(tx.categoryId, ' › ') ?? categoriesById.get(tx.categoryId)?.name) : undefined}
                  categoryIcon={getCategoryDisplayIcon(categoriesById, tx.categoryId)}
                  accountName={accountsById?.get(tx.accountId)}
                  linkedAccountName={tx.linkedAccountId ? accountsById?.get(tx.linkedAccountId) : undefined}
                  loanPersonName={tx.loanId ? loansById?.get(tx.loanId)?.personName : undefined}
                  loanDirection={tx.loanId ? loansById?.get(tx.loanId)?.direction : undefined}
                  depositName={tx.depositId ? depositsById?.get(tx.depositId)?.name : undefined}
                  depositBankName={tx.depositId ? (depositsById?.get(tx.depositId)?.bankName ?? undefined) : undefined}
                  tertiaryText={
                    tagNamesById && tx.tags.length > 0
                      ? tx.tags.map((id) => tagNamesById.get(id)).filter((v): v is string => !!v).join(' • ') || undefined
                      : undefined
                  }
                  showAmountSign={false}
                  paddingY={14}
                  onPress={onTransactionPress ? () => onTransactionPress(tx) : undefined}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
