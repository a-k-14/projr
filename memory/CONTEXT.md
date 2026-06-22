# Reni — Project Context Notes (for future sessions)

> Goal: persistent, terse notes so we don't re-explore the codebase every session.
> Update whenever a meaningful structural decision is made.

---

## App in one paragraph
**Reni** is an Expo / React Native (Android-primary) personal finance tracker
with a fully local SQLite DB (drizzle-orm + expo-sqlite). Multi-account: tracks
banks, cash, wallets, investments, credit, etc. Users add transactions
(income, expense, transfer, loan), categorise them with their own icons /
emojis, and view per-account + global cashflow, trends, budgets, and loans.
There is also a home-screen Android widget.

## Stack
- **Runtime:** Expo 54 / RN 0.81 / React 19, expo-router, reanimated v4.
- **DB:** `expo-sqlite` + `drizzle-orm`. Schema in `db/schema.ts`. Migrations
  in `db/migrate.ts` (additive, imperative — no migration files). Seeded in
  `db/seed.ts` on first launch.
- **State:** Zustand stores in `stores/*`, bootstrapped in `app/_layout.tsx`.
- **Charts:** `react-native-gifted-charts` wrapped in `components/ui/AppDonutChart` /
  `AppSparklineChart`. Trend chart on account detail uses `TrendLineChart`
  (`components/insights/TrendLineChart.tsx`).
- **Icons:** `lucide-react-native` via `components/ui/AppIcon`. Feather-compatible
  names only (migration in `db/migrate.ts` maps old Ionicons to Feather).
- **Theme:** `lib/theme.ts` — single source. `useAppTheme()` returns `{mode,palette}`.
  NEVER hardcode colours. Light bg `#F5F7FB`, dark bg `#000`.
- **Tokens:** `lib/design.ts` (raw) + `lib/layoutTokens.ts` (`HOME_RADIUS`,
  `HOME_SURFACE`, `HOME_SPACE`, `HOME_TEXT`, `ACTIVITY_LAYOUT`, plus
  `getTxTypeConfig(palette)` for per-tx-type colours/icons).

## Navigation map (expo-router)
```
app/
  _layout.tsx              Root Stack; runs migrations, loads stores, SecurityGuard
  (tabs)/
    _layout.tsx            Custom tab bar w/ animated pill + center FAB
    index.tsx              HOME — net worth, sparklines, account cards
                           (defines HomeAccountPage — REUSED by account detail!)
    activity.tsx           Tx list w/ filters
    insights.tsx           Charts
    settings.tsx           Settings entry
  account/[id].tsx         ★ Account detail (REDESIGN TARGET)
  accounts/index.tsx       Accounts list
  modals/                  add-transaction, split, etc.
  loan/[id].tsx, budget/[id].tsx, deposit/[id].tsx
```
**Tab bar:** Home | Activity | [FAB +] | Insights | Settings. The center FAB
is the primary "add transaction" action — so `+ Add` on the account-detail
screen header is intentionally SECONDARY.

## Account Detail screen — anatomy
File: **`app/account/[id].tsx`** (355 lines, thin wrapper).
The actual UI is delegated to **`HomeAccountPage`** from
`app/(tabs)/index.tsx` with `isDetailScreen={true}`. The detail-screen-specific
layout lives **inside HomeAccountPage** behind `if (isDetailScreen)` branches.
Relevant line ranges in `app/(tabs)/index.tsx`:

- **L2240–2416** — `isDetailScreen` hero block: dark gradient card containing
  the balance row (icon + Balance label + amount + SAVINGS-style type chip)
  AND the trend chart immediately below (via `middleContent` prop).
  Includes an active-point tooltip overlay (L2329–2409).
- **L2421–2589** — Period + cashflow card:
  - Row 1: `ActivityPeriodHeader` (← Jun 2026 →, opens period sheet)
  - Row 2: `SegmentedPillSwitch` Today/Month + `AppSwitch` Cashflow toggle
  - Row 3: **Speedometer ticks** + Income/Expense (or Inflow/Outflow) values
- **L2591+** — Activity section (date-grouped list OR category-grouped),
  with `inlineFilter` ('in'/'out'/null) and `categoryDrilldown`.

### Speedometer ticks — IMPORTANT, KEEP
Defined at L612–621 of `(tabs)/index.tsx`:
```
TICK_W = 2.3, TICK_GAP = 4
TICK_TOTAL = floor((containerWidth + GAP) / (W + GAP))  // ~60-70 ticks
```
This is **NOT decoration** — green tick count / red tick count is proportional
to `income / (income + expense)` for the current period. Both overlays are
animated via reanimated `withSpring` (damping 26, stiffness 180) for a
"speedometer sweep" feel. There's also a fade-in (`tickActivityProgress`) when
the value moves from 0 → non-zero. **Wow-factor element — keep & enhance.**

