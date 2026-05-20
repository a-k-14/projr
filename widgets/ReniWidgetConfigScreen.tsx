import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Appearance,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';
import { runMigrations } from '../db/migrate';
import { getAccounts } from '../services/accounts';
import { renderReniWidget } from './ReniWidget';
import { loadWidgetConfig, saveWidgetConfig } from './widgetStorage';
import { fetchWidgetData } from './widgetDataService';
import type { Account } from '../types';
import type { BalanceDisplay, ReniWidgetConfig } from './widgetTypes';
import { DEFAULT_WIDGET_CONFIG } from './widgetTypes';

// ── Palette (inline, no hooks — runs before app stores are ready) ──────────

const LIGHT_CFG = {
  bg: '#F0F2F8',
  surface: '#FFFFFF',
  text: '#1F2A44',
  textMuted: '#8C94AF',
  textSecondary: '#6B7280',
  brand: '#1E293B',
  border: '#E2E6EE',
  divider: '#E8EBF0',
  selected: '#1E293B',
  selectedText: '#FFFFFF',
  unselected: '#FFFFFF',
  unselectedBorder: '#E2E6EE',
};

const DARK_CFG = {
  bg: '#000000',
  surface: '#0C1018',
  text: '#D8DDE5',
  textMuted: '#66707D',
  textSecondary: '#A6ADB8',
  brand: '#CBD5E1',
  border: '#1A1E28',
  divider: '#161A22',
  selected: '#CBD5E1',
  selectedText: '#07100B',
  unselected: '#0C1018',
  unselectedBorder: '#1A1E28',
};

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ text, p }: { text: string; p: typeof LIGHT_CFG }) {
  return (
    <Text style={[styles.sectionLabel, { color: p.textMuted }]}>{text}</Text>
  );
}

function RadioRow({
  label,
  selected,
  onPress,
  p,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  p: typeof LIGHT_CFG;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.radioRow, { borderBottomColor: p.divider }]}
    >
      <Text style={[styles.radioLabel, { color: p.text }]}>{label}</Text>
      <View
        style={[
          styles.radioCircle,
          {
            borderColor: selected ? p.selected : p.unselectedBorder,
            backgroundColor: selected ? p.selected : p.unselected,
          },
        ]}
      >
        {selected && <View style={[styles.radioInner, { backgroundColor: p.selectedText }]} />}
      </View>
    </TouchableOpacity>
  );
}

function ToggleRow({
  label,
  subtitle,
  value,
  onValueChange,
  last,
  p,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
  p: typeof LIGHT_CFG;
}) {
  return (
    <View style={[styles.toggleRow, !last && { borderBottomColor: p.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[styles.toggleLabel, { color: p.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.toggleSubtitle, { color: p.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: p.border, true: p.brand }}
        thumbColor={value ? p.surface : p.surface}
      />
    </View>
  );
}

function Card({ children, p }: { children: React.ReactNode; p: typeof LIGHT_CFG }) {
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
      {children}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export function ReniWidgetConfigScreen({
  widgetInfo,
  renderWidget,
  setResult,
}: WidgetConfigurationScreenProps) {
  const isDark = Appearance.getColorScheme() === 'dark';
  const p = isDark ? DARK_CFG : LIGHT_CFG;

  const [config, setConfig] = useState<ReniWidgetConfig>({ ...DEFAULT_WIDGET_CONFIG });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await runMigrations();
        const [savedConfig, accs] = await Promise.all([
          loadWidgetConfig(widgetInfo.widgetId),
          getAccounts(),
        ]);
        setConfig(savedConfig);
        setAccounts(accs);
      } catch {
        // fall back to defaults
      } finally {
        setLoading(false);
      }
    })();
  }, [widgetInfo.widgetId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveWidgetConfig(widgetInfo.widgetId, config);
      const data = await fetchWidgetData(config);
      renderWidget(renderReniWidget(data, config));
      setResult('ok');
    } catch {
      setResult('ok');
    }
  }, [widgetInfo.widgetId, config, renderWidget, setResult]);

  const setBalanceDisplay = (val: BalanceDisplay) =>
    setConfig((c) => ({ ...c, balanceDisplay: val }));

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: p.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={p.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={[styles.title, { color: p.text }]}>Configure Widget</Text>
        <Text style={[styles.subtitle, { color: p.textSecondary }]}>
          Choose what Reni shows on your home screen.
        </Text>

        {/* Balance display */}
        <SectionLabel text="BALANCE TO DISPLAY" p={p} />
        <Card p={p}>
          <RadioRow
            label="Net worth"
            selected={config.balanceDisplay === 'netWorth'}
            onPress={() => setBalanceDisplay('netWorth')}
            p={p}
          />
          <RadioRow
            label="Total account balance"
            selected={config.balanceDisplay === 'totalBalance'}
            onPress={() => setBalanceDisplay('totalBalance')}
            p={p}
          />
          {accounts.map((acc) => (
            <RadioRow
              key={acc.id}
              label={acc.name}
              selected={
                config.balanceDisplay === 'specificAccount' && config.accountId === acc.id
              }
              onPress={() =>
                setConfig((c) => ({
                  ...c,
                  balanceDisplay: 'specificAccount',
                  accountId: acc.id,
                }))
              }
              p={p}
            />
          ))}
          <RadioRow
            label="Don't show balance"
            selected={config.balanceDisplay === 'none'}
            onPress={() => setBalanceDisplay('none')}
            p={p}
          />
        </Card>

        {/* Toggles */}
        <SectionLabel text="OPTIONS" p={p} />
        <Card p={p}>
          <ToggleRow
            label="Quick actions"
            subtitle="Add income, expense, or transfer"
            value={config.showQuickActions}
            onValueChange={(v) => setConfig((c) => ({ ...c, showQuickActions: v }))}
            p={p}
          />
          <ToggleRow
            label="Today's activity"
            subtitle="Income and expense totals for today"
            value={config.showTodayActivity}
            onValueChange={(v) => setConfig((c) => ({ ...c, showTodayActivity: v }))}
            last
            p={p}
          />
        </Card>
      </ScrollView>

      {/* Save button */}
      <View style={[styles.footer, { backgroundColor: p.bg, borderTopColor: p.divider }]}>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: p.brand, opacity: saving ? 0.7 : 1 }]}
        >
          {saving ? (
            <ActivityIndicator color={p.selectedText} size="small" />
          ) : (
            <Text style={[styles.saveBtnText, { color: p.selectedText }]}>
              Add Widget
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 24,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  radioLabel: { flex: 1, fontSize: 15 },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleLabel: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  toggleSubtitle: { fontSize: 12 },
  footer: {
    padding: 16,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
