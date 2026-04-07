import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useUIStore } from '../../stores/useUIStore';
import { PickerSheetShell, THEMES } from '../../lib/settings-shared';
import { ChoiceRow, SectionLabel } from '../../components/settings-ui';
import { getThemePalette, resolveTheme } from '../../lib/theme';

export default function ThemeScreen() {
  const router = useRouter();
  const { settings, updateSettings, load, isLoaded } = useUIStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));

  useEffect(() => {
    if (!isLoaded) {
      load().catch(() => undefined);
    }
  }, [isLoaded, load]);

  return (
    <PickerSheetShell
      title="Theme"
      subtitle="Choose how the app follows system appearance"
      palette={palette}
      onClose={() => router.back()}
    >
      <SectionLabel label="Choose how the app follows system appearance" palette={palette} />
      {THEMES.map((theme, index) => (
        <ChoiceRow
          key={theme.key}
          title={theme.label}
          subtitle={
            theme.key === 'auto'
              ? 'Follow the device setting'
              : theme.key === 'light'
                ? 'Always use light mode'
                : 'Always use dark mode'
          }
          selected={settings.theme === theme.key}
          palette={palette}
          onPress={() => updateSettings({ theme: theme.key })}
          noBorder={index === THEMES.length - 1}
        />
      ))}
    </PickerSheetShell>
  );
}
