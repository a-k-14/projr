import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Appearance,
  SafeAreaView,
  ScrollView,
  StyleSheet,
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

// ── Palette (inline — runs before app stores are ready) ────────────────────

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
  switchTrackOff: '#D1D9E6',
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
  switchTrackOff: '#1D2535',
};

type Palette = typeof LIGHT_CFG;

// ── ConfigSwitch — matches AppSwitch visuals without needing AppThemePalette ─

function ConfigSwitch({
  value,
  onValueChange,
  p,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  p: Palette;
}) {
  const W = 43, H = 25, THUMB = 19, PAD = 3;
  const offX = PAD, onX = W - THUMB - PAD;

  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: value ? 1 : 0,
      damping: 18,
      stiffness: 280,
      mass: 0.5,
      useNativeDriver: false, // backgroundColor interpolation requires JS driver
    }).start();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const trackBg = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [p.switchTrackOff, p.selected],
  });
  const thumbX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offX, onX],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onValueChange(!value)}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
    >
      <Animated.View
        style={{
          width: W,
          height: H,
          borderRadius: H / 2,
          justifyContent: 'center',
          backgroundColor: trackBg,
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: '#FFFFFF',
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.18,
            shadowRadius: 2,
            transform: [{ translateX: thumbX }],
          }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ text, p }: { text: string; p: Palette }) {
  return <Text style={[styles.sectionLabel, { color: p.textMuted }]}>{text}</Text>;
}

function Card({ children, p }: { children: React.ReactNode; p: Palette }) {
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
      {children}
    </View>
  );
}

function RadioRow({
  label,
  selected,
  onPress,
  last,
  p,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  last?: boolean;
  p: Palette;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.radioRow,
        !last && { borderBottomColor: p.divider, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
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
  p: Palette;
}) {
  return (
    <View
      style={[
        styles.toggleRow,
        !last && { borderBottomColor: p.divider, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[styles.toggleLabel, { color: p.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.toggleSubtitle, { color: p.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      <ConfigSwitch value={value} onValueChange={onValueChange} p={p} />
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

  const selectedAccount = accounts.find((a) => a.id === config.accountId);

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
          <RadioRow
            label="Specific account"
            selected={config.balanceDisplay === 'specificAccount'}
            onPress={() => setBalanceDisplay('specificAccount')}
            p={p}
          />
          <RadioRow
            label="Don't show balance"
            selected={config.balanceDisplay === 'none'}
            onPress={() => setBalanceDisplay('none')}
            last
            p={p}
          />
        </Card>

        {/* Account picker — only when specificAccount is selected */}
        {config.balanceDisplay === 'specificAccount' && accounts.length > 0 && (
          <>
            <SectionLabel text="ACCOUNT" p={p} />
            <Card p={p}>
              <ScrollView
                style={{ maxHeight: 220 }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {accounts.map((acc, idx) => (
                  <RadioRow
                    key={acc.id}
                    label={acc.name}
                    selected={config.accountId === acc.id}
                    onPress={() => setConfig((c) => ({ ...c, accountId: acc.id }))}
                    last={idx === accounts.length - 1}
                    p={p}
                  />
                ))}
              </ScrollView>
            </Card>
          </>
        )}

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

      {/* Save */}
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
            <Text style={[styles.saveBtnText, { color: p.selectedText }]}>Save</Text>
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
    marginBottom: 20,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    paddingVertical: 14,
  },
  toggleLabel: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  toggleSubtitle: { fontSize: 12 },
  footer: {
    padding: 16,
    paddingBottom: 36, // clears gesture navigation bar on Android
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
