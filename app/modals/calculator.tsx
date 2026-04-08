import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SCREEN_GUTTER } from '../../lib/design';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { useUIStore } from '../../stores/useUIStore';

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
          <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text, flex: 1 }}>
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
        minHeight: 64,
        borderRadius: 18,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: primary ? palette.tabActive : palette.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label === '⌫' ? (
        <Ionicons
          name="backspace-outline"
          size={24}
          color={primary ? '#fff' : palette.text}
        />
      ) : (
        <Text
          style={{
            fontSize: label === 'OK' ? 15 : 18,
            fontWeight: '700',
            color: primary ? '#fff' : palette.text,
          }}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
