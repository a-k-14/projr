import { View, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { MONTHS, PickerSheetShell } from './_shared';
import { PickerChip, SectionLabel } from '../../components/settings-ui';

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
    <PickerSheetShell
      title="Year Start"
      subtitle="Choose the first month of your financial year"
      palette={palette}
      onClose={() => router.back()}
    >
      <SectionLabel label="Select a month" palette={palette} />
      <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap' }}>
        {MONTHS.map((month, index) => (
          <View key={month} style={{ width: '48%', marginBottom: 10 }}>
            <PickerChip
              label={month}
              selected={settings.yearStart === index}
              palette={palette}
              onPress={() => updateSettings({ yearStart: index })}
            />
          </View>
        ))}
      </View>
    </PickerSheetShell>
  );
}
