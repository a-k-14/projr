/**
 * AccountDetailsV2Hero — experimental rearrangement of the account detail hero.
 *
 * Renders as TWO separate cards instead of the existing single-card hero:
 *   Card 1: gradient top (icon + name + balance) with the balance trend chart embedded below
 *   Card 2: period chips + cashflow toggle + tick chart + income/expense values
 *
 * JSX is duplicated from `AccountSummaryCard` (in app/(tabs)/index.tsx) so that
 * the original card stays untouched. Animation behavior (tick sweep, metric springs,
 * cashflow note expand) is preserved 1:1.
 *
 * Activated for a single account via HomeAccountPage's `useExperimentalHero` prop
 * (set from app/account/[id].tsx based on V2_ACCOUNT_NAME).
 */

import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { formatDate, getNavigableDateRange, toLocalDayEndISO, toLocalDayStartISO } from '../../lib/dateUtils';
import { getCashflowFromList, getTransactionCashflowImpact } from '../../lib/derived';
import { CARD_PADDING, FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import type { AppThemePalette } from '../../lib/theme';
import type { AccountType, CashflowSummary, PeriodType, Transaction } from '../../types';
import {
  computeTickGeom,
  familyAwareCurrency,
  splitTickAmount,
  TICK_GAP,
  TICK_W,
  useMetricSprings,
} from '../../lib/v2HeroUtils';
import { V2_SPACING, v2Colors } from '../../lib/v2HeroTokens';
import { V2GradientHero } from './V2GradientHero';
import { ActivityViewModeToggle } from '../activity/ActivityFilterBar';
import { CategoryIconBadge } from '../activity/ActivityUI';
import { ChoiceRow } from '../settings-ui';
import { AppChevron } from '../ui/AppChevron';
import { AppIcon } from '../ui/AppIcon';
import { AppSwitch } from '../ui/AppSwitch';
import { Text } from '../ui/AppText';
import { SegmentedPillSwitch } from '../ui/SegmentedPillSwitch';

import { getAutoBucketType, getAvailableGranularities, getTimeBuckets, type ChartGranularity } from '../../lib/chartUtils';
import { BOTTOM_SHEET_TOKENS, getTxTypeConfig, HELP_TEXTS, HOME_LAYOUT, HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import { getIncomeExpenseByBuckets, type IncomeExpenseBucket } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useFixedDepositsStore } from '../../stores/useFixedDepositsStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';
import { CategoryDonutChartBlock, type CategoryChartMode } from '../CategoryDonutChartBlock';
import { DateGroupedTransactionList } from '../DateGroupedTransactionList';
import { DateGroupedTransactionSheetList } from '../DateGroupedTransactionSheetList';
import { IncomeExpenseChart } from '../insights/IncomeExpenseChart';
import { BottomSheet } from '../ui/BottomSheet';
import { SheetScrollTopButton } from '../ui/SheetScrollTopButton';

type HomePeriodType = 'today' | PeriodType;

const PERIODS: HomePeriodType[] = ['today', 'week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<HomePeriodType, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom',
};

const TAB_OPTIONS = [
  { key: 'activity', label: 'Activity', icon: 'activity' },
  { key: 'donut', label: 'Breakdown', icon: 'pie-chart' },
  { key: 'bar', label: 'Trends', icon: 'chart-column-increasing' },
] as const;

// Tick-chart geometry — duplicated from index.tsx so V2 looks identical.
// Helper functions, hooks, and tick chart geometry moved to lib/v2HeroUtils.
// Spacing + color tokens moved to lib/v2HeroTokens. See those files for
// the single source of truth.
const CASHFLOW_NOTE_H = 24;
type HierarchyFamily = 'in' | 'out' | 'transfer' | 'deposit' | 'loan';

interface Props {
  accountName: string;
  accountTypeLabel: string;
  balance: number;
  currencySymbol: string;
  palette: AppThemePalette;
  accountId?: string;
  onTransactionPress?: (tx: Transaction) => void;

  incomeExpense?: { income: number; expense: number };
  cashflowSummary?: CashflowSummary;

  period?: HomePeriodType;
  onPeriodChange?: (p: HomePeriodType) => void;
  onOpenCustomRange?: () => void;

  isCashflowView?: boolean;
  onToggleCashflowView?: (v: boolean) => void;

  onPressMetricIn?: () => void;
  onPressMetricOut?: () => void;

  hideAmounts?: boolean;
  accountType?: AccountType;
  from?: string;
  to?: string;
  tweenTrigger: number;

  /** The TrendLineChart node, rendered inside the gradient card below the balance. */
  trendChart: React.ReactNode;
  /** When set, the gradient top-right shows the tooltip (date + value) instead
   *  of being empty. Set while the user is dragging the chart. */
  activeTrendPoint?: { date: string; val: number } | null;
  /**
   * Current-period transactions pre-fetched by the parent (HomeAccountPage).
   * When provided and periodOffset is 0, used directly — eliminating a
   * redundant DB round-trip on screen open (V1 strategy).
   */
  initialTransactions?: Transaction[];
}

/**
 * Tiny entry shell. Defers mounting `AccountDetailsV2HeroInner` (the heavy V2
 * body — 45 hooks, lots of memos, deeply-nested JSX) until AFTER the screen
 * slide-in animation completes. During the animation we render just Card 1
 * (V2GradientHero) — same gradient + balance + trend chart the user sees
 * anyway, but with virtually zero JS cost so the slide-in stays smooth.
 *
 * Why this exists: V1 (AccountSummaryCard) has 3 component-mount hooks. V2's
 * full body has 45. Even with empty data, those 45 hooks + their useMemo
 * computations + the Card 2/3 JSX evaluation all run during the navigation
 * push animation and compete for the JS thread. Deferring the inner body
 * means the animation runs on a near-idle JS thread.
 *
 * Tradeoff: Card 2 (period chips + cashflow + tick chart + income/expense
 * values) is also delayed by ~300ms. If that visible "Card 2 fills in
 * a beat later" feels worse than the original stutter, the next step is a
 * full Card 3 extraction — see comments at the bottom of this file.
 */
export function AccountDetailsV2Hero(props: Props) {
  const [innerReady, setInnerReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setInnerReady(true);
    });
    return () => task.cancel();
  }, []);

  if (!innerReady) {
    // Skeleton: only render Card 1 during the slide-in. It's the cheapest
    // component in V2 (no state, no effects beyond a memoized gradient)
    // so JSX evaluation barely moves the JS-thread needle.
    return (
      <View>
        <V2GradientHero
          accountName={props.accountName}
          balance={props.balance}
          currencySymbol={props.currencySymbol}
          palette={props.palette}
          accountType={props.accountType}
          hideAmounts={props.hideAmounts}
          trendChart={props.trendChart}
          activeTrendPoint={props.activeTrendPoint}
        />
      </View>
    );
  }

  return <AccountDetailsV2HeroInner {...props} />;
}

