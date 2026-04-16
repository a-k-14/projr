import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

export function FinanceEmptyMascot({
  palette,
  variant,
}: {
  palette: AppThemePalette;
  variant: 'budget' | 'loan' | 'activity' | 'security';
}) {
  const accent = variant === 'budget' ? palette.budget : variant === 'loan' ? palette.loan : palette.brand;
  const soft = variant === 'budget' ? palette.budgetSoft : variant === 'loan' ? palette.loanSoft : palette.brandSoft;
  const badgeBg = variant === 'budget' ? palette.budget : palette.surface;
  const badgeColor = variant === 'budget' ? palette.onBudget : accent;

  return (
    <View style={{ width: 144, height: 112, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 6,
          right: 18,
          width: 48,
          height: 40,
          borderRadius: 14,
          backgroundColor: soft,
          borderWidth: 1,
          borderColor: palette.divider,
          paddingTop: 7,
          alignItems: 'center',
        }}
      >
        <View style={{ width: 18, height: 3, borderRadius: 999, backgroundColor: accent, marginBottom: 5 }} />
        <View style={{ width: 22, height: 3, borderRadius: 999, backgroundColor: palette.textSoft }} />
      </View>

      <View
        style={{
          position: 'absolute',
          top: 18,
          left: 30,
          width: 20,
          height: 12,
          borderRadius: 8,
          backgroundColor: soft,
          borderWidth: 1.5,
          borderColor: accent,
          transform: [{ rotate: '-18deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 18,
          right: 30,
          width: 20,
          height: 12,
          borderRadius: 8,
          backgroundColor: soft,
          borderWidth: 1.5,
          borderColor: accent,
          transform: [{ rotate: '18deg' }],
        }}
      />

      <View
        style={{
          width: 92,
          height: 62,
          borderRadius: 30,
          backgroundColor: soft,
          borderWidth: 1.5,
          borderColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: -4,
            width: 22,
            height: 6,
            borderRadius: 999,
            backgroundColor: accent,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 18,
            top: 18,
            width: 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: palette.text,
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: 18,
            top: 18,
            width: 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: palette.text,
          }}
        />
        <View
          style={{
            width: 28,
            height: 14,
            borderBottomWidth: 2,
            borderBottomColor: accent,
            borderRadius: 999,
            marginTop: 14,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -8,
            left: 24,
            width: 8,
            height: 12,
            borderRadius: 999,
            backgroundColor: accent,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -8,
            right: 24,
            width: 8,
            height: 12,
            borderRadius: 999,
            backgroundColor: accent,
          }}
        />
      </View>

      <View
        style={{
          position: 'absolute',
          left: 18,
          bottom: 8,
          width: 44,
          height: 24,
          borderRadius: 8,
          backgroundColor: badgeBg,
          borderWidth: 1,
          borderColor: variant === 'budget' ? accent : palette.divider,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {variant === 'budget' ? (
          <Text style={{ fontSize: HOME_TEXT.tiny, color: badgeColor, fontWeight: '700' }}>₹</Text>
        ) : variant === 'loan' ? (
          <Ionicons name="swap-horizontal" size={15} color={badgeColor} />
        ) : variant === 'security' ? (
          <Ionicons name="lock-closed" size={13} color={badgeColor} />
        ) : (
          <Ionicons name="list-outline" size={15} color={badgeColor} />
        )}
      </View>
    </View>
  );
}
