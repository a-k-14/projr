import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useUIStore } from '../../stores/useUIStore';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { CURRENCIES } from '../../lib/settings-shared';
import { ChoiceRow, SectionLabel } from '../../components/settings-ui';
import { getThemePalette, resolveTheme } from '../../lib/theme';

export default function CurrencyScreen() {
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
      title="Currency"
      subtitle="Pick the currency shown across the app"
      palette={palette}
      onClose={() => router.back()}
    >
      <SectionLabel label="Pick the currency shown across the app" palette={palette} />
      {CURRENCIES.map((currency, index) => (
        <ChoiceRow
          key={currency.code}
          title={`${currency.symbol} ${currency.code}`}
          subtitle={currency.name}
          selected={settings.currency === currency.code}
          palette={palette}
          onPress={() => updateSettings({ currency: currency.code, currencySymbol: currency.symbol })}
          noBorder={index === CURRENCIES.length - 1}
        />
      ))}
    </BottomSheet>
  );
}
