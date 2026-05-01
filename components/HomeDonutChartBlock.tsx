import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { formatCurrency, getTransactionCashflowImpact } from '@/lib/derived';
import { getPrototypeCategoryColor } from '@/lib/prototypeCategoryColors';
import { HOME_TEXT } from '@/lib/layoutTokens';
import type { Category, Transaction } from '@/types';

type Mode = 'expense' | 'income';

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

const CHART_PROTO_EXPENSE_COLORS = [
  '#FF6B6B', '#4F8CFF', '#F4A62A', '#A855F7', '#15B8A6', '#334BFF', '#FF4FD8',
  '#00A7F5', '#26C281', '#FB7185', '#8B5CF6', '#F97316', '#FF8A65', '#FF5C8A',
  '#7DD56F', '#7B61FF', '#C084FC', '#38BDF8', '#5EEAD4', '#6366F1', '#FDBA74',
] as const;

const CHART_PROTO_INCOME_COLORS = [
  '#22C55E', '#2DD4BF', '#60A5FA', '#A78BFA', '#16A34A', '#84CC16',
] as const;

const UNCATEGORIZED_ICON = ':o';

function polar(cx: number, cy: number, radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function donutPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number) {
  const safeEnd = end - start >= 359.9 ? start + 359.9 : end;
  const large = safeEnd - start > 180 ? 1 : 0;
  const p1 = polar(cx, cy, outer, start);
  const p2 = polar(cx, cy, outer, safeEnd);
  const p3 = polar(cx, cy, inner, safeEnd);
  const p4 = polar(cx, cy, inner, start);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

function collectIds(node: HomeNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}

function buildModeHierarchy(
  mode: Mode,
  transactions: Transaction[],
  categoriesById: Map<string, Category>,
): HomeNode[] {
  const targetImpact = mode === 'income' ? 'in' : 'out';
  const parentMap = new Map<string, HomeNode & { childMap: Map<string, HomeNode> }>();

  transactions.forEach((tx) => {
    const impact = getTransactionCashflowImpact(tx);
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

    if (category?.parentId && category.id !== parentId) {
      if (!parentNode.childMap.has(category.id)) {
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

function buildSlices(nodes: HomeNode[], transactions: Transaction[], mode: Mode): HomeSlice[] {
  const palette = mode === 'income' ? CHART_PROTO_INCOME_COLORS : CHART_PROTO_EXPENSE_COLORS;
  const raw = nodes
    .map((node) => ({ ...node, amount: sumForNode(node, transactions) }))
    .filter((node) => node.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = raw.reduce((sum, item) => sum + item.amount, 0) || 1;
  return raw.map((item, index) => ({ ...item, color: palette[index % palette.length], percent: item.amount / total }));
}

function HomeDonut({
  slices,
  selectedId,
  onSelect,
  bgHex = '#FFFFFF',
}: {
  slices: HomeSlice[];
  selectedId?: string;
  onSelect: (id: string) => void;
  bgHex?: string;
}) {
  let angle = 0;
  const cx = 150;
  const cy = 150;
  const gap = 2.2;

  return (
    <Svg width={300} height={300} viewBox="0 0 300 300">
      <G>
        {slices.map((slice) => {
          const start = angle + gap;
          const end = angle + slice.percent * 360 - gap;
          angle += slice.percent * 360;
          const active = slice.id === selectedId;
          const outer = active ? 126 : 116;
          const inner = active ? 73 : 80;
          const visiblePath = donutPath(cx, cy, outer, inner, start, Math.max(start + 1, end));
          const touchPath = donutPath(cx, cy, 143, 46, start, Math.max(start + 1, end));
          return (
            <G key={slice.id} onPress={() => onSelect(slice.id)} onPressIn={() => onSelect(slice.id)}>
              <Path d={touchPath} fill={bgHex} opacity={0.01} />
              <Path
                d={visiblePath}
                fill={slice.color}
                opacity={active ? 1 : 0.72}
                stroke={bgHex}
                strokeWidth={active ? 4 : 2}
              />
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

export function HomeDonutChartBlock({
  transactions,
  categoriesById,
  sym,
  theme,
  expanded = false,
  onExpand,
}: {
  transactions: Transaction[];
  categoriesById: Map<string, Category>;
  sym: string;
  theme: any;
  expanded?: boolean;
  onExpand?: () => void;
}) {
  const [mode, setMode] = useState<Mode>('expense');
  const [drillParentId, setDrillParentId] = useState<string | null>(null);
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);
  const hierarchy = useMemo(
    () => buildModeHierarchy(mode, transactions, categoriesById),
    [mode, transactions, categoriesById],
  );
  const parentSlices = useMemo(() => buildSlices(hierarchy, transactions, mode), [hierarchy, transactions, mode]);
  const total = useMemo(() => parentSlices.reduce((sum, s) => sum + s.amount, 0), [parentSlices]);
  const selectedParent = drillParentId ? hierarchy.find((node) => node.id === drillParentId) ?? null : null;
  const selectedParentSlice = drillParentId ? parentSlices.find((s) => s.id === drillParentId) ?? null : null;
  const selectedLeafSlice = !drillParentId && selectedSliceId
    ? parentSlices.find((s) => s.id === selectedSliceId) ?? null
    : null;
  const visibleSlices = drillParentId && selectedParent?.children?.length
    ? buildSlices(selectedParent.children, transactions, mode)
    : parentSlices;
  const isSubcategoryLevel = !!drillParentId;

  const switchMode = (next: Mode) => {
    setMode(next);
    setDrillParentId(null);
    setSelectedSliceId(null);
  };

  const goUpToParents = () => {
    setDrillParentId(null);
    setSelectedSliceId(null);
  };

  const drillToParent = (id: string) => {
    const target = hierarchy.find((node) => node.id === id);
    setSelectedSliceId(id);
    if (!target?.children?.length) return;
    setDrillParentId(id);
  };

  const selectChartSlice = (id: string) => {
    const selectedId = drillParentId || selectedSliceId;
    if (selectedId === id && drillParentId) {
      goUpToParents();
      return;
    }
    setSelectedSliceId(id);
    setDrillParentId(id);
  };

  return (
    <View style={[expanded ? styles.expandedChartContent : undefined, expanded && styles.expandedChartInner]}>
      <View style={[styles.chartTopRow, expanded && styles.chartTopRowExpanded]}>
        <View style={[styles.segmentedControl, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {([
            { key: 'income', label: 'Income' },
            { key: 'expense', label: 'Expense' },
          ] as const).map((item) => {
            const active = mode === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => switchMode(item.key)}
                style={[
                  styles.segmentedOption,
                  active && { backgroundColor: theme.inputBg, borderColor: theme.border, borderWidth: 1 },
                ]}
              >
                <Text appWeight="medium" style={[styles.switchText, { color: active ? theme.text : theme.muted, fontWeight: active ? '700' : '600' }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {expanded || !onExpand ? null : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onExpand}
            style={[styles.expandButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <AppIcon name="maximize-2" size={14} color={theme.textMuted ?? theme.muted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.chartWrap}>
        <HomeDonut slices={parentSlices} selectedId={selectedParentSlice?.id ?? selectedSliceId ?? undefined} onSelect={selectChartSlice} bgHex={theme.card} />
        <View pointerEvents="none" style={styles.centerLabel}>
          <Text style={styles.centerIcon}>{selectedParentSlice?.icon ?? selectedLeafSlice?.icon ?? '◎'}</Text>
          <Text numberOfLines={2} style={[styles.centerName, { color: theme.text }]}>
            {selectedParentSlice?.label ?? selectedLeafSlice?.label ?? 'All'}
          </Text>
          <Text style={[styles.centerAmount, { color: theme.text }]}>
            {((selectedParentSlice?.amount ?? selectedLeafSlice?.amount) ?? total) === 0
              ? '—'
              : formatCurrency((selectedParentSlice?.amount ?? selectedLeafSlice?.amount) ?? total, sym)}
          </Text>
          <Text style={[styles.centerMeta, { color: theme.muted }]}>
            {selectedParentSlice
              ? `${Math.round(selectedParentSlice.percent * 100)}% of total`
              : selectedLeafSlice
                ? `${Math.round(selectedLeafSlice.percent * 100)}% of total`
                : '100% of total'}
          </Text>
        </View>
      </View>

      <View style={[styles.breadcrumbRow, { backgroundColor: theme.surface }]}>
        <View style={styles.breadcrumbLeft}>
          {drillParentId ? (
            <>
              <TouchableOpacity onPress={goUpToParents} activeOpacity={0.8} hitSlop={{ top: 12, bottom: 12, left: 12, right: 24 }} style={styles.breadcrumbTap}>
                <Text style={[styles.breadcrumbLink, { color: theme.accent }]}>All</Text>
              </TouchableOpacity>
              <Text style={[styles.breadcrumbSep, { color: theme.muted }]}>/</Text>
              <Text style={[styles.breadcrumbCurrent, { color: theme.text }]}>{selectedParentSlice?.label}</Text>
            </>
          ) : (
            <Text style={[styles.breadcrumbCurrent, { color: theme.text }]}>All</Text>
          )}
        </View>
        <View style={[styles.breadcrumbMeta, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          <Text style={[styles.breadcrumbMetaText, { color: theme.text }]}>
            {drillParentId
              ? `${formatCurrency(selectedParentSlice?.amount ?? 0, sym)} · ${Math.round((selectedParentSlice?.percent ?? 0) * 100)}%`
              : `${formatCurrency(total, sym)} · 100%`}
          </Text>
        </View>
      </View>

      <View style={[styles.listViewport, expanded ? styles.listViewportExpanded : styles.listViewportCollapsed, styles.categoryList]}>
        {visibleSlices.map((slice) => {
          const canDrill = !drillParentId && hierarchy.find((node) => node.id === slice.id)?.children?.length;
          return (
            <TouchableOpacity
              key={slice.id}
              activeOpacity={0.82}
              onPress={() => {
                if (canDrill) drillToParent(slice.id);
                else selectChartSlice(slice.id);
              }}
              style={styles.categoryRow}
            >
              <View style={[styles.rowTopLine, isSubcategoryLevel && styles.rowTopLineWithBar]}>
                <View style={styles.rowTitleWrap}>
                  <View style={[styles.iconBadge, { backgroundColor: theme.surface }]}>
                    <Text style={styles.rowIcon}>{slice.icon}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.splitName, { color: theme.text }]}>{slice.label}</Text>
                </View>
                <View style={styles.rowAmountWrap}>
                  <Text style={[styles.splitValue, { color: theme.muted }]}>
                    {formatCurrency(slice.amount, sym)} · {Math.round(slice.percent * 100)}%
                  </Text>
                </View>
              </View>
              {isSubcategoryLevel ? (
                <View style={[styles.progressTrack, styles.progressTrackIndented, { backgroundColor: theme.progressTrack ?? theme.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: slice.color, width: `${Math.max(3, slice.percent * 100)}%` },
                    ]}
                  />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  expandedChartContent: { flex: 1 },
  expandedChartInner: { paddingBottom: 8 },
  chartTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 4, paddingHorizontal: 14, marginBottom: 2 },
  chartTopRowExpanded: { paddingTop: 8 },
  segmentedControl: { width: 136, flexDirection: 'row', borderRadius: 13, borderWidth: 1, height: 32, padding: 1.5 },
  segmentedOption: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  switchText: { fontSize: HOME_TEXT.caption, fontWeight: '600', textAlign: 'center', includeFontPadding: false },
  expandButton: { width: 34, height: 34, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chartWrap: { height: 304, alignItems: 'center', justifyContent: 'center', marginTop: -2, marginBottom: -4 },
  centerLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centerIcon: { fontSize: 24, marginBottom: 4 },
  centerName: { fontSize: 13, fontWeight: '700', textAlign: 'center', maxWidth: 108 },
  centerAmount: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  centerMeta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  breadcrumbRow: {
    marginTop: 0,
    marginHorizontal: 14,
    marginBottom: 2,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  breadcrumbLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  breadcrumbTap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  breadcrumbLink: { fontSize: 12, fontWeight: '800' },
  breadcrumbSep: { fontSize: 14, fontWeight: '900' },
  breadcrumbCurrent: { flexShrink: 1, fontSize: 12.5, fontWeight: '700' },
  breadcrumbMeta: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  breadcrumbMetaText: { fontSize: 11.5, fontWeight: '800' },
  listViewport: { width: '100%' },
  listViewportCollapsed: { maxHeight: 120 },
  listViewportExpanded: { maxHeight: 260 },
  categoryList: { paddingHorizontal: 14, gap: 4 },
  categoryRow: { gap: 4, paddingVertical: 2 },
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  rowTopLineWithBar: { marginBottom: 6 },
  rowTitleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowIcon: { fontSize: 18 },
  rowAmountWrap: { alignItems: 'flex-end', minWidth: 88 },
  splitName: { flex: 1, fontSize: 15, fontWeight: '500' },
  splitValue: { fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  progressTrackIndented: { marginLeft: 48 },
  progressFill: { height: 6, borderRadius: 999 },
});
