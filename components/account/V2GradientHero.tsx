/**
 * V2GradientHero — Card 1 of the V2 account-detail layout.
 *
 * Renders the rounded card containing:
 *   - Top: gradient with account-type icon, name, balance number
 *   - Bottom: balance trend chart (passed as a render slot)
 *   - Overlay: tooltip in the gradient's top-right while the user is dragging
 *     the chart (date + value at active point)
 *
 * Stateless and pure-presentational. State lives in `AccountDetailsV2Hero`.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppIcon } from '../ui/AppIcon';
import { Text } from '../ui/AppText';
import { FONT_WEIGHT } from '../../lib/design';
import { formatDate } from '../../lib/dateUtils';
import { HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import { ACCOUNT_TYPE_META } from '../../lib/settings-shared';
import { buildAccountTypeGradient, splitBalance } from '../../lib/v2HeroUtils';
import { V2_SPACING, v2Colors } from '../../lib/v2HeroTokens';
import type { AppThemePalette } from '../../lib/theme';
import type { AccountType } from '../../types';

interface Props {
  accountName: string;
  balance: number;
  currencySymbol: string;
  palette: AppThemePalette;
  accountType?: AccountType;
  hideAmounts?: boolean;
  /** The TrendLineChart node, rendered inside this card below the gradient. */
  trendChart: React.ReactNode;
  /** When non-null, the gradient top-right shows the date + value tooltip. */
  activeTrendPoint?: { date: string; val: number } | null;
}

export const V2GradientHero = React.memo(function V2GradientHero({
  accountName,
  balance,
  currencySymbol,
  palette,
  accountType,
  hideAmounts,
  trendChart,
  activeTrendPoint,
}: Props) {
  const typeMeta = accountType ? ACCOUNT_TYPE_META[accountType] : undefined;
  const typeColor = typeMeta?.color ?? palette.brand;
  const colors = v2Colors(palette);

  const gradient = useMemo(
    () => buildAccountTypeGradient(accountType, typeColor),
    [accountType, typeColor],
  );

  const { int: balanceInt, dec: balanceDec } = splitBalance(balance);

  return (
    <View
      style={{
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        backgroundColor: palette.card,
        ...colors.cardElevation,
      }}
    >
      {/* Gradient top: account icon + name + balance */}
      <View
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderTopLeftRadius: HOME_RADIUS.card,
          borderTopRightRadius: HOME_RADIUS.card,
        }}
      >
        <LinearGradient
          colors={[gradient[0], gradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          style={{
            paddingHorizontal: V2_SPACING.cardPaddingX,
            paddingTop: V2_SPACING.cardPaddingTop,
            paddingBottom: V2_SPACING.cardPaddingBottom,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: V2_SPACING.iconLabelGap }}>
            {accountType && (
              <View
                style={{
                  backgroundColor: colors.onHeroIconBg,
                  width: 42,
                  height: 42,
                  borderRadius: HOME_RADIUS.chip,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AppIcon
                  name={typeMeta?.icon ?? 'wallet'}
                  size={20}
                  color={colors.onHeroIcon}
                  strokeWidth={1.9}
                />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: V2_SPACING.nameToBalanceGap,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: HOME_TEXT.metaSmall,
                    fontWeight: FONT_WEIGHT.semibold,
                    color: colors.onHeroMuted,
                    letterSpacing: 0.4,
                  }}
                >
                  {accountName}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                {currencySymbol ? (
                  <Text
                    style={{
                      fontSize: HOME_TEXT.sectionTitle,
                      fontWeight: FONT_WEIGHT.medium,
                      color: colors.onHeroMuted,
                      marginRight: 3,
                    }}
                  >
                    {currencySymbol}
                  </Text>
                ) : null}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    fontSize: HOME_TEXT.heroCardValue,
                    fontWeight: FONT_WEIGHT.medium,
                    color: colors.onHeroText,
                  }}
                >
                  {hideAmounts ? '••••' : balanceInt}
                </Text>
                {balanceDec ? (
                  <Text
                    style={{
                      fontSize: HOME_TEXT.rowLabel,
                      fontWeight: FONT_WEIGHT.medium,
                      color: colors.onHeroSoft,
                    }}
                  >
                    {balanceDec}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Tooltip — compact block in the top-right of the gradient. Only
              visible while the user is dragging the trend chart. Smaller fonts
              than the name/balance so it reads as a transient hint. */}
          {activeTrendPoint && (
            <View
              style={{
                position: 'absolute',
                top: V2_SPACING.cardPaddingTop,
                right: V2_SPACING.cardPaddingX,
                alignItems: 'flex-end',
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: HOME_TEXT.label,
                  fontWeight: FONT_WEIGHT.medium,
                  color: colors.onHeroSoft,
                  letterSpacing: 0.3,
                }}
              >
                {formatDate(activeTrendPoint.date)}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: HOME_TEXT.bodySmall,
                  fontWeight: FONT_WEIGHT.semibold,
                  color: colors.onHeroText,
                  marginTop: 1,
                }}
              >
                {currencySymbol ? `${currencySymbol} ` : ''}
                {Math.abs(activeTrendPoint.val).toLocaleString('en-IN', {
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Balance trend chart slot — caller passes embedded=true on TrendLineChart
          so it doesn't paint its own nested border inside this card. */}
      <View
        style={{
          backgroundColor: palette.card,
          borderBottomLeftRadius: HOME_RADIUS.card,
          borderBottomRightRadius: HOME_RADIUS.card,
          overflow: 'hidden',
        }}
      >
        {trendChart}
      </View>
    </View>
  );
});
