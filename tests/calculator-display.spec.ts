import { getCalculatorDisplayMetrics } from '../lib/calculatorDisplay';

describe('calculator display sizing', () => {
  it('adjusts font size based on length but respects the minimum of 20px', () => {
    // Short values keep max font size
    expect(getCalculatorDisplayMetrics('12345', 24).fontSize).toBe(24);
    expect(getCalculatorDisplayMetrics('12,345,678', 24).fontSize).toBe(24);

    // Medium values scale down
    expect(getCalculatorDisplayMetrics('1'.repeat(22), 24).fontSize).toBe(23);
    expect(getCalculatorDisplayMetrics('1'.repeat(30), 24).fontSize).toBe(21);

    // Very long values clamp at 20px
    expect(getCalculatorDisplayMetrics('1'.repeat(50), 24).fontSize).toBe(20);
    expect(getCalculatorDisplayMetrics('1'.repeat(200), 24).fontSize).toBe(20);
  });
});
