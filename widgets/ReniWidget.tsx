import React from 'react';
import { FlexWidget, TextWidget, SvgWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';
import { formatCurrency } from '../lib/derived';
import type { ReniWidgetConfig, WidgetData } from './widgetTypes';

const c = (s: string): ColorProp => s as ColorProp;

// ── Palettes ───────────────────────────────────────────────────────────────

interface BtnColors { bg: string; border: string; text: string; icon: string }

interface Palette {
  surface: string;
  label: string;
  balance: string;
  positiveBar: string;
  negativeBar: string;
  emptyBar: string;
  activityIn: string;
  activityOut: string;
  btn: BtnColors;
}

const LIGHT: Palette = {
  surface:     '#F2F4F3',
  label:       '#8C94AF',
  balance:     '#1F2A44',
  positiveBar: '#0D9488',
  negativeBar: '#F87171',
  emptyBar:    '#D4D9E8',
  activityIn:  '#047857',
  activityOut: '#B32020',
  btn: { bg: '#FFFFFF', border: '#E4E7ED', text: '#3D4A66', icon: '#3D4A66' },
};

const DARK: Palette = {
  surface:     '#111318',
  label:       '#66707D',
  balance:     '#D8DDE5',
  positiveBar: '#2DD4BF',
  negativeBar: '#F87171',
  emptyBar:    '#1A2030',
  activityIn:  '#34D399',
  activityOut: '#FCA5A5',
  btn: { bg: '#1C2333', border: '#252F45', text: '#8A9AB0', icon: '#8A9AB0' },
};

// ── Constants ──────────────────────────────────────────────────────────────

const TICK_COUNT = 40;
const TICK_GAP   = 4;
const H_PAD      = 18;
const APP_SCHEME = 'financetracker';
const GAP = c('#00000000');

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmtFull = (n: number, sym: string) => formatCurrency(n, sym);

function repeatSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
}

function arrowDownLeftSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="5 5 14 14" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>`;
}

function arrowUpRightSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="5 5 14 14" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
}

// ── TickChart ──────────────────────────────────────────────────────────────

function TickChart({
  todayIncome,
  todayExpense,
  p,
}: {
  todayIncome: number;
  todayExpense: number;
  p: Palette;
}) {
  const total = todayIncome + todayExpense;
  const greenCount = total > 0 ? Math.round((todayIncome / total) * TICK_COUNT) : 0;
  const redCount   = total > 0 ? TICK_COUNT - greenCount : 0;

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        flexGap: TICK_GAP,
        flexGapColor: GAP,
      }}
    >
      {Array.from({ length: TICK_COUNT }, (_, i) => {
        const isGreen = i < greenCount;
        const isRed   = i >= TICK_COUNT - redCount;
        const bg = isGreen ? c(p.positiveBar) : isRed ? c(p.negativeBar) : c(p.emptyBar);
        return (
          <FlexWidget
            key={i}
            style={{ flex: 1, height: 10, backgroundColor: bg, borderRadius: 2 }}
          />
        );
      })}
    </FlexWidget>
  );
}

// ── ActionButton ───────────────────────────────────────────────────────────

function ActionButton({
  label,
  uri,
  colors,
  repeatIcon,
}: {
  label: string;
  uri: string;
  colors: BtnColors;
  repeatIcon?: boolean;
}) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        flex: 1,
        height: 44,
        backgroundColor: c(colors.bg),
        borderRadius: 10,
        borderColor: c(colors.border),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        flexGap: 4,
        flexGapColor: GAP,
      }}
    >
      {repeatIcon && (
        <SvgWidget svg={repeatSvg(colors.icon)} style={{ width: 11, height: 11 }} />
      )}
      <TextWidget
        text={label}
        style={{ fontSize: 11, fontWeight: '600', color: c(colors.text), textAlign: 'center' }}
        maxLines={1}
        truncate="END"
        allowFontScaling={false}
      />
    </FlexWidget>
  );
}

// ── Widget ─────────────────────────────────────────────────────────────────

function ReniWidgetLayout({
  data,
  config,
  p,
}: {
  data: WidgetData;
  config: ReniWidgetConfig;
  p: Palette;
}) {
  const { balance, currencySymbol: sym, todayIncome, todayExpense, monthLabel } = data;
  const headerRight = balance !== null ? fmtFull(balance, sym) : monthLabel;
  const incomeIsZero = todayIncome === 0;
  const expenseIsZero = todayExpense === 0;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        backgroundColor: c(p.surface),
        borderRadius: 22,
        paddingTop: 18,
        paddingBottom: 16,
        paddingLeft: H_PAD,
        paddingRight: H_PAD,
      }}
    >
      {/* Header: label ·····  balance / month */}
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginBottom: 14 }}>
        <TextWidget
          text="Reni"
          style={{ fontSize: 12, fontWeight: '600', color: c(p.label), letterSpacing: 0.3 }}
          allowFontScaling={false}
        />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget
          text={headerRight}
          style={{ fontSize: 14, fontWeight: '700', color: c(p.balance) }}
          maxLines={1}
          truncate="START"
          allowFontScaling={false}
        />
      </FlexWidget>

      {/* Tick chart — flex:1 ticks always fill full width regardless of reported widget width */}
      <TickChart todayIncome={todayIncome} todayExpense={todayExpense} p={p} />

      {/* Today's activity */}
      {config.showTodayActivity && (
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            width: 'match_parent',
            paddingTop: 2,
            marginBottom: 2,
          }}
        >
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4, flexGapColor: GAP }}>
            <SvgWidget
              svg={arrowDownLeftSvg(incomeIsZero ? p.label : p.activityIn)}
              style={{ width: 16, height: 16 }}
            />
            <TextWidget
              text={incomeIsZero ? '—' : fmtFull(todayIncome, sym)}
              style={{ fontSize: 13, fontWeight: '400', color: c(incomeIsZero ? p.label : p.balance), letterSpacing: -0.3 }}
              maxLines={1}
              allowFontScaling={false}
            />
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />

          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4, flexGapColor: GAP }}>
            <TextWidget
              text={expenseIsZero ? '—' : fmtFull(todayExpense, sym)}
              style={{ fontSize: 13, fontWeight: '400', color: c(expenseIsZero ? p.label : p.balance), letterSpacing: -0.3 }}
              maxLines={1}
              allowFontScaling={false}
            />
            <SvgWidget
              svg={arrowUpRightSvg(expenseIsZero ? p.label : p.activityOut)}
              style={{ width: 16, height: 16 }}
            />
          </FlexWidget>
        </FlexWidget>
      )}
      <FlexWidget style={{ flex: 1 }} />

      {/* Quick actions */}
      {config.showQuickActions && (
        <FlexWidget
          style={{
            flexDirection: 'row',
            width: 'match_parent',
            flexGap: 6,
            flexGapColor: GAP,
          }}
        >
          <ActionButton label="+ Income"  uri={`${APP_SCHEME}://modals/add-transaction?type=in`}       colors={p.btn} />
          <ActionButton label="− Expense" uri={`${APP_SCHEME}://modals/add-transaction?type=out`}      colors={p.btn} />
          <ActionButton label="Transfer"  uri={`${APP_SCHEME}://modals/add-transaction?type=transfer`} colors={p.btn} repeatIcon />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────

export function renderReniWidget(data: WidgetData, config: ReniWidgetConfig, _widgetWidthDp = 250) {
  return {
    light: <ReniWidgetLayout data={data} config={config} p={LIGHT} />,
    dark:  <ReniWidgetLayout data={data} config={config} p={DARK}  />,
  };
}
