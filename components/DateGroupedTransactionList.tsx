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

/** Row-rendering inputs shared by the plain list and the virtualized sheet list. */
export interface DateGroupRowProps {
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
}

export interface DateGroup {
  dateKey: string;
  items: Transaction[];
}

/** Bucket a (already date-desc) transaction list into contiguous same-day groups. */
export function buildDateGroups(transactions: Transaction[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const tx of transactions) {
    const key = toLocalDateKey(tx.date);
    const last = groups[groups.length - 1];
    if (last?.dateKey === key) last.items.push(tx);
    else groups.push({ dateKey: key, items: [tx] });
  }
  return groups;
}

export const TransactionDateHeader = React.memo(function TransactionDateHeader({
  dateKey,
  palette,
  style,
}: {
  dateKey: string;
  palette: AppThemePalette;
  style?: any;
}) {
  const { date, label } = getRelativeDateLabel(dateKey.includes('T') ? dateKey : dateKey + 'T00:00:00');
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', marginBottom: HOME_SPACE.sm, paddingHorizontal: 2 }, style]}>
      <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>{date}</Text>
      {label ? (
        <>
          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginHorizontal: 5 }}>•</Text>
          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{label}</Text>
        </>
      ) : null}
    </View>
  );
});

/** One day's card: relative date header + a bordered surface listing that day's rows.
 *  Shared so the plain (ScrollView) list and the virtualized sheet list render
 *  identically — only the container differs (map vs FlatList item). */
export const DateGroupCard = React.memo(function DateGroupCard({ group, row }: { group: DateGroup; row: DateGroupRowProps }) {
  const {
    palette,
    sym,
    categoriesById,
    accountsById,
    loansById,
    depositsById,
    tagNamesById,
    getCategoryFullDisplayName,
    onTransactionPress,
  } = row;
  return (
    <View>
      <TransactionDateHeader dateKey={group.dateKey} palette={palette} />
      <View style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.isDark ? palette.surface : '#FFFFFF', overflow: 'hidden' }}>
        {group.items.map((tx, index) => (
          <TransactionListItem
            key={tx.id}
            tx={tx}
            sym={sym}
            palette={palette}
            isLast={index === group.items.length - 1}
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
});

export function EmptyTransactions({ palette, emptyText }: { palette: AppThemePalette; emptyText: string }) {
  return (
    <View style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.isDark ? palette.surface : '#FFFFFF' }}>
      <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.bodySmall, textAlign: 'center', paddingVertical: 20 }}>
        {emptyText}
      </Text>
    </View>
  );
}

/** 3 placeholder rows shown ONLY during the first cold-cache load — replaces
 *  the "No transactions" empty state for that brief window so the user never
 *  reads a stale message before real data lands. */
export function TransactionsSkeleton({ palette }: { palette: AppThemePalette }) {
  const placeholderBg = palette.isDark ? 'rgba(255,255,255,0.05)' : '#F0F2F6';
  const placeholderBgDim = palette.isDark ? 'rgba(255,255,255,0.03)' : '#F5F7FA';
  return (
    <View style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.isDark ? palette.surface : '#FFFFFF', padding: 14, gap: 14 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: placeholderBg }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ width: '55%', height: 11, borderRadius: 3, backgroundColor: placeholderBg }} />
            <View style={{ width: '38%', height: 9, borderRadius: 3, backgroundColor: placeholderBgDim }} />
          </View>
          <View style={{ width: 60, height: 12, borderRadius: 3, backgroundColor: placeholderBg }} />
        </View>
      ))}
    </View>
  );
}

interface Props extends DateGroupRowProps {
  transactions: Transaction[];
  /** Shown when transactions is empty. Defaults to "No transactions". */
  emptyText?: string;
  /** When true and transactions is empty, render a skeleton instead of the
   *  empty-state text. Used during the cold-cache window on account detail. */
  showSkeleton?: boolean;
}

/** Plain (non-virtualized) list for use as content inside an existing ScrollView,
 *  e.g. the home/account "recent" list (capped, small). For large lists inside a
 *  bottom sheet use DateGroupedTransactionSheetList instead — it virtualizes. */
export function DateGroupedTransactionList({
  transactions,
  emptyText = 'No transactions',
  showSkeleton = false,
  ...row
}: Props) {
  if (transactions.length === 0) {
    if (showSkeleton) return <TransactionsSkeleton palette={row.palette} />;
    return <EmptyTransactions palette={row.palette} emptyText={emptyText} />;
  }

  const groups = buildDateGroups(transactions);

  return (
    <View style={{ gap: HOME_SPACE.xxl }}>
      {groups.map((group) => (
        <DateGroupCard key={group.dateKey} group={group} row={row} />
      ))}
    </View>
  );
}
