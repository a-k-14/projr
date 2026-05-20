import React from 'react';
import { FlexWidget, TextWidget, SvgWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';
import { formatCurrency } from '../lib/derived';
import type { ReniWidgetConfig, WidgetData } from './widgetTypes';

const c = (s: string): ColorProp => s as ColorProp;

// ── Palettes ───────────────────────────────────────────────────────────────

interface BtnColors { bg: string; border: string; text: string; icon: string }

interface Palette {
  surfaceFrom: string;
  surfaceTo: string;
  label: string;
  balance: string;
  positiveBar: string;
  negativeBar: string;
  emptyBar: string;
  activityIn: string;
  activityOut: string;
  btnIncome: BtnColors;
  btnExpense: BtnColors;
  btnTransfer: BtnColors;
}

const LIGHT: Palette = {
  surfaceFrom: '#EEF1F7',
  surfaceTo:   '#E6EAF3',
  label:       '#8C94AF',
  balance:     '#1F2A44',
  positiveBar: '#0D9488',
  negativeBar: '#F87171',
  emptyBar:    '#D4D9E8',
  activityIn:  '#047857',
  activityOut: '#B32020',
  btnIncome:   { bg: '#DDE3EF', border: '#C8D0E5', text: '#3D4A66', icon: '#3D4A66' },
  btnExpense:  { bg: '#DDE3EF', border: '#C8D0E5', text: '#3D4A66', icon: '#3D4A66' },
  btnTransfer: { bg: '#DDE3EF', border: '#C8D0E5', text: '#3D4A66', icon: '#3D4A66' },
};

const DARK: Palette = {
  surfaceFrom: '#0C1018',
  surfaceTo:   '#080D14',
  label:       '#66707D',
  balance:     '#D8DDE5',
  positiveBar: '#2DD4BF',
  negativeBar: '#F87171',
  emptyBar:    '#1A2030',
  activityIn:  '#34D399',
  activityOut: '#FCA5A5',
  btnIncome:   { bg: '#141C28', border: '#1D2A3E', text: '#8A9AB0', icon: '#8A9AB0' },
  btnExpense:  { bg: '#141C28', border: '#1D2A3E', text: '#8A9AB0', icon: '#8A9AB0' },
  btnTransfer: { bg: '#141C28', border: '#1D2A3E', text: '#8A9AB0', icon: '#8A9AB0' },
};

// ── Constants ──────────────────────────────────────────────────────────────

// Match app card exactly: TICK_W=2.3, TICK_H=12, TICK_GAP=4
const TICK_W   = 2.3;
const TICK_H   = 12;
const TICK_GAP = 4;
const H_PAD    = 14; // widget horizontal padding each side
const APP_SCHEME = 'financetracker';
const GAP = c('#00000000');

function tickCount(widgetWidthDp: number): number {
  const available = widgetWidthDp - H_PAD * 2;
  return Math.floor((available + TICK_GAP) / (TICK_W + TICK_GAP));
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmtFull = (n: number, sym: string) => formatCurrency(n, sym);


function repeatSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
}

function arrowDownLeftSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="5 5 14 14" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>`;
}

function arrowUpRightSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="5 5 14 14" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
}

// ── TickChart ──────────────────────────────────────────────────────────────

function TickChart({
  todayIncome,
  todayExpense,
  count,
  p,
}: {
  todayIncome: number;
  todayExpense: number;
  count: number;
  p: Palette;
}) {
  const total = todayIncome + todayExpense;
  const greenCount = total > 0 ? Math.round((todayIncome / total) * count) : 0;
  // redCount = count - greenCount → green + red always = count when data exists
  const redCount = total > 0 ? count - greenCount : 0;

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
      {Array.from({ length: count }, (_, i) => {
        const isGreen = i < greenCount;
        const isRed   = i >= count - redCount;
        const bg = isGreen ? c(p.positiveBar) : isRed ? c(p.negativeBar) : c(p.emptyBar);
        return (
          <FlexWidget
            key={i}
            style={{ width: TICK_W, height: TICK_H, backgroundColor: bg, borderRadius: 2 }}
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
        height: 30,
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
  ticks,
}: {
  data: WidgetData;
  config: ReniWidgetConfig;
  p: Palette;
  ticks: number;
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
        backgroundGradient: { from: c(p.surfaceFrom), to: c(p.surfaceTo), orientation: 'TOP_BOTTOM' },
        borderRadius: 22,
        paddingTop: 13,
        paddingBottom: 12,
        paddingLeft: H_PAD,
        paddingRight: H_PAD,
      }}
    >
      {/* Header: Reni ·····  balance / month */}
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginBottom: 9 }}>
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

      {/* Tick chart — today's income vs expense ratio; marginBottom:6 matches card */}
      <TickChart todayIncome={todayIncome} todayExpense={todayExpense} count={ticks} p={p} />

      {/* Today's amounts — paddingTop:2 matches card spacing above amounts row */}
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
          {/* Income: ↙ + amount */}
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

          {/* Expense: amount + ↗ */}
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
          <ActionButton label="+ Income"  uri={`${APP_SCHEME}://modals/add-transaction?type=in`}       colors={p.btnIncome} />
          <ActionButton label="− Expense" uri={`${APP_SCHEME}://modals/add-transaction?type=out`}      colors={p.btnExpense} />
          <ActionButton label="Transfer"  uri={`${APP_SCHEME}://modals/add-transaction?type=transfer`} colors={p.btnTransfer} repeatIcon />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────

export function renderReniWidget(data: WidgetData, config: ReniWidgetConfig, widgetWidthDp = 250) {
  const ticks = tickCount(widgetWidthDp);
  return {
    light: <ReniWidgetLayout data={data} config={config} p={LIGHT} ticks={ticks} />,
    dark:  <ReniWidgetLayout data={data} config={config} p={DARK}  ticks={ticks} />,
  };
}
