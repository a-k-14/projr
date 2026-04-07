import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { MONTHS } from '../../lib/settings-shared';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { ChoiceRow, SectionLabel } from '../../components/settings-ui';

export default function YearStartScreen() {
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
    <BottomSheet
      title="Year Start"
      subtitle="Choose the first month of your year"
      palette={palette}
      onClose={() => router.back()}
    >
      <SectionLabel label="Select a month" palette={palette} />
      {MONTHS.map((month, index) => (
        <ChoiceRow
          key={month}
          title={month}
          selected={settings.yearStart === index}
          palette={palette}
          onPress={() => updateSettings({ yearStart: index })}
          noBorder={index === MONTHS.length - 1}
        />
      ))}
    </BottomSheet>
  );
}