function AccountDetailsV2HeroInner({
  accountName,
  balance,
  currencySymbol,
  palette,
  incomeExpense: _incomeExpense,
  cashflowSummary: _cashflowSummary,
  period,
  onPeriodChange,
  onOpenCustomRange,
  isCashflowView,
  onToggleCashflowView,
  onPressMetricIn,
  onPressMetricOut,
  hideAmounts,
  accountType,
  from,
  to,
  tweenTrigger,
  trendChart,
  activeTrendPoint,
  accountId,
  onTransactionPress,
  initialTransactions,
}: Props) {
  const { width: winW } = useWindowDimensions();
  const tickGeom = useMemo(() => computeTickGeom(winW), [winW]);
  const v2c = v2Colors(palette);

  // ── Tab State & DB Querying for Card 2 ──
  const [activeTab, setActiveTab] = useState<'activity' | 'donut' | 'bar'>('activity');
  const [isViewModeSheetOpen, setIsViewModeSheetOpen] = useState(false);
  const [periodOffset, setPeriodOffset] = useState(0);

  // Reset offset when period changes
  useEffect(() => {
    setPeriodOffset(0);
  }, [period]);

  const goPrev = () => {
    if (period !== 'custom') {
      setPeriodOffset((prev) => prev - 1);
    }
  };
  const canGoNext = period !== 'custom' && periodOffset < 0;
  const goNext = () => {
    if (canGoNext) {
      setPeriodOffset((prev) => prev + 1);
    }
  };
  // Seed transactions from props on first mount so the very first render has
  // the right data already — avoids an empty → populated re-render flash and
  // means all downstream useMemo derivations get useful inputs immediately.
  const [periodTransactions, setPeriodTransactions] = useState<Transaction[]>(
    () => (initialTransactions ?? []),
  );
  const [incomeExpenseData, setIncomeExpenseData] = useState<IncomeExpenseBucket[]>([]);
  const [incExpGranularity, setIncExpGranularity] = useState<ChartGranularity>('auto');
  const [isLoading, setIsLoading] = useState(false);

  // Defer mounting the heavy Card 3 (tabs + lists + charts) until after the
  // screen slide-in animation finishes. Card 1 (hero) and Card 2 (period
  // section) render immediately so the screen looks alive; Card 3 fills in a
  // beat later. This is the single biggest "feels slow to open" lever — the
  // tabs section JSX evaluation was competing with the navigation animation
  // on the JS thread.
  const [card3Ready, setCard3Ready] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setCard3Ready(true);
    });
    return () => task.cancel();
  }, []);

  // V2 enhancement state
  const [activityViewMode, setActivityViewMode] = useState<'date' | 'category'>('date');
  const [activeActivityCategory, setActiveActivityCategory] = useState<{
    parentKey: string;
    parentLabel: string;
    subKey?: string;
    subLabel?: string;
    compactLabel?: boolean;
  } | null>(null);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const [selectedDonutTransactions, setSelectedDonutTransactions] = useState<Transaction[]>([]);
  const [selectedBarBucket, setSelectedBarBucket] = useState<{ label: string; income: number; expense: number; from?: string; to?: string } | null>(null);
  // Cap at 500 rows up front. Picked high so 99% of accounts/periods render
  // fully on first paint without any pagination machinery. We previously
  // started at 25 and grew via a setInterval(350ms) polling measureInWindow —
  // that polling was the main JS-thread cost making V2 feel slow. If your
  // accounts routinely exceed 500 per period, swap DateGroupedTransactionList
  // for the FlashList-backed sheet variant rather than reintroducing polling.
  const [visibleLimit, setVisibleLimit] = useState(500);

  const [chartMode, setChartMode] = useState<CategoryChartMode>('expense');
  const [selectedChartCategoryId, setSelectedChartCategoryId] = useState<string | null>(null);
  const [chartResetNonce, setChartResetNonce] = useState(0);

  const [expandedChartState, setExpandedChartState] = useState<{
    transactions: Transaction[];
    mode: CategoryChartMode;
    resetTrigger: number;
  } | null>(null);
  const [expandedSheetTxs, setExpandedSheetTxs] = useState<Transaction[]>([]);



  // Scroll-to-top affordance for the expanded BottomSheet
  const sheetListRef = useRef<any>(null);
  const [showSheetScrollTop, setShowSheetScrollTop] = useState(false);
  const lastShowSheetTopRef = useRef(false);
  const isScrollingToTopRef = useRef(false);

  // Fetch categories, accounts, and loans stores
  const categories = useCategoriesStore((s) => s.categories);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const tags = useCategoriesStore((s) => s.tags);
  const loans = useLoansStore((s) => s.loans);
  const accounts = useAccountsStore((s) => s.accounts);
  const deposits = useFixedDepositsStore((s) => s.deposits);
  const settingsYearStart = useUIStore((s) => s.settings.yearStart);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);
  const tagNamesById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);
  const depositsById = useMemo(() => new Map(deposits.map((d) => [d.id, d])), [deposits]);
  const txTypeConfig = useMemo(() => getTxTypeConfig(palette), [palette]);

  // V2 Category Hierarchy
  const toggleCategoryExpansion = (id: string) => {
    setExpandedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSectionExpansion = (parentKeys: string[]) => {
    if (parentKeys.length === 0) return;
    setExpandedCategoryIds((prev) => {
      const allExpanded = parentKeys.every((key) => prev.includes(key));
      return allExpanded
        ? prev.filter((key) => !parentKeys.includes(key))
        : Array.from(new Set([...prev, ...parentKeys]));
    });
  };


  const getHierarchySections = (transactions: Transaction[]) => {
    const parentMap = new Map<
      string,
      {
        parentKey: string;
        parentLabel: string;
        parentIcon?: string;
        parentSyntheticType?: HierarchyFamily;
        familyOrder: number;
        familyKey: HierarchyFamily;
        transactions: Transaction[];
        subMap: Map<string, { subKey: string; subLabel: string; transactions: Transaction[] }>;
      }
    >();

    const getFamilyKey = (tx: Transaction): HierarchyFamily => {
      if (tx.transferPairId) return 'transfer';
      if (tx.type === 'out') return 'out';
      if (tx.type === 'in') return 'in';
      if (tx.type === 'loan') return 'loan';
      if (tx.type === 'deposit') return 'deposit';
      return 'transfer';
    };

    const getFamilyOrder = (familyKey: HierarchyFamily) => {
      if (familyKey === 'in') return 0;
      if (familyKey === 'out') return 1;
      if (familyKey === 'transfer') return 2;
      if (familyKey === 'deposit') return 3;
      return 4; // loan
    };

    transactions.forEach((tx) => {
      const category = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
      const parent = category?.parentId ? categoriesById.get(category.parentId) : undefined;
      const familyKey = getFamilyKey(tx);
      const parentKey = parent
        ? parent.id
        : category
          ? category.id
          : tx.transferPairId
            ? 'type:transfer'
            : `type:${tx.type}`;
      const parentLabel = parent
        ? parent.name
        : category
          ? category.name
          : tx.transferPairId
            ? 'Transfer'
            : tx.type === 'transfer'
              ? 'Transfer'
              : tx.type === 'loan'
                ? 'Loan'
                : tx.type === 'deposit'
                  ? 'Deposit'
                  : 'Uncategorized';
      const parentIcon = parent
        ? parent.icon
        : category
          ? category.icon
          : undefined;
      const subKey = category?.id ?? (tx.transferPairId ? 'type:transfer' : `type:${tx.type}`);
      const subLabel = category
        ? category.name
        : tx.transferPairId
          ? 'Transfer'
          : tx.type === 'transfer'
            ? 'Transfer'
            : tx.type === 'loan'
              ? 'Loan'
              : tx.type === 'deposit'
                ? 'Deposit'
                : 'Uncategorized';

      if (!parentMap.has(parentKey)) {
        parentMap.set(parentKey, {
          parentKey,
          parentLabel,
          parentIcon,
          parentSyntheticType: parent || category ? undefined : familyKey,
          familyOrder: getFamilyOrder(familyKey),
          familyKey,
          transactions: [],
          subMap: new Map()
        });
      }

      const parentEntry = parentMap.get(parentKey)!;
      parentEntry.transactions.push(tx);

      if (!parentEntry.subMap.has(subKey)) {
        parentEntry.subMap.set(subKey, { subKey, subLabel, transactions: [] });
      }
      parentEntry.subMap.get(subKey)!.transactions.push(tx);
    });

    const includeTotalCashflow = !!isCashflowView;

    const computedHierarchy = Array.from(parentMap.values())
      .map((entry) => {
        const includeTransfersForEntry =
          includeTotalCashflow || (entry.familyKey === 'transfer' && accountId !== 'all');
        return {
          parentKey: entry.parentKey,
          parentLabel: entry.parentLabel,
          parentIcon: entry.parentIcon,
          parentSyntheticType: entry.parentSyntheticType,
          total: getCashflowFromList(
            entry.transactions,
            includeTransfersForEntry,
            entry.familyKey === 'loan' ? true : includeTotalCashflow,
            includeTotalCashflow
          ).net,
          transactions: entry.transactions,
          subcategories: Array.from(entry.subMap.values())
            .map((sub) => ({
              subKey: sub.subKey,
              subLabel: sub.subLabel,
              total: getCashflowFromList(
                sub.transactions,
                includeTransfersForEntry,
                entry.familyKey === 'loan' ? true : includeTotalCashflow,
                includeTotalCashflow
              ).net,
              transactions: sub.transactions
            }))
            .sort((a, b) => a.subLabel.localeCompare(b.subLabel, 'en', { sensitivity: 'base' })),
          familyOrder: entry.familyOrder,
          familyKey: entry.familyKey
        };
      })
      .sort((a, b) => {
        if (a.familyOrder !== b.familyOrder) return a.familyOrder - b.familyOrder;
        return a.parentLabel.localeCompare(b.parentLabel, 'en', { sensitivity: 'base' });
      });

    return ([
      { key: 'in', label: 'Income' },
      { key: 'out', label: 'Expenses' },
      { key: 'transfer', label: 'Transfers' },
      { key: 'deposit', label: 'Deposits' },
      { key: 'loan', label: 'Loans' },
    ] as const)
      .map((section) => ({
        ...section,
        items: computedHierarchy.filter((category) => category.familyKey === section.key)
      }))
      .filter((section) => section.items.length > 0);
  };

  const renderCategorySections = (sections: ReturnType<typeof getHierarchySections>) => {
    return sections.map((section, sectionIndex) => (
      <View key={section.key}>
        {(() => {
          const expandableParentKeys = section.items
            .filter((category) => category.familyKey !== 'loan' && category.familyKey !== 'transfer' && category.familyKey !== 'deposit')
            .map((category) => category.parentKey);
          const allExpanded =
            expandableParentKeys.length > 0 &&
            expandableParentKeys.every((key) => expandedCategoryIds.includes(key));

          const sectionHeaderStyle = {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            paddingHorizontal: CARD_PADDING - SCREEN_GUTTER,
            paddingTop: sectionIndex === 0 ? 0 : 6,
            paddingBottom: 7,
          };

          const sectionHeaderContent = (
            <>
              <Text
                appWeight="medium"
                style={{
                  flex: 1,
                  fontSize: HOME_TEXT.tiny + 1,
                  fontWeight: FONT_WEIGHT.heavy,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: palette.text,
                }}
              >
                {section.label}
              </Text>
              {expandableParentKeys.length > 0 ? (
                <AppIcon
                  name={allExpanded ? 'chevrons-up' : 'chevrons-down'}
                  size={15}
                  color={palette.text}
                  strokeWidth={1.8}
                />
              ) : null}
            </>
          );

          return expandableParentKeys.length > 0 ? (
            <TouchableOpacity
              delayPressIn={0}
              onPress={() => toggleSectionExpansion(expandableParentKeys)}
              activeOpacity={0.72}
              style={sectionHeaderStyle}
            >
              {sectionHeaderContent}
            </TouchableOpacity>
          ) : (
            <View
              style={sectionHeaderStyle}
            >
              {sectionHeaderContent}
            </View>
          );
        })()}
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: HOME_RADIUS.card,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: palette.borderSoft,
            marginBottom: 16,
          }}
        >
          {section.items.map((category, categoryIndex) => {
            const isExpanded = expandedCategoryIds.includes(category.parentKey);
            const isDirectNavigation = category.familyKey === 'loan' || category.familyKey === 'transfer' || category.familyKey === 'deposit';
            const isLastCategory = categoryIndex === section.items.length - 1;
            const syntheticCfg = category.parentSyntheticType ? (txTypeConfig as any)?.[category.parentSyntheticType] : undefined;

            return (
              <View key={category.parentKey}>
                <TouchableOpacity
                  delayPressIn={0}
                  onPress={() => {
                    if (category.familyKey === 'loan') {
                      setActiveActivityCategory({
                        parentKey: category.parentKey,
                        parentLabel: 'Loans',
                        subKey: 'type:loan',
                        subLabel: 'Loans',
                        compactLabel: true
                      });
                      return;
                    }

                    if (category.familyKey === 'transfer') {
                      setActiveActivityCategory({
                        parentKey: category.parentKey,
                        parentLabel: 'Transfers',
                        subKey: 'type:transfer',
                        subLabel: 'Transfers',
                        compactLabel: true
                      });
                      return;
                    }

                    if (category.familyKey === 'deposit') {
                      setActiveActivityCategory({
                        parentKey: category.parentKey,
                        parentLabel: 'Deposits',
                        subKey: 'type:deposit',
                        subLabel: 'Deposits',
                        compactLabel: true
                      });
                      return;
                    }

                    toggleCategoryExpansion(category.parentKey);
                  }}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: CARD_PADDING,
                    minHeight: 70,
                    backgroundColor: palette.card,
                    borderBottomWidth: isLastCategory && (!isExpanded || isDirectNavigation) ? 0 : 1,
                    borderBottomColor: palette.divider,
                    gap: 12,
                  }}
                >
                  <CategoryIconBadge
                    icon={
                      category.parentSyntheticType === 'loan'
                        ? 'credit-card'
                        : syntheticCfg?.iconName || category.parentIcon || 'tag'
                    }
                    palette={palette}
                    iconColor={palette.brand}
                    size={HOME_LAYOUT.listIconSize}
                    iconSize={HOME_LAYOUT.listIconInnerSize}
                    strokeWidth={HOME_LAYOUT.listIconStrokeWidth}
                    noBackground
                  />
                  <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.text, flex: 1 }} numberOfLines={1}>
                    {category.parentLabel}
                  </Text>
                  <Text
                    style={{
                      fontSize: HOME_TEXT.body,
                      fontWeight: FONT_WEIGHT.semibold,
                      color: category.familyKey === 'in'
                        ? palette.numberPositive
                        : category.familyKey === 'out'
                          ? palette.numberNegative
                          : category.total >= 0 ? palette.numberPositive : palette.numberNegative,
                      marginRight: 2
                    }}
                  >
                    {familyAwareCurrency(category.familyKey, category.total, currencySymbol)}
                  </Text>
                  {isDirectNavigation ? (
                    <AppChevron direction="right" size={18} tone="secondary" palette={palette} />
                  ) : (
                    <AppChevron direction={isExpanded ? 'up' : 'down'} size={18} tone="secondary" palette={palette} />
                  )}
                </TouchableOpacity>

                {isExpanded && !isDirectNavigation && (
                  <View
                    style={{
                      backgroundColor: palette.surface,
                      borderBottomWidth: isLastCategory ? 0 : 1,
                      borderBottomColor: palette.divider,
                    }}
                  >
                    {category.subcategories.map((sub) => (
                      <TouchableOpacity
                        delayPressIn={0}
                        key={sub.subKey}
                        onPress={() =>
                          setActiveActivityCategory({
                            parentKey: category.parentKey,
                            parentLabel: category.parentLabel,
                            subKey: sub.subKey,
                            subLabel: sub.subLabel,
                          })
                        }
                        activeOpacity={0.75}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 12,
                          paddingLeft: CARD_PADDING + 52,
                          paddingRight: CARD_PADDING,
                          minHeight: 52,
                          borderTopWidth: 1,
                          borderTopColor: palette.divider,
                          backgroundColor: palette.surface,
                        }}
                      >
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>
                          {sub.subLabel}
                        </Text>
                        <Text
                          style={{
                            fontSize: HOME_TEXT.bodySmall,
                            fontWeight: FONT_WEIGHT.medium,
                            color: category.familyKey === 'in'
                              ? palette.numberPositive
                              : category.familyKey === 'out'
                                ? palette.numberNegative
                                : sub.total >= 0 ? palette.numberPositive : palette.numberNegative,
                            marginRight: 10
                          }}
                        >
                          {familyAwareCurrency(category.familyKey, sub.total, currencySymbol)}
                        </Text>
                        <AppChevron direction="right" size={16} tone="secondary" palette={palette} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    ));
  };


  const drilldownTransactions = useMemo(() => {
    if (!activeActivityCategory) return [];
    const { parentKey, subKey, compactLabel } = activeActivityCategory;

    return periodTransactions.filter((tx) => {
      if (compactLabel) {
        if (parentKey === 'type:loan') return tx.type === 'loan';
        if (parentKey === 'type:transfer') return !!tx.transferPairId || tx.type === 'transfer';
        if (parentKey === 'type:deposit') return tx.type === 'deposit';
      }

      if (subKey) {
        return tx.categoryId === subKey;
      }
      const category = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
      return tx.categoryId === parentKey || (category && category.parentId === parentKey);
    });
  }, [periodTransactions, activeActivityCategory, categoriesById]);

  const filteredBarTransactions = useMemo(() => {
    if (!selectedBarBucket) return periodTransactions;
    const { from: bucketFrom, to: bucketTo } = selectedBarBucket;
    if (!bucketFrom || !bucketTo) return periodTransactions;

    const fromTime = new Date(bucketFrom).getTime();
    const toTime = new Date(bucketTo).getTime();

    return periodTransactions.filter((tx) => {
      const txTime = new Date(tx.date).getTime();
      return txTime >= fromTime && txTime <= toTime;
    });
  }, [periodTransactions, selectedBarBucket]);

  const sentinelRef = useRef<View>(null);

  // NOTE: We used to drive infinite scroll with a setInterval(350ms) polling
  // `measureInWindow`. That ran forever while V2 was on screen, waking the JS
  // thread + crossing the native bridge every 350ms — a major contributor to
  // the V2 "feels slow" feedback. The list is `DateGroupedTransactionList`
  // (a plain non-virtualized map), so the polling was duplicating work React
  // Native's own scrolling already provides. We now render up to `visibleLimit`
  // rows up front. If you regularly exceed this, the right fix is to swap to
  // the virtualized sheet list variant (FlashList-backed) instead of polling.

  // Duplicate state variables hoisted to top are removed.

  const handleSheetScroll = (offsetY: number) => {
    if (isScrollingToTopRef.current) {
      if (offsetY <= 0) {
        isScrollingToTopRef.current = false;
      }
      return;
    }
    const next = offsetY > 240;
    if (next !== lastShowSheetTopRef.current) {
      lastShowSheetTopRef.current = next;
      setShowSheetScrollTop(next);
    }
  };

  const scrollSheetToTop = () => {
    isScrollingToTopRef.current = true;
    sheetListRef.current?.scrollToOffset({ offset: 0, animated: true });
    lastShowSheetTopRef.current = false;
    setShowSheetScrollTop(false);
  };

  const chartTheme = useMemo(() => ({
    brand: palette.brand,
    card: palette.card,
    surface: palette.layers.chartWell,
    inputBg: palette.layers.insightsInputBg,
    progressTrack: palette.states.progressTrack,
    border: palette.lines.chartBorder,
    text: palette.text,
    // Slightly darker than the global textMuted — used by chart axis labels.
    muted: palette.textSecondary,
    textMuted: palette.textMuted,
    accent: palette.brand,
    positive: palette.numberPositive,
    negative: palette.numberNegative,
  }), [palette]);

  // Derived ranges and granularities for the bar chart
  const localDateRange = useMemo(() => {
    if (period === 'custom') {
      return { from: from || toLocalDayStartISO(new Date()), to: to || toLocalDayEndISO(new Date()) };
    }
    const apiPeriod = period === 'today' ? 'day' : period;
    if (apiPeriod === 'day' || apiPeriod === 'week' || apiPeriod === 'month' || apiPeriod === 'year') {
      return getNavigableDateRange(apiPeriod, periodOffset, settingsYearStart);
    }
    return { from: from || toLocalDayStartISO(new Date()), to: to || toLocalDayEndISO(new Date()) };
  }, [period, periodOffset, from, to, settingsYearStart]);

  const { availableGranularities, autoBucketType } = useMemo(() => {
    const spanDays = Math.round(
      (new Date(localDateRange.to).getTime() - new Date(localDateRange.from).getTime()) / 86400000,
    );
    return {
      availableGranularities: getAvailableGranularities(period ?? 'today', spanDays),
      autoBucketType: getAutoBucketType(period ?? 'today', spanDays),
    };
  }, [period, localDateRange]);

  useEffect(() => {
    if (selectedChartCategoryId !== null) return;
    setChartResetNonce((n) => n + 1);
  }, [selectedChartCategoryId]);

  useEffect(() => {
    setSelectedChartCategoryId(null);
    setChartMode('expense');
    setIncExpGranularity('auto');
  }, [period, localDateRange.from, localDateRange.to]);

  useEffect(() => {
    setVisibleLimit(500);
  }, [activeTab, period, localDateRange.from, localDateRange.to, selectedChartCategoryId, selectedBarBucket]);

  // ── Transactions fetch ───────────────────────────────────────────────────
  // Only fetches `periodTransactions`. The bar-chart `incomeExpenseData` is
  // a *separate* effect below that only fires when the user actually opens
  // the Trends tab — V1 doesn't fetch bucket data on open, V2 shouldn't either.
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    const accountFilter = accountId === 'all' ? undefined : accountId;
    const canUseInitial = periodOffset === 0 && initialTransactions != null;

    // Fast path: parent already has transactions. Paint them synchronously —
    // no loading flash, no InteractionManager wait, parity with V1.
    if (canUseInitial) {
      setPeriodTransactions(initialTransactions!);
      return;
    }

    // Slow path: user navigated to a non-current period via the arrows.
    // Parent has no data for this range — fetch ourselves, behind the
    // screen-transition guard so the slide-in animation stays smooth.
    setIsLoading(true);
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const scoped = localDateRange.from && localDateRange.to
          ? await getTransactions({
              accountId: accountFilter,
              fromDate: localDateRange.from,
              toDate: localDateRange.to,
            })
          : [];
        if (active) setPeriodTransactions(scoped);
      } catch (err) {
        console.error('Error fetching transactions for V2:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    });
    return () => {
      active = false;
      task.cancel();
    };
  }, [accountId, localDateRange.from, localDateRange.to, periodOffset, initialTransactions]);

  // ── Bar-chart bucket data — only fetched when the Trends tab opens ──────
  // Previously fired on every mount, costing a DB round-trip the user might
  // never see (Activity is the default tab). Now: fetch on first switch to
  // 'bar', refetch only when the actual chart inputs change.
  // Tracks whether the bar-chart fetch has run at least once. Available for
  // future "show stale data vs. spinner" decisions; currently unused at read
  // time but kept so callers can introspect.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_didFetchIncExp, setDidFetchIncExp] = useState(false);
  useEffect(() => {
    if (activeTab !== 'bar') return;
    if (!localDateRange.from || !localDateRange.to) return;
    let active = true;
    const accountFilter = accountId === 'all' ? undefined : accountId;
    const isTotal = !!isCashflowView;
    const buckets = getTimeBuckets(period ?? 'today', localDateRange.from, localDateRange.to, incExpGranularity);
    (async () => {
      try {
        const incExp = await getIncomeExpenseByBuckets(
          buckets,
          localDateRange.from,
          localDateRange.to,
          accountFilter,
          { includeTransfers: isTotal, includeLoans: isTotal, includeDeposits: isTotal },
        );
        if (active) {
          setIncomeExpenseData(incExp);
          setDidFetchIncExp(true);
        }
      } catch (err) {
        console.error('Error fetching bucket data for V2 Trends tab:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeTab, accountId, localDateRange.from, localDateRange.to, period, incExpGranularity, isCashflowView, tweenTrigger]);

  // ── Tick chart animation (duplicated from AccountSummaryCard) ──
  const localCashflowSummary = useMemo(() => {
    return getCashflowFromList(
      periodTransactions,
      accountId !== 'all', // includeTransfers
      true, // includeLoans
      true, // includeDeposits
    );
  }, [periodTransactions, accountId]);

  const localIncomeExpense = useMemo(() => {
    let income = 0, expense = 0;
    periodTransactions.forEach((tx) => {
      const impact = getTransactionCashflowImpact(tx, { includeLoans: false, includeDeposits: false });
      if (impact === 'in') income += tx.amount;
      else if (impact === 'out') expense += tx.amount;
    });
    return { income, expense };
  }, [periodTransactions]);

  const isCashflow = !!isCashflowView;
  const tickIn = isCashflow ? (localCashflowSummary.in) : (localIncomeExpense.income);
  const tickOut = isCashflow ? (localCashflowSummary.out) : (localIncomeExpense.expense);
  const totalTick = tickIn + tickOut;
  const incomeFraction = totalTick > 0 ? tickIn / totalTick : 0.5;
  const animatedIncomeFraction = useSharedValue(incomeFraction);
  // Always start at 0 so the entrance animation plays even when periodTransactions
  // is seeded from initialTransactions on mount (which would otherwise initialize
  // this at 1 and skip the sweep). The effect below animates this to 1 once data
  // is present, matching V1's behavior where data arrived async and triggered
  // the animation naturally.
  const tickActivityProgress = useSharedValue(0);
  const prevTotalTickRef = useRef(totalTick);

  useEffect(() => {
    if (totalTick > 0) {
      if (prevTotalTickRef.current === 0) {
        animatedIncomeFraction.value = incomeFraction;
      } else {
        animatedIncomeFraction.value = withSpring(incomeFraction, { damping: 26, stiffness: 180, mass: 0.9, overshootClamping: true });
      }
    }
    tickActivityProgress.value = withTiming(totalTick > 0 ? 1 : 0, { duration: 250 });
    prevTotalTickRef.current = totalTick;
  }, [tickIn, tickOut, incomeFraction, totalTick, animatedIncomeFraction, tickActivityProgress]);

  const tickTotal = tickGeom.total;
  const tickRemainder = tickGeom.remainder;
  const incomeTickOverlayStyle = useAnimatedStyle(() => {
    const progress = tickActivityProgress.value;
    const fraction = animatedIncomeFraction.value;
    const greenTicksCount = Math.round(fraction * tickTotal);
    const currentGreenTicks = greenTicksCount * progress;
    const width = currentGreenTicks > 0
      ? currentGreenTicks * TICK_W + (currentGreenTicks - 1) * TICK_GAP
      : 0;
    return { width: Math.max(0, width) };
  });
  const expenseTickOverlayStyle = useAnimatedStyle(() => {
    const progress = tickActivityProgress.value;
    const fraction = animatedIncomeFraction.value;
    const greenTicksCount = Math.round(fraction * tickTotal);
    const redTicksCount = tickTotal - greenTicksCount;
    const currentRedTicks = redTicksCount * progress;
    const width = currentRedTicks > 0
      ? currentRedTicks * TICK_W + (currentRedTicks - 1) * TICK_GAP
      : 0;
    return { width: Math.max(0, width), right: tickRemainder };
  });

  // Cashflow help-text expand.
  const cashflowNoteProgress = useSharedValue(isCashflowView ? 1 : 0);
  useEffect(() => {
    cashflowNoteProgress.value = withTiming(isCashflowView ? 1 : 0, { duration: 220 });
  }, [isCashflowView, cashflowNoteProgress]);
  const cashflowNoteStyle = useAnimatedStyle(() => ({
    height: cashflowNoteProgress.value * CASHFLOW_NOTE_H,
    opacity: cashflowNoteProgress.value,
    overflow: 'hidden',
  }));

  // Income / expense values + their slide-on-change springs.
  const metricLeftAmount = tickIn;
  const metricRightAmount = tickOut;
  const { leftSpringStyle, rightSpringStyle } = useMetricSprings(tweenTrigger, metricLeftAmount, metricRightAmount);

  const periodOptions = PERIODS.map((item) => ({ key: item, label: PERIOD_LABELS[item] }));
  const activeTabOption = TAB_OPTIONS.find((o) => o.key === activeTab) || TAB_OPTIONS[0];

  return (
    <View>
      {/* ── Card 1: gradient hero (icon + name + balance) + trend chart ── */}
      <V2GradientHero
        accountName={accountName}
        balance={balance}
        currencySymbol={currencySymbol}
        palette={palette}
        accountType={accountType}
        hideAmounts={hideAmounts}
        trendChart={trendChart}
        activeTrendPoint={activeTrendPoint}
      />

      {/* ── Card 2: period chips + cashflow + ticks + income/expense ── */}
      {/* Gap matches the old layout (spacer 20px + TrendLineChart marginTop 20px ≈ 40px)
          so the visual rhythm between the hero and the period section is identical. */}
      <View
        style={{
          marginTop: V2_SPACING.cardGap,
          borderRadius: HOME_RADIUS.card,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: v2c.cardBorder,
          backgroundColor: palette.card,
          ...v2c.cardElevation,
        }}
      >
        <View
          style={{
            paddingHorizontal: V2_SPACING.cardPaddingX,
            paddingTop: V2_SPACING.cardPaddingTop,
            paddingBottom: V2_SPACING.cardPaddingBottom,
          }}
        >
          {/* Period pills */}
          <View style={{ marginBottom: 6 }}>
            {period && onPeriodChange && (
              <SegmentedPillSwitch
                options={periodOptions}
                value={period}
                onChange={(key) => {
                  const nextPeriod = key as HomePeriodType;
                  if (nextPeriod === 'custom') { onOpenCustomRange?.(); return; }
                  if (nextPeriod === period) {
                    setPeriodOffset(0);
                  }
                  onPeriodChange(nextPeriod);
                }}
                backgroundColor={v2c.pillTrackBg}
                pillColor={v2c.pillThumbBg}
                borderColor={v2c.pillBorder}
                activeTextColor={palette.text}
                inactiveTextColor={palette.textMuted}
                height={32}
                radius={14}
                fontSize={10.5}
                itemMinWidth={54}
                style={{ alignSelf: 'stretch' }}
              />
            )}
          </View>

          {/* Date range selector with arrow navigation */}
          {localDateRange.from && localDateRange.to && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 34,
                marginBottom: 6,
              }}
            >
              <TouchableOpacity
                onPress={goPrev}
                disabled={period === 'custom'}
                activeOpacity={0.7}
              >
                <AppChevron
                  direction="left"
                  size={18}
                  tone={period === 'custom' ? 'subtle' : 'primary'}
                  palette={palette}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (period === 'custom' && onOpenCustomRange) {
                    onOpenCustomRange();
                  }
                }}
                disabled={period !== 'custom'}
                activeOpacity={0.7}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
              >
                <Text style={{ fontSize: 13, fontWeight: FONT_WEIGHT.medium, color: palette.text, letterSpacing: 0.1 }}>
                  {formatDate(localDateRange.from)}
                  {period !== 'today' && ` – ${formatDate(localDateRange.to)}`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={goNext}
                disabled={!canGoNext}
                activeOpacity={0.7}
              >
                <AppChevron
                  direction="right"
                  size={18}
                  tone={canGoNext ? 'primary' : 'subtle'}
                  palette={palette}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Metrics & Ticks Column */}
          <View style={{ gap: 6, marginTop: 0 }}>
            {/* Tick chart — speedometer sweep */}
            <View style={{ flexDirection: 'row', gap: TICK_GAP, marginBottom: 2, width: tickGeom.containerW }}>
              {Array.from({ length: tickGeom.total }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: TICK_W,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: v2c.tickEmptyBg,
                  }}
                />
              ))}
              <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: 12, overflow: 'hidden' }, incomeTickOverlayStyle]}>
                <View style={{ flexDirection: 'row', gap: TICK_GAP, width: tickGeom.contentW }}>
                  {Array.from({ length: tickGeom.total }).map((_, i) => (
                    <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.chartIncome }} />
                  ))}
                </View>
              </Animated.View>
              <Animated.View style={[{ position: 'absolute', top: 0, height: 12, overflow: 'hidden' }, expenseTickOverlayStyle]}>
                <View style={{ position: 'absolute', right: 0, flexDirection: 'row', gap: TICK_GAP, width: tickGeom.contentW }}>
                  {Array.from({ length: tickGeom.total }).map((_, i) => (
                    <View key={i} style={{ width: TICK_W, height: 12, borderRadius: 2, backgroundColor: palette.chartExpense }} />
                  ))}
                </View>
              </Animated.View>
            </View>

            {/* Income / Expense values */}
            {(() => {
              const leftSplit = splitTickAmount(metricLeftAmount);
              const rightSplit = splitTickAmount(metricRightAmount);
              const leftIsZero = metricLeftAmount === 0;
              const rightIsZero = metricRightAmount === 0;
              const leftSign = metricLeftAmount < 0 ? '-' : '';
              const rightSign = metricRightAmount < 0 ? '-' : '';
              return (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 4 }}>
                  <TouchableOpacity delayPressIn={0} activeOpacity={0.75} onPress={onPressMetricIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <AppIcon name="arrow-down-left" size={15} color={leftIsZero ? palette.textMuted : palette.positive} strokeWidth={2.2} />
                    <Animated.View style={leftSpringStyle}>
                      <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.semibold, color: leftIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }}>
                        {hideAmounts ? '••••' : leftIsZero ? '—' : (
                          <Text>{leftSign}{leftSplit.int}{leftSplit.dec ? <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{leftSplit.dec}</Text> : null}</Text>
                        )}
                      </Text>
                    </Animated.View>
                  </TouchableOpacity>
                  <TouchableOpacity delayPressIn={0} activeOpacity={0.75} onPress={onPressMetricOut} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Animated.View style={rightSpringStyle}>
                      <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.semibold, color: rightIsZero ? palette.textMuted : palette.text, letterSpacing: -0.4 }}>
                        {hideAmounts ? '••••' : rightIsZero ? '—' : (
                          <Text>{rightSign}{rightSplit.int}{rightSplit.dec ? <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>{rightSplit.dec}</Text> : null}</Text>
                        )}
                      </Text>
                    </Animated.View>
                    <AppIcon name="arrow-up-right" size={15} color={rightIsZero ? palette.textMuted : palette.negative} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>

          {/* Cashflow toggle (left-aligned) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginTop: 10 }}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => onToggleCashflowView?.(!isCashflowView)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
            >
              <Text style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted }}>
                Cashflow
              </Text>
              <AppSwitch
                value={!!isCashflowView}
                onValueChange={(val) => onToggleCashflowView?.(val)}
                palette={palette}
                width={36}
                height={20}
                thumbSize={14}
              />
            </TouchableOpacity>
          </View>

          {/* Cashflow note — expands when toggle is on */}
          <Animated.View style={cashflowNoteStyle}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 10 }}>
              <AppIcon name="info" size={11} color={palette.textMuted} strokeWidth={1.8} />
              <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, letterSpacing: 0.1 }}>
                {HELP_TEXTS.cashflowNote}
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Tab Content Display - Laid out directly on the screen background.
          Deferred mount: `card3Ready` is set true after the screen slide-in
          animation completes (see useEffect above). Until then we render a
          minimum-height placeholder so the scroll layout doesn't jump. */}
      {!card3Ready && (
        <View style={{ minHeight: 320, paddingTop: 34 }} />
      )}
      {card3Ready && <View
        style={{
          paddingTop: 34,
          paddingBottom: 24,
        }}
      >
        {/* Tab Header Row: Switcher (left) and View Toggle (right) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 0 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => startTransition(() => setIsViewModeSheetOpen(true))}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: v2c.activitySegmentBg,
              borderColor: v2c.activitySegmentBorder,
              borderWidth: 1,
              paddingHorizontal: 12,
              height: 35,
              borderRadius: 18,
              gap: 8,
            }}
          >
            <AppIcon name={activeTabOption.icon} size={15} color={palette.text} />
            <Text style={{ fontSize: HOME_TEXT.bodySmall - 0.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
              {activeTabOption.label}
            </Text>
            <AppChevron direction="down" size={13} tone="primary" palette={palette} />
          </TouchableOpacity>
          {activeTab !== 'donut' && (
            <ActivityViewModeToggle
              mode={activityViewMode}
              palette={palette}
              onChange={(mode) => {
                setActivityViewMode(mode);
                if (mode === 'date') {
                  setExpandedCategoryIds((prev) => (prev.length > 0 ? [] : prev));
                }
              }}
            />
          )}
        </View>

        {activeTab === 'activity' && (
          <View style={{ minHeight: 100, paddingBottom: 16 }}>
            {activeActivityCategory ? (
              <>
                <View style={{ marginBottom: 14 }}>
                  <TouchableOpacity
                    delayPressIn={0}
                    onPress={() => {
                      setActiveActivityCategory(null);
                      setVisibleLimit(500);
                    }}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <AppChevron direction="left" size={16} tone="secondary" palette={palette} />
                    <Text style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
                      {activeActivityCategory.compactLabel
                        ? activeActivityCategory.parentLabel
                        : `${activeActivityCategory.parentLabel} \u203a ${activeActivityCategory.subLabel}`}
                    </Text>
                  </TouchableOpacity>
                </View>
                <DateGroupedTransactionList
                  transactions={drilldownTransactions.slice(0, visibleLimit)}
                  palette={palette}
                  sym={currencySymbol}
                  categoriesById={categoriesById}
                  accountsById={accountsById}
                  loansById={loansById}
                  depositsById={depositsById}
                  tagNamesById={tagNamesById}
                  getCategoryFullDisplayName={getCategoryFullDisplayName}
                  onTransactionPress={onTransactionPress}
                  emptyText="No transactions in this category"
                />
              </>
            ) : (
              <View>
                {activityViewMode === 'date' ? (
                  <DateGroupedTransactionList
                    transactions={periodTransactions.slice(0, visibleLimit)}
                    palette={palette}
                    sym={currencySymbol}
                    categoriesById={categoriesById}
                    accountsById={accountsById}
                    loansById={loansById}
                    depositsById={depositsById}
                    tagNamesById={tagNamesById}
                    getCategoryFullDisplayName={getCategoryFullDisplayName}
                    onTransactionPress={onTransactionPress}
                    emptyText="No transactions yet"
                  />
                ) : (
                  renderCategorySections(getHierarchySections(periodTransactions))
                )}
              </View>
            )}
          </View>
        )}

        {activeTab === 'donut' && (
          <View style={{ minHeight: 200, paddingBottom: 16 }}>
            <View
              style={{
                backgroundColor: palette.card,
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: HOME_RADIUS.card,
                paddingTop: 12,
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <CategoryDonutChartBlock
                transactions={periodTransactions}
                categoriesById={categoriesById}
                sym={currencySymbol}
                listPalette={palette}
                getCategoryFullDisplayName={getCategoryFullDisplayName}
                theme={chartTheme}
                mode={chartMode}
                onModeChange={setChartMode}
                selectedCategoryId={selectedChartCategoryId}
                onCategorySelect={setSelectedChartCategoryId}
                resetTrigger={`${period}:${localDateRange.from}:${localDateRange.to}:${chartResetNonce}`}
                accountsById={accountsById}
                loansById={loansById}
                onTransactionPress={onTransactionPress}
                isCashflowMode={!!isCashflowView}
                onSelectedTransactionsChange={setSelectedDonutTransactions}
              />
            </View>
            {activeActivityCategory ? (
              <>
                <View style={{ marginBottom: 14 }}>
                  <TouchableOpacity
                    delayPressIn={0}
                    onPress={() => {
                      setActiveActivityCategory(null);
                      setVisibleLimit(500);
                    }}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <AppChevron direction="left" size={16} tone="secondary" palette={palette} />
                    <Text style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
                      {activeActivityCategory.compactLabel
                        ? activeActivityCategory.parentLabel
                        : `${activeActivityCategory.parentLabel} \u203a ${activeActivityCategory.subLabel}`}
                    </Text>
                  </TouchableOpacity>
                </View>
                <DateGroupedTransactionList
                  transactions={drilldownTransactions.slice(0, visibleLimit)}
                  palette={palette}
                  sym={currencySymbol}
                  categoriesById={categoriesById}
                  accountsById={accountsById}
                  loansById={loansById}
                  depositsById={depositsById}
                  tagNamesById={tagNamesById}
                  getCategoryFullDisplayName={getCategoryFullDisplayName}
                  onTransactionPress={onTransactionPress}
                  emptyText="No transactions in this category"
                />
              </>
            ) : (
              <DateGroupedTransactionList
                transactions={selectedDonutTransactions.slice(0, visibleLimit)}
                palette={palette}
                sym={currencySymbol}
                categoriesById={categoriesById}
                accountsById={accountsById}
                loansById={loansById}
                depositsById={depositsById}
                tagNamesById={tagNamesById}
                getCategoryFullDisplayName={getCategoryFullDisplayName}
                onTransactionPress={onTransactionPress}
                emptyText="No transactions"
              />
            )}
          </View>
        )}

        {activeTab === 'bar' && (
          <View style={{ minHeight: 200, paddingBottom: 16 }}>
            <View style={{ marginBottom: 16 }}>
              <IncomeExpenseChart
                data={incomeExpenseData}
                palette={palette}
                sym={currencySymbol}
                period={period}
                title={isCashflowView ? 'Inflow vs Outflow' : 'Income vs Expense'}
                subtitle={`(${PERIOD_LABELS[period ?? 'today']})`}
                granularity={incExpGranularity}
                onGranularityChange={setIncExpGranularity}
                availableGranularities={availableGranularities}
                autoBucketType={autoBucketType}
                isLoading={isLoading}
                isCashflowMode={!!isCashflowView}
                onBucketPress={setSelectedBarBucket}
              />
            </View>
            {activeActivityCategory ? (
              <>
                <View style={{ marginBottom: 14 }}>
                  <TouchableOpacity
                    delayPressIn={0}
                    onPress={() => {
                      setActiveActivityCategory(null);
                      setVisibleLimit(500);
                    }}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <AppChevron direction="left" size={16} tone="secondary" palette={palette} />
                    <Text style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
                      {activeActivityCategory.compactLabel
                        ? activeActivityCategory.parentLabel
                        : `${activeActivityCategory.parentLabel} \u203a ${activeActivityCategory.subLabel}`}
                    </Text>
                  </TouchableOpacity>
                </View>
                <DateGroupedTransactionList
                  transactions={drilldownTransactions.slice(0, visibleLimit)}
                  palette={palette}
                  sym={currencySymbol}
                  categoriesById={categoriesById}
                  accountsById={accountsById}
                  loansById={loansById}
                  depositsById={depositsById}
                  tagNamesById={tagNamesById}
                  getCategoryFullDisplayName={getCategoryFullDisplayName}
                  onTransactionPress={onTransactionPress}
                  emptyText="No transactions in this category"
                />
              </>
            ) : (
              <>
                {activityViewMode === 'date' ? (
                  <DateGroupedTransactionList
                    transactions={filteredBarTransactions.slice(0, visibleLimit)}
                    palette={palette}
                    sym={currencySymbol}
                    categoriesById={categoriesById}
                    accountsById={accountsById}
                    loansById={loansById}
                    depositsById={depositsById}
                    tagNamesById={tagNamesById}
                    getCategoryFullDisplayName={getCategoryFullDisplayName}
                    onTransactionPress={onTransactionPress}
                    emptyText="No transactions"
                  />
                ) : (
                  renderCategorySections(getHierarchySections(filteredBarTransactions))
                )}
              </>
            )}
          </View>
        )}
      </View>}

      {/* Expanded Chart BottomSheet */}
      {/* Sentinel for progressive loading (infinite scroll) */}
      <View ref={sentinelRef} style={{ height: 1, backgroundColor: 'transparent' }} />
      {
        expandedChartState ? (
          <BottomSheet
            title="Category Breakdown"
            palette={palette}
            backgroundColor={palette.background}
            disableShadow
            onClose={() => {
              setExpandedChartState(null);
              setExpandedSheetTxs([]);
            }}
            maxHeightRatio={BOTTOM_SHEET_TOKENS.insightsMaxHeight}
            fixedHeightRatio={BOTTOM_SHEET_TOKENS.insightsMaxHeight}
            hasNavBar
            bareContent
            titleRight={<SheetScrollTopButton visible={showSheetScrollTop} onPress={scrollSheetToTop} palette={palette} />}
          >
            <DateGroupedTransactionSheetList
              transactions={expandedSheetTxs}
              palette={palette}
              sym={currencySymbol}
              categoriesById={categoriesById}
              accountsById={accountsById}
              loansById={loansById}
              tagNamesById={tagNamesById}
              getCategoryFullDisplayName={getCategoryFullDisplayName}
              onTransactionPress={onTransactionPress}
              emptyText="No transactions"
              contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 24 }}
              listRef={sheetListRef}
              onScrollSettle={handleSheetScroll}
              ListHeaderComponent={
                <View style={{ backgroundColor: palette.card, borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, overflow: 'hidden' }}>
                  <CategoryDonutChartBlock
                    transactions={expandedChartState.transactions}
                    categoriesById={categoriesById}
                    sym={currencySymbol}
                    listPalette={palette}
                    getCategoryFullDisplayName={getCategoryFullDisplayName}
                    theme={chartTheme}
                    expanded
                    disableScroll
                    externalTransactions
                    onSelectedTransactionsChange={setExpandedSheetTxs}
                    initialMode={expandedChartState.mode}
                    resetTrigger={expandedChartState.resetTrigger}
                    accountsById={accountsById}
                    loansById={loansById}
                    onTransactionPress={onTransactionPress}
                    isCashflowMode={!!isCashflowView}
                  />
                </View>
              }
            />
          </BottomSheet>
        ) : null
      }

      {isViewModeSheetOpen && (
        <BottomSheet
          title="View Mode"
          palette={palette}
          onClose={() => setIsViewModeSheetOpen(false)}
          maxHeightRatio={0.45}
        >
          {TAB_OPTIONS.map((option, index) => (
            <ChoiceRow
              key={option.key}
              title={option.label}
              selected={option.key === activeTab}
              palette={palette}
              onPress={() => {
                setActiveTab(option.key as 'activity' | 'donut' | 'bar');
                setActivityViewMode((prev) => (prev !== 'date' ? 'date' : prev));
                setExpandedCategoryIds((prev) => (prev.length > 0 ? [] : prev));
                setIsViewModeSheetOpen(false);
              }}
              leftElement={
                <AppIcon
                  name={option.icon}
                  size={20}
                  color={option.key === activeTab ? palette.brand : palette.textMuted}
                />
              }
              noBorder={index === TAB_OPTIONS.length - 1}
            />
          ))}
        </BottomSheet>
      )}
    </View >
  );
}
