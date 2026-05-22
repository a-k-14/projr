import React from 'react';
import type { ColorProp } from 'react-native-android-widget';
import { FlexWidget, SvgWidget } from 'react-native-android-widget';

const c = (s: string): ColorProp => s as ColorProp;

interface QuickPalette {
  surface: string;
  btnBg: string;
  incomeIcon: string;
  expenseIcon: string;
  transferIcon: string;
}

const LIGHT_PALETTE: QuickPalette = {
  surface: '#F8FAFD',
  btnBg: '#ECEFF5',
  incomeIcon: '#438B62',
  expenseIcon: '#C95D52',
  transferIcon: '#1F2A44',
};

const DARK_PALETTE: QuickPalette = {
  surface: '#181A20',
  btnBg: '#25262B',
  incomeIcon: '#5AA87B',
  expenseIcon: '#D46A60',
  transferIcon: '#FFFFFF',
};

const APP_SCHEME = 'financetracker';
const GAP = c('#00000000');

function arrowDownLeftSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>`;
}

function arrowUpRightSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
}

function repeatSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
}

interface QuickWidgetLayoutProps {
  p: QuickPalette;
  width: number;
  height: number;
}

function ReniQuickWidgetLayout({ p, width, height }: QuickWidgetLayoutProps) {
  const isVertical = height > width;
  const dimensionToUse = isVertical ? height : width;

  // Resolve actions based on breakpoints
  let actions: Array<'income' | 'expense' | 'transfer'> = [];
  if (dimensionToUse < 110) {
    actions = ['expense'];
  } else if (dimensionToUse < 190) {
    actions = ['expense', 'income'];
  } else {
    actions = ['income', 'expense', 'transfer'];
  }

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c(p.surface),
        borderRadius: 22,
        flexGap: 10,
        flexGapColor: GAP,
      }}
    >
      {actions.map((act) => {
        let uri = '';
        let svg = '';
        if (act === 'income') {
          uri = `${APP_SCHEME}://modals/add-transaction?type=in&fromWidget=1`;
          svg = arrowDownLeftSvg(p.incomeIcon);
        } else if (act === 'expense') {
          uri = `${APP_SCHEME}://modals/add-transaction?type=out&fromWidget=1`;
          svg = arrowUpRightSvg(p.expenseIcon);
        } else {
          uri = `${APP_SCHEME}://modals/add-transaction?type=transfer&fromWidget=1`;
          svg = repeatSvg(p.transferIcon);
        }

        return (
          <FlexWidget
            key={act}
            clickAction="OPEN_URI"
            clickActionData={{ uri }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: c(p.btnBg),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SvgWidget svg={svg} style={{ width: 22, height: 22 }} />
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
