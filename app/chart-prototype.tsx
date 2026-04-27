import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { G, Path } from 'react-native-svg';

type Mode = 'expense' | 'income';

type Tx = {
  id: string;
  title: string;
  amount: number;
  date: string;
  account: string;
  categoryId: string;
};

type ChartNode = {
  id: string;
  label: string;
  icon: string;
  color: string;
  children?: ChartNode[];
};

type ChartSlice = ChartNode & {
  amount: number;
  percent: number;
};

const data: Record<Mode, { title: string; subtitle: string; nodes: ChartNode[]; transactions: Tx[] }> = {
  expense: {
    title: 'Expense flow',
    subtitle: 'This month',
    nodes: [
      {
        id: 'food',
        label: 'Food & Drinks',
        icon: '🍜',
        color: '#FF6B6B',
        children: [
          { id: 'coffee', label: 'Tea & Coffee', icon: '☕', color: '#FF8A65' },
          { id: 'dining', label: 'Restaurants', icon: '🍽️', color: '#FF5C8A' },
          { id: 'grocery', label: 'Groceries', icon: '🥬', color: '#7DD56F' },
        ],
      },
      {
        id: 'travel',
        label: 'Travel',
        icon: '🚕',
        color: '#4F8CFF',
        children: [
          { id: 'cab', label: 'Cab', icon: '🚕', color: '#4F8CFF' },
          { id: 'fuel', label: 'Fuel', icon: '⛽', color: '#7B61FF' },
        ],
      },
      { id: 'bills', label: 'Bills', icon: '⚡', color: '#F4A62A' },
      { id: 'shopping', label: 'Shopping', icon: '🛍️', color: '#A855F7' },
      { id: 'health', label: 'Health', icon: '💊', color: '#15B8A6' },
      { id: 'rent', label: 'Rent', icon: '🏠', color: '#334BFF' },
      {
        id: 'entertainment',
        label: 'Entertainment',
        icon: '🎬',
        color: '#FF4FD8',
        children: [
          { id: 'movies', label: 'Movies', icon: '🎬', color: '#FF4FD8' },
          { id: 'music', label: 'Music', icon: '🎧', color: '#C084FC' },
        ],
      },
      {
        id: 'education',
        label: 'Education',
        icon: '🎓',
        color: '#00A7F5',
        children: [
          { id: 'course', label: 'Courses', icon: '🎓', color: '#00A7F5' },
          { id: 'books', label: 'Books', icon: '📚', color: '#38BDF8' },
        ],
      },
      {
        id: 'fitness',
        label: 'Fitness',
        icon: '🏋️',
        color: '#26C281',
        children: [
          { id: 'gym', label: 'Gym', icon: '🏋️', color: '#26C281' },
          { id: 'sport', label: 'Sports', icon: '🏸', color: '#5EEAD4' },
        ],
      },
      { id: 'gifts', label: 'Gifts', icon: '🎁', color: '#FB7185' },
      {
        id: 'subscriptions',
        label: 'Subscriptions',
        icon: '🔁',
        color: '#8B5CF6',
        children: [
          { id: 'saas', label: 'Apps', icon: '▣', color: '#8B5CF6' },
          { id: 'streaming', label: 'Streaming', icon: '▶', color: '#6366F1' },
        ],
      },
      {
        id: 'personal',
        label: 'Personal',
        icon: '✨',
        color: '#F97316',
        children: [
          { id: 'personal-care', label: 'Care', icon: '✨', color: '#F97316' },
          { id: 'charity', label: 'Giving', icon: '♡', color: '#FDBA74' },
        ],
      },
    ],
    transactions: [
      { id: 'e1', categoryId: 'coffee', title: 'Blue Tokai', amount: 245, date: 'Apr 17, 8:03 AM', account: 'HDFC' },
      { id: 'e2', categoryId: 'coffee', title: 'Office chai', amount: 80, date: 'Apr 16, 5:20 PM', account: 'Cash' },
      { id: 'e3', categoryId: 'dining', title: 'Nasi and Mee', amount: 1420, date: 'Apr 15, 9:12 PM', account: 'Axis' },
      { id: 'e4', categoryId: 'grocery', title: 'Nature Basket', amount: 2360, date: 'Apr 14, 11:44 AM', account: 'HDFC' },
      { id: 'e5', categoryId: 'cab', title: 'Uber', amount: 690, date: 'Apr 13, 10:05 PM', account: 'Wallet' },
      { id: 'e6', categoryId: 'fuel', title: 'Shell', amount: 3200, date: 'Apr 11, 7:30 PM', account: 'Credit Card' },
      { id: 'e7', categoryId: 'bills', title: 'Electricity', amount: 4100, date: 'Apr 10, 9:00 AM', account: 'HDFC' },
      { id: 'e8', categoryId: 'shopping', title: 'Uniqlo', amount: 5200, date: 'Apr 8, 6:18 PM', account: 'Credit Card' },
      { id: 'e9', categoryId: 'health', title: 'Pharmacy', amount: 2940, date: 'Apr 7, 12:30 PM', account: 'HDFC' },
      { id: 'e10', categoryId: 'rent', title: 'Apartment rent', amount: 7800, date: 'Apr 5, 10:00 AM', account: 'HDFC' },
      { id: 'e11', categoryId: 'movies', title: 'PVR', amount: 3800, date: 'Apr 6, 8:20 PM', account: 'Credit Card' },
      { id: 'e12', categoryId: 'music', title: 'Spotify', amount: 2100, date: 'Apr 2, 7:10 AM', account: 'Credit Card' },
      { id: 'e13', categoryId: 'course', title: 'Design course', amount: 4600, date: 'Apr 9, 1:40 PM', account: 'HDFC' },
      { id: 'e14', categoryId: 'books', title: 'Kindle book', amount: 1800, date: 'Apr 12, 5:42 PM', account: 'Wallet' },
      { id: 'e15', categoryId: 'gym', title: 'Cult membership', amount: 3200, date: 'Apr 1, 6:00 AM', account: 'Credit Card' },
      { id: 'e16', categoryId: 'sport', title: 'Badminton court', amount: 1600, date: 'Apr 18, 7:30 PM', account: 'UPI' },
      { id: 'e17', categoryId: 'gifts', title: 'Birthday gift', amount: 3100, date: 'Apr 19, 2:10 PM', account: 'HDFC' },
      { id: 'e18', categoryId: 'saas', title: 'Notion', amount: 1830, date: 'Apr 20, 9:00 AM', account: 'Credit Card' },
      { id: 'e19', categoryId: 'streaming', title: 'Netflix', amount: 949, date: 'Apr 21, 9:00 AM', account: 'Credit Card' },
      { id: 'e20', categoryId: 'personal-care', title: 'Haircut', amount: 2700, date: 'Apr 22, 11:30 AM', account: 'Cash' },
      { id: 'e21', categoryId: 'charity', title: 'Donation', amount: 1500, date: 'Apr 23, 8:05 PM', account: 'UPI' },
    ],
  },
  income: {
    title: 'Income flow',
    subtitle: 'This month',
    nodes: [
      {
        id: 'salary',
        label: 'Salary',
        icon: '💼',
        color: '#22C55E',
        children: [
          { id: 'basepay', label: 'Base Pay', icon: '🏦', color: '#16A34A' },
          { id: 'bonus', label: 'Bonus', icon: '✨', color: '#84CC16' },
        ],
      },
      { id: 'freelance', label: 'Freelance', icon: '🧑‍💻', color: '#2DD4BF' },
      { id: 'interest', label: 'Interest', icon: '📈', color: '#60A5FA' },
      { id: 'refunds', label: 'Refunds', icon: '↩️', color: '#A78BFA' },
    ],
    transactions: [
      { id: 'i1', categoryId: 'basepay', title: 'April salary', amount: 142000, date: 'Apr 1, 9:00 AM', account: 'HDFC' },
      { id: 'i2', categoryId: 'bonus', title: 'Performance bonus', amount: 18000, date: 'Apr 3, 9:00 AM', account: 'HDFC' },
      { id: 'i3', categoryId: 'freelance', title: 'Design audit', amount: 26000, date: 'Apr 12, 4:15 PM', account: 'HDFC' },
      { id: 'i4', categoryId: 'interest', title: 'Savings interest', amount: 720, date: 'Apr 25, 8:00 AM', account: 'Savings' },
      { id: 'i5', categoryId: 'refunds', title: 'Amazon refund', amount: 1399, date: 'Apr 18, 2:30 PM', account: 'Credit Card' },
    ],
  },
};

