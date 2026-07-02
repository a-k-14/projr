import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { AppIcon } from '@/components/ui/AppIcon';
import { HeaderSearchBar } from '@/components/ui/HeaderSearchBar';
import { TransactionListItem } from '@/components/TransactionListItem';
import { useAppTheme } from '@/lib/theme';
import { useUIStore } from '@/stores/useUIStore';
import { useCategoriesStore } from '@/stores/useCategoriesStore';
import { useAccountsStore } from '@/stores/useAccountsStore';
import { useLoansStore } from '@/stores/useLoansStore';
import { useFixedDepositsStore } from '@/stores/useFixedDepositsStore';
import { getTransactions } from '@/services/transactions';
import { getCategoryDisplayName } from '@/services/categories';
import { getCategoryDisplayIcon } from '@/lib/category-utils';
import { getRelativeDateLabel } from '@/lib/dateUtils';
import { FONT_WEIGHT, SCREEN_GUTTER } from '@/lib/design';
import { HOME_TEXT } from '@/lib/layoutTokens';
import { getScrollableBottomPadding } from '@/components/ui/safeBottom';
import type { Transaction } from '@/types';

type SearchDateRow =
  | { type: 'dateHeader'; key: string; title: string; subtitle?: string; isFirst?: boolean }
  | { type: 'item'; key: string; tx: Transaction; indexInSection: number; sectionLength: number };

export default function SearchTransactionsModal() {
  const { palette } = useAppTheme();
  const sym = useUIStore((s) => s.settings.currencySymbol);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const categories = useCategoriesStore((s) => s.categories);
  const accounts = useAccountsStore((s) => s.accounts);
  const loans = useLoansStore((s) => s.loans);
  const deposits = useFixedDepositsStore((s) => s.deposits);

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);
  const depositsById = useMemo(() => new Map(deposits.map((d) => [d.id, d])), [deposits]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let isMounted = true;
    getTransactions({ search: trimmed, limit: 100 })
      .then((txs) => {
        if (isMounted) {
          setResults(txs);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setResults([]);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  const dateRows = useMemo(() => {
    if (results.length === 0) return [];

    const groupedMap = new Map<string, Transaction[]>();
    for (const tx of results) {
      const dateKey = tx.date.slice(0, 10);
      const existing = groupedMap.get(dateKey);
      if (existing) existing.push(tx);
      else groupedMap.set(dateKey, [tx]);
    }

    const rows: SearchDateRow[] = [];
    let isFirstHeader = true;
    for (const [dateKey, items] of groupedMap.entries()) {
      const { date, label } = getRelativeDateLabel(dateKey + 'T00:00:00');
      rows.push({
        type: 'dateHeader',
        key: `header-${dateKey}`,
        title: date,
        subtitle: label,
        isFirst: isFirstHeader,
      });
      isFirstHeader = false;
      items.forEach((tx, idx) => {
        rows.push({
          type: 'item',
          key: tx.id,
          tx,
          indexInSection: idx,
          sectionLength: items.length,
        });
      });
    }
    return rows;
  }, [results]);

  const handleTransactionPress = useCallback((tx: Transaction) => {
    Keyboard.dismiss();
    router.push({ pathname: '/modals/add-transaction', params: { editId: tx.id } });
  }, []);

  const renderRow = useCallback(
    ({ item }: { item: SearchDateRow }) => {
      if (item.type === 'dateHeader') {
        const labelSuffix = item.subtitle ? `  •  ${item.subtitle}` : '';
        return (
          <View
            style={{
              height: item.isFirst ? 30 : 48,
              paddingLeft: 4,
              paddingBottom: 1,
              paddingTop: item.isFirst ? 0 : 16,
              backgroundColor: palette.background,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: HOME_TEXT.bodySmall,
                fontWeight: FONT_WEIGHT.semibold,
                color: palette.text,
              }}
            >
              {item.title}
              <Text style={{ color: palette.textMuted, fontWeight: FONT_WEIGHT.medium }}>{labelSuffix}</Text>
            </Text>
          </View>
        );
      }

      const tx = item.tx;
      const accountName = accountsById.get(tx.accountId);
      const linkedAccountName = tx.linkedAccountId ? accountsById.get(tx.linkedAccountId) : undefined;
      const loan = tx.loanId ? loansById.get(tx.loanId) : undefined;
      const deposit = tx.depositId ? depositsById.get(tx.depositId) : undefined;
      const isFirst = item.indexInSection === 0;
      const isLast = item.indexInSection === item.sectionLength - 1;

      return (
        <TransactionListItem
          tx={tx}
          sym={sym}
          palette={palette}
          isFirst={isFirst}
          isLast={isLast}
          isGrouped={true}
          categoryName={tx.categoryId && categoriesById.get(tx.categoryId) ? getCategoryDisplayName(categoriesById.get(tx.categoryId)!, categories) : undefined}
          categoryIcon={getCategoryDisplayIcon(categoriesById, tx.categoryId)}
          accountName={accountName}
          linkedAccountName={linkedAccountName}
          loanPersonName={loan?.personName}
          loanDirection={loan?.direction}
          depositName={deposit?.name}
          depositBankName={deposit?.bankName}
          showAmountSign={false}
          useTypeAmountColor
          onPress={handleTransactionPress}
        />
      );
    },
    [accountsById, categories, categoriesById, depositsById, handleTransactionPress, loansById, palette, sym],
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      <HeaderSearchBar
        visible
        value={query}
        onChangeText={setQuery}
        placeholder="Search transactions…"
        onClose={() => router.back()}
        palette={palette}
        style={{ borderBottomWidth: 1 }}
      />

      {debouncedQuery.trim() === '' ? (
        <View style={{ flex: 1, paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 }}>
          <AppIcon name="search" size={36} color={palette.textMuted} strokeWidth={1.5} />
          <Text style={{ fontSize: 14, color: palette.textMuted, textAlign: 'center', marginTop: 12 }}>
            Search transactions by payee, category, note, or amount.
          </Text>
        </View>
      ) : loading ? (
        <View style={{ flex: 1, paddingTop: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>Searching...</Text>
        </View>
      ) : dateRows.length === 0 ? (
        <View style={{ flex: 1, paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 14, color: palette.textMuted, textAlign: 'center' }}>
            No transactions match "{debouncedQuery}"
          </Text>
        </View>
      ) : (
        <FlashList
          data={dateRows}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.type}
          drawDistance={900}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: getScrollableBottomPadding(insets),
            paddingHorizontal: SCREEN_GUTTER,
          }}
          renderItem={renderRow}
        />
      )}
    </View>
  );
}
