import { BottomSheet } from '../ui/BottomSheet';
import { ChoiceRow } from '../settings-ui';
import { AccountTypeBadge } from './ActivityUI';
import { BOTTOM_SHEET_TOKENS } from '../../lib/layoutTokens';
import { getAccountTypeLabel } from '../../lib/settings-shared';
import { type AppThemePalette } from '../../lib/theme';
import type { Account } from '../../types';

interface AccountFilterSheetProps {
  accounts: Account[];
  selectedAccountId: string | 'all';
  onSelect: (id: string | 'all') => void;
  onClose: () => void;
  palette: AppThemePalette;
}

/** Account selector used by both the Activity filter bar and the Export screen. */
export function AccountFilterSheet({ accounts, selectedAccountId, onSelect, onClose, palette }: AccountFilterSheetProps) {
  return (
    <BottomSheet title="Select Account" palette={palette} onClose={onClose} hasNavBar maxHeightRatio={BOTTOM_SHEET_TOKENS.filterWithNavBarMaxHeight}>
      <ChoiceRow
        title="All Accounts"
        selected={selectedAccountId === 'all'}
        palette={palette}
        leftElement={<AccountTypeBadge palette={palette} />}
        onPress={() => onSelect('all')}
        noBorder={accounts.length === 0}
      />
      {accounts.map((account, index) => (
        <ChoiceRow
          key={account.id}
          title={account.name}
          subtitle={getAccountTypeLabel(account.type)}
          selected={selectedAccountId === account.id}
          palette={palette}
          leftElement={<AccountTypeBadge account={account} palette={palette} />}
          onPress={() => onSelect(account.id)}
          noBorder={index === accounts.length - 1}
        />
      ))}
    </BottomSheet>
  );
}
