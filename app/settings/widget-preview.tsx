import React, { useEffect, useState, Component, ReactNode } from 'react';
import { ActivityIndicator, Dimensions, NativeModules, ScrollView, TouchableOpacity, TurboModuleRegistry, View, Platform } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { WidgetPreview } from 'react-native-android-widget';
import { useAppTheme } from '../../lib/theme';
import { fetchWidgetData } from '../../widgets/widgetDataService';
import { renderReniWidget } from '../../widgets/ReniWidget';
import { DEFAULT_WIDGET_CONFIG } from '../../widgets/widgetTypes';
import type { WidgetData } from '../../widgets/widgetTypes';
import { SCREEN_GUTTER } from '../../lib/design';

const SCREEN_WIDTH = Dimensions.get('window').width;
const WIDGET_WIDTH = SCREEN_WIDTH - SCREEN_GUTTER * 2;
const WIDGET_HEIGHT_4x2 = 146;
const WIDGET_HEIGHT_2x2 = 146;

// Check native module availability without triggering the proxy error.
// New arch uses TurboModuleRegistry; old arch uses NativeModules.
const isNativeWidgetLinked =
  Platform.OS === 'android' &&
  (NativeModules.AndroidWidget != null ||
    TurboModuleRegistry.get('AndroidWidget') != null);

class WidgetErrorBoundary extends Component<{children: ReactNode, fallback: ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default function WidgetPreviewScreen() {
  const { palette, mode } = useAppTheme();
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);

  const config = DEFAULT_WIDGET_CONFIG;

  async function load() {
    setLoading(true);
    try {
      const d = await fetchWidgetData(config);
      setData(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const fallbackUI = (
    <View style={{ height: WIDGET_HEIGHT_4x2, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border }}>
      <Text style={{ color: palette.textMuted, textAlign: 'center', fontSize: 13 }}>
        Widget preview requires an Android development build.
      </Text>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={{ padding: SCREEN_GUTTER, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: palette.textMuted, letterSpacing: 0.6, marginBottom: 12 }}>
        4×2 — {mode === 'dark' ? 'DARK' : 'LIGHT'}
      </Text>

      {loading || !data ? (
        <View style={{ height: WIDGET_HEIGHT_4x2, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.brand} />
        </View>
      ) : !isNativeWidgetLinked ? (
        fallbackUI
      ) : (
        <WidgetErrorBoundary fallback={fallbackUI}>
          <WidgetPreview
            renderWidget={() => {
              const widget = renderReniWidget(data, config, WIDGET_WIDTH);
              return mode === 'dark' ? widget.dark! : widget.light;
            }}
            width={WIDGET_WIDTH}
            height={WIDGET_HEIGHT_4x2}
            showBorder
          />
        </WidgetErrorBoundary>
      )}

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={load}
        style={{
          marginTop: 20,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: palette.brand }}>
          Reload Data
        </Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 11, color: palette.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 16 }}>
        Highlighted areas are tappable.{'\n'}Toggle app theme to preview light/dark.
      </Text>
    </ScrollView>
  );
}
