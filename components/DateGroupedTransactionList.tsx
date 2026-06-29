import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
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
  tagsById?: Map<string, { id: string; name: string; color: string }>;
  getCategoryFullDisplayName?: (id: string, sep?: string) => string;
  onTransactionPress?: (tx: Transaction) => void;
}

export interface DateGroup {
  dateKey: string;
  items: Transaction[];
}

/** Bucket a transaction list into contiguous same-day groups, sorting them in-memory first. */
export function buildDateGroups(transactions: Transaction[]): DateGroup[] {
  const todayKey = toLocalDateKey(new Date().toISOString());
  const sorted = transactions.slice().sort((a, b) => {
    const keyA = toLocalDateKey(a.date);
    const keyB = toLocalDateKey(b.date);
    if (keyA !== keyB) {
      return keyB.localeCompare(keyA);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  const groups: DateGroup[] = [];
  for (const tx of sorted) {
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
function areDateGroupCardPropsEqual(
  prev: { group: DateGroup; row: DateGroupRowProps },
  next: { group: DateGroup; row: DateGroupRowProps }
) {
  if (prev.group !== next.group) return false;
  const pRow = prev.row;
  const nRow = next.row;
  return (
    pRow.palette === nRow.palette &&
    pRow.sym === nRow.sym &&
    pRow.categoriesById === nRow.categoriesById &&
    pRow.accountsById === nRow.accountsById &&
    pRow.loansById === nRow.loansById &&
    pRow.depositsById === nRow.depositsById &&
    pRow.tagNamesById === nRow.tagNamesById &&
    pRow.tagsById === nRow.tagsById &&
    pRow.getCategoryFullDisplayName === nRow.getCategoryFullDisplayName &&
    pRow.onTransactionPress === nRow.onTransactionPress
  );
}

export const DateGroupCard = React.memo(function DateGroupCard({ group, row }: { group: DateGroup; row: DateGroupRowProps }) {
  const {
    palette,
    sym,
    categoriesById,
    accountsById,
    loansById,
    depositsById,
    tagNamesById,
    tagsById,
    getCategoryFullDisplayName,
    onTransactionPress,
  } = row;
  return (
    <View>
      <TransactionDateHeader dateKey={group.dateKey} palette={palette} />
      <View style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' }}>
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
            txTags={
              tagsById && tx.tags.length > 0
                ? tx.tags.map((id) => tagsById.get(id)).filter((v): v is { id: string; name: string; color: string } => !!v)
                : undefined
            }
            showAmountSign={false}
            paddingY={14}
            onPress={onTransactionPress}
          />
        ))}
      </View>
    </View>
  );
}, areDateGroupCardPropsEqual);

export function EmptyTransactions({
  palette,
  emptyText,
  isTransparentDashed,
}: {
  palette: AppThemePalette;
  emptyText: string;
  isTransparentDashed?: boolean;
}) {
  return (
    <View style={{
      borderRadius: HOME_RADIUS.card,
      borderWidth: 1,
      borderStyle: isTransparentDashed ? 'dashed' : 'solid',
      borderColor: isTransparentDashed
        ? (palette.isDark ? 'rgba(255,255,255,0.22)' : `${palette.brand}50`)
        : palette.border,
      backgroundColor: isTransparentDashed ? 'transparent' : palette.surface
    }}>
      <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.bodySmall, textAlign: 'center', paddingVertical: 20 }}>
        {emptyText}
      </Text>
    </View>
  );
}

/** 3 placeholder rows with a subtle pulsing shimmer. Shown ONLY during the
 *  first cold-cache load — replaces the "No transactions" empty state so the
 *  user never reads a stale message before real data lands. */
export function TransactionsSkeleton({ palette }: { palette: AppThemePalette }) {
  const placeholderBg = palette.isDark ? 'rgba(255,255,255,0.07)' : '#E8ECF2';
  const placeholderBgDim = palette.isDark ? 'rgba(255,255,255,0.04)' : '#EFF2F7';
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse]);
  const animStyle = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.value * 0.45 }));
  return (
    <Animated.View style={[{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.isDark ? palette.surface : '#FFFFFF', padding: 14, gap: 14 }, animStyle]}>
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
    </Animated.View>
  );
}

function areDateGroupedTransactionListPropsEqual(prev: Props, next: Props) {
  if (prev.transactions !== next.transactions) return false;
  if (prev.emptyText !== next.emptyText) return false;
  if (prev.emptyStateTransparentDashed !== next.emptyStateTransparentDashed) return false;
  if (prev.showSkeleton !== next.showSkeleton) return false;
  return (
    prev.palette === next.palette &&
    prev.sym === next.sym &&
    prev.categoriesById === next.categoriesById &&
    prev.accountsById === next.accountsById &&
    prev.loansById === next.loansById &&
    prev.depositsById === next.depositsById &&
    prev.tagNamesById === next.tagNamesById &&
    prev.tagsById === next.tagsById &&
    prev.getCategoryFullDisplayName === next.getCategoryFullDisplayName &&
    prev.onTransactionPress === next.onTransactionPress
  );
}

interface Props extends DateGroupRowProps {
  transactions: Transaction[];
  /** Shown when transactions is empty. Defaults to "No transactions". */
  emptyText?: string;
  emptyStateTransparentDashed?: boolean;
  /** When true and transactions is empty, render a skeleton instead of the
   *  empty-state text. Used during the cold-cache window on account detail. */
  showSkeleton?: boolean;
}

/** Plain (non-virtualized) list for use as content inside an existing ScrollView,
 *  e.g. the home/account "recent" list (capped, small). For large lists inside a
 *  bottom sheet use DateGroupedTransactionSheetList instead — it virtualizes. */
export const DateGroupedTransactionList = React.memo(function DateGroupedTransactionList({
  transactions,
  emptyText = 'No transactions',
  emptyStateTransparentDashed,
  showSkeleton = false,
  ...row
}: Props) {
  if (transactions.length === 0) {
    if (showSkeleton) return <TransactionsSkeleton palette={row.palette} />;
    return <EmptyTransactions palette={row.palette} emptyText={emptyText} isTransparentDashed={emptyStateTransparentDashed} />;
  }

  const groups = buildDateGroups(transactions);

  return (
    <View style={{ gap: HOME_SPACE.xxl }}>
      {groups.map((group) => (
        <DateGroupCard key={group.dateKey} group={group} row={row} />
      ))}
    </View>
  );
}, areDateGroupedTransactionListPropsEqual);