function formatMoney(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function collectIds(node: ChartNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}

function sumForNode(node: ChartNode, transactions: Tx[]) {
  const ids = new Set(collectIds(node));
  return transactions.filter((tx) => ids.has(tx.categoryId)).reduce((sum, tx) => sum + tx.amount, 0);
}

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

function buildSlices(nodes: ChartNode[], transactions: Tx[]): ChartSlice[] {
  const raw = nodes
    .map((node) => ({ ...node, amount: sumForNode(node, transactions) }))
    .filter((node) => node.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = raw.reduce((sum, item) => sum + item.amount, 0) || 1;
  return raw.map((item) => ({ ...item, percent: item.amount / total }));
}

export default function ChartPrototypeScreen() {
  const theme = lightTheme;
  const [mode, setMode] = useState<Mode>('expense');
  const current = data[mode];
  const parentSlices = useMemo(
    () => buildSlices(current.nodes, current.transactions),
    [current.nodes, current.transactions],
  );
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [drillParentId, setDrillParentId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const selectedParent = selectedParentId ? current.nodes.find((node) => node.id === selectedParentId) ?? null : null;
  const selectedParentSlice = selectedParentId ? parentSlices.find((slice) => slice.id === selectedParentId) ?? null : null;
  const subSlices = useMemo(
    () => (drillParentId && selectedParent ? buildSlices(selectedParent.children ?? [], current.transactions) : []),
    [current.transactions, drillParentId, selectedParent],
  );
  const selectedSubNode = drillParentId
    ? selectedParent?.children?.find((node) => node.id === selectedSubId) ?? null
    : null;
  const selectedNode = selectedSubNode ?? (drillParentId ? selectedParent : null);
  const selectedIds = selectedNode ? new Set(collectIds(selectedNode)) : null;
  const selectedTransactions = selectedIds
    ? current.transactions.filter((tx) => selectedIds.has(tx.categoryId))
    : current.transactions;
  const total = parentSlices.reduce((sum, slice) => sum + slice.amount, 0);
  const drillToParent = (parentId: string) => {
    const target = current.nodes.find((node) => node.id === parentId);
    if (!target) return;
    setSelectedParentId(parentId);
    setDrillParentId(parentId);
    setSelectedSubId(null);
  };

  const selectSlice = (id: string) => {
    if (drillParentId && selectedParentId === id) {
      goUpToParents();
      return;
    }
    drillToParent(id);
  };

  const goUpToParents = () => {
    setDrillParentId(null);
    setSelectedSubId(null);
    setSelectedParentId(null);
  };

  const chartSelectedId = drillParentId && selectedParentSlice ? selectedParentSlice.id : undefined;

  const switchMode = (next: Mode) => {
    setMode(next);
    setSelectedParentId(null);
    setDrillParentId(null);
    setSelectedSubId(null);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.closeButton, { backgroundColor: theme.surface }]}>
            <Text style={[styles.closeText, { color: theme.text }]}>×</Text>
          </TouchableOpacity>
          <View style={[styles.periodPill, { backgroundColor: theme.surface }]}>
            <Text style={[styles.periodText, { color: theme.muted }]}>Prototype</Text>
          </View>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Category flow</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Tap a slice for subcategories and matching transactions</Text>

        <View style={[styles.chartPanel, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <View style={[styles.switcher, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {(['expense', 'income'] as const).map((item) => {
              const active = mode === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => switchMode(item)}
                  style={[
                    styles.switchOption,
                    active && { backgroundColor: theme.inputBg, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.switchText, { color: active ? theme.text : theme.muted, fontWeight: active ? '700' : '600' }]}>
                    {item === 'expense' ? 'Expense' : 'Income'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.chartWrap}>
            <DonutChart slices={parentSlices} selectedId={chartSelectedId} theme={theme} onSelect={selectSlice} />
            <View pointerEvents="none" style={styles.centerLabel}>
              <Text style={styles.centerIcon}>{drillParentId && selectedParentSlice ? selectedParentSlice.icon : '◎'}</Text>
              <Text numberOfLines={1} style={[styles.centerName, { color: theme.text }]}>
                {drillParentId && selectedParentSlice ? selectedParentSlice.label : 'All'}
              </Text>
              <Text style={[styles.centerAmount, { color: theme.text }]}>
                {formatMoney(drillParentId && selectedParentSlice ? selectedParentSlice.amount : total)}
              </Text>
              <Text style={[styles.centerMeta, { color: theme.muted }]}>
                {drillParentId && selectedParentSlice
                  ? `${Math.round(selectedParentSlice.percent * 100)}% of total`
                  : '100% of total'}
              </Text>
            </View>
          </View>

          <View style={[styles.breadcrumbRow, { backgroundColor: theme.surface }]}>
            {drillParentId ? (
              <>
                <TouchableOpacity onPress={goUpToParents} activeOpacity={0.8} hitSlop={{ top: 12, bottom: 12, left: 12, right: 32 }} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.breadcrumbLink, { color: theme.accent }]}>All</Text>
                  <Text style={[styles.breadcrumbSep, { color: theme.muted, marginLeft: 6 }]}>/</Text>
                </TouchableOpacity>
                <Text numberOfLines={1} style={[styles.breadcrumbCurrent, { color: theme.text }]}>
                  {selectedParent?.icon} {selectedParent?.label}
                </Text>
              </>
            ) : (
              <Text numberOfLines={1} style={[styles.breadcrumbCurrent, { color: theme.text }]}>All</Text>
            )}
            <View style={[styles.breadcrumbMeta, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <Text style={[styles.breadcrumbMetaText, { color: theme.text }]}>
                {drillParentId
                  ? `${formatMoney(selectedParentSlice?.amount ?? 0)} · ${Math.round((selectedParentSlice?.percent ?? 0) * 100)}%`
                  : `${formatMoney(total)} · 100%`}
              </Text>
            </View>
          </View>

          <View style={styles.listSection}>
            {drillParentId ? (
              <View style={styles.splitRows}>
                {subSlices.length ? (
                  subSlices.map((slice) => {
                    const isActive = slice.id === selectedSubNode?.id;
                    return (
                      <TouchableOpacity
                        key={slice.id}
                        activeOpacity={0.8}
                        onPress={() => setSelectedSubId(isActive ? null : slice.id)}
                        style={[
                          styles.splitRowTop,
                          {
                            backgroundColor: isActive ? theme.surfaceStrong : 'transparent',
                            borderColor: isActive ? theme.border : 'transparent',
                          },
                        ]}
                      >
                        <Text style={styles.rowIcon}>{slice.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text numberOfLines={1} style={[styles.splitName, { color: theme.text }]}>{slice.label}</Text>
                            <Text style={[styles.splitValue, { color: theme.muted }]}>
                              {formatMoney(slice.amount)} · {Math.round(slice.percent * 100)}%
                            </Text>
                          </View>
                          <View style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}>
                            <View style={[styles.progressFill, { backgroundColor: slice.color, width: `${Math.max(3, slice.percent * 100)}%` }]} />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={[styles.noSplitText, { color: theme.muted }]}>No subcategories available for this category.</Text>
                )}
              </View>
            ) : (
              <View style={styles.categoryList}>
                {parentSlices.map((slice) => {
                  const isActive = false;
                  return (
                    <TouchableOpacity
                      key={slice.id}
                      activeOpacity={0.8}
                      onPress={() => drillToParent(slice.id)}
                      style={[
                        styles.categoryRow,
                        {
                          backgroundColor: isActive ? theme.surfaceStrong : 'transparent',
                          borderColor: isActive ? theme.border : 'transparent',
                        },
                      ]}
                    >
                      <Text style={styles.rowIcon}>{slice.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text numberOfLines={1} style={[styles.splitName, { color: theme.text }]}>{slice.label}</Text>
                          <Text style={[styles.splitValue, { color: theme.muted }]}>
                            {formatMoney(slice.amount)} · {Math.round(slice.percent * 100)}%
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        <View style={styles.transactionsHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Transactions</Text>
            <Text style={[styles.sectionSub, { color: theme.muted }]}>
              {drillParentId
                ? `All / ${selectedParent?.label ?? ''}${selectedSubNode ? ` / ${selectedSubNode.label}` : ''}`
                : 'All'}
            </Text>
          </View>
          <Text style={[styles.countBadge, { color: theme.text, backgroundColor: theme.surface }]}>{selectedTransactions.length}</Text>
        </View>

        <View style={styles.txList}>
          {selectedTransactions.map((tx) => (
            <View key={tx.id} style={[styles.txCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={[styles.txTitle, { color: theme.text }]}>{tx.title}</Text>
                <Text numberOfLines={1} style={[styles.txMeta, { color: theme.muted }]}>{tx.date} · {tx.account}</Text>
              </View>
              <Text style={[styles.txAmount, { color: mode === 'income' ? '#21C46B' : '#FF6767' }]}>
                {mode === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DonutChart({
  slices,
  selectedId,
  theme,
  onSelect,
}: {
  slices: ChartSlice[];
  selectedId?: string;
  theme: typeof lightTheme;
  onSelect: (id: string) => void;
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
              <Path d={touchPath} fill={theme.bg} opacity={0.01} />
              <Path
                d={visiblePath}
                fill={slice.color}
                opacity={active ? 1 : 0.72}
                stroke={theme.bg}
                strokeWidth={active ? 4 : 2}
              />
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

const lightTheme = {
  bg: '#F5F7FB',
  card: '#FFFFFF',
  surface: '#EEF2F8',
  surfaceStrong: '#F2F5FA',
  inputBg: '#FFFFFF',
  progressTrack: '#DDE4F0',
  border: '#DFE5EF',
  text: '#15213E',
  muted: '#7C8498',
  accent: '#2457FF',
  shadow: '#1C2744',
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 44 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  closeButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 34, lineHeight: 36, fontWeight: '300' },
  periodPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  periodText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, fontWeight: '600', lineHeight: 22, marginTop: 8, marginBottom: 22 },
  switcher: {
    flexDirection: 'row',
    borderRadius: 22,
    padding: 3,
    marginBottom: 10,
    width: 170,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  switchOption: {
    flex: 1,
    minHeight: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  switchText: { fontSize: 12, textAlign: 'center' },
  chartPanel: {
    borderRadius: 30,
    padding: 14,
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  chartWrap: { height: 310, alignItems: 'center', justifyContent: 'center' },
  centerLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  centerIcon: { fontSize: 30, marginBottom: 4 },
  centerName: { maxWidth: 130, fontSize: 12, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  centerAmount: { fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  centerMeta: { fontSize: 11.5, fontWeight: '800', marginTop: 2 },
  listSection: { marginTop: 12 },
  categoryList: { gap: 6 },
  categoryRow: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  splitRows: { gap: 10, marginTop: 6 },
  splitRow: { gap: 6 },
  splitRowTop: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  splitName: { flex: 1, fontSize: 15, fontWeight: '500' },
  splitValue: { fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 999 },
  rowIcon: { fontSize: 24, textAlign: 'center', width: 28 },
  noSplitText: { fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 12 },
  breadcrumbRow: {
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbLink: { fontSize: 12.5, fontWeight: '800' },
  breadcrumbSep: { fontSize: 12, fontWeight: '700' },
  breadcrumbCurrent: { flex: 1, fontSize: 13, fontWeight: '700' },
  breadcrumbMeta: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  breadcrumbMetaText: { fontSize: 11.5, fontWeight: '800' },
  transactionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '900' },
  sectionSub: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  countBadge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, fontSize: 13, fontWeight: '900' },
  txList: { gap: 10 },
  txCard: { minHeight: 78, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  txTitle: { fontSize: 16, fontWeight: '900' },
  txMeta: { fontSize: 12.5, fontWeight: '700', marginTop: 5 },
  txAmount: { fontSize: 17, fontWeight: '900' },
});
