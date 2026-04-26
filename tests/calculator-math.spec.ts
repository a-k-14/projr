import {
  appendCalculatorToken,
  evaluateCalculatorExpression,
  getCalculatorPreviewResult,
  prettifyCalculatorValue,
} from '../lib/calculatorMath';

describe('calculator math', () => {
  it('drops leading zeroes inside each operand while typing', () => {
    let display = '0';
    for (const token of ['7', '+', '0', '1', '2']) {
      display = appendCalculatorToken(display, token);
    }

    expect(display).toBe('7+12');
    expect(evaluateCalculatorExpression(display)).toBe('19');
  });

  it('accepts a trailing decimal before an operator as the whole number', () => {
    let display = '0';
    for (const token of ['7', '.', '+', '2']) {
      display = appendCalculatorToken(display, token);
    }

    expect(display).toBe('7+2');
    expect(evaluateCalculatorExpression(display)).toBe('9');
  });

  it('normalizes pasted or existing expressions before evaluation', () => {
    expect(evaluateCalculatorExpression('7+012')).toBe('19');
    expect(evaluateCalculatorExpression('7.+2')).toBe('9');
    expect(prettifyCalculatorValue('0000123+0045')).toBe('123+45');
  });

  it('replaces consecutive operators with the latest operator', () => {
    let display = '0';
    for (const token of ['7', '+', '−', '2']) {
      display = appendCalculatorToken(display, token);
    }

    expect(display).toBe('7−2');
    expect(evaluateCalculatorExpression(display)).toBe('5');
  });

  it('keeps standard percent calculations working', () => {
    expect(evaluateCalculatorExpression('200×10%')).toBe('20');
    expect(getCalculatorPreviewResult('200×10%')).toBe('20');
  });

  it('formats typed operands and preview results with Indian commas', () => {
    let display = '0';
    for (const token of ['1', '2', '3', '4', '5', '6', '7', '+', '8', '9', '0', '0', '0']) {
      display = appendCalculatorToken(display, token);
    }

    expect(display).toBe('12,34,567+89,000');
    expect(getCalculatorPreviewResult(display)).toBe('13,23,567');
    expect(prettifyCalculatorValue('100000+50000')).toBe('1,00,000+50,000');
  });
});
