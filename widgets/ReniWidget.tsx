import React from 'react';
import type { ColorProp } from 'react-native-android-widget';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { formatCurrency } from '../lib/derived';
import type { ReniWidgetConfig, WidgetData, WidgetBgTheme } from './widgetTypes';

const c = (s: string): ColorProp => s as ColorProp;

interface BtnColors {
  bg: string;
  iconBg: string;
  text: string;
  incomeIcon: string;
  expenseIcon: string;
  transferIcon: string;
}

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
  surface: '#F3EFE3',
  label: '#8D929F',
  balance: '#1F2A44',
  positiveBar: '#438B62',
  negativeBar: '#C95D52',
  emptyBar: '#DDD6C7',
  activityIn: '#438B62',
  activityOut: '#C95D52',
  btn: {
    bg: '#E6E1D5',
    iconBg: '#F3EFE3',
    text: '#1F2A44',
    incomeIcon: '#438B62',
    expenseIcon: '#C95D52',
    transferIcon: '#1F2A44',
  },
};

const DARK: Palette = {
  surface: '#181A20',
  label: '#8B93A3',
  balance: '#ECE8DD',
  positiveBar: '#5AA87B',
  negativeBar: '#D46A60',
  emptyBar: '#33333A',
  activityIn: '#5AA87B',
  activityOut: '#D46A60',
  btn: {
    bg: '#25262B',
    iconBg: '#181A20',
    text: '#ECE8DD',
    incomeIcon: '#5AA87B',
    expenseIcon: '#D46A60',
    transferIcon: '#ECE8DD',
  },
};

function getWidgetPalette(mode: 'light' | 'dark', theme: WidgetBgTheme = 'classic'): Palette {
  if (mode === 'light') {
    if (theme === 'warm') {
      return {
        surface: '#FAF6EC',
        label: '#8D929F',
        balance: '#1F2A44',
        positiveBar: '#438B62',
        negativeBar: '#C95D52',
        emptyBar: '#E2DDD0',
        activityIn: '#438B62',
        activityOut: '#C95D52',
        btn: {
          bg: '#EDE8DC',
          iconBg: '#FAF6EC',
          text: '#1F2A44',
          incomeIcon: '#438B62',
          expenseIcon: '#C95D52',
          transferIcon: '#1F2A44',
        },
      };
    }
    if (theme === 'heroBottom') {
      return {
        surface: '#F8FAFD',
        label: '#8C94AF',
        balance: '#1F2A44',
        positiveBar: '#438B62',
        negativeBar: '#C95D52',
        emptyBar: '#DFE3EC',
        activityIn: '#438B62',
        activityOut: '#C95D52',
        btn: {
          bg: '#ECEFF5',
          iconBg: '#F8FAFD',
          text: '#1F2A44',
          incomeIcon: '#438B62',
          expenseIcon: '#C95D52',
          transferIcon: '#1F2A44',
        },
      };
    }
    return LIGHT;
  } else {
    if (theme === 'warm') {
      return {
        surface: '#22201D',
        label: '#8B93A3',
        balance: '#ECE8DD',
        positiveBar: '#5AA87B',
        negativeBar: '#D46A60',
        emptyBar: '#3B3731',
        activityIn: '#5AA87B',
        activityOut: '#D46A60',
        btn: {
          bg: '#2D2A26',
          iconBg: '#22201D',
          text: '#ECE8DD',
          incomeIcon: '#5AA87B',
          expenseIcon: '#D46A60',
          transferIcon: '#ECE8DD',
        },
      };
    }
    if (theme === 'heroBottom') {
      return {
        surface: '#1A1F2E',
        label: '#8B93A3',
        balance: '#ECE8DD',
        positiveBar: '#5AA87B',
        negativeBar: '#D46A60',
        emptyBar: '#313B53',
        activityIn: '#5AA87B',
        activityOut: '#D46A60',
        btn: {
          bg: '#242B3E',
          iconBg: '#1A1F2E',
          text: '#ECE8DD',
          incomeIcon: '#5AA87B',
          expenseIcon: '#D46A60',
          transferIcon: '#ECE8DD',
        },
      };
    }
    return DARK;
  }
}

