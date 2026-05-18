import { Text } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ScreenHeroCard } from '../components/ui/ScreenHeroCard';
import { router } from 'expo-router';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleIconBadge } from '../components/ui/CircleIconBadge';
import { EmptyStateCard } from '../components/ui/EmptyStateCard';
import { FinanceEmptyMascot } from '../components/ui/FinanceEmptyMascot';
import { getCompactScrollableBottomPadding, SystemBottomGuard } from '../components/ui/safeBottom';
import { ASSET_BG, ASSET_TONE } from '../lib/assetVisuals';
import { SCREEN_GUTTER , FONT_WEIGHT, SPACING } from '../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../lib/layoutTokens';
import { useAppTheme } from '../lib/theme';
import { ScreenScaffold } from '../components/ui/ScreenScaffold';
import { HeaderAddButton } from '../components/ui/ScreenHeader';
import { useAssetsStore } from '../stores/useAssetsStore';
import { useUIStore } from '../stores/useUIStore';
import { formatCurrency } from '../lib/derived';
import { isEmojiIcon } from '../lib/ui-format';
import { AppIcon } from '../components/ui/AppIcon';
import React, { useEffect } from 'react';

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

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Assets"
        palette={palette}
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        rightAction={
          <HeaderAddButton
            onPress={() => router.push('/modals/asset-form')}
            palette={palette}
          />
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SCREEN_GUTTER,
          paddingBottom: getCompactScrollableBottomPadding(insets),
        }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeroCard
          palette={palette}
          accentColor={ASSET_TONE}
          icon="gem"
          screenLabel="Assets"
          badge={assets.length > 0 ? { label: `${assets.length} ${assets.length === 1 ? 'asset' : 'assets'}` } : undefined}
          eyebrow="Total Asset Value"
          primaryValue={formatCurrency(totalValue, displaySymbol)}
          style={{ marginTop: 12, marginBottom: 20 }}
        />

        {assets.length === 0 ? (
          <EmptyStateCard
            palette={palette}
            title="No assets yet"
            subtitle="Add assets you want included outside accounts, deposits, and loans."
            illustration={<FinanceEmptyMascot palette={palette} variant="account" />}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {assets.map((asset) => (
              <TouchableOpacity
                key={asset.id}
                onPress={() => router.push({ pathname: '/modals/asset-form', params: { id: asset.id } })}
                activeOpacity={0.7}
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
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}
