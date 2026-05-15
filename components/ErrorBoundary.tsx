import React from 'react';
import { View } from 'react-native';
import { Text } from './ui/AppText';
import { FilledButton } from './ui/AppButton';
import { FONT_WEIGHT } from '../lib/design';
import { HOME_TEXT } from '../lib/layoutTokens';
import { useAppTheme } from '../lib/theme';

interface State {
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
}

/**
 * Top-level error boundary. Catches render-time throws anywhere downstream
 * (init errors are handled separately in app/_layout.tsx). Surfaces a recovery
 * UI with a "Try again" reset instead of a white-screen crash.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (__DEV__) {
      console.error('ErrorBoundary caught', error, info.componentStack);
    }
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback message={this.state.error.message} onRetry={this.handleReset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { palette } = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        backgroundColor: palette.background,
      }}
    >
      <Text
        style={{
          fontSize: HOME_TEXT.heroValue,
          fontWeight: FONT_WEIGHT.bold,
          color: palette.text,
          marginBottom: 12,
          textAlign: 'center',
        }}
      >
        Something went wrong
      </Text>
      <Text
        style={{
          fontSize: HOME_TEXT.sectionTitle,
          lineHeight: 22,
          color: palette.textSecondary,
          textAlign: 'center',
          marginBottom: 24,
        }}
      >
        {message}
      </Text>
      <FilledButton label="Try again" onPress={onRetry} palette={palette} style={{ minWidth: 140 }} />
    </View>
  );
}
