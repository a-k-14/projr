import { Text } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleIconBadge } from '../components/ui/CircleIconBadge';
import { EmptyStateCard } from '../components/ui/EmptyStateCard';
import { FinanceEmptyMascot } from '../components/ui/FinanceEmptyMascot';
import { getCompactScrollableBottomPadding, SystemBottomGuard } from '../components/ui/safeBottom';
import { ASSET_BG, ASSET_TONE } from '../lib/assetVisuals';
import { SCREEN_GUTTER , FONT_WEIGHT} from '../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../lib/layoutTokens';
import { useAppTheme } from '../lib/theme';
import { ScreenScaffold } from '../components/ui/ScreenScaffold';

export default function AssetsScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Assets"
        palette={palette}
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
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
            marginBottom: HOME_SPACE.lg,
            borderRadius: HOME_RADIUS.card,
            borderWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            padding: HOME_SPACE.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <CircleIconBadge icon="gem" tone={ASSET_TONE} background={ASSET_BG} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                Other Assets
              </Text>
              <Text style={{ marginTop: 2, fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>
                Property, gold, vehicles, valuables, and manual investments.
              </Text>
            </View>
          </View>
        </View>

        <EmptyStateCard
          palette={palette}
          title="No assets yet"
          subtitle="Add assets you want included outside accounts, deposits, and loans."
          illustration={<FinanceEmptyMascot palette={palette} variant="account" />}
        />
      </ScrollView>
    </ScreenScaffold>
  );
}
