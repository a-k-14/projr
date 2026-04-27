import { AppIcon } from '../../components/ui/AppIcon';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { View, TouchableOpacity } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import {
  FixedBottomActions,
  SettingsScreenLayout,
} from '../../components/settings-ui';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { CARD_PADDING, RADIUS, SCREEN_GUTTER, TYPE } from '../../lib/design';
import { formatDisplayCurrency, getAccountTypeLabel } from '../../lib/settings-shared';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import type { Account } from '../../types';

const ACCOUNT_ROW_HEIGHT = 72;

export default function AccountsScreen() {
  const { accounts, load, isLoaded, setOrder } = useAccountsStore();
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const displaySymbol = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const router = useRouter();
  const [orderedAccounts, setOrderedAccounts] = useState(accounts);

  useEffect(() => {
    if (!isLoaded) load().catch(() => undefined);
  }, [isLoaded, load]);

  useEffect(() => {
    setOrderedAccounts(accounts);
  }, [accounts]);

  const persistOrder = async (nextAccounts: Account[]) => {
    setOrderedAccounts(nextAccounts);
    await setOrder(nextAccounts.map((account) => account.id)).catch(() => {
      setOrderedAccounts(accounts);
    });
  };

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
              borderRadius: 14,
              borderWidth: 1,
              borderColor: palette.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text appWeight="medium" style={{ fontSize: TYPE.section, fontWeight: '600', color: palette.brand }}>
              + Add Account
            </Text>
          </TouchableOpacity>
        </FixedBottomActions>
      }
    >
      <DraggableFlatList
        data={orderedAccounts}
        keyExtractor={(item) => item.id}
        activationDistance={8}
        autoscrollThreshold={90}
        autoscrollSpeed={180}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
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
        renderItem={(params) => (
          <AccountReorderRow
            {...params}
            total={orderedAccounts.length}
            displaySymbol={displaySymbol}
            palette={palette}
            onPress={() => router.push({ pathname: '/settings/account-form', params: { id: params.item.id } })}
          />
        )}
        onDragEnd={({ data }) => void persistOrder(data)}
      />
    </SettingsScreenLayout>
  );
}

function AccountReorderRow({
  item,
  drag,
  isActive,
  getIndex,
  total,
  displaySymbol,
  palette,
  onPress,
}: RenderItemParams<Account> & {
  total: number;
  displaySymbol: string;
  palette: ReturnType<typeof useAppTheme>['palette'];
  onPress: () => void;
}) {
  const index = getIndex();
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
      <View
        style={{
          minHeight: ACCOUNT_ROW_HEIGHT,
          paddingHorizontal: CARD_PADDING,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isActive ? palette.inputBg : palette.card,
          borderTopLeftRadius: isFirst ? RADIUS.lg : 0,
          borderTopRightRadius: isFirst ? RADIUS.lg : 0,
          borderBottomLeftRadius: isLast ? RADIUS.lg : 0,
          borderBottomRightRadius: isLast ? RADIUS.lg : 0,
          borderTopWidth: isFirst ? 1 : 0,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderBottomWidth: 1,
          borderColor: palette.border,
          borderBottomColor: isLast ? palette.border : palette.divider,
          opacity: isActive ? 0.96 : 1,
          shadowColor: '#000',
          shadowOpacity: isActive ? 0.14 : 0,
          shadowRadius: isActive ? 10 : 0,
          shadowOffset: { width: 0, height: 6 },
          elevation: isActive ? 4 : 0,
        }}
      >
        <TouchableOpacity
          delayLongPress={160}
          onLongPress={drag}
          activeOpacity={0.75}
          style={{
            width: 46,
            height: 46,
            marginLeft: -8,
            marginRight: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppIcon name="menu" size={18} color={palette.textSoft} />
        </TouchableOpacity>
        <TouchableOpacity
          delayPressIn={0}
          onPress={onPress}
          activeOpacity={0.65}
          style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontSize: TYPE.rowLabel,
                fontWeight: '400',
                color: palette.text,
              }}
              numberOfLines={1}
            >
              {formatAccountDisplayName(item.name, item.accountNumber)}
            </Text>
            <Text
              style={{
                fontSize: TYPE.body,
                color: palette.textMuted,
                marginTop: 2,
                fontWeight: '400',
              }}
              numberOfLines={1}
            >
              {getAccountTypeLabel(item.type)} · {formatDisplayCurrency(item.initialBalance, displaySymbol)}
            </Text>
          </View>
          <AppIcon name="chevron-right" size={18} color={palette.textSoft} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
