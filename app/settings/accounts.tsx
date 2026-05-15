import { Text } from '@/components/ui/AppText';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { FlatList, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FixedBottomActions,
  SettingsScreenLayout,
} from '../../components/settings-ui';
import { AppChevron } from '../../components/ui/AppChevron';
import { AppIcon } from '../../components/ui/AppIcon';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { CARD_PADDING, RADIUS, SCREEN_GUTTER, TYPE, FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS } from '../../lib/layoutTokens';
import { ACCOUNT_TYPE_META, formatDisplayCurrency, getAccountTypeLabel } from '../../lib/settings-shared';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import type { Account } from '../../types';

export default function AccountsScreen() {
  const { accounts, load, isLoaded } = useAccountsStore();
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const displaySymbol = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  const sortedAccounts = useMemo(() => {
    return accounts.slice().sort((a, b) =>
      formatAccountDisplayName(a.name, a.accountNumber).localeCompare(
        formatAccountDisplayName(b.name, b.accountNumber),
        'en',
        { sensitivity: 'base' },
      )
    );
  }, [accounts]);

  return (
    <SettingsScreenLayout
      palette={palette}
      useScrollView={false}
      bottomAction={
        <FixedBottomActions palette={palette} useBudgetSpacing>
          <TouchableOpacity
            delayPressIn={0}
            onPress={() => router.push('/settings/account-form')}
            activeOpacity={0.7}
            style={{
              minHeight: 48,
              borderRadius: HOME_RADIUS.pill,
              borderWidth: 1,
              borderColor: palette.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text appWeight="medium" style={{ fontSize: TYPE.section, fontWeight: FONT_WEIGHT.semibold, color: palette.brand }}>
              + Add Account
            </Text>
          </TouchableOpacity>
        </FixedBottomActions>
      }
    >
      <FlatList
        data={sortedAccounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 70 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View
            style={{
              marginHorizontal: SCREEN_GUTTER,
              backgroundColor: palette.card,
              borderRadius: RADIUS.lg,
              borderWidth: 1,
              borderColor: palette.border,
              padding: 24,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: palette.textMuted, fontSize: TYPE.rowValue }}>No accounts yet.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <SettingsAccountCard
            item={item}
            index={index}
            total={sortedAccounts.length}
            displaySymbol={displaySymbol}
            palette={palette}
            onPress={() => router.push({ pathname: '/settings/account-form', params: { id: item.id } })}
          />
        )}
      />
    </SettingsScreenLayout>
  );
}

function SettingsAccountCard({
  item,
  index,
  total,
  displaySymbol,
  palette,
  onPress,
}: {
  item: Account;
  index: number;
  total: number;
  displaySymbol: string;
  palette: ReturnType<typeof useAppTheme>['palette'];
  onPress: () => void;
}) {
  const typeLabel = getAccountTypeLabel(item.type);
  const typeMeta = ACCOUNT_TYPE_META[item.type];
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
      <TouchableOpacity
        delayPressIn={0}
        onPress={onPress}
        activeOpacity={0.68}
        style={{
          minHeight: 78,
          paddingHorizontal: CARD_PADDING,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: palette.card,
          borderTopLeftRadius: isFirst ? RADIUS.lg : RADIUS.md,
          borderTopRightRadius: isFirst ? RADIUS.lg : RADIUS.md,
          borderBottomLeftRadius: isLast ? RADIUS.lg : RADIUS.md,
          borderBottomRightRadius: isLast ? RADIUS.lg : RADIUS.md,
          borderWidth: 1,
          borderColor: palette.border,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: HOME_RADIUS.chip,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: typeMeta.bg ?? `${typeMeta.color}18`,
            borderWidth: 1,
            borderColor: typeMeta.bg ? `${typeMeta.color}20` : `${typeMeta.color}30`,
            marginRight: 14,
          }}
        >
          <AppIcon name={typeMeta.icon} size={20} color={typeMeta.color} strokeWidth={1.5} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontSize: TYPE.section, fontWeight: FONT_WEIGHT.medium, color: palette.text }}
            numberOfLines={1}
          >
            {formatAccountDisplayName(item.name, item.accountNumber)}
          </Text>
          <Text
            style={{ fontSize: TYPE.body, color: palette.textMuted, marginTop: 2, fontWeight: FONT_WEIGHT.regular }}
            numberOfLines={1}
          >
            {typeLabel}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            maxWidth: 112,
            marginLeft: 10,
            fontSize: TYPE.body,
            fontWeight: FONT_WEIGHT.medium,
            color: item.initialBalance < 0 ? palette.negative : palette.text,
            textAlign: 'right',
          }}
        >
          {formatDisplayCurrency(item.initialBalance, displaySymbol)}
        </Text>
        <AppChevron direction="right" size={18} tone="secondary" palette={palette} />
      </TouchableOpacity>
    </View>
  );
}
