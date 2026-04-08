import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { useUIStore } from '../../stores/useUIStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';

const BUTTONS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['0', '.', '%', '+'],
] as const;

export default function CalculatorModal() {
  const { settings } = useUIStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));
  const { calculatorValue, setCalculatorValue, setCalculatorOpen } = useTransactionDraftStore();
  const [display, setDisplay] = useState(calculatorValue || '0');

  useEffect(() => {
    setCalculatorOpen(true);
    return () => {
      setCalculatorOpen(false);
    };
  }, [setCalculatorOpen]);

  useEffect(() => {
    setDisplay(calculatorValue || '0');
  }, [calculatorValue]);

  const commit = (value: string) => {
    const next = value || '0';
    setDisplay(next);
    setCalculatorValue(next);
  };

  const appendToken = (token: string) => {
    setDisplay((current) => {
      const next = token === '×' ? '*' : token === '÷' ? '/' : token === '−' ? '-' : token;
      const base = current === '0' && /[0-9.]/.test(token) ? '' : current;
      const updated = `${base}${next}`;
      setCalculatorValue(updated);
      return updated;
    });
  };

  const backspace = () => {
    setDisplay((current) => {
      const next = current.length <= 1 ? '0' : current.slice(0, -1);
      setCalculatorValue(next);
      return next;
    });
  };

  const clearAll = () => commit('0');

  const evaluate = () => {
    const expr = display.trim();
    if (!expr) return;
    try {
      const transformed = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
      const normalized = transformed.replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/[−]/g, '-');
      const safe = normalized.replace(/[^0-9+\-*/().\s]/g, '');
      const result = Function(`"use strict"; return (${safe});`)();
      const next = Number.isFinite(result) ? String(Number.parseFloat(Number(result).toFixed(8))) : expr;
      commit(next);
    } catch {
      commit(expr);
    }
  };

  const handleClose = () => {
    setCalculatorOpen(false);
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flex: 1, paddingTop: 8, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18, paddingHorizontal: 16 }}>
          <TouchableOpacity onPress={handleClose} style={{ padding: 6, marginRight: 8 }}>
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text, flex: 1 }}>
            Calculator
          </Text>
        </View>

        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: 24,
            paddingHorizontal: 18,
            paddingVertical: 18,
            borderWidth: 1,
            borderColor: palette.border,
            marginBottom: 18,
          }}
        >
          <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 8 }}>Amount</Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 34,
              fontWeight: '700',
              color: palette.text,
              textAlign: 'right',
              letterSpacing: -0.8,
            }}
          >
            {display}
          </Text>
        </View>

        <View style={{ width: '100%', gap: 10, marginBottom: 16, paddingHorizontal: 0 }}>
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
                />
              ))}
            </View>
          ))}
        </View>

        <View style={{ width: '100%', flexDirection: 'row', gap: 10, paddingHorizontal: 0 }}>
          <CalcButton label="C" onPress={clearAll} palette={palette} />
          <CalcButton label="⌫" onPress={backspace} palette={palette} />
          <CalcButton label="=" onPress={evaluate} palette={palette} />
          <CalcButton label="OK" onPress={handleClose} palette={palette} primary />
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
}: {
  label: string;
  onPress: () => void;
  palette: ReturnType<typeof getThemePalette>;
  primary?: boolean;
}) {
  const isOperator = ['÷', '×', '−', '+', '%', '='].includes(label);
  const isAction = ['C', '⌫', 'OK'].includes(label);
  const bg = primary
    ? palette.tabActive
    : isAction
      ? palette.surface
      : isOperator
        ? 'rgba(23, 103, 59, 0.08)'
        : palette.surface;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 56,
        borderRadius: 18,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: primary ? palette.tabActive : palette.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: label === 'OK' ? 15 : 18,
          fontWeight: '700',
          color: primary ? '#fff' : palette.text,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
