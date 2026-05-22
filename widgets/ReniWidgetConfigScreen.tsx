import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Appearance,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';
import { runMigrations } from '../db/migrate';
import { getAccounts } from '../services/accounts';
import { renderReniWidget } from './ReniWidget';
import { loadWidgetConfig, saveWidgetConfig } from './widgetStorage';
import { fetchWidgetData } from './widgetDataService';
import type { Account } from '../types';
import type { BalanceDisplay, ReniWidgetConfig } from './widgetTypes';
import { DEFAULT_WIDGET_CONFIG } from './widgetTypes';
import { getThemePalette, useAppTheme } from '../lib/theme';
import { useUIStore } from '../stores/useUIStore';
import { FixedBottomActions } from '../components/settings-ui';
import { FilledButton } from '../components/ui/AppButton';
import { getScrollableBottomPadding } from '../components/ui/safeBottom';
import { SPACING, TYPE, FONT_WEIGHT } from '../lib/design';
import { SCREEN_HEADER, SCREEN_GUTTER } from '../lib/layoutTokens';
import { AppIcon } from '../components/ui/AppIcon';
import { StatusBar } from 'expo-status-bar';

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

function ReniWidgetConfigScreenContent({
  widgetInfo,
  renderWidget,
  setResult,
}: WidgetConfigurationScreenProps) {
  const { mode, palette } = useAppTheme();
  const isDark = mode === 'dark';
  const p = isDark ? DARK_CFG : LIGHT_CFG;
  const insets = useSafeAreaInsets();

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
          useUIStore.getState().load(),
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
      renderWidget(renderReniWidget(data, config, widgetInfo.width));
      setResult('ok');
    } catch {
      setResult('ok');
    }
  }, [widgetInfo.widgetId, widgetInfo.width, config, renderWidget, setResult]);

  const setBalanceDisplay = (val: BalanceDisplay) =>
    setConfig((c) => ({ ...c, balanceDisplay: val }));

  const selectedAccount = accounts.find((a) => a.id === config.accountId);

  if (loading) {
    return (
      <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: palette.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={palette.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: palette.background }]}>
      <StatusBar style={palette.statusBarStyle} backgroundColor="transparent" translucent />
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 12
          }}
        >
          <TouchableOpacity
            delayPressIn={0}
            onPress={() => setResult('cancel')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: SCREEN_HEADER.iconTitleGap }}
          >
            <AppIcon name="x" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              fontSize: SCREEN_HEADER.titleSize,
              fontWeight: SCREEN_HEADER.titleWeight,
              color: palette.text,
            }}
          >
            Configure Widget
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: 8,
            paddingBottom: getScrollableBottomPadding(insets) + 72,
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Subtitle */}
        <View style={{ paddingBottom: 16 }}>
          <Text style={{ fontSize: TYPE.caption, color: palette.textMuted, lineHeight: 17 }}>
            Choose what Reni shows on your home screen.
          </Text>
        </View>

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

        {/* Background theme */}
        <SectionLabel text="BACKGROUND THEME" p={p} />
        <Card p={p}>
          <RadioRow
            label="Classic (Vanilla Cream / Dark Slate)"
            selected={config.bgTheme === 'classic' || !config.bgTheme || config.bgTheme === 'warm'}
            onPress={() => setConfig((c) => ({ ...c, bgTheme: 'classic' }))}
            p={p}
          />
          <RadioRow
            label="Hero bottom (Cool Gray / Dark Navy)"
            selected={config.bgTheme === 'heroBottom'}
            onPress={() => setConfig((c) => ({ ...c, bgTheme: 'heroBottom' }))}
            last
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

      {/* Save */}
      <FixedBottomActions palette={palette}>
        <FilledButton
          label={saving ? 'Saving...' : 'Save'}
          onPress={handleSave}
          disabled={saving}
          palette={palette}
        />
      </FixedBottomActions>
    </SafeAreaView>
  );
}

export function ReniWidgetConfigScreen(props: WidgetConfigurationScreenProps) {
  return (
    <SafeAreaProvider>
      <ReniWidgetConfigScreenContent {...props} />
    </SafeAreaProvider>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 8 },
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
});
