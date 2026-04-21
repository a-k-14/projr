import { formatIndianNumberStr } from './derived';

const DISPLAY_OPERATORS = ['+', '−', '×', '÷', '%'] as const;
const BASIC_OPERATORS = ['+', '−', '×', '÷'] as const;

function toRaw(value: string) {
  return value.replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/[−]/g, '-').replace(/,/g, '');
}

function toDisplay(value: string) {
  return value.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
}

function isDisplayOperator(value: string) {
  return DISPLAY_OPERATORS.includes(value as (typeof DISPLAY_OPERATORS)[number]);
}

function isBasicOperator(value: string) {
  return BASIC_OPERATORS.includes(value as (typeof BASIC_OPERATORS)[number]);
}

function normalizeNumberToken(token: string) {
  if (!token) return token;
  const hasTrailingDecimal = token.endsWith('.');
  const [integerPart = '', decimalPart] = token.split('.');
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || '0';
  const normalized = decimalPart === undefined
    ? normalizedInteger
    : `${normalizedInteger}.${decimalPart}`;
  return hasTrailingDecimal ? normalized.replace(/\.$/, '') : normalized;
}

function normalizeExpressionNumbers(expression: string) {
  let result = '';
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];
    if (/\d|\./.test(char)) {
      let token = '';
      let decimalSeen = false;

      while (index < expression.length) {
        const next = expression[index];
        if (/\d/.test(next)) {
          token += next;
          index += 1;
          continue;
        }
        if (next === '.' && !decimalSeen) {
          token += next;
          decimalSeen = true;
          index += 1;
          continue;
        }
        break;
      }

      result += normalizeNumberToken(token);
      continue;
    }

    result += char;
    index += 1;
  }

  return result;
}

export function prettifyCalculatorValue(value: string) {
  if (!value) return '';
  const normalized = normalizeExpressionNumbers(toDisplay(value));
  const segments = normalized.split(/([+−×÷%*\/-])/);
  return segments
    .map((segment) => {
      if (/^[0-9.]+$/.test(segment)) {
        return formatIndianNumberStr(segment);
      }
      return toDisplay(segment);
    })
    .join('');
}

export function appendCalculatorToken(current: string, token: string) {
  const operators = DISPLAY_OPERATORS as readonly string[];
  const isNewTokenOperator = operators.includes(token);
  const lastChar = current.slice(-1);
  const isLastCharOperator = operators.includes(lastChar);
  let base = current;

  if (isNewTokenOperator) {
    if (isLastCharOperator) {
      base = current.slice(0, -1);
    } else if (lastChar === '.') {
      base = current.slice(0, -1);
    }
  } else if (token === '.') {
    const parts = current.split(/[+−×÷%]/);
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes('.')) return current;
    if (isLastCharOperator || !current || current === '0') {
      base = current === '0' ? '' : current;
      return `${base}0.`;
    }
  }

  if (base === '0' && /[0-9.]/.test(token)) {
    base = '';
  } else if (/^\d$/.test(token)) {
    const match = base.match(/(^|[+−×÷%])0$/);
    if (match) {
      base = base.slice(0, -1);
    }
  }

  return `${base}${token}`;
}

export function evaluateCalculatorExpression(input: string) {
  let expr = input.trim();
  if (!expr || expr === '0') return '0';
  while (isBasicOperator(expr.slice(-1)) || expr.endsWith('.')) {
    expr = expr.slice(0, -1);
  }
  if (!expr) return '0';

  try {
    const rawExpression = normalizeExpressionNumbers(toRaw(expr));
    const normalized = rawExpression.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
    const safe = normalized.replace(/[^0-9+\-*/().\s]/g, '');
    const result = Function(`"use strict"; return (${safe});`)();
    return Number.isFinite(result)
      ? String(Number.parseFloat(Number(result).toFixed(10)))
      : rawExpression;
  } catch {
    return normalizeExpressionNumbers(toRaw(expr));
  }
}

export function getCalculatorPreviewResult(input: string) {
  const expr = input.trim();
  if (!/[+−×÷%*/-]/.test(expr)) return null;
  if (/[+−×÷]$/.test(expr)) return null;

  const result = evaluateCalculatorExpression(expr);
  const normalizedInput = normalizeExpressionNumbers(toRaw(expr));
  if (!result || result === normalizedInput) return null;
  return prettifyCalculatorValue(result);
}
