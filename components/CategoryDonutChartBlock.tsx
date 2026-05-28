import { TransactionListItem } from '@/components/TransactionListItem';
import { AppIcon, isValidIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { SegmentedPillSwitch } from '@/components/ui/SegmentedPillSwitch';
import { getCategoryDisplayIcon } from '@/lib/category-utils';
import { formatCurrency, getTransactionCashflowImpact } from '@/lib/derived';
import { getPrototypeCategoryColor } from '@/lib/prototypeCategoryColors';
import type { AppThemePalette } from '@/lib/theme';
import type { Category, LoanWithSummary, Transaction } from '@/types';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { FONT_WEIGHT } from '../lib/design';
import { CARD_TEXT, HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../lib/layoutTokens';
import { useCategoriesStore } from '../stores/useCategoriesStore';
import { useFixedDepositsStore } from '../stores/useFixedDepositsStore';
import { AppDonutChart, type DonutSlice } from './ui/AppDonutChart';

export type CategoryChartMode = 'expense' | 'income';

type HomeNode = {
  id: string;
  label: string;
  icon: string;
  color: string;
  children?: HomeNode[];
};

type HomeSlice = HomeNode & {
  amount: number;
  percent: number;
};

const UNCATEGORIZED_ICON = ':o';
const EXPENSE_COLORS = [
  '#FF6B6B', '#4F8CFF', '#F4A62A', '#A855F7', '#15B8A6', '#334BFF', '#FF4FD8',
  '#00A7F5', '#26C281', '#FB7185', '#8B5CF6', '#F97316', '#FF8A65', '#FF5C8A',
  '#7DD56F', '#7B61FF', '#C084FC', '#38BDF8', '#5EEAD4', '#6366F1', '#FDBA74',
] as const;
const INCOME_COLORS = [
  '#22C55E', '#2DD4BF', '#60A5FA', '#A78BFA', '#16A34A', '#84CC16',
] as const;

function renderIcon(icon: string | undefined, size: number, color: string) {
  const isEmoji = icon ? !/^[a-z-]+$/.test(icon) : false;
  if (icon && isEmoji) return <Text style={{ fontSize: size }}>{icon}</Text>;
  if (icon && isValidIcon(icon)) return <AppIcon name={icon} size={Math.round(size * 0.92)} color={color} strokeWidth={1.8} />;
  return <Text style={{ fontSize: size }}>{UNCATEGORIZED_ICON}</Text>;
}

function collectIds(node: HomeNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}

function buildModeHierarchy(
  mode: CategoryChartMode,
  transactions: Transaction[],
  categoriesById: Map<string, Category>,
): HomeNode[] {
  const targetImpact = mode === 'income' ? 'in' : 'out';
  const parentMap = new Map<string, HomeNode & { childMap: Map<string, HomeNode> }>();

  transactions.forEach((tx) => {
    const impact = getTransactionCashflowImpact(tx, { includeTransfers: false, includeLoans: false, includeDeposits: false });
    if (impact !== targetImpact) return;

    const category = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
    const parent = category?.parentId ? categoriesById.get(category.parentId) : undefined;
    const parentId = parent?.id ?? category?.id ?? 'uncategorized';
    const parentLabel = parent?.name ?? category?.name ?? 'Uncategorized';
    const parentIcon = parent?.icon ?? category?.icon ?? UNCATEGORIZED_ICON;
    const parentColor = getPrototypeCategoryColor(
      `${parentId}:${parentLabel}`,
      mode === 'income' ? 'income' : 'expense',
      parent?.color ?? category?.color,
    );

    if (!parentMap.has(parentId)) {
      parentMap.set(parentId, {
        id: parentId,
        label: parentLabel,
        icon: parentIcon,
        color: parentColor,
        children: [],
        childMap: new Map(),
      });
    }

    const parentNode = parentMap.get(parentId)!;

    if (category?.parentId && category.id !== parentId && !parentNode.childMap.has(category.id)) {
      parentNode.childMap.set(category.id, {
        id: category.id,
        label: category.name,
        icon: category.icon || parent?.icon || UNCATEGORIZED_ICON,
        color: getPrototypeCategoryColor(
          `${category.id}:${category.name}`,
          mode === 'income' ? 'income' : 'expense',
          category.color,
        ),
      });
    }
  });

  return Array.from(parentMap.values())
    .map(({ childMap, children, ...node }) => ({
      ...node,
      children: Array.from(childMap.values()),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));
}

function sumForNode(node: HomeNode, transactions: Transaction[]) {
  const ids = new Set(collectIds(node));
  return transactions
    .filter((tx) => {
      if (node.id === 'uncategorized') return !tx.categoryId;
      return tx.categoryId ? ids.has(tx.categoryId) : false;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function buildSlices(nodes: HomeNode[], transactions: Transaction[], mode: CategoryChartMode, parentColor?: string): HomeSlice[] {
  const palette = mode === 'income' ? INCOME_COLORS : EXPENSE_COLORS;
  const raw = nodes
    .map((node) => ({ ...node, amount: sumForNode(node, transactions) }))
    .filter((node) => node.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = raw.reduce((sum, item) => sum + item.amount, 0) || 1;
  return raw.map((item, index) => ({ ...item, color: parentColor ?? palette[index % palette.length], percent: item.amount / total }));
}

// Categories whose net sum is below zero — i.e. refunds / corrections / adjustments
// dominated the bucket. These can't be drawn as donut slices, so they're surfaced
// as a flat list below the main chart.
function buildNegativeRows(nodes: HomeNode[], transactions: Transaction[]): { id: string; label: string; icon: string; color: string; amount: number }[] {
  return nodes
    .map((node) => ({ ...node, amount: sumForNode(node, transactions) }))
    .filter((node) => node.amount < 0)
    .sort((a, b) => a.amount - b.amount); // most-negative first
}

function HomeDonut({
  slices,
  selectedId,
  onSelect,
  bgHex,
}: {
  slices: DonutSlice[];
  selectedId?: string;
  onSelect: (id: string) => void;
  bgHex: string;
}) {
  return (
    <AppDonutChart
      slices={slices}
      size={300}
      selectedId={selectedId}
      onSelect={onSelect}
      bgHex={bgHex}
    />
  );
}

function CategoryDonutChartBlockBase({
  transactions,
  categoriesById,
  sym,
  theme,
  listPalette,
  expanded = false,
  onExpand,
  initialMode = 'expense',
  mode: controlledMode,
  onModeChange,
  selectedCategoryId,
  resetTrigger = 0,
  accountsById,
  loansById,
  getCategoryFullDisplayName,
  onCategorySelect,
  onTransactionPress,
  disableScroll = false,
  externalTransactions = false,
  onSelectedTransactionsChange,
}: {
  transactions: Transaction[];
  categoriesById: Map<string, Category>;
  sym: string;
  theme: {
    brand: string;
    card: string;
    surface: string;
    inputBg: string;
    border: string;
    progressTrack: string;
    text: string;
    muted: string;
    textMuted?: string;
    accent: string;
    positive: string;
    negative: string;
  };
  listPalette?: AppThemePalette;
  expanded?: boolean;
  onExpand?: (mode: CategoryChartMode) => void;
  initialMode?: CategoryChartMode;
  mode?: CategoryChartMode;
  onModeChange?: (mode: CategoryChartMode) => void;
  selectedCategoryId?: string | null;
  resetTrigger?: number | string;
  accountsById?: Map<string, string>;
  loansById?: Map<string, LoanWithSummary>;
  getCategoryFullDisplayName?: (categoryId: string, separator?: string) => string;
  onCategorySelect?: (categoryId: string | null) => void;
  onTransactionPress?: (tx: Transaction) => void;
  /** When true, skips the internal ScrollView and renders a flat View — lets the parent (BottomSheet) handle scrolling. */
  disableScroll?: boolean;
  /** When true, hides the internal transactions section — parent renders them separately. */
  externalTransactions?: boolean;
  /** Called whenever the selected transactions change (useful when externalTransactions is true). */
  onSelectedTransactionsChange?: (txs: Transaction[]) => void;
}) {
  const depositsList = useFixedDepositsStore((s) => s.deposits);
  const depositsById = useMemo(() => new Map(depositsList.map((d) => [d.id, d])), [depositsList]);
  const tagsList = useCategoriesStore((s) => s.tags);
  const tagNamesById = useMemo(() => new Map(tagsList.map((t) => [t.id, t.name])), [tagsList]);
  const [internalMode, setInternalMode] = useState<CategoryChartMode>(initialMode);
  const [drillParentId, setDrillParentId] = useState<string | null>(null);
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);
  const listScrollRef = useRef<ScrollView | null>(null);
  const txPalette = listPalette ?? (theme as unknown as AppThemePalette);
  const mode = controlledMode ?? internalMode;
  const switchOptions = useMemo(() => ([
    { key: 'income', label: 'Income' },
    { key: 'expense', label: 'Expense' },
  ] as const), []);

  const hierarchy = useMemo(() => buildModeHierarchy(mode, transactions, categoriesById), [mode, transactions, categoriesById]);
  const parentSlices = useMemo(() => buildSlices(hierarchy, transactions, mode), [hierarchy, transactions, mode]);
  const negativeRows = useMemo(() => buildNegativeRows(hierarchy, transactions), [hierarchy, transactions]);
  const total = useMemo(() => parentSlices.reduce((sum, s) => sum + s.amount, 0), [parentSlices]);
  const selectedParent = drillParentId ? hierarchy.find((node) => node.id === drillParentId) ?? null : null;
  const selectedParentSlice = drillParentId ? parentSlices.find((s) => s.id === drillParentId) ?? null : null;
  const visibleListSlices = drillParentId ? buildSlices(selectedParent?.children ?? [], transactions, mode, selectedParentSlice?.color) : parentSlices;
  const isSubcategoryLevel = !!drillParentId;
  const selectedSubcategoryNode = drillParentId && selectedSliceId
    ? selectedParent?.children?.find((node) => node.id === selectedSliceId) ?? null
    : null;
  const selectionNode = selectedSubcategoryNode ?? selectedParent ?? null;
  const selectedIds = useMemo(() => (selectionNode ? new Set(collectIds(selectionNode)) : null), [selectionNode]);
  const modeTransactions = useMemo(
    () => transactions.filter((tx) => getTransactionCashflowImpact(tx, { includeTransfers: false, includeLoans: false, includeDeposits: false }) === (mode === 'income' ? 'in' : 'out')),
    [mode, transactions],
  );
  const selectedTransactions = useMemo(
    () => modeTransactions.filter((tx) => {
      if (!selectedIds) return true;
      if (selectionNode?.id === 'uncategorized') return !tx.categoryId;
      return tx.categoryId ? selectedIds.has(tx.categoryId) : false;
    }),
    [modeTransactions, selectedIds, selectionNode],
  );
  const isEmpty = parentSlices.length === 0;

  useEffect(() => {
    onSelectedTransactionsChange?.(selectedTransactions);
  }, [selectedTransactions, onSelectedTransactionsChange]);
  const showEmptySubcategories = isSubcategoryLevel && visibleListSlices.length === 0;
  const selectedSliceAmount = visibleListSlices.find((slice) => slice.id === selectedSliceId)?.amount;


  useEffect(() => {
    if (controlledMode === undefined) setInternalMode(initialMode);
    setDrillParentId(null);
    setSelectedSliceId(null);
    onCategorySelect?.(null);
    listScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [controlledMode, initialMode, resetTrigger]);

  useEffect(() => {
    if (selectedCategoryId !== null) return;
    setDrillParentId(null);
    setSelectedSliceId(null);
    listScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [selectedCategoryId]);

  useEffect(() => {
    onCategorySelect?.(selectionNode?.id ?? null);
  }, [selectionNode?.id]);

  const handleModeChange = (next: CategoryChartMode) => {
    if (onModeChange) onModeChange(next);
    else setInternalMode(next);
    setDrillParentId(null);
    setSelectedSliceId(null);
    onCategorySelect?.(null);
  };

  const goUpToParents = () => {
    setDrillParentId(null);
    setSelectedSliceId(null);
  };

  const handleParentSlicePress = (id: string) => {
    if (drillParentId === id) {
      setDrillParentId(null);
      setSelectedSliceId(null);
      return;
    }
    setDrillParentId(id);
    setSelectedSliceId(null);
  };

  const categoryList = (
    <View style={[styles.categoryList, isSubcategoryLevel && { gap: 14 }]}>
      {visibleListSlices.map((slice) => (
        <TouchableOpacity
          key={slice.id}
          activeOpacity={0.82}
          onPress={() => {
            if (!drillParentId) {
              handleParentSlicePress(slice.id);
              return;
            }
            setSelectedSliceId((current) => (current === slice.id ? null : slice.id));
          }}
          style={[
            styles.categoryRow,
            isSubcategoryLevel && selectedSliceId === slice.id && styles.categoryRowSelected,
            // Use the same surface colour as the breadcrumb strip, at ~30% opacity.
            // Adjust the trailing hex digits to change transparency: '4D'=30%, '33'=20%, '66'=40%.
            isSubcategoryLevel && selectedSliceId === slice.id && { backgroundColor: theme.surface + '66' },
          ]}
        >
          {isSubcategoryLevel ? (
            <View style={styles.subcategoryRow}>
              <View style={styles.iconBadge}>
                {renderIcon(slice.icon, 20, theme.brand)}
              </View>
              <View style={styles.subcategoryContent}>
                <View style={styles.rowTopLine}>
                  <Text numberOfLines={1} style={[styles.splitName, styles.subcategoryName, { color: theme.text }]}>{slice.label}</Text>
                  <View style={styles.rowAmountWrap}>
                    <Text style={[styles.splitValue, { color: theme.muted }]}>
                      {formatCurrency(slice.amount, sym)} · {Math.round(slice.percent * 100)}%
                    </Text>
                  </View>
                </View>
                <View style={[styles.progressTrack, styles.subcategoryProgressTrack, { backgroundColor: theme.progressTrack }]}>
                  <View style={[styles.progressFill, { backgroundColor: slice.color, width: `${Math.max(3, slice.percent * 100)}%` }]} />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.rowTopLine}>
              <View style={styles.rowTitleWrap}>
                <View style={styles.iconBadge}>
                  {renderIcon(slice.icon, 20, theme.brand)}
                </View>
                <Text numberOfLines={1} style={[styles.splitName, { color: theme.text }]}>{slice.label}</Text>
              </View>
              <View style={styles.rowAmountWrap}>
                <Text style={[styles.splitValue, { color: theme.muted }]}>
                  {formatCurrency(slice.amount, sym)} · {Math.round(slice.percent * 100)}%
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      ))}
      {showEmptySubcategories ? (
        <View style={styles.emptySubcategoryWrap}>
          <Text style={[styles.emptySubcategoryText, { color: theme.muted }]}>No subcategories here yet.</Text>
        </View>
      ) : null}
    </View>
  );

  // Refunds / Adjustments — shown only when at least one category sums below zero.
  // These represent net inflows into an expense bucket (or net outflows from an income bucket),
  // which can't be drawn as a donut slice. Surface them here so the data isn't silently hidden.
  const negativeList = !isSubcategoryLevel && negativeRows.length > 0 ? (
    <View style={styles.negativeSection}>
      <Text style={[styles.negativeSectionTitle, { color: theme.muted }]}>
        {mode === 'income' ? 'Income adjustments' : 'Refunds & adjustments'}
      </Text>
      {negativeRows.map((row) => (
        <View key={`neg-${row.id}`} style={styles.negativeRow}>
          <View style={styles.iconBadge}>
            {renderIcon(row.icon, 20, theme.brand)}
          </View>
          <Text numberOfLines={1} style={[styles.splitName, { color: theme.text }]}>{row.label}</Text>
          <View style={styles.rowAmountWrap}>
            <Text style={[styles.splitValue, { color: theme.negative }]}>
              -{formatCurrency(Math.abs(row.amount), sym)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <View style={[expanded ? styles.expandedChartContent : undefined, expanded && styles.expandedChartInner]}>
      <View style={[styles.chartTopRow, expanded && styles.chartTopRowExpanded]}>
        <SegmentedPillSwitch
          options={switchOptions}
          value={mode}
          onChange={(next) => handleModeChange(next as CategoryChartMode)}
          backgroundColor={theme.surface}
          pillColor={theme.inputBg}
          borderColor={theme.border}
          itemMinWidth={62}
          activeTextColor={theme.text}
          inactiveTextColor={theme.muted}
          style={styles.chartSwitch}
          height={HOME_LAYOUT.periodHeight}
          radius={HOME_RADIUS.tab + 3}
          fontSize={HOME_TEXT.caption}
        />
        {expanded || !onExpand ? null : (
          <TouchableOpacity
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => onExpand(mode)}
            style={styles.expandButton}
          >
            <AppIcon name="maximize-2" size={15} color={theme.textMuted ?? theme.muted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.chartWrap}>
        {isEmpty ? (
          <View style={[styles.emptyChart, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.emptyChartRing, { borderColor: theme.border }]}>
              <AppIcon name="pie-chart" size={22} color={theme.muted} />
            </View>
            <Text style={[styles.emptyChartTitle, { color: theme.muted }]}>
              {mode === 'income' ? 'No income here yet' : 'No expenses here yet'}
            </Text>
            <Text style={[styles.emptyChartCopy, { color: theme.muted }]}>
              {mode === 'income'
                ? 'Add a few inflows and this ring will wake up.'
                : 'Add a few spends and this ring will wake up.'}
            </Text>
          </View>
        ) : (
          <>
            <HomeDonut slices={parentSlices} selectedId={drillParentId ?? selectedSliceId ?? undefined} onSelect={handleParentSlicePress} bgHex={theme.card} />
            <View pointerEvents="none" style={styles.centerLabel}>
              {selectionNode ? (
                <View style={styles.centerIconWrap}>
                  {renderIcon(selectedSubcategoryNode?.icon ?? selectedParentSlice?.icon, 24, theme.brand)}
                </View>
              ) : null}
              <Text numberOfLines={2} style={[styles.centerName, { color: theme.text }]}>
                {selectedSubcategoryNode?.label ?? selectedParentSlice?.label ?? 'All'}
              </Text>
              <Text style={[styles.centerAmount, { color: theme.text }]}>
                {(selectedSliceAmount ?? selectedParentSlice?.amount ?? total) === 0
                  ? '—'
                  : formatCurrency(selectedSliceAmount ?? selectedParentSlice?.amount ?? total, sym)}
              </Text>
            </View>
          </>
        )}
      </View>

      {isEmpty ? null : (
        <View style={[styles.breadcrumbRow, { backgroundColor: theme.surface }]}>
          <View style={styles.breadcrumbLeft}>
            <TouchableOpacity
              onPress={drillParentId ? goUpToParents : undefined}
              activeOpacity={drillParentId ? 0.8 : 1}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 24 }}
              style={[
                styles.breadcrumbTap,
                drillParentId
                  ? { backgroundColor: theme.inputBg, borderColor: theme.border }
                  : styles.breadcrumbTapInactive,
              ]}
            >
              <Text style={[styles.breadcrumbLink, { color: drillParentId ? theme.accent : theme.text }]}>All</Text>
            </TouchableOpacity>
            {drillParentId ? (
              <>
                <Text style={[styles.breadcrumbSep, { color: theme.muted }]}>/</Text>
                <Text style={[styles.breadcrumbCurrent, { color: theme.text }]}>{selectedParentSlice?.label}</Text>
              </>
            ) : null}
          </View>
          <View style={[styles.breadcrumbMeta, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <Text style={[styles.breadcrumbMetaText, { color: theme.text }]}>
              {drillParentId
                ? `${formatCurrency(selectedParentSlice?.amount ?? 0, sym)} · ${Math.round((selectedParentSlice?.percent ?? 0) * 100)}%`
                : `${formatCurrency(total, sym)} · 100%`}
            </Text>
          </View>
        </View>
      )}

      {expanded ? (
        disableScroll ? (
          <View style={[styles.expandedScroll, { paddingBottom: styles.expandedScrollContent.paddingBottom }]}>
            {categoryList}
            {negativeList}
            {!externalTransactions && (
              <View style={[styles.transactionsSection, { backgroundColor: txPalette.surface, borderColor: txPalette.border }]}>
                <View style={styles.transactionsHeader}>
                  <Text style={[styles.sectionTitle, { color: txPalette.text }]}>Transactions</Text>
                  <Text style={{ fontSize: HOME_TEXT.caption, color: txPalette.textMuted }}>{selectedTransactions.length}</Text>
                </View>
                {selectedTransactions.map((tx, index) => (
                  <TransactionListItem
                    key={tx.id}
                    tx={tx}
                    sym={sym}
                    palette={txPalette}
                    isLast={index === selectedTransactions.length - 1}
                    categoryName={tx.categoryId ? (getCategoryFullDisplayName?.(tx.categoryId, ' › ') ?? categoriesById.get(tx.categoryId)?.name) : undefined}
                    categoryIcon={getCategoryDisplayIcon(categoriesById, tx.categoryId)}
                    accountName={accountsById?.get(tx.accountId)}
                    linkedAccountName={tx.linkedAccountId ? accountsById?.get(tx.linkedAccountId) : undefined}
                    loanPersonName={tx.loanId ? loansById?.get(tx.loanId)?.personName : undefined}
                    loanDirection={tx.loanId ? loansById?.get(tx.loanId)?.direction : undefined}
                    depositName={tx.depositId ? depositsById.get(tx.depositId)?.name : undefined}
                    depositBankName={tx.depositId ? (depositsById.get(tx.depositId)?.bankName ?? undefined) : undefined}
                    tertiaryText={tx.tags.length > 0 ? tx.tags.map((id) => tagNamesById.get(id)).filter((v): v is string => !!v).join(' • ') || undefined : undefined}
                    showAmountSign={false}
                    paddingY={14}
                    onPress={onTransactionPress ? () => onTransactionPress(tx) : undefined}
                  />
                ))}
                {selectedTransactions.length === 0 ? (
                  <Text style={{ color: txPalette.textSoft, fontSize: HOME_TEXT.bodySmall, textAlign: 'center', paddingVertical: 16 }}>
                    No transactions here
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        ) : (
          <ScrollView
            ref={listScrollRef}
            style={styles.expandedScroll}
            contentContainerStyle={styles.expandedScrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {categoryList}
            {negativeList}
            <View style={[styles.transactionsSection, { backgroundColor: txPalette.surface, borderColor: txPalette.border }]}>
              <View style={styles.transactionsHeader}>
                <Text style={[styles.sectionTitle, { color: txPalette.text }]}>Transactions</Text>
                <Text style={{ fontSize: HOME_TEXT.caption, color: txPalette.textMuted }}>{selectedTransactions.length}</Text>
              </View>
              {selectedTransactions.map((tx, index) => (
                <TransactionListItem
                  key={tx.id}
                  tx={tx}
                  sym={sym}
                  palette={txPalette}
                  isLast={index === selectedTransactions.length - 1}
                  categoryName={tx.categoryId ? (getCategoryFullDisplayName?.(tx.categoryId, ' › ') ?? categoriesById.get(tx.categoryId)?.name) : undefined}
                  categoryIcon={getCategoryDisplayIcon(categoriesById, tx.categoryId)}
                  accountName={accountsById?.get(tx.accountId)}
                  linkedAccountName={tx.linkedAccountId ? accountsById?.get(tx.linkedAccountId) : undefined}
                  loanPersonName={tx.loanId ? loansById?.get(tx.loanId)?.personName : undefined}
                  loanDirection={tx.loanId ? loansById?.get(tx.loanId)?.direction : undefined}
                  depositName={tx.depositId ? depositsById.get(tx.depositId)?.name : undefined}
                  depositBankName={tx.depositId ? (depositsById.get(tx.depositId)?.bankName ?? undefined) : undefined}
                  tertiaryText={tx.tags.length > 0 ? tx.tags.map((id) => tagNamesById.get(id)).filter((v): v is string => !!v).join(' • ') || undefined : undefined}
                  showAmountSign={false}
                  paddingY={14}
                  onPress={onTransactionPress ? () => onTransactionPress(tx) : undefined}
                />
              ))}
              {selectedTransactions.length === 0 ? (
                <Text style={{ color: txPalette.textSoft, fontSize: HOME_TEXT.bodySmall, textAlign: 'center', paddingVertical: 16 }}>
                  No transactions here
                </Text>
              ) : null}
            </View>
          </ScrollView>
        )
      ) : (
        <ScrollView ref={listScrollRef} style={[styles.listViewport, styles.listViewportCollapsed]} contentContainerStyle={{ paddingBottom: 4 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {categoryList}
          {negativeList}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  expandedChartContent: { flex: 1 },
  expandedChartInner: { paddingBottom: 2 },
  chartTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingTop: 2, paddingHorizontal: 10, marginBottom: -2, zIndex: 10 },
  chartTopRowExpanded: { paddingTop: 8, paddingHorizontal: 12, marginBottom: 0, zIndex: 10 },
  chartSwitch: { alignSelf: 'flex-start', minWidth: 144 },
  expandButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: -2 },
  chartWrap: { height: 304, alignItems: 'center', justifyContent: 'center', marginTop: -14, marginBottom: 0 },
  emptyChart: { width: 248, minHeight: 248, borderRadius: HOME_RADIUS.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  emptyChartRing: { width: 64, height: 64, borderRadius: HOME_RADIUS.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyChartTitle: { fontSize: HOME_TEXT.bodyLarge, fontWeight: FONT_WEIGHT.medium, textAlign: 'center', marginTop: 2 },
  emptyChartCopy: { fontSize: HOME_TEXT.metaSmall, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  centerLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingTop: 2 },
  centerIconWrap: { minHeight: 28, marginBottom: 4, alignItems: 'center', justifyContent: 'center' },
  centerName: { fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', maxWidth: 108 },
  centerAmount: { fontSize: HOME_TEXT.subhead, fontWeight: FONT_WEIGHT.heavy, marginTop: 4 },
  centerMeta: { fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.semibold, marginTop: 2 },
  breadcrumbRow: {
    marginTop: 0,
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: HOME_RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  breadcrumbLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  breadcrumbTap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: HOME_RADIUS.full, borderWidth: 1 },
  breadcrumbTapInactive: { borderColor: 'transparent', backgroundColor: 'transparent' },
  breadcrumbLink: { fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.heavy },
  breadcrumbSep: { fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.black },
  breadcrumbCurrent: { flexShrink: 1, fontSize: HOME_TEXT.metaSmall, fontWeight: FONT_WEIGHT.bold },
  breadcrumbMeta: { borderWidth: 1, borderRadius: HOME_RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  breadcrumbMetaText: { fontSize: HOME_TEXT.metaTiny, fontWeight: FONT_WEIGHT.heavy },
  listViewport: { width: '100%' },
  listViewportCollapsed: { maxHeight: 244 },
  categoryList: { paddingHorizontal: 20, paddingTop: 10, gap: 8 },
  categoryRow: { gap: 6, paddingVertical: 6 },
  categoryRowSelected: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 10, marginHorizontal: -10 },
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  rowTitleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  subcategoryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  subcategoryContent: { flex: 1, minWidth: 0, paddingTop: 1 },
  subcategoryName: { paddingTop: 0 },
  iconBadge: { width: 34, height: 34, borderRadius: HOME_RADIUS.chip, alignItems: 'center', justifyContent: 'center' },
  rowAmountWrap: { alignItems: 'flex-end', minWidth: 80, paddingRight: 6 },
  splitName: { flex: 1, fontSize: CARD_TEXT.line1, fontWeight: FONT_WEIGHT.medium },
  splitValue: { fontSize: CARD_TEXT.line1, fontWeight: FONT_WEIGHT.heavy },
  progressTrack: { height: 4, borderRadius: HOME_RADIUS.full, overflow: 'hidden' },
  subcategoryProgressTrack: { marginTop: 12 },
  progressFill: { height: 4, borderRadius: HOME_RADIUS.full },
  emptySubcategoryWrap: { marginLeft: 44, marginTop: 2, paddingVertical: 8 },
  emptySubcategoryText: { fontSize: HOME_TEXT.metaSmall, fontWeight: FONT_WEIGHT.semibold },
  negativeSection: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 10 },
  negativeSectionTitle: { fontSize: HOME_TEXT.metaSmall, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5, textTransform: 'uppercase' },
  negativeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  transactionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: HOME_SPACE.sm, paddingHorizontal: 12 },
  sectionTitle: { fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold },
  transactionsSection: { borderRadius: HOME_RADIUS.card, borderWidth: 1, marginHorizontal: 12, marginTop: 18, marginBottom: 24, paddingTop: 16, paddingBottom: 4, overflow: 'hidden' },
  expandedScroll: { flex: 1 },
  expandedScrollContent: { paddingBottom: 20 },
});

export const CategoryDonutChartBlock = React.memo(CategoryDonutChartBlockBase);
