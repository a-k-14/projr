import { Text } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { router } from 'expo-router';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyStateCard } from '../components/ui/EmptyStateCard';
import { FinanceEmptyMascot } from '../components/ui/FinanceEmptyMascot';
import { getCompactScrollableBottomPadding } from '../components/ui/safeBottom';
import { ASSET_HERO_SURFACE } from '../lib/assetVisuals';
import { SCREEN_GUTTER , FONT_WEIGHT } from '../lib/design';
import { HOME_RADIUS, HOME_TEXT } from '../lib/layoutTokens';
import { useAppTheme } from '../lib/theme';
import { ScreenScaffold } from '../components/ui/ScreenScaffold';
import { HeaderAddButton } from '../components/ui/ScreenHeader';
import { GrainHeroCard } from '../components/ui/GrainHeroCard';
import { useAssetsStore } from '../stores/useAssetsStore';
import { useUIStore } from '../stores/useUIStore';
import { formatCurrency } from '../lib/derived';
import { isEmojiIcon } from '../lib/ui-format';
import { AppIcon } from '../components/ui/AppIcon';
import { PressableScale } from '../components/ui/PressableScale';
import { useEffect, useMemo } from 'react';

export default function AssetsScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const { assets, load, isLoaded, totalValue } = useAssetsStore();
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const displaySymbol = showCurrencySymbol ? currencySymbol : '';

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  const highestAsset = useMemo(() => {
    if (assets.length === 0) return undefined;
    return assets.reduce((max, a) => (a.value > max.value ? a : max), assets[0]);
  }, [assets]);

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Assets"
        palette={palette}
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        titleSize={25}
        titleWeight="400"
        rightAction={
          <HeaderAddButton
            onPress={() => router.push('/modals/asset-form')}
            palette={palette}
          />
        }
      />

      <FlashList
        data={assets}
        contentContainerStyle={{
          paddingHorizontal: SCREEN_GUTTER,
          paddingBottom: getCompactScrollableBottomPadding(insets),
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginTop: 4, marginBottom: 20 }}>
            <GrainHeroCard
              solidColor={ASSET_HERO_SURFACE}
              icon="gem"
              eyebrow="Total Asset Value"
              value={formatCurrency(totalValue, displaySymbol)}
              sym={displaySymbol}
              palette={palette}
              metrics={[
                {
                  label: 'ITEMS',
                  value: `${assets.length}`,
                },
                {
                  label: 'HIGHEST',
                  value: highestAsset ? formatCurrency(highestAsset.value, displaySymbol) : '—',
                },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyStateCard
            palette={palette}
            title="No assets yet"
            subtitle="Add assets you want included outside accounts, deposits, and loans."
            illustration={<FinanceEmptyMascot palette={palette} variant="account" />}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item: asset }) => (
          <PressableScale
            onPress={() => router.push({ pathname: '/modals/asset-form', params: { id: asset.id } })}
            style={{
              backgroundColor: palette.card,
              borderRadius: HOME_RADIUS.card,
              padding: 16,
              borderWidth: 1,
              borderColor: palette.borderSoft,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12
            }}
          >
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: palette.surface,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isEmojiIcon(asset.icon) ? (
                <Text style={{ fontSize: 24 }}>{asset.icon}</Text>
              ) : (
                <AppIcon name={asset.icon as any} size={24} color={palette.brand} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                {asset.name}
              </Text>
              {asset.note && (
                <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginTop: 2 }}>
                  {asset.note}
                </Text>
              )}
            </View>
            <Text style={{ fontSize: HOME_TEXT.bodyLarge, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
              {formatCurrency(asset.value, displaySymbol)}
            </Text>
          </PressableScale>
        )}
      />
    </ScreenScaffold>
  );
}
