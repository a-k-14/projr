import React from 'react';
import type { ColorProp } from 'react-native-android-widget';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

const c = (s: string): ColorProp => s as ColorProp;

interface QuickPalette {
  surface: string;
  btnBg: string;
  // Inner icon-chip background for the labelled pill (matches the large widget).
  iconBg: string;
  text: string;
  incomeIcon: string;
  expenseIcon: string;
  transferIcon: string;
}

const LIGHT_PALETTE: QuickPalette = {
  surface: '#F8FAFD',
  btnBg: '#ECEFF5',
  iconBg: '#F8FAFD',
  text: '#1F2A44',
  incomeIcon: '#438B62',
  expenseIcon: '#C95D52',
  transferIcon: '#1F2A44',
};

const DARK_PALETTE: QuickPalette = {
  surface: '#181A20',
  btnBg: '#25262B',
  iconBg: '#181A20',
  text: '#FFFFFF',
  incomeIcon: '#5AA87B',
  expenseIcon: '#D46A60',
  transferIcon: '#FFFFFF',
};

const APP_SCHEME = 'financetracker';
const GAP = c('#00000000');

type ActKind = 'income' | 'expense' | 'transfer';

function arrowDownLeftSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>`;
}

function arrowUpRightSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
}

function repeatSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
}

interface ActMeta {
  uri: string;
  svg: string;
  label: string;
}

function actionMeta(act: ActKind, p: QuickPalette): ActMeta {
  if (act === 'income') {
    return {
      uri: `${APP_SCHEME}://modals/add-transaction?type=in&fromWidget=1`,
      svg: arrowDownLeftSvg(p.incomeIcon),
      label: 'Income',
    };
  }
  if (act === 'expense') {
    return {
      uri: `${APP_SCHEME}://modals/add-transaction?type=out&fromWidget=1`,
      svg: arrowUpRightSvg(p.expenseIcon),
      label: 'Expense',
    };
  }
  return {
    uri: `${APP_SCHEME}://modals/add-transaction?type=transfer&fromWidget=1`,
    svg: repeatSvg(p.transferIcon),
    label: 'Transfer',
  };
}

interface QuickWidgetLayoutProps {
  p: QuickPalette;
  width: number;
  height: number;
}

function ReniQuickWidgetLayout({ p, width, height }: QuickWidgetLayoutProps) {
  const isVertical = height > width;
  const mainDimension = isVertical ? height : width;

  let actions: ActKind[] = [];
  if (mainDimension < 110) {
    actions = ['expense'];
  } else if (mainDimension < 190) {
    actions = ['expense', 'income'];
  } else {
    actions = ['income', 'expense', 'transfer'];
  }

  const lengthPerPill = mainDimension / actions.length;
  const showLabels = isVertical
    ? width >= 124 && lengthPerPill >= 48
    : lengthPerPill >= 100 && height >= 48;

  const crossFill = (isVertical ? { width: 'match_parent' } : { height: 'match_parent' }) as
    | { width: 'match_parent' }
    | { height: 'match_parent' };

  // The Android widget host doesn't always flex-distribute child heights cleanly,
  // so we keep per-pill *content* compact (smaller icon-bg, smaller font) when
  // three pills must stack vertically. That way even if pills end up content-sized
  // rather than evenly split, the third pill (Transfer) still fits without clipping.
  const tightVertical = isVertical && actions.length >= 3;
  const outerPad = tightVertical ? 8 : 12;
  const gap = tightVertical ? 5 : 8;
  const iconBgSize = tightVertical ? 26 : 32;
  const iconBgRadius = tightVertical ? 9 : 11;
  const iconSvgSize = tightVertical ? 14 : 18;
  const labelFontSize = tightVertical ? 12 : 13;
  const labelPillPadY = tightVertical ? 3 : 5;
  const iconOnlySvgSize = tightVertical ? 18 : 22;

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c(p.surface),
        borderRadius: 32,
        padding: outerPad,
        flexGap: gap,
        flexGapColor: GAP,
      }}
    >
      {actions.map((act) => {
        const meta = actionMeta(act, p);

        if (showLabels) {
          return (
            <FlexWidget
              key={act}
              clickAction="OPEN_URI"
              clickActionData={{ uri: meta.uri }}
              style={{
                flex: 1,
                ...crossFill,
                backgroundColor: c(p.btnBg),
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingLeft: 6,
                paddingRight: 10,
                paddingTop: labelPillPadY,
                paddingBottom: labelPillPadY,
              }}
            >
              <FlexWidget
                style={{
                  width: iconBgSize,
                  height: iconBgSize,
                  borderRadius: iconBgRadius,
                  backgroundColor: c(p.iconBg),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                <SvgWidget svg={meta.svg} style={{ width: iconSvgSize, height: iconSvgSize }} />
              </FlexWidget>
              <TextWidget
                text={meta.label}
                style={{ fontSize: labelFontSize, fontWeight: '600', color: c(p.text) }}
                maxLines={1}
                truncate="END"
                allowFontScaling={false}
              />
            </FlexWidget>
          );
        }

        // Icon-only pill — render the SVG directly on the pill background. No nested
        // icon chip: with no label there's nothing to visually distinguish from, and
        // the extra layer just made the icon look boxed-in.
        return (
          <FlexWidget
            key={act}
            clickAction="OPEN_URI"
            clickActionData={{ uri: meta.uri }}
            style={{
              flex: 1,
              ...crossFill,
              borderRadius: 16,
              backgroundColor: c(p.btnBg),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SvgWidget svg={meta.svg} style={{ width: iconOnlySvgSize, height: iconOnlySvgSize }} />
          </FlexWidget>
        );
      })}
    </FlexWidget>
  );
}

export function renderReniQuickWidget(width = 100, height = 100) {
  const w = (!width || width < 20) ? 100 : width;
  const h = (!height || height < 20) ? 100 : height;

  return {
    light: <ReniQuickWidgetLayout p={LIGHT_PALETTE} width={w} height={h} />,
    dark: <ReniQuickWidgetLayout p={DARK_PALETTE} width={w} height={h} />,
  };
}
