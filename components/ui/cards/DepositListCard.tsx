/**
 * DepositListCard — row card used in the Deposits list screen (app/deposits.tsx).
 * Shows deposit name, bank, status label, invested amount, and maturity/received amount.
 */
import { Text } from '@/components/ui/AppText';
import { AppIcon } from '../AppIcon';
import { TouchableOpacity, View } from 'react-native';
import { getDepositProgress } from '../../../lib/depositDisplay';
import { DEPOSIT_VISUAL } from '../../../lib/depositVisuals';
import { formatCurrency } from '../../../lib/derived';
import { FONT_WEIGHT } from '../../../lib/design';
import { CARD_TEXT, HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../../lib/layoutTokens';
import type { AppThemePalette } from '../../../lib/theme';
import type { Deposit } from '../../../types';

export function DepositListCard({
  deposit,
  sym,
  palette,
  onPress,
}: {
  deposit: Deposit;
  sym: string;
  palette: AppThemePalette;
  onPress: () => void;
}) {
  const progress = getDepositProgress(deposit);
  const isClosed = deposit.status === 'closed';
  const maturityLabel = isClosed ? 'Received' : 'Maturity';
  const statusLabel = isClosed ? 'Closed' : deposit.maturityDate ? progress.label : '-';

  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.82}
      onPress={onPress}
      style={{
        paddingHorizontal: HOME_SPACE.lg,
        paddingVertical: 18,
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        borderColor: isClosed ? palette.divider : palette.borderSoft,
        backgroundColor: isClosed ? palette.surface : palette.card,
        opacity: isClosed ? 0.86 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: HOME_RADIUS.small,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: DEPOSIT_VISUAL.bg,
          }}
        >
          <AppIcon name={DEPOSIT_VISUAL.icon} size={18} color={DEPOSIT_VISUAL.tone} strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              appWeight="medium"
              numberOfLines={1}
              style={{ flex: 1, fontSize: CARD_TEXT.line1, color: palette.text }}
            >
              {deposit.bankName ? `${deposit.name} · ${deposit.bankName}` : deposit.name}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: HOME_TEXT.caption,
                fontWeight: FONT_WEIGHT.semibold,
                color: progress.isUrgent ? palette.warning : isClosed ? palette.textMuted : palette.brand,
              }}
            >
              {statusLabel}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 6,
            }}
          >
            <DepositAmountText
              label="Invested"
              value={formatCurrency(deposit.principalAmount, sym)}
              palette={palette}
            />
            <DepositAmountText
              label={maturityLabel}
              value={formatCurrency(deposit.maturityValue ?? deposit.principalAmount, sym)}
              palette={palette}
              valueColor={palette.numberPositive}
              align="right"
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DepositAmountText({
  label,
  value,
  palette,
  valueColor,
  align = 'left',
}: {
  label: string;
  value: string;
  palette: AppThemePalette;
  valueColor?: string;
  align?: 'left' | 'right';
}) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      style={{ flex: 1, minWidth: 0, textAlign: align, fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary }}
    >
      {label}{' '}
      <Text style={{ fontWeight: FONT_WEIGHT.semibold, color: valueColor ?? palette.text }}>{value}</Text>
    </Text>
  );
}
