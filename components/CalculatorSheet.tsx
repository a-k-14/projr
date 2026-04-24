import React, { useState, useEffect } from 'react';
import { Text } from '@/components/ui/AppText';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './ui/BottomSheet';
import { CALCULATOR_DISPLAY_MAX_LINES, getCalculatorDisplayMetrics } from '../lib/calculatorDisplay';
import {
  appendCalculatorToken,
  evaluateCalculatorExpression,
  getCalculatorPreviewResult,
  prettifyCalculatorValue,
} from '../lib/calculatorMath';
import { SCREEN_GUTTER } from '../lib/design';
import { AppThemePalette } from '../lib/theme';
import { BUTTON_TOKENS, PRIMARY_ACTION } from '../lib/layoutTokens';

interface CalculatorSheetProps {
  visible: boolean;
  value: string;
  palette: AppThemePalette;
  brandColor?: string;
  brandSoft?: string;
  brandOnColor?: string;
  onClose: () => void;
  onApply: (finalValue: string) => void;
}

const BUTTONS = [
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
] as const;

export function CalculatorSheet({
  visible,
  value,
  palette,
  brandColor,
  brandSoft,
  brandOnColor,
  onClose,
  onApply,
}: CalculatorSheetProps) {
  const [display, setDisplay] = useState(prettifyCalculatorValue(value) || '0');

  useEffect(() => {
    if (visible) {
      setDisplay(prettifyCalculatorValue(value) || '0');
    }
  }, [value, visible]);

  if (!visible) return null;

  const appendToken = (token: string) => {
    setDisplay((current) => appendCalculatorToken(current, token));
  };

  const backspace = () => {
    setDisplay((current) => {
      const next = current.slice(0, -1);
      return next || '0';
    });
  };

  const evaluate = () => evaluateCalculatorExpression(display);

  const handleApply = () => {
    const final = evaluate();
    onApply(final);
  };

  const handleClear = () => {
    setDisplay('0');
  };

  const handleEvaluate = () => {
    setDisplay(prettifyCalculatorValue(evaluate()));
  };

  const displayMetrics = getCalculatorDisplayMetrics(display, 36);
  const previewResult = getCalculatorPreviewResult(display);

  return (
    <BottomSheet
      title="Calculator"
      showHeaderTitle={false}
      palette={palette}
      onClose={onClose}
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
          {/* Row 1: C, Backspace, %, ÷ */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <CalcButton label="C" onPress={handleClear} palette={palette} />
            <CalcButton label="⌫" onPress={backspace} palette={palette} />
            <CalcButton
              label="%"
              onPress={() => appendToken('%')}
              palette={palette}
              brandSoft={brandSoft}
              brandOnColor={brandOnColor}
            />
            <CalcButton
              label="÷"
              onPress={() => appendToken('÷')}
              palette={palette}
              brandSoft={brandSoft}
              brandOnColor={brandOnColor}
            />
          </View>

          {/* Middle Rows: Numbers 1-9 and Operators ×, −, + */}
          {BUTTONS.map((row, idx) => (
            <View key={idx} style={{ flexDirection: 'row', gap: 10 }}>
              {row.map((label) => (
                <CalcButton
                  key={label}
                  label={label}
                  onPress={() => appendToken(label)}
                  palette={palette}
                  brandSoft={brandSoft}
                  brandOnColor={brandOnColor}
                />
              ))}
            </View>
          ))}

          {/* Last Row: ., 0, =, OK */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <CalcButton label="." onPress={() => appendToken('.')} palette={palette} />
            <CalcButton label="0" onPress={() => appendToken('0')} palette={palette} />
            <CalcButton
              label="="
              onPress={handleEvaluate}
              palette={palette}
              brandSoft={brandSoft}
              brandOnColor={brandOnColor}
            />
            <CalcButton
              label="OK"
              onPress={handleApply}
              palette={palette}
              brandColor={brandColor}
              brandOnColor={brandOnColor}
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
  brandOnColor,
}: {
  label: string;
  onPress: () => void;
  palette: AppThemePalette;
  primary?: boolean;
  brandColor?: string;
  brandSoft?: string;
  brandOnColor?: string;
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
      activeOpacity={0.4}
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
        <Ionicons name="backspace-outline" size={22} color={primary ? (brandOnColor || palette.onBrand) : palette.text} />
      ) : (
        <Text
          style={{
            fontSize: label === 'OK' ? 16 : 18,
            fontWeight: primary ? PRIMARY_ACTION.labelWeight : BUTTON_TOKENS.text.labelWeight,
            color: primary ? (brandOnColor || palette.onBrand) : palette.text,
          }}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
