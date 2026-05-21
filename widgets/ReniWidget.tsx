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
  stripBase: string;
  stripGradTo: string;
}

const LIGHT: Palette = {
  surface:      '#F2F4F3',
  label:        '#8C94AF',
  balance:      '#1F2A44',
  positiveBar:  '#0D9488',
  negativeBar:  '#F87171',
  emptyBar:     '#D4D9E8',
  activityIn:   '#047857',
  activityOut:  '#B32020',
  btn: { bg: '#DDE3EF', border: '#C8D0E5', text: '#3D4A66', icon: '#3D4A66' },
  stripBase:   '#1F2A44',
  stripGradTo: '#243558',
};

const DARK: Palette = {
  surface:      '#111318',
  label:        '#66707D',
  balance:      '#D8DDE5',
  positiveBar:  '#2DD4BF',
  negativeBar:  '#F87171',
  emptyBar:     '#1A2030',
  activityIn:   '#34D399',
  activityOut:  '#FCA5A5',
  btn: { bg: '#1C2333', border: '#252F45', text: '#8A9AB0', icon: '#8A9AB0' },
  stripBase:   '#060C16',
  stripGradTo: '#0C1A28',
};

// ── Constants ──────────────────────────────────────────────────────────────

const TICK_W     = 2.3;
const TICK_H     = 8;
const TICK_GAP   = 4;
const H_PAD      = 18;
const STRIP_H    = 22;
const CARD_R     = 22;
const APP_SCHEME = 'financetracker';
const GAP        = c('#00000000');

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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>`;
}

function arrowUpRightSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
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
  const total      = todayIncome + todayExpense;
  const greenCount = total > 0 ? Math.round((todayIncome / total) * count) : 0;
  const redCount   = total > 0 ? count - greenCount : 0;

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: H_PAD,
        paddingRight: H_PAD,
        marginBottom: 4,
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

type BtnIconType = 'income' | 'expense' | 'transfer';

function ActionButton({
  label,
  uri,
  colors,
  iconType,
}: {
  label: string;
  uri: string;
  colors: BtnColors;
  iconType?: BtnIconType;
}) {
  const svgIcon =
    iconType === 'income'   ? arrowDownLeftSvg(colors.icon) :
    iconType === 'expense'  ? arrowUpRightSvg(colors.icon)  :
    iconType === 'transfer' ? repeatSvg(colors.icon)        : null;
  const iconW = iconType === 'transfer' ? 11 : 13;
  const iconH = iconType === 'transfer' ? 11 : 13;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        flex: 1,
        height: 36,
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
      {svgIcon && (
        <SvgWidget svg={svgIcon} style={{ width: iconW, height: iconH }} />
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
  const { balance, balanceLabel, currencySymbol: sym, todayIncome, todayExpense, monthLabel } = data;
  const balanceValue  = balance !== null ? fmtFull(balance, sym) : monthLabel;
  const incomeIsZero  = todayIncome === 0;
  const expenseIsZero = todayExpense === 0;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        backgroundColor: c(p.surface),
        borderRadius: CARD_R,
        paddingBottom: 10,
      }}
    >
      {/* ── Brand strip ── */}
      <FlexWidget
        style={{
          width: 'match_parent',
          height: STRIP_H,
          backgroundGradient: { from: c(p.stripBase), to: c(p.stripGradTo), orientation: 'LEFT_RIGHT' },
          borderTopLeftRadius: CARD_R,
          borderTopRightRadius: CARD_R,
          paddingLeft: H_PAD,
          paddingRight: H_PAD,
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <TextWidget
          text="Reni"
          style={{ fontSize: 11, fontWeight: '700', color: c('#FFFFFF'), letterSpacing: 0.8 }}
          allowFontScaling={false}
        />
      </FlexWidget>

      {/* ── Balance row (always rendered to keep layout stable) ── */}
      {config.balanceDisplay === 'none' ? (
        // Empty spacer — same height as the balance row so the chart doesn't shift
        <FlexWidget style={{ width: 'match_parent', height: 14, marginBottom: 10 }} />
      ) : (
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            width: 'match_parent',
            paddingLeft: H_PAD,
            paddingRight: H_PAD,
            marginBottom: 10,
          }}
        >
          <TextWidget
            text={balanceLabel}
            style={{ fontSize: 11, fontWeight: '500', color: c(p.balance), letterSpacing: 0.2 }}
            allowFontScaling={false}
          />
          <FlexWidget style={{ flex: 1 }} />
          <TextWidget
            text={balanceValue}
            style={{ fontSize: 14, fontWeight: '600', color: c(p.balance) }}
            maxLines={1}
            truncate="START"
            allowFontScaling={false}
          />
        </FlexWidget>
      )}

      {/* ── Tick chart ── */}
      <TickChart todayIncome={todayIncome} todayExpense={todayExpense} count={ticks} p={p} />

      {/* ── Today's activity ── */}
      {config.showTodayActivity && (
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            width: 'match_parent',
            paddingLeft: H_PAD,
            paddingRight: H_PAD,
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

      {/* ── Spacer ── */}
      <FlexWidget style={{ flex: 1 }} />

      {/* ── Quick actions ── */}
      {config.showQuickActions && (
        <FlexWidget
          style={{
            flexDirection: 'row',
            width: 'match_parent',
            paddingLeft: H_PAD,
            paddingRight: H_PAD,
            marginTop: 6,
            flexGap: 6,
            flexGapColor: GAP,
          }}
        >
          <ActionButton label="Income"   uri={`${APP_SCHEME}://modals/add-transaction?type=in`}       colors={p.btn} iconType="income" />
          <ActionButton label="Expense"  uri={`${APP_SCHEME}://modals/add-transaction?type=out`}      colors={p.btn} iconType="expense" />
          <ActionButton label="Transfer" uri={`${APP_SCHEME}://modals/add-transaction?type=transfer`} colors={p.btn} iconType="transfer" />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────

export function renderReniWidget(data: WidgetData, config: ReniWidgetConfig, widgetWidthDp = 300) {
  const ticks = tickCount(widgetWidthDp);
  return {
    light: <ReniWidgetLayout data={data} config={config} p={LIGHT} ticks={ticks} />,
    dark:  <ReniWidgetLayout data={data} config={config} p={DARK}  ticks={ticks} />,
  };
}
