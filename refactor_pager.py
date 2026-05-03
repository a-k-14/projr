import re

with open('app/(tabs)/index.tsx', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace(
"""import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue
} from 'react-native-reanimated';""",
"""import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  useEvent,
  useHandler,
  type SharedValue
} from 'react-native-reanimated';
import PagerView from 'react-native-pager-view';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export function usePageScrollHandler(handlers: any, dependencies?: any[]) {
  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies);
  const subscribeForEvents = ['onPageScroll'];

  return useEvent(
    (event: any) => {
      'worklet';
      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith('onPageScroll')) {
        onPageScroll(event, context);
      }
    },
    subscribeForEvents,
    doDependenciesDiffer
  );
}""")

# 2. State & Refs
content = re.sub(r'type HomePageUiState = \{.*?scrollResetNonce: number;\n\};\n\nconst defaultHomePageUiState: HomePageUiState = \{.*?scrollResetNonce: 0,\n\};\n\n', '', content, flags=re.DOTALL)

content = content.replace(
    'const pagerRef = useAnimatedRef<Animated.ScrollView>();',
    """const pagerRef = useRef<PagerView>(null);
  const pageHandlesRef = useRef(new Map<string, any>());
  const registerPageHandle = useCallback((id: string, handle: any) => {
    if (handle) {
      pageHandlesRef.current.set(id, handle);
    } else {
      pageHandlesRef.current.delete(id);
    }
  }, []);"""
)

content = content.replace('const isPagerInteractingRef = useRef(false);\n', '')
content = content.replace('  const pendingSwipeResetTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());\n', '')
content = content.replace('  const [pageUiStates, setPageUiStates] = useState<Record<string, HomePageUiState>>({});\n', '')

content = re.sub(r'  const getPageUiState = useCallback\(.*?useEffect\(\(\) => \(\) => cancelPendingSwipeResets\(\), \[cancelPendingSwipeResets\]\);\n', '', content, flags=re.DOTALL)

# 3. PagerRef scrollTo replacements
content = content.replace('pagerRef.current?.scrollTo({ x: rootIndex * width, animated: false });', 'pagerRef.current?.setPageWithoutAnimation(rootIndex);')

content = re.sub(r'pagerRef\.current\?\.scrollTo\(\{ x: targetX, animated: false \}\);', r'pagerRef.current?.setPageWithoutAnimation(Math.round(targetX / Math.max(width, 1)));', content)
content = re.sub(r'pagerRef\.current\?\.scrollTo\(\{ x: rootIndex \* width, animated: true \}\);', r'pagerRef.current?.setPage(rootIndex);', content)

# 4. resetHomeToAll
content = content.replace("""    accountPagerScrollX.value = targetX;
    pagerRef.current?.scrollTo({ x: targetX, animated });
    resetCustomRangeToToday();
    setPageUiStates({});
    if (prev !== homeRootAccountId) {
      resetPageUiState(prev);
    } else {
      resetPageUiState(homeRootAccountId);
    }""",
"""    accountPagerScrollX.value = targetX;
    if (animated) {
      pagerRef.current?.setPage(rootIndex);
    } else {
      pagerRef.current?.setPageWithoutAnimation(rootIndex);
    }
    resetCustomRangeToToday();
    pageHandlesRef.current.get(prev)?.scrollToTop();
    pageHandlesRef.current.get(prev)?.resetPeriod();
    if (prev === homeRootAccountId) {
      pageHandlesRef.current.get(homeRootAccountId)?.scrollToTop();
      pageHandlesRef.current.get(homeRootAccountId)?.resetPeriod();
    }""")

# 5. Handlers
content = re.sub(r'  const handlePagerEnd = useCallback\(.*?  const accountPagerScrollHandler = useAnimatedScrollHandler\(\{', r'  const accountPagerScrollHandler = useAnimatedScrollHandler({', content, flags=re.DOTALL)

content = re.sub(r'  const accountPagerScrollHandler = useAnimatedScrollHandler\(\{.*?  const setHomeViewMode = useCallback\(',
"""  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const index = e.nativeEvent.position;
      const safeIndex = Math.max(0, Math.min(index, displayAccounts.length - 1));
      const next = displayAccounts[safeIndex];
      if (!next) return;

      settledAccountPageIndex.value = safeIndex;

      if (next.id !== selectedAccountIdRef.current) {
        const prevId = selectedAccountIdRef.current;

        pageHandlesRef.current.get(prevId)?.scrollToTop();
        pageHandlesRef.current.get(prevId)?.resetPeriod();
        resetCustomRangeToToday();

        selectedAccountIdRef.current = next.id;
        setSelectedAccountId(next.id);
      }
    },
    [displayAccounts, resetCustomRangeToToday, settledAccountPageIndex],
  );

  const handlePageScrollStateChanged = useCallback(
    (e: { nativeEvent: { pageScrollState: string } }) => {
      const state = e.nativeEvent.pageScrollState;
      if (state === 'idle') {
        indicatorGestureOpacity.value = 1;
      } else if (state === 'dragging') {
        const currentScroll = verticalScrolls.value[settledAccountPageIndex.value] ?? 0;
        if (HIDE_SCROLLED_INDICATOR_DURING_SWIPE && Math.abs(currentScroll) > 1) {
          indicatorGestureOpacity.value = 0;
        }
      }
    },
    [indicatorGestureOpacity, settledAccountPageIndex, verticalScrolls],
  );

  const onPageScroll = usePageScrollHandler({
    onPageScroll(e: any) {
      'worklet';
      accountPagerScrollX.value = (e.position + e.offset) * width;
    },
  }, [width]);

  const setHomeViewMode = useCallback(""", content, flags=re.DOTALL)

# 6. Pager JSX
content = re.sub(r'<Animated\.ScrollView\n              ref=\{pagerRef\}\n              horizontal\n              pagingEnabled\n              showsHorizontalScrollIndicator=\{false\}\n              directionalLockEnabled\n              onScroll=\{accountPagerScrollHandler\}\n              onScrollBeginDrag=\{handlePagerBeginDrag\}\n              onScrollEndDrag=\{handlePagerDragEnd\}\n              onMomentumScrollBegin=\{handlePagerMomentumBegin\}\n              onMomentumScrollEnd=\{handlePagerMomentumEnd\}\n              scrollEventThrottle=\{1\}\n              style=\{\{ flex: 1 \}\}\n            >',
"""<AnimatedPagerView
              ref={pagerRef as any}
              style={{ flex: 1 }}
              initialPage={selectedPageIndex}
              overdrag={false}
              onPageSelected={handlePageSelected}
              onPageScrollStateChanged={handlePageScrollStateChanged}
              onPageScroll={onPageScroll}
            >""", content)

content = content.replace('</Animated.ScrollView>', '</AnimatedPagerView>')

content = re.sub(r'const uiState = account.id === \'add\' \? defaultHomePageUiState : getPageUiState\(account\.id\);\n                return \(\n                  <View key=\{account\.id\} style=\{\{ width, height: pagerHeight \|\| undefined \}\}>',
r"""return (
                  <View key={account.id} collapsable={false} style={{ flex: 1 }}>""", content)

# 7. HomeAccountPage props revert
content = re.sub(r'                        period=\{uiState\.period\}\n                        onPeriodChange=\{\(period\) => setPageUiState\(account\.id, \{ period \}\)\}\n                        chartMode=\{uiState\.chartMode\}\n                        onChartModeChange=\{\(chartMode\) => setPageUiState\(account\.id, \{ chartMode \}\)\}\n                        selectedChartCategoryId=\{uiState\.selectedChartCategoryId\}\n                        onChartCategorySelect=\{\(selectedChartCategoryId\) => setPageUiState\(account\.id, \{ selectedChartCategoryId \}\)\}\n                        scrollResetNonce=\{uiState\.scrollResetNonce\}\n',
"""                        registerPageHandle={registerPageHandle}\n""", content)

content = re.sub(r'                        onOpenChartExpanded=\{\(transactions, mode, range, resetTrigger\) => \{\n                          setExpandedChartState\(\{ transactions, mode, resetTrigger \}\);\n                          setBottomSheetVisible\(true\);\n                        \}\}',
"""                        onOpenChartExpanded={(transactions, mode, range, resetTrigger) => {
                          setExpandedChartState({ transactions, mode, resetTrigger });
                          setBottomSheetVisible(true);
                        }}""", content)


# 8. HomeAccountPage Component changes
content = re.sub(r'  period: HomePeriodType;\n  onPeriodChange: \(period: HomePeriodType\) => void;\n  chartMode: HomeChartMode;\n  onChartModeChange: \(mode: HomeChartMode\) => void;\n  selectedChartCategoryId: string \| null;\n  onChartCategorySelect: \(categoryId: string \| null\) => void;\n  scrollResetNonce: number;\n',
r'  registerPageHandle: (id: string, handle: any) => void;\n', content)

content = re.sub(r'  indicatorY,\n  period,\n  onPeriodChange,\n  chartMode,\n  onChartModeChange,\n  selectedChartCategoryId,\n  onChartCategorySelect,\n  scrollResetNonce,\n  onOpenChartExpanded,',
r'  indicatorY,\n  registerPageHandle,\n  onOpenChartExpanded,', content)

# Add local state inside HomeAccountPage
content = re.sub(r'  const \[refreshing, setRefreshing\] = useState\(false\);\n  const isScreenFocused = useIsFocused\(\);',
r"""  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<HomePeriodType>('today');
  const [chartMode, setChartMode] = useState<HomeChartMode>('expense');
  const [selectedChartCategoryId, setSelectedChartCategoryId] = useState<string | null>(null);
  const [chartResetNonce, setChartResetNonce] = useState(0);
  const isScreenFocused = useIsFocused();""", content)

# Replace the scrollResetNonce useEffect with registerPageHandle useEffect
content = re.sub(r'  const prevScrollResetNonceRef = useRef\(scrollResetNonce\);\n.*?\n  useEffect\(\(\) => \{\n    if \(scrollResetNonce === prevScrollResetNonceRef\.current\) return;\n    prevScrollResetNonceRef\.current = scrollResetNonce;\n    mainScrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\);\n    recentScrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\);\n    const arr = verticalScrolls\.value\.slice\(\);\n    arr\[pageIndex\] = 0;\n    verticalScrolls\.value = arr;\n\n    const today = new Date\(\);\n    const todayFrom = toLocalDayStartISO\(today\);\n    const todayTo = toLocalDayEndISO\(today\);\n    if \(todayDataCacheRef\.current\) \{\n      setCashflow\(todayDataCacheRef\.current\.cashflow\);\n      setPeriodTransactions\(todayDataCacheRef\.current\.periodTransactions\);\n      setTransactions\(todayDataCacheRef\.current\.transactions\);\n    \} else \{\n      loadRangeData\(todayFrom, todayTo\)\.catch\(\(\) => undefined\);\n    \}\n  \}, \[loadRangeData, mainScrollRef, pageIndex, recentScrollRef, scrollResetNonce, verticalScrolls\]\);\n',
r"""  useEffect(() => {
    registerPageHandle(accountId, {
      scrollToTop: () => {
        mainScrollRef.current?.scrollTo({ y: 0, animated: false });
        recentScrollRef.current?.scrollTo({ y: 0, animated: false });
        const arr = verticalScrolls.value.slice();
        arr[pageIndex] = 0;
        verticalScrolls.value = arr;
      },
      resetPeriod: () => {
        const today = new Date();
        const todayFrom = toLocalDayStartISO(today);
        const todayTo = toLocalDayEndISO(today);
        setPeriod('today');
        setChartResetNonce((nonce) => nonce + 1);
        setSelectedChartCategoryId(null);
        setChartMode('expense');
        
        if (todayDataCacheRef.current) {
          setCashflow(todayDataCacheRef.current.cashflow);
          setPeriodTransactions(todayDataCacheRef.current.periodTransactions);
          setTransactions(todayDataCacheRef.current.transactions);
        } else {
          loadRangeData(todayFrom, todayTo).catch(() => undefined);
        }
      },
    });
    return () => registerPageHandle(accountId, null);
  }, [accountId, loadRangeData, mainScrollRef, pageIndex, registerPageHandle, verticalScrolls]);
""", content, flags=re.DOTALL)

# Fix onPeriodChange / onChartModeChange props passed to DonutChartBlock
content = content.replace("onModeChange={onChartModeChange}", "onModeChange={setChartMode}")
content = content.replace("onCategorySelect={onChartCategorySelect}", "onCategorySelect={setSelectedChartCategoryId}")
content = content.replace("resetTrigger={`${period}:${from}:${to}:${scrollResetNonce}`}", "resetTrigger={`${period}:${from}:${to}:${chartResetNonce}`}")
content = content.replace("key={`${period}:${from}:${to}:${scrollResetNonce}`}", "key={`${period}:${from}:${to}:${chartResetNonce}`}")

content = content.replace("onPeriodChange('custom');", "setPeriod('custom');")
content = content.replace("onPeriodChange(next as HomePeriodType);", "setPeriod(next as HomePeriodType);")

with open('app/(tabs)/index.tsx', 'w') as f:
    f.write(content)
