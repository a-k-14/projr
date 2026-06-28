import React, { useCallback, useMemo } from 'react';
import { View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { BottomSheetFlatList, type BottomSheetFlatListMethods } from '@gorhom/bottom-sheet';

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;
import {
  buildDateGroups,
  DateGroupCard,
  EmptyTransactions,
  type DateGroup,
  type DateGroupRowProps,
} from './DateGroupedTransactionList';
import { HOME_SPACE } from '@/lib/layoutTokens';
import type { Transaction } from '@/types';

interface Props extends DateGroupRowProps {
  transactions: Transaction[];
  /** Rendered (and scrolled) above the transactions — e.g. the expanded chart. */
  ListHeaderComponent?: React.ReactElement | null;
  emptyText?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  listRef?: React.Ref<BottomSheetFlatListMethods>;
  /** Reports the vertical offset when a scroll gesture settles (drag/momentum end).
   *  gorhom's BottomSheetFlatList omits the continuous `onScroll`, so this is the
   *  hook for "am I scrolled down" affordances. */
  onScrollSettle?: (offsetY: number) => void;
}

/**
 * Virtualized transaction list for use as the *scroller* of a @gorhom bottom
 * sheet (set the sheet's `scrollEnabled={false}`). Windows at the date-group
 * level — only visible day-cards mount — so opening the sheet no longer commits
 * the entire period's rows on the JS thread. Visuals are identical to
 * DateGroupedTransactionList (same DateGroupCard). The chart goes in
 * `ListHeaderComponent` so it scrolls with the list and participates in the
 * sheet's pan gesture.
 */
export function DateGroupedTransactionSheetList({
  transactions,
  ListHeaderComponent,
  emptyText = 'No transactions',
  contentContainerStyle,
  listRef,
  onScrollSettle,
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
}: Props) {
  const groups = useMemo(() => buildDateGroups(transactions), [transactions]);

  // Stable row-props object so the memoized DateGroupCard only re-renders when an
  // actual input changes — keeps the VirtualizedList cheap to update/scroll.
  const row = useMemo(
    () => ({ palette, sym, categoriesById, accountsById, loansById, depositsById, tagNamesById, tagsById, getCategoryFullDisplayName, onTransactionPress }),
    [palette, sym, categoriesById, accountsById, loansById, depositsById, tagNamesById, tagsById, getCategoryFullDisplayName, onTransactionPress],
  );
  const renderItem = useCallback(
    ({ item }: { item: DateGroup }) => <DateGroupCard group={item} row={row} />,
    [row],
  );

  const handleScroll = useCallback(
    (e: ScrollEvent) => {
      onScrollSettle?.(e.nativeEvent.contentOffset.y);
    },
    [onScrollSettle],
  );

  return (
    <BottomSheetFlatList<DateGroup>
      ref={listRef}
      {...({
        onScroll: handleScroll,
        scrollEventThrottle: 16,
      } as any)}
      data={groups}
      keyExtractor={(group) => group.dateKey}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={{ height: HOME_SPACE.xxl }} />}
      ListHeaderComponent={
        ListHeaderComponent ? (
          <View style={{ marginBottom: HOME_SPACE.xxl }}>{ListHeaderComponent}</View>
        ) : null
      }
      ListEmptyComponent={<EmptyTransactions palette={row.palette} emptyText={emptyText} />}
      // Fill the fixed-height sheet so the list has a real scroll viewport —
      // without this the FlatList is content-sized, which kills both scrolling
      // AND virtualization (it renders every row).
      style={{ flex: 1 }}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="always"
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={9}
      removeClippedSubviews
    />
  );
}
