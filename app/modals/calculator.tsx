import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatIndianNumberStr } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useBudgetDraftStore } from '../../stores/useBudgetDraftStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';

const BUTTONS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['0', '.', '%', '+'],
] as const;

export default function CalculatorModal() {
  const { palette } = useAppTheme();
  const txCalculatorValue = useTransactionDraftStore((s) => s.calculatorValue);
  const txSetCalculatorValue = useTransactionDraftStore((s) => s.setCalculatorValue);
  const txSetCalculatorOpen = useTransactionDraftStore((s) => s.setCalculatorOpen);
  const budgetCalculatorValue = useBudgetDraftStore((s) => s.calculatorValue);
  const budgetSetCalculatorValue = useBudgetDraftStore((s) => s.setCalculatorValue);
  const budgetSetCalculatorOpen = useBudgetDraftStore((s) => s.setCalculatorOpen);
  const { brandColor, brandSoft, draft } = useLocalSearchParams<{ brandColor?: string; brandSoft?: string; draft?: string }>();
  const useBudgetDraft = draft === 'budget';
  const calculatorValue = useBudgetDraft ? budgetCalculatorValue : txCalculatorValue;
  const setCalculatorValue = useBudgetDraft ? budgetSetCalculatorValue : txSetCalculatorValue;
  const setCalculatorOpen = useBudgetDraft ? budgetSetCalculatorOpen : txSetCalculatorOpen;
  
  // Keep display always in "pretty" format (÷, ×, −) with commas
  const pretty = (val: string) => {
    if (!val) return '';
    // Split by operators but keep them in the result to reconstruct
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
  
  const [display, setDisplay] = useState(pretty(calculatorValue) || '0');

  useEffect(() => {
    setCalculatorOpen(true);
    return () => {
      setCalculatorOpen(false);
    };
  }, [setCalculatorOpen]);

  useEffect(() => {
    setDisplay(pretty(calculatorValue) || '0');
  }, [calculatorValue]);

  const commit = (value: string) => {
    const next = value || '';
    setDisplay(pretty(next) || '0');
    setCalculatorValue(raw(next));
  };

  const appendToken = (token: string) => {
    setDisplay((current) => {
      const operators = ['+', '−', '×', '÷', '%'];
      const isNewTokenOperator = operators.includes(token);
      const lastChar = current.slice(-1);
      const isLastCharOperator = operators.includes(lastChar);
      
      let base = current;

      if (isNewTokenOperator) {
        // Replace last operator with new one
        if (isLastCharOperator) {
            base = current.slice(0, -1);
        } else if (lastChar === '.') {
            // If dot is at end, remove it before adding operator
            base = current.slice(0, -1);
        }
      } else if (token === '.') {
        // Prevent double decimals in the same number segment
        const parts = current.split(/[+−×÷%]/);
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('.')) return current;
        
        // If last char is operator, append '0.'
        if (isLastCharOperator || !current || current === '0') {
            base = (current === '0') ? '' : current;
            const updated = `${base}0.`;
            setCalculatorValue(raw(updated));
            return updated;
        }
      }
      
      // Handle leading zero replacement
      if (base === '0' && /[0-9.]/.test(token)) {
        base = '';
      }

      const updated = `${base}${token}`;
      setCalculatorValue(raw(updated));
      return updated;
    });
  };

  const backspace = () => {
    setDisplay((current) => {
      let next = current.slice(0, -1);
      if (!next) next = '0';
      setCalculatorValue(raw(next));
      return next;
    });
  };

  const clearAll = () => commit('');

  const evaluate = () => {
    let expr = display.trim();
    if (!expr || expr === '0') return;

    // Strip trailing operators (e.g., "94++" -> "94")
    expr = expr.replace(/[+−×÷%]+$/, '');
    
    // Safety check after stripping
    if (!expr) {
      commit('');
      return;
    }

    try {
      // Normalize for math engine
      const normalized = raw(expr).replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
      
      // Final security check for JS Function eval
      const safe = normalized.replace(/[^0-9+\-*/().\s]/g, '');
      const result = Function(`"use strict"; return (${safe});`)();
      
      // Round to avoid floating point issues, limit decimals
      const finalResult = Number.isFinite(result) 
        ? String(Number.parseFloat(Number(result).toFixed(10))) 
        : raw(expr);
        
      commit(finalResult);
    } catch {
      commit(raw(expr)); // Fallback to raw sanitized string
    }
  };

  const handleClose = () => {
    evaluate(); // Auto-evaluate expression before closing
    setCalculatorOpen(false);
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flex: 1, paddingTop: 8, paddingBottom: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 120,
            paddingHorizontal: SCREEN_GUTTER,
          }}
        >
          <TouchableOpacity onPress={handleClose} style={{ padding: 6, marginRight: 8 }}>
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, flex: 1 }}>
            Calculator
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={{ flex: 0.16, justifyContent: 'flex-end', paddingHorizontal: SCREEN_GUTTER }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 40,
                fontWeight: '700',
                color: palette.text,
                textAlign: 'right',
                letterSpacing: -1,
                marginBottom: 4,
              }}
            >
              {display}
            </Text>
          </View>

          <View style={{ flex: 0.84, justifyContent: 'flex-end', paddingHorizontal: SCREEN_GUTTER }}>
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: palette.border,
                paddingTop: 12,
                width: '100%',
              }}
            />

            <View style={{ height: 14 }} />

            <View style={{ width: '100%', gap: 10, marginBottom: 18, paddingHorizontal: 0 }}>
              {BUTTONS.map((row) => (
                <View
                  key={row.join('')}
                  style={{ width: '100%', flexDirection: 'row', gap: 10, paddingHorizontal: 0 }}
                >
                  {row.map((label) => (
                    <CalcButton
                      key={label}
                      label={label}
                      onPress={() => appendToken(label)}
                      palette={palette}
                      brandColor={brandColor}
                      brandSoft={brandSoft}
                    />
                  ))}
                </View>
              ))}
            </View>

            <View style={{ width: '100%', flexDirection: 'row', gap: 10, paddingHorizontal: 0 }}>
              <CalcButton label="C" onPress={clearAll} palette={palette} brandColor={brandColor} brandSoft={brandSoft} />
              <CalcButton label="⌫" onPress={backspace} palette={palette} brandColor={brandColor} brandSoft={brandSoft} />
              <CalcButton label="=" onPress={evaluate} palette={palette} brandColor={brandColor} brandSoft={brandSoft} />
              <CalcButton label="OK" onPress={handleClose} palette={palette} brandColor={brandColor} brandSoft={brandSoft} primary />
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
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
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 64,
        borderRadius: 18,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: primary ? (brandColor || palette.tabActive) : palette.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label === '⌫' ? (
        <Ionicons
          name="backspace-outline"
          size={24}
          color={primary ? palette.onBrand : palette.text}
        />
      ) : (
        <Text
          style={{
            fontSize: label === 'OK' ? HOME_TEXT.sectionTitle : HOME_TEXT.rowLabel,
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
