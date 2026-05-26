/**
 * LoanListCard — row card used in the Loans list screen (app/loans.tsx).
 * Shows loan person, direction, given amount, balance, progress bar, and closed badge.
 */
import { Text } from '@/components/ui/AppText';
import { View } from 'react-native';
import { formatCurrency } from '../../../lib/derived';
import { FONT_WEIGHT } from '../../../lib/design';
import {
  ACTIVITY_LAYOUT,
  CARD_TEXT,
  HOME_LAYOUT,
  HOME_RADIUS,
  HOME_TEXT,
  PROGRESS,
} from '../../../lib/layoutTokens';
import type { AppThemePalette } from '../../../lib/theme';
import type { LoanWithSummary } from '../../../types';
import { AppCard, CardSubtitleRow } from '../AppCard';
import { AppIcon } from '../AppIcon';

export function LoanListCard({
  loan,
  accountName,
  sym,
  palette,
  onPress,
}: {
  loan: LoanWithSummary;
  accountName?: string;
  sym: string;
  palette: AppThemePalette;
  onPress: () => void;
}) {
  const isLent = loan.direction === 'lent';
  const iconColor = palette.brand;
  // Progress bar: brand icon color when open, muted when closed
  const progressColor = loan.status === 'closed' ? palette.textSoft : palette.loan;
  const directionLabel = isLent ? 'Lent' : 'Borrowed';

  return (
    <View style={{ marginBottom: 12, position: 'relative' }}>
      <AppCard
        palette={palette}
        onPress={onPress}
        style={{
          marginHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderColor: palette.border,
          paddingTop: loan.status === 'closed' ? 28 : 14,
          paddingBottom: loan.status === 'closed' ? 16 : 14,
        }}
        icon={
          <AppIcon
            name="hand-coins"
            size={HOME_LAYOUT.listIconInnerSize}
            color={iconColor}
            strokeWidth={HOME_LAYOUT.listIconStrokeWidth}
          />
        }
        topRow={
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text
                appWeight="medium"
                numberOfLines={1}
                style={{ fontSize: CARD_TEXT.line1, color: palette.listText }}
              >
                {loan.personName}
              </Text>
              <View
                style={{
                  backgroundColor: isLent ? palette.outBg : palette.inBg,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: HOME_RADIUS.card,
                  borderWidth: 0.5,
                  borderColor: isLent ? palette.negative : palette.positive,
                }}
              >
                <Text
                  appWeight="medium"
                  style={{
                    fontSize: HOME_TEXT.tiny - 1,
                    color: isLent ? palette.negative : palette.positive,
                  }}
                >
                  {directionLabel}
                </Text>
              </View>
            </View>
            <Text
              appWeight="medium"
              style={{ fontSize: CARD_TEXT.line1, color: palette.listText, textAlign: 'right', marginLeft: 14 }}
            >
              {formatCurrency(loan.givenAmount, sym)}
            </Text>
          </View>
        }
        bottomRow={
          <CardSubtitleRow
            text={`${formatLoanCardDate(loan.date)} • ${accountName ?? 'Unknown account'}`}
            rightText={`Bal ${formatCurrency(loan.pendingAmount, sym)}`}
            palette={palette}
          />
        }
        footer={
          <View style={{ gap: 6 }}>
            <View style={{ height: PROGRESS.cardHeight, backgroundColor: palette.divider, borderRadius: PROGRESS.radius, overflow: 'hidden' }}>
              <View style={{ height: PROGRESS.cardHeight, width: `${loan.repaidPercent}%`, backgroundColor: progressColor, borderRadius: PROGRESS.radius }} />
            </View>
            {loan.repaidPercent > 0 && (
              <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted }}>
                {loan.repaidPercent}% Repaid
              </Text>
            )}
          </View>
        }
      />
      {loan.status === 'closed' && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: ACTIVITY_LAYOUT.headerPaddingX,
            minHeight: 22,
            paddingHorizontal: 8,
            borderTopRightRadius: HOME_RADIUS.card,
            borderBottomLeftRadius: HOME_RADIUS.card,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.border,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.bold, color: palette.textSecondary }}>Closed</Text>
        </View>
      )}
    </View>
  );
}

function formatLoanCardDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
