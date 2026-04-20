import { getCalculatorDisplayMetrics } from '../lib/calculatorDisplay';

describe('calculator display sizing', () => {
  it('keeps the base font for values that fit the two-line target', () => {
    expect(getCalculatorDisplayMetrics('12,34,56,789+90,000', 36).fontSize).toBe(36);
  });

  it('shrinks long expressions after the two-line target', () => {
    expect(getCalculatorDisplayMetrics('12,34,56,789+90,000+12,34,56,789', 36).fontSize).toBeLessThan(36);
  });

  it('does not shrink below the minimum display size', () => {
    expect(getCalculatorDisplayMetrics('1'.repeat(200), 36).fontSize).toBeGreaterThanOrEqual(21);
  });
});