const H_PAD = 20;
const CARD_R = 26;
const TICK_GAP = 6;
const TICK_W = 3;
const TICK_H = 14;
const APP_SCHEME = 'financetracker';
const GAP = c('#00000000');

type BtnIconType = 'income' | 'expense' | 'transfer';

const fmtFull = (n: number, sym: string) => formatCurrency(n, sym);

function spacedUpper(text: string) {
  return text.toUpperCase().split('').join(' ');
}

function tickCount(widgetWidthDp: number) {
  const stableWidth = Math.round(widgetWidthDp / 80) * 80;
  const available = Math.max(0, stableWidth - H_PAD * 2);
  return Math.max(12, Math.floor((available + TICK_GAP) / (TICK_W + TICK_GAP)));
}

function formatWidgetDate() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function repeatSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
}

function arrowDownLeftSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>`;
}

function arrowUpRightSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
}

function TickChart({ data, count, p }: { data: WidgetData; count: number; p: Palette }) {
  const total = data.todayIncome + data.todayExpense;
  const incomeFraction = total > 0 ? data.todayIncome / total : 0.5;
  const incomeTicks = total > 0 ? Math.round(incomeFraction * count) : 0;

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: H_PAD,
        paddingRight: H_PAD,
        marginTop: 5,
        marginBottom: 5,
        flexGap: TICK_GAP,
        flexGapColor: GAP,
      }}
    >
      {Array.from({ length: count }, (_, i) => {
        const bg = total === 0 ? p.emptyBar : i < incomeTicks ? p.positiveBar : p.negativeBar;
        return (
          <FlexWidget
            key={i}
            style={{
              flex: 1,
              height: TICK_H,
              borderRadius: 2,
              backgroundColor: c(bg),
            }}
          />
        );
      })}
    </FlexWidget>
  );
}

function ActivityRow({ data, p }: { data: WidgetData; p: Palette }) {
  const { currencySymbol: sym, todayIncome, todayExpense } = data;

  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        width: 'match_parent',
        paddingLeft: H_PAD,
        paddingRight: H_PAD,
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6, flexGapColor: GAP }}>
        <SvgWidget svg={arrowDownLeftSvg(p.activityIn)} style={{ width: 14, height: 14 }} />
        <TextWidget text={fmtFull(todayIncome, sym)} style={{ fontSize: 12, fontWeight: '500', color: c(p.balance) }} allowFontScaling={false} maxLines={1} />
      </FlexWidget>

      <FlexWidget style={{ flex: 1 }} />

      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6, flexGapColor: GAP }}>
        <TextWidget text={fmtFull(todayExpense, sym)} style={{ fontSize: 12, fontWeight: '500', color: c(p.balance) }} allowFontScaling={false} maxLines={1} />
        <SvgWidget svg={arrowUpRightSvg(p.activityOut)} style={{ width: 14, height: 14 }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function ActionButton({
  label,
  uri,
  colors,
  iconType,
}: {
  label: string;
  uri: string;
  colors: BtnColors;
  iconType: BtnIconType;
}) {
  const iconColor =
    iconType === 'income' ? colors.incomeIcon :
      iconType === 'expense' ? colors.expenseIcon :
        colors.transferIcon;
  const svgIcon =
    iconType === 'income' ? arrowDownLeftSvg(iconColor) :
      iconType === 'expense' ? arrowUpRightSvg(iconColor) :
        repeatSvg(iconColor);

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        flex: 1,
        height: 38,
        backgroundColor: c(colors.bg),
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'flex-start',
        flexDirection: 'row',
        paddingLeft: 8,
        paddingRight: 5,
      }}
    >
      <FlexWidget
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          backgroundColor: c(colors.iconBg),
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 6,
        }}
      >
        <SvgWidget svg={svgIcon} style={{ width: 15, height: 15 }} />
      </FlexWidget>
      <TextWidget
        text={label}
        style={{ fontSize: 11, fontWeight: '600', color: c(colors.text) }}
        maxLines={1}
        truncate="END"
        allowFontScaling={false}
      />
    </FlexWidget>
  );
}

function QuickActions({ p }: { p: Palette }) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        paddingLeft: 12,
        paddingRight: 12,
        marginTop: 10,
        flexDirection: 'row',
        flexGap: 7,
        flexGapColor: GAP,
      }}
    >
      <ActionButton label="Income" uri={`${APP_SCHEME}://modals/add-transaction?type=in&fromWidget=1`} colors={p.btn} iconType="income" />
      <ActionButton label="Expense" uri={`${APP_SCHEME}://modals/add-transaction?type=out&fromWidget=1`} colors={p.btn} iconType="expense" />
      <ActionButton label="Transfer" uri={`${APP_SCHEME}://modals/add-transaction?type=transfer&fromWidget=1`} colors={p.btn} iconType="transfer" />
    </FlexWidget>
  );
}

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
  const { balance, balanceLabel, currencySymbol: sym, monthLabel } = data;
  const balanceValue = balance !== null ? fmtFull(balance, sym) : monthLabel;
  const displayValue = config.balanceDisplay === 'none' ? ' ' : balanceValue;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'wrap_content',
        flexDirection: 'column',
        backgroundColor: c(p.surface),
        borderRadius: CARD_R,
        paddingTop: 16,
        paddingBottom: 14,
      }}
    >
      {/* Option B: Two-Column Header Row */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingLeft: H_PAD,
          paddingRight: H_PAD,
          marginBottom: 10,
        }}
      >
        {/* Left Column: RENI + Date */}
        <FlexWidget style={{ flexDirection: 'column' }}>
          <TextWidget
            text="RENI"
            style={{ fontSize: 12, fontWeight: '700', color: c(p.label) }}
            allowFontScaling={false}
            maxLines={1}
          />
          <TextWidget
            text={formatWidgetDate()}
            style={{ fontSize: 10, fontWeight: '500', color: c(p.label), marginTop: 2 }}
            allowFontScaling={false}
            maxLines={1}
          />
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />

        {/* Right Column: Account/Label + Amount */}
        <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
          {balanceLabel ? (
            <TextWidget
              text={balanceLabel.toUpperCase()}
              style={{ fontSize: 11, fontWeight: '700', color: c(p.label) }}
              allowFontScaling={false}
              maxLines={1}
              truncate="END"
            />
          ) : null}
          <TextWidget
            text={displayValue}
            style={{
              fontSize: 24,
              fontWeight: '600',
              color: c(p.balance),
              marginTop: 2,
            }}
            allowFontScaling={false}
            maxLines={1}
            truncate="START"
          />
        </FlexWidget>
      </FlexWidget>

      <TickChart data={data} count={ticks} p={p} />

      {config.showTodayActivity && <ActivityRow data={data} p={p} />}

      {config.showQuickActions && <QuickActions p={p} />}
    </FlexWidget>
  );
}

export function renderReniWidget(data: WidgetData, config: ReniWidgetConfig, widgetWidthDp = 300) {
  const ticks = tickCount(widgetWidthDp);
  const theme = config.bgTheme || 'classic';
  const lightPalette = getWidgetPalette('light', theme);
  const darkPalette = getWidgetPalette('dark', theme);
  return {
    light: <ReniWidgetLayout data={data} config={config} p={lightPalette} ticks={ticks} />,
    dark: <ReniWidgetLayout data={data} config={config} p={darkPalette} ticks={ticks} />,
  };
}
