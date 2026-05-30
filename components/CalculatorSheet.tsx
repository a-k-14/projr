import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@/components/ui/AppText';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { BottomSheet } from './ui/BottomSheet';
import { getCalculatorDisplayMetrics } from '../lib/calculatorDisplay';
import {
  appendCalculatorToken,
  evaluateCalculatorExpression,
  getCalculatorPreviewResult,
  prettifyCalculatorValue,
} from '../lib/calculatorMath';
import { SCREEN_GUTTER, FONT_WEIGHT } from '../lib/design';
import { AppThemePalette } from '../lib/theme';
import { BUTTON_TOKENS, PRIMARY_ACTION, HOME_RADIUS } from '../lib/layoutTokens';

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
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setDisplay(prettifyCalculatorValue(value) || '0');
    }
  }, [value, visible]);

  useEffect(() => {
    if (visible) {
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [display, visible]);

  if (!visible) return null;

  const appendToken = (token: string) => {
    setDisplay((current) => appendCalculatorToken(current, token));
  };

  const backspace = () => {
    setDisplay((current) => {
      const raw = current.replace(/,/g, '');
      const next = raw.slice(0, -1);
      return next ? prettifyCalculatorValue(next) || '0' : '0';
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

  const displayMetrics = getCalculatorDisplayMetrics(display);
  const previewResult = getCalculatorPreviewResult(display);

  const isPureNumber = !/[+−×÷%]/.test(display);
  const formattedDisplay = isPureNumber
    ? display
    : display.replace(/([+−×÷])/g, ' $1 ').replace(/\s+/g, ' ').trim();

  return (
    <BottomSheet
      title="Calculator"
      showHeaderTitle={false}
      palette={palette}
      onClose={onClose}
    >
      <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 20 }}>
        <View style={{ marginBottom: 16 }}>
          <ScrollView
            ref={scrollRef}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            style={{ height: 80 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', alignItems: 'flex-end' }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            <Text
              style={{
                fontSize: displayMetrics.fontSize,
                lineHeight: displayMetrics.lineHeight,
                fontWeight: FONT_WEIGHT.regular,
                color: palette.text,
                letterSpacing: 0,
                textAlign: 'right',
              }}
            >
              {formattedDisplay}
            </Text>
          </ScrollView>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={{
              minHeight: 24,
              marginTop: 6,
              fontSize: 20,
              fontWeight: FONT_WEIGHT.semibold,
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

  const bg = primary
    ? (brandColor || palette.tabActive)
    : isOperator
      ? (brandSoft || palette.brandSoft)
      : palette.surface;
  const borderColor = primary || isOperator
    ? 'transparent'
    : palette.states.calcBorder;

  const pressOverlay = primary || isOperator
    ? 'rgba(255,255,255,0.14)'
    : palette.states.calcPressOverlay;

  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1 }}
    >
      {({ pressed }) => (
        <View
          style={{
            minHeight: 58,
            borderRadius: HOME_RADIUS.pill,
            backgroundColor: bg,
            borderWidth: 0.7,
            borderColor,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {pressed && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: pressOverlay }]} />
          )}
          {label === '⌫' ? (
            <AppIcon name="delete" size={22} color={primary ? (brandOnColor || palette.onBrand) : palette.text} strokeWidth={1.9} />
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
        </View>
      )}
    </Pressable>
  );
}
