import { Text } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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
        <View
          style={{
            marginTop: 12,
            marginBottom: 20,
            borderRadius: HOME_RADIUS.card,
            borderWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            padding: 20,
            elevation: 6,
            shadowColor: '#94A3B8',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.13,
            shadowRadius: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{
              width: 42,
              height: 42,
              borderRadius: HOME_RADIUS.chip,
              backgroundColor: ASSET_BG,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AppIcon name="gem" size={20} color={ASSET_TONE} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: HOME_TEXT.metaSmall, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, marginBottom: 4 }}>
                Total Asset Value
              </Text>
              {(() => {
                const val = formatCurrency(totalValue, displaySymbol);
                const dotIdx = val.lastIndexOf('.');
                const hasDot = dotIdx !== -1;
                const intPart = hasDot ? val.slice(0, dotIdx) : val;
                const decPart = hasDot ? val.slice(dotIdx) : '';
                
                let symbol = '';
                let mainVal = intPart;
                const isNegative = intPart.startsWith('-');
                const temp = isNegative ? intPart.slice(1) : intPart;
                if (temp.length > 0 && !/[\d]/.test(temp[0])) {
                  const numericIdx = temp.search(/[\d]/);
                  if (numericIdx !== -1) {
                    symbol = temp.slice(0, numericIdx).trim();
                    mainVal = (isNegative ? '-' : '') + temp.slice(numericIdx);
                  }
                }

                return (
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    {symbol ? (
                      <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginRight: 3 }}>
                        {symbol}
                      </Text>
                    ) : null}
                    <Text adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: HOME_TEXT.heroCardValue, fontWeight: FONT_WEIGHT.medium, color: palette.text, letterSpacing: -0.5 }}>
                      {mainVal}
                    </Text>
                    {decPart ? (
                      <Text style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, letterSpacing: -0.2 }}>
                        {decPart}
                      </Text>
                    ) : null}
                  </View>
                );
              })()}
            </View>
          </View>
        </View>

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
