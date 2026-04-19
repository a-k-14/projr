import { buildCashflowChartData } from '../lib/derived.ts';
import { toLocalDayEndISO, toLocalDayStartISO } from '../lib/dateUtils.ts';

describe('cashflow chart drilldown alignment', () => {
  it('keeps day 7 in W1 and day 8 in W2 for monthly charts', () => {
    const from = toLocalDayStartISO(new Date(2026, 3, 1, 12, 0, 0, 0));
    const to = toLocalDayEndISO(new Date(2026, 3, 30, 12, 0, 0, 0));

    const chart = buildCashflowChartData(
      'month',
      [
        { date: new Date(2026, 3, 7, 12, 0, 0, 0).toISOString(), in: 70, out: 0 },
        { date: new Date(2026, 3, 8, 12, 0, 0, 0).toISOString(), in: 80, out: 0 },
      ],
      from,
      to,
    );

    expect(chart[0]?.in).toBe(70);
    expect(chart[1]?.in).toBe(80);
  });
});
