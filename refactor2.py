import re

with open('/Volumes/Hive/Dev/projr/app/(tabs)/index.tsx', 'r') as f:
    content = f.read()

start_idx = content.find('function HomeScreenContent() {')
end_idx = content.find('function HomeAccountViewToggle({')

if start_idx == -1 or end_idx == -1:
    print("Could not find start or end index")
    exit(1)

new_content = """function HomeScreenContent() {
  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const categories = useCategoriesStore((s) => s.categories);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);
  const settingsYearStart = useUIStore((s) => s.settings.yearStart);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);

  const { palette } = useAppTheme();
  
  const verticalScrolls = useSharedValue<number[]>([0]);
  const indicatorY = useSharedValue(0);

  const [period, setPeriod] = useState<HomePeriodType>('today');
  const [chartMode, setChartMode] = useState<HomeChartMode>('expense');
  const [selectedChartCategoryId, setSelectedChartCategoryId] = useState<string | null>(null);

  const [customRangeFrom, setCustomRangeFrom] = useState(() => toLocalDayStartISO(new Date()));
  const [customRangeTo, setCustomRangeTo] = useState(() => toLocalDayEndISO(new Date()));
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  
  const [netWorthSheetVisible, setNetWorthSheetVisible] = useState(false);
  const netWorthSheetVerticalScrolls = useSharedValue<number[]>([0]);
  const netWorthSheetIndicatorY = useSharedValue(0);

  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [expandedChartState, setExpandedChartState] = useState<{
    transactions: Transaction[];
    mode: HomeChartMode;
    resetTrigger: number;
  } | null>(null);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);

  const totalBalance = useMemo(() => getTotalBalance(accounts), [accounts]);
  const loanSummary = useMemo(() => getLoanSummary(loans), [loans]);
  const netWorth = totalBalance + loanSummary.net;

  const handleCustomRangeDone = useCallback(() => {
    const fromDate = customDraftFrom <= customDraftTo ? customDraftFrom : customDraftTo;
    const toDate = customDraftTo >= customDraftFrom ? customDraftTo : customDraftFrom;
    setCustomDraftFrom(fromDate);
    setCustomDraftTo(toDate);
    setCustomRangeFrom(toLocalDayStartISO(fromDate));
    setCustomRangeTo(toLocalDayEndISO(toDate));
    setPeriod('custom');
    setCustomRangeOpen(false);
  }, [customDraftFrom, customDraftTo]);

  const openDatePicker = useCallback(
    (stage: 'from' | 'to') => {
      const value = stage === 'from' ? customDraftFrom : customDraftTo;
      const minDate = stage === 'to' ? customDraftFrom : undefined;
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        display: 'calendar',
        minimumDate: minDate,
        onChange: (_event, selected) => {
          if (!selected) return;
          if (stage === 'from') {
            setCustomDraftFrom(selected);
            if (selected > customDraftTo) {
              setCustomDraftTo(selected);
            }
          } else {
            setCustomDraftTo(selected < customDraftFrom ? customDraftFrom : selected);
          }
        }
      });
    },
    [customDraftFrom, customDraftTo],
  );

  const middleContent = (
    <View style={{ marginBottom: HOME_SPACE.lg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, gap: 12 }}>
        {accounts.map(acc => {
          const typeLabel = getAccountTypeLabel(acc.type);
          return (
            <TouchableOpacity 
              key={acc.id} 
              onPress={() => router.push(`/account/${acc.id}`)}
              style={{ 
                width: 140, 
                padding: 16, 
                backgroundColor: palette.card, 
                borderRadius: HOME_RADIUS.card, 
                borderWidth: 1, 
                borderColor: palette.divider 
              }}
            >
              <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted }}>{typeLabel}</Text>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: palette.text, marginVertical: 4 }}>{formatAccountDisplayName(acc.name, acc.accountNumber)}</Text>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: palette.text }}>{formatCurrency(Math.abs(acc.balance), currencySymbol)}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity 
          onPress={() => router.push('/settings/account-form')}
          style={{ 
            width: 140, 
            padding: 16, 
            backgroundColor: palette.surface, 
            borderRadius: HOME_RADIUS.card, 
            borderWidth: 1, 
            borderStyle: 'dashed',
            borderColor: palette.borderSoft,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <AppIcon name="plus-circle" size={22} color={palette.text} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>Add Account</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: SCREEN_GUTTER, marginTop: 16 }}>
        {['Deposits', 'Loans', 'Budgets'].map(feature => (
          <TouchableOpacity
            key={feature}
            onPress={() => feature === 'Loans' ? router.push('/(tabs)/loans') : feature === 'Budgets' ? router.push('/(tabs)/budget') : {}}
            style={{ 
               flex: 1, 
               padding: 12, 
               alignItems: 'center', 
               justifyContent: 'center',
               backgroundColor: palette.surface, 
               borderRadius: HOME_RADIUS.card, 
               borderWidth: 1, 
               borderColor: palette.divider 
            }}
          >
             <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{feature}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <HomeAccountPage
        pageHeight={1000}
        accountId="all"
        accountName="All"
        accountTypeLabel=""
        settingsYearStart={settingsYearStart}
        currencySymbol={showCurrencySymbol ? currencySymbol : ''}
        customRange={{ from: new Date(customRangeFrom), to: new Date(customRangeTo) }}
        onOpenCustomRange={() => {
          setCustomDraftFrom(new Date(customRangeFrom));
          setCustomDraftTo(new Date(customRangeTo));
          setCustomRangeOpen(true);
        }}
        totalBalance={totalBalance}
        onRefresh={refreshAccounts}
        isSelected={true}
        pageIndex={0}
        verticalScrolls={verticalScrolls}
        indicatorY={indicatorY}
        period={period}
        onPeriodChange={setPeriod}
        chartMode={chartMode}
        onChartModeChange={setChartMode}
        selectedChartCategoryId={selectedChartCategoryId}
        onChartCategorySelect={setSelectedChartCategoryId}
        registerScrollTop={() => {}}
        isPageReady={true}
        accountsById={accountsById}
        categoriesById={categoriesById}
        loansById={loansById}
        getCategoryFullDisplayName={getCategoryFullDisplayName}
        loansLoaded={loansLoaded}
        loadLoans={loadLoans}
        onOpenNetWorth={() => setNetWorthSheetVisible(true)}
        netWorth={netWorth}
        middleContent={middleContent}
        onOpenChartExpanded={(transactions, mode, range, resetTrigger) => {
          setExpandedChartState({ transactions, mode, resetTrigger });
          setBottomSheetVisible(true);
        }}
      />

      <Modal
        visible={customRangeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomRangeOpen(false)}
      >
        <Pressable
          onPress={() => setCustomRangeOpen(false)}
          style={{ flex: 1, backgroundColor: palette.scrim, justifyContent: 'center', padding: 20 }}
        >
          <Pressable
            onPress={() => { }}
            style={{ backgroundColor: palette.card, borderRadius: HOME_RADIUS.large, padding: HOME_SPACE.xxl, borderWidth: 1, borderColor: palette.divider }}
          >
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, marginBottom: 8 }}>
              Custom range
            </Text>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginBottom: 16 }}>
              Pick the from and to dates for this range.
            </Text>
            <View style={{ gap: HOME_SPACE.md, marginBottom: HOME_SPACE.lg }}>
              <TouchableOpacity delayPressIn={0} onPress={() => openDatePicker('from')} style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.inputBg, borderRadius: HOME_RADIUS.card, paddingHorizontal: HOME_SPACE.lg, paddingVertical: 12 }}>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>From</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
                  {formatDate(customDraftFrom.toISOString())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0} onPress={() => openDatePicker('to')} style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.inputBg, borderRadius: HOME_RADIUS.card, paddingHorizontal: HOME_SPACE.lg, paddingVertical: 12 }}>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
                  {formatDate(customDraftTo.toISOString())}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md, marginTop: HOME_SPACE.lg }}>
              <View style={{ flex: 1 }}>
                <TextButton label="Cancel" onPress={() => setCustomRangeOpen(false)} palette={palette} tone="default" style={{ minHeight: 48, borderRadius: HOME_RADIUS.tab, backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border }} />
              </View>
              <View style={{ flex: 1 }}>
                <FilledButton label="Done" onPress={handleCustomRangeDone} palette={palette} tone="brand" style={{ borderRadius: HOME_RADIUS.tab }} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {expandedChartState ? (
        <BottomSheet
          title="Category Breakdown"
          palette={palette}
          backgroundColor={palette.background}
          disableShadow
          onClose={() => {
            setExpandedChartState(null);
            setBottomSheetVisible(false);
          }}
          maxHeightRatio={0.80}
          fixedHeightRatio={0.80}
          hasNavBar
        >
          <View style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 0, backgroundColor: palette.background }}>
            <View style={{ backgroundColor: palette.card, borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, overflow: 'hidden' }}>
              <HomeDonutChartBlock
                transactions={expandedChartState.transactions}
                categoriesById={categoriesById}
                sym={showCurrencySymbol ? currencySymbol : ''}
                listPalette={palette}
                getCategoryFullDisplayName={getCategoryFullDisplayName}
                theme={{ brand: palette.brand, card: palette.card, surface: '#EEF2F8', inputBg: '#FFFFFF', progressTrack: '#DDE4F0', border: '#DFE5EF', text: palette.text, muted: '#7C8498', textMuted: palette.textMuted, accent: palette.brand, positive: palette.positive, negative: palette.negative }}
                expanded
                initialMode={expandedChartState.mode}
                resetTrigger={expandedChartState.resetTrigger}
                accountsById={accountsById}
                loansById={loansById}
              />
            </View>
          </View>
        </BottomSheet>
      ) : null}

      {netWorthSheetVisible ? (
        <BottomSheet
          title="Net Worth"
          palette={palette}
          backgroundColor={palette.background}
          disableShadow
          onClose={() => setNetWorthSheetVisible(false)}
          maxHeightRatio={0.80}
          fixedHeightRatio={0.80}
          hasNavBar
          scrollEnabled={false}
        >
          <View style={{ flex: 1, backgroundColor: palette.background }}>
            <HomeNetWorthPage
              pageHeight={800}
              palette={palette}
              currencySymbol={showCurrencySymbol ? currencySymbol : ''}
              accounts={accounts}
              loanSummary={loanSummary}
              netWorth={netWorth}
              pageIndex={0}
              verticalScrolls={netWorthSheetVerticalScrolls}
              indicatorY={netWorthSheetIndicatorY}
              isSelected={false}
              compactTop
              hideTitle
              onOpenAccount={(accountId) => {
                setNetWorthSheetVisible(false);
                router.push(`/account/${accountId}`);
              }}
            />
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}
"""

with open('/Volumes/Hive/Dev/projr/app/(tabs)/index.tsx', 'w') as f:
    f.write(content[:start_idx] + new_content + "\n" + content[end_idx:])

print("Successfully replaced HomeScreenContent")
