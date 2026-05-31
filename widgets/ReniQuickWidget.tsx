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
  // Shortcuts run along the longer axis; this is the space we ration them across.
  const mainDimension = isVertical ? height : width;
  // The "thickness" of each pill — its cross-axis room.
  const crossDimension = isVertical ? width : height;

  // Resolve how many shortcuts to show based on the main axis.
  let actions: ActKind[] = [];
  if (mainDimension < 110) {
    actions = ['expense'];
  } else if (mainDimension < 190) {
    actions = ['expense', 'income'];
  } else {
    actions = ['income', 'expense', 'transfer'];
  }

  // Show the labelled (icon + name) pill — mirroring the large widget — only when
  // the widget is roomy in BOTH directions: each pill needs enough length along
  // the main axis for the text, and enough thickness on the cross axis to seat the
  // icon chip + label comfortably.
  const lengthPerPill = mainDimension / actions.length;
  const showLabels = isVertical
    ? width >= 124 && lengthPerPill >= 48
    : lengthPerPill >= 100 && height >= 48;

  // Fill the cross axis (the library has no alignItems:'stretch') so pills fill the
  // widget in every configuration instead of floating as small chips.
  const crossFill = (isVertical ? { width: 'match_parent' } : { height: 'match_parent' }) as
    | { width: 'match_parent' }
    | { height: 'match_parent' };

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c(p.surface),
        borderRadius: 28,
        padding: 10,
        flexGap: 8,
        flexGapColor: GAP,
      }}
    >
      {actions.map((act) => {
        const meta = actionMeta(act, p);

        if (showLabels) {
          // Label + icon pill — copied from the large widget's ActionButton so the
          // two widgets read as one family.
          return (
            <FlexWidget
              key={act}
              clickAction="OPEN_URI"
              clickActionData={{ uri: meta.uri }}
              style={{
                flex: 1,
                ...crossFill,
                backgroundColor: c(p.btnBg),
                borderRadius: 18,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingLeft: 10,
                paddingRight: 10,
              }}
            >
              <FlexWidget
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  backgroundColor: c(p.iconBg),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 9,
                }}
              >
                <SvgWidget svg={meta.svg} style={{ width: 20, height: 20 }} />
              </FlexWidget>
              <TextWidget
                text={meta.label}
                style={{ fontSize: 14, fontWeight: '600', color: c(p.text) }}
                maxLines={1}
                truncate="END"
                allowFontScaling={false}
              />
            </FlexWidget>
          );
        }

        // Icon-only pill — fills its share of the widget; the rounded shape also
        // clips the touch ripple so the splash matches the pill.
        const iconSize = Math.max(22, Math.min(30, Math.round(crossDimension * 0.36)));
        return (
          <FlexWidget
            key={act}
            clickAction="OPEN_URI"
            clickActionData={{ uri: meta.uri }}
            style={{
              flex: 1,
              ...crossFill,
              borderRadius: 18,
              backgroundColor: c(p.btnBg),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SvgWidget svg={meta.svg} style={{ width: iconSize, height: iconSize }} />
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
