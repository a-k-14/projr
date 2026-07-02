import { HeaderMoreButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/AppText';
import { ActionStrip } from '../../components/ui/ActionStrip';
import { getCompactScrollableBottomPadding, SystemBottomGuard } from '@/components/ui/safeBottom';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  View,
  InteractionManager,
  StyleSheet
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { AppIcon } from '@/components/ui/AppIcon';
import { ActionChip } from '../../components/ui/AppButton';
import { AppConfirmDialog } from '../../components/ui/AppConfirmDialog';
import { TransactionListItem } from '../../components/TransactionListItem';

const AnimatedPath = Animated.createAnimatedComponent(Path);

function semiArcLength(r: number) {
  return Math.PI * r;
}

function SemiGauge({ size, strokeWidth, percent, color, trackColor }: {
  size: number;
  strokeWidth: number;
  percent: number;
  color: string;
  trackColor: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const arcLen = semiArcLength(r);
  const pathD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const progress = useSharedValue(0);
  const clamped = Math.min(Math.max(percent, 0), 100);

  useEffect(() => {
    let timer: any;
    const task = InteractionManager.runAfterInteractions(() => {
      // Small timeout to ensure visual smoothness after slide transition settles
      timer = setTimeout(() => {
        progress.value = withTiming(clamped / 100, {
          duration: 900,
          easing: Easing.out(Easing.cubic),
        });
      }, 120);
    });
    return () => {
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [clamped, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLen * (1 - progress.value),
  }));

  const viewH = size / 2 + strokeWidth / 2 + 2;

  return (
    <View style={{ width: size, height: viewH, overflow: 'hidden' }}>
      <Svg width={size} height={size}>
        <Path
          d={pathD}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedPath
          d={pathD}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={arcLen}
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}

function SecondaryStat({
  label,
  value,
  labelColor,
  valueColor,
}: {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 9.5, fontWeight: FONT_WEIGHT.semibold, color: labelColor, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: valueColor, marginTop: 3 }}>
        {value}
      </Text>
    </View>
  );
}

function getRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pillState(palette: any, hasBudgetSet: boolean, isOver: boolean, overBudgetCount: number) {
  if (!hasBudgetSet) return null;
  const color = isOver ? palette.negative : palette.positive;
  const opacityBg = palette.isDark ? 0.15 : 0.08;
  const opacityBorder = palette.isDark ? 0.4 : 0.3;

  return {
    label: isOver ? (overBudgetCount > 1 ? `${overBudgetCount} Overspent` : 'Overspent') : 'On Track',
    bg: getRgba(color, opacityBg),
    text: color,
    border: getRgba(color, opacityBorder),
  };
}
import { getCategoryDisplayIcon } from '../../lib/category-utils';
import { isEmojiIcon } from '../../lib/ui-format';
import { getRelativeDateLabel, toLocalDateKey } from '../../lib/dateUtils';
import { formatCurrency } from '../../lib/derived';
import { SCREEN_GUTTER, FONT_WEIGHT } from '../../lib/design';
import {
  ACTIVITY_LAYOUT,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_TEXT,
} from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { useBudgetStore } from '../../stores/useBudgetStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useUIStore } from '../../stores/useUIStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { getBudgetTransactions } from '../../services/budget';
import type { Transaction } from '../../types';

export default function BudgetDetailScreen() {
  const { id, month } = useLocalSearchParams<{ id: string; month: string }>();
  const insets = useSafeAreaInsets();
  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);
  const budgetsLoaded = useBudgetStore((s) => s.isLoaded);
  const removeBudget = useBudgetStore((s) => s.remove);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const categories = useCategoriesStore((s) => s.categories);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accounts = useAccountsStore((s) => s.accounts);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const mutationVersion = useTransactionsStore((s) => s.mutationVersion);

  const [txns, setTxns] = useState<Transaction[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const panelProgress = useSharedValue(0);

  const toggleActions = () => {
    const nextShow = !showActions;
    setShowActions(nextShow);
    panelProgress.value = withTiming(nextShow ? 1 : 0, { duration: 220 });
  };
  const closePanel = () => {
    setShowActions(false);
    panelProgress.value = withTiming(0, { duration: 220 });
  };

  const actionsAnimatedStyle = useAnimatedStyle(() => ({
    height: panelProgress.value * 56,
    opacity: panelProgress.value,
  }));

  const handleTransactionPress = useCallback((tx: Transaction) => {
    router.push({ pathname: '/modals/add-transaction', params: { editId: tx.id } });
  }, []);

  const budget = budgets.find((b) => b.id === id);

  // Auto-pop when the budget vanishes from the store while we're sitting on
  // its detail screen — happens after delete (from this screen or the edit
  // form). Without this, the screen sticks on its ActivityIndicator branch.
  useEffect(() => {
    if (budgetsLoaded && !budget && router.canGoBack()) {
      router.back();
    }
  }, [budgetsLoaded, budget]);

  useEffect(() => {
    if (month) {
      const task = InteractionManager.runAfterInteractions(() => {
        loadBudgets(month).catch(() => undefined);
      });
      return () => task.cancel();
    }
  }, [month, loadBudgets, mutationVersion]);

  useEffect(() => {
    if (!budget || !month) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setTxnsLoading(true);
      getBudgetTransactions(budget.categoryId, month, budget.subCategoryIds)
        .then(setTxns)
        .catch(() => undefined)
        .finally(() => setTxnsLoading(false));
    });
    return () => task.cancel();
  }, [budget?.categoryId, budget?.subCategoryIds, month, mutationVersion]);

  if (!budget) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={palette.brand} />
      </View>
    );
  }

  const isOver = budget.amount > 0 && budget.remaining < 0;
  const parentCategory = categoriesById.get(budget.categoryId);
  const subCategoriesList = budget.subCategoryIds && budget.subCategoryIds.length > 0
    ? (budget.subCategoryIds.map((sid) => categoriesById.get(sid)?.name).filter(Boolean) as string[])
    : categories.filter(c => c.parentId === budget.categoryId).map(c => c.name);
  const isAllSubcats = !budget.subCategoryIds || budget.subCategoryIds.length === 0;

  const hasBudgetSet = budget.amount > 0;
  const clampedPercent = Math.min(Math.max(budget.percent, 0), 100);
  const ringColor = !hasBudgetSet
    ? palette.textMuted
    : isOver
      ? palette.negative // theme crimson
      : clampedPercent > 85
        ? palette.warning // theme amber
        : palette.positive; // theme emerald

  const trackColor = palette.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const pill = pillState(palette, hasBudgetSet, isOver, isOver ? 1 : 0);

  const GAUGE_SIZE = 130;
  const STROKE = 4;

  const categoryLabel = (() => {
    const category = categoriesById.get(budget.categoryId);
    if (!category) return 'Unknown';
    if (budget.subCategoryIds && budget.subCategoryIds.length > 0) {
      const subNames = budget.subCategoryIds
        .map((sid) => categoriesById.get(sid)?.name)
        .filter(Boolean)
        .join(', ');
      return `${category.name} › ${subNames}`;
    }
    return `${category.name} (All)`;
  })();

  const groups: { dateKey: string; items: Transaction[] }[] = [];
  for (const tx of txns) {
    const key = toLocalDateKey(tx.date);
    const last = groups[groups.length - 1];
    if (last?.dateKey === key) last.items.push(tx);
    else groups.push({ dateKey: key, items: [tx] });
  }
  groups.reverse();

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          header: () => (
            <View style={{ paddingTop: insets.top, backgroundColor: palette.background }}>
              <ScreenHeader
                title={categoryLabel}
                palette={palette}
                showBack={true}
                rightAction={
                  <HeaderMoreButton palette={palette} isOpen={showActions} onPress={toggleActions} />
                }
              />
            </View>
          )
        }}
      />

      <View style={{ flex: 1 }}>
        {/* Action strip */}
        <ActionStrip palette={palette} animatedStyle={actionsAnimatedStyle}>
          <ActionChip
            icon="edit-2"
            label="Edit"
            palette={palette}
            onPress={() => {
              closePanel();
              router.push({ pathname: '/modals/budget-form', params: { budgetId: budget.id } });
            }}
          />
          <ActionChip
            icon="trash-2"
            label="Delete"
            palette={palette}
            destructive
            onPress={() => { closePanel(); setShowDeleteConfirm(true); }}
          />
        </ActionStrip>

        {/* Hero card — sticky outside ScrollView */}
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: ACTIVITY_LAYOUT.headerPaddingTop }}>
          <View style={[styles.card, {
            backgroundColor: palette.card,
            borderColor: palette.borderSoft,
            marginBottom: HOME_SPACE.lg,
          }]}>
            {/* Main row: Remaining + Budgeted/Spent (Left) & Gauge (Right) */}
            <View style={styles.row}>
              {/* Left Col: details and metrics */}
              <View style={{ flex: 1, marginRight: 16, justifyContent: 'space-between', alignSelf: 'stretch' }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                      {isOver ? 'Over budget' : 'Remaining'}
                    </Text>
                  </View>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={{ fontSize: 32, fontWeight: FONT_WEIGHT.regular, color: palette.text, letterSpacing: -0.8, marginTop: 1 }}
                  >
                    {formatCurrency(Math.abs(budget.remaining), sym)}
                  </Text>
                </View>

                {/* Bottom Row: Budgeted vs Spent */}
                <View style={styles.secondaryRow}>
                  <SecondaryStat
                    label="Budgeted"
                    value={formatCurrency(budget.amount, sym)}
                    labelColor={palette.textMuted}
                    valueColor={palette.textSecondary}
                  />
                  <View style={[styles.secondaryDivider, { backgroundColor: palette.borderSoft }]} />
                  <SecondaryStat
                    label="Spent"
                    value={formatCurrency(budget.spent, sym)}
                    labelColor={palette.textMuted}
                    valueColor={palette.textSecondary}
                  />
                </View>
              </View>

              {/* Right Col: Semi-circle gauge with badge above */}
              <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                {pill ? (
                  <View style={[styles.pillInline, { backgroundColor: pill.bg, borderColor: pill.border, borderWidth: 1, paddingVertical: 1.5, paddingHorizontal: 7 }]}>
                    <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.medium, color: pill.text, letterSpacing: 0.1 }}>
                      {pill.label}
                    </Text>
                  </View>
                ) : <View />}
                <View style={{ position: 'relative', width: GAUGE_SIZE, alignItems: 'center' }}>
                  <SemiGauge
                    size={GAUGE_SIZE}
                    strokeWidth={STROKE}
                    percent={clampedPercent}
                    color={ringColor}
                    trackColor={trackColor}
                  />
                  <View style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 22, fontWeight: FONT_WEIGHT.regular, color: palette.text, letterSpacing: -0.6 }}>
                      {`${Math.round(budget.percent)}%`}
                    </Text>
                    <Text style={{ fontSize: 9.5, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 1 }}>
                      used
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Sub-info section (Category, Subcategories, Frequency) */}
            <View style={{ marginTop: HOME_SPACE.md, paddingTop: HOME_SPACE.md, borderTopWidth: 1, borderStyle: 'dashed', borderColor: palette.borderSoft }}>
              {/* Category & Subcategories Info */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ marginTop: 2 }}>
                  {(() => {
                    const icon = getCategoryDisplayIcon(categoriesById, budget.categoryId);
                    return isEmojiIcon(icon) ? (
                      <Text style={{ fontSize: 12 }}>{icon}</Text>
                    ) : (
                      <AppIcon name={(icon as any) ?? 'tag'} size={12} color={palette.textSecondary} strokeWidth={1.8} />
                    );
                  })()}
                </View>
                <Text style={{ flex: 1, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 11.5, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary }}>
                    {parentCategory?.name ?? 'Category'}
                  </Text>
                  {isAllSubcats ? (
                    <Text style={{ fontSize: HOME_TEXT.metaSmall, color: palette.textMuted }}>
                      {'  (All)'}
                    </Text>
                  ) : subCategoriesList.length > 0 && (
                    <Text style={{ fontSize: HOME_TEXT.metaSmall, color: palette.textMuted }}>
                      {' › '}{subCategoriesList.join(', ')}
                    </Text>
                  )}
                </Text>
              </View>

              {/* Frequency */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: HOME_SPACE.sm }}>
                <AppIcon name={budget.repeat ? 'repeat' : 'calendar'} size={12} color={palette.textSecondary} strokeWidth={1.8} />
                <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary }}>
                  {budget.repeat ? 'Repeats Monthly' : 'One-time Budget'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Scrollable transaction list */}
        <ScrollView
          style={{ flex: 1 }}
          onScrollBeginDrag={closePanel}
          contentContainerStyle={{ paddingBottom: getCompactScrollableBottomPadding(insets) }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
            {txnsLoading ? (
              <ActivityIndicator color={palette.brand} style={{ marginTop: HOME_SPACE.lg }} />
            ) : txns.length === 0 ? (
              <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, textAlign: 'center', paddingVertical: HOME_SPACE.xl }}>
                No transactions this month
              </Text>
            ) : (
              <View style={{ gap: HOME_SPACE.sm + 4, marginBottom: HOME_SPACE.md }}>
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
                        {items.map((tx, i) => (
                          <TransactionListItem
                            key={tx.id}
                            tx={tx}
                            sym={sym}
                            palette={palette}
                            isLast={i === items.length - 1}
                            categoryName={getCategoryFullDisplayName(tx.categoryId ?? '', ' › ')}
                            categoryIcon={getCategoryDisplayIcon(categoriesById, tx.categoryId)}
                            accountName={accountsById.get(tx.accountId)}
                            showAmountSign={false}
                            onPress={handleTransactionPress}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
      <SystemBottomGuard />
      <AppConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Budget"
        message="This budget will be removed for its covered month(s)."
        palette={palette}
        onCancel={() => setShowDeleteConfirm(false)}
        confirm={{
          label: 'Delete',
          destructive: true,
          onPress: () => {
            setShowDeleteConfirm(false);
            removeBudget(budget.id, month).catch(() => undefined);
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: HOME_RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: HOME_SPACE.lg,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 132,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: HOME_SPACE.md,
  },
  secondaryDivider: {
    width: 1,
    height: 24,
    marginHorizontal: HOME_SPACE.md,
  },
  pillInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: HOME_RADIUS.small,
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});