### Per-account hero gradient
`accountHeroDarkGradient` derived from `ACCOUNT_TYPE_META[type].color`:
- savings  `#3B5B7A` (slate-blue)  — matches screenshot
- cash     `#4F7D5D` (forest)
- wallet   `#8A6548` (terracotta)
- investment `#6E5A8A` (plum)
- credit   `#9B4A46` (brick)
- other    `#667085` (slate)

The hero card top is `typeColor`, bottom is darkened ×0.68. That's the
"SBI - 2082" navy band you see in the screenshot.

### Reused vs detail-only components
- `TrendLineChart` — shared (`middleContent`).
- `ActivityPeriodHeader` — shared between detail + activity tab.
- `SummaryCard` — used elsewhere (`components/SummaryCard.tsx`); NOT used on
  the detail screen (which renders its own Income/Expense block w/ ticks).
- `SegmentedPillSwitch`, `AppSwitch` — shared primitives.
- `DateGroupedTransactionList` — shared.

## Design contract (don't break)
1. **All colours from `palette`** — never hardcoded. Dark mode must work.
2. **Header `+ Add`** stays top-LEFT/right (it's secondary; primary FAB is
   in the tab bar). User confirmed in 2026-01 redesign chat.
3. **Speedometer ticks stay** — they're meaningful, animated, and a key
   "wow" element. Redesign should ENHANCE not remove them.
4. **Category emojis + icons stay** — users can pick either, so the activity
   list mixes 💰 and `arrow-up-right` etc. by design. Don't normalise to
   icons-only.
5. **No quick actions** (Send/Receive/Statement) on account detail. This is
   a TRACKER, not a banking app — accounts are passive.
6. **`+ Add` on header** routes to `/modals/add-transaction?accountId=…`
   (pre-fills account).
7. **Hot reload only.** Never rewrite `package.json` / dependency lists.

## Coding conventions
- `Text` from `@/components/ui/AppText` (not RN `<Text>`).
- Use `AppIcon name="kebab-case"` — auto-converted to PascalCase lucide.
- Animations: reanimated v4, prefer `useSharedValue` + `useAnimatedStyle`.
  `withTiming` for fades, `withSpring` for snappy / springy.
- `delayPressIn={0}` on `TouchableOpacity` is the codebase norm (fast taps).
- Lists: `@shopify/flash-list` (already used in `DateGroupedTransactionList`).
- Tests: `*.test.ts` → node test runner; `*.spec.ts` → Jest + better-sqlite3.

## Active redesign work (2026-01)
**Target:** Account Detail screen aesthetic refresh.
**User constraints captured 2026-01:**
- Wants WOW + usability (looks matter, not just function).
- Ticks stay (animated, meaningful).
- Emojis + icons stay (user choice).
- No quick actions.
- `+ Add` stays where it is (secondary).
- Asked for codebase notes file (this one).

### Design Lab — Phase 1 SHIPPED 2026-01
Lab mode lets us A/B test full screen redesigns against real data.
- **Toggle:** long-press the account name in the header → cycles
  `Current → Pulse → Ledger → Current`. Resets to Current on app restart
  (in-memory only).
- **Store:** `stores/useDesignLabStore.ts` — Zustand, not persisted.
- **Header badge:** when not on Current, a small pill `PULSE` / `LEDGER`
  appears next to the title (also tappable to cycle).
- **Plumbing:** `ScreenHeader` gained `onTitleLongPress?: () => void`.
  `HomeAccountPage` reads `useDesignLabStore` and branches the
  detail-screen JSX three ways inside `app/(tabs)/index.tsx`:
  - `activeVariant === 'current'` → unchanged production block (L2247+)
  - `activeVariant === 'pulse'`   → `<PulseAccountHero />` + `<PulseCashflowCard />`
  - `activeVariant === 'ledger'`  → `<LedgerComingSoonHero />` (Phase 2)
- **Variant components:** `components/account-detail/PulseVariant.tsx`.

### Pulse variant (Phase 1)
- Hero: ONE gradient covers balance + chart (no white break), tabular-num
  balance, pulsing end-of-line dot (account-type color halo).
- Cashflow card: ticks are 22px (was 12px), cascade-fill on data change,
  glowing handoff tick at the green↔red boundary, Net amount centered
  beneath, all three controls (period · today/month · cashflow) collapsed
  into one bottom row.

### Phase 2 TODO
- Ledger variant — editorial / cream / serif balance / proportional split
  bar replacing 60 ticks. Needs `expo-font` + Fraunces or Source Serif.

### Cleanup (when winner picked)
Delete:
- `stores/useDesignLabStore.ts`
- `components/account-detail/PulseVariant.tsx` (or rename / merge into prod)
- `onTitleLongPress` wiring in `ScreenHeader.tsx` + `account/[id].tsx`
- `activeVariant` branches in `app/(tabs)/index.tsx`
Inline the winning JSX into the existing `isDetailScreen` block.
