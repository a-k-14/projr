import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './ui/BottomSheet';
import { CALCULATOR_DISPLAY_MAX_LINES, getCalculatorDisplayMetrics } from '../lib/calculatorDisplay';
import { formatIndianNumberStr } from '../lib/derived';
import { SCREEN_GUTTER } from '../lib/design';
import { AppThemePalette } from '../lib/theme';

interface CalculatorSheetProps {
  visible: boolean;
  value: string;
  palette: AppThemePalette;
  brandColor?: string;
  brandSoft?: string;
  onClose: (finalValue: string) => void;
}

const BUTTONS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['0', '.', '%', '+'],
] as const;

export function CalculatorSheet({
  visible,
  value,
  palette,
  brandColor,
  brandSoft,
  onClose,
}: CalculatorSheetProps) {
  const pretty = (val: string) => {
    if (!val) return '';
    const segments = val.split(/([+−×÷%*\/%-])/);
    return segments
      .map((seg) => {
        if (/^[0-9.]+$/.test(seg)) {
          return formatIndianNumberStr(seg);
        }
        return seg.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
      })
      .join('');
  };
  const raw = (val: string) => val.replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/[−]/g, '-').replace(/,/g, '');

  const [display, setDisplay] = useState(pretty(value) || '0');

  useEffect(() => {
    if (visible) {
      setDisplay(pretty(value) || '0');
    }
  }, [value, visible]);

  if (!visible) return null;

  const evaluateExpression = (input: string) => {
    let expr = input.trim();
    if (!expr || expr === '0') return '0';
    expr = expr.replace(/[+−×÷]+$/, '');
    if (!expr) return '0';
    try {
      const normalized = raw(expr).replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
      const safe = normalized.replace(/[^0-9+\-*/().\s]/g, '');
      const result = Function(`"use strict"; return (${safe});`)();
      return Number.isFinite(result)
        ? String(Number.parseFloat(Number(result).toFixed(10)))
        : raw(expr);
    } catch {
      return raw(expr);
    }
  };

  const getPreviewResult = (input: string) => {
    const expr = input.trim();
    if (!/[+−×÷%*/-]/.test(expr)) return null;
    if (/[+−×÷]$/.test(expr)) return null;

    const result = evaluateExpression(expr);
    if (!result || result === raw(expr)) return null;
    return pretty(result);
  };

  const appendToken = (token: string) => {
    setDisplay((current) => {
      const operators = ['+', '−', '×', '÷', '%'];
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
      }
      return `${base}${token}`;
    });
  };

  const backspace = () => {
    setDisplay((current) => {
      const next = current.slice(0, -1);
      return next || '0';
    });
  };

  const evaluate = () => evaluateExpression(display);

  const handleDone = () => {
    const final = evaluate();
    onClose(final);
  };
  const displayMetrics = getCalculatorDisplayMetrics(display, 36);
  const previewResult = getPreviewResult(display);

  return (
    <BottomSheet
      title="Calculator"
      showHeaderTitle={false}
      palette={palette}
      onClose={() => handleDone()}
    >
      <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 20 }}>
        <View style={{ minHeight: 118, justifyContent: 'center', alignItems: 'flex-end', marginBottom: 16 }}>
          <Text
            numberOfLines={CALCULATOR_DISPLAY_MAX_LINES}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            style={{
              fontSize: displayMetrics.fontSize,
              lineHeight: displayMetrics.lineHeight,
              fontWeight: '700',
              color: palette.text,
              letterSpacing: 0,
              textAlign: 'right',
            }}
          >
            {display}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={{
              minHeight: 24,
              marginTop: 6,
              fontSize: 20,
              fontWeight: '600',
              color: palette.textMuted,
              textAlign: 'right',
              letterSpacing: 0,
            }}
          >
            {previewResult ? `= ${previewResult}` : ''}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {BUTTONS.map((row, idx) => (
            <View key={idx} style={{ flexDirection: 'row', gap: 10 }}>
              {row.map((label) => (
                <CalcButton
                  key={label}
                  label={label}
                  onPress={() => appendToken(label)}
                  palette={palette}
                  brandSoft={brandSoft}
                />
              ))}
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <CalcButton label="C" onPress={() => setDisplay('0')} palette={palette} />
            <CalcButton label="⌫" onPress={backspace} palette={palette} />
            <CalcButton label="=" onPress={() => setDisplay(pretty(evaluate()))} palette={palette} brandSoft={brandSoft} />
            <CalcButton
              label="OK"
              onPress={handleDone}
              palette={palette}
              brandColor={brandColor}
              primary
            />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

function CalcButton({
  label,
  onPress,
  palette,
  primary,
  brandColor,
  brandSoft,
}: {
  label: string;
  onPress: () => void;
  palette: AppThemePalette;
  primary?: boolean;
  brandColor?: string;
  brandSoft?: string;
}) {
  const isOperator = ['÷', '×', '−', '+', '%', '='].includes(label);
  const isAction = ['C', '⌫', 'OK'].includes(label);
  const bg = primary
    ? (brandColor || palette.tabActive)
    : isAction
      ? palette.surface
      : isOperator
        ? (brandSoft || palette.brandSoft)
        : palette.surface;

  return (
    <TouchableOpacity
      delayPressIn={0}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 58,
        borderRadius: 14,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: primary ? (brandColor || palette.tabActive) : palette.divider,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label === '⌫' ? (
        <Ionicons name="backspace-outline" size={22} color={primary ? palette.onBrand : palette.text} />
      ) : (
        <Text
          style={{
            fontSize: label === 'OK' ? 16 : 18,
            fontWeight: '700',
            color: primary ? palette.onBrand : palette.text,
          }}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
