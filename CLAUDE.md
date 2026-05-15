# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server
npx expo start

# Run on Android / iOS
npx expo start --android
npx expo start --ios

# Run all tests (Node built-in runner for *.test.ts, Jest for *.spec.ts)
npm test

# Run only Jest specs
npx jest

# Run a single Jest spec
npx jest tests/transactions.service.spec.ts

# Run a single Node test file
node --experimental-strip-types --test tests/dateUtils.test.ts

# Type-check
npx tsc --noEmit
```

## Architecture Overview

This is an **Expo / React Native** personal finance tracker (Android-primary). It uses **expo-router** for file-based navigation and **expo-sqlite + drizzle-orm** for a fully local SQLite database.

### Data layer

- `db/schema.ts` — Drizzle table definitions (accounts, categories, tags, transactions, loans, budget, settings, persons).
- `db/client.ts` — opens `finance.db` synchronously via `expo-sqlite`, exposes `db` (drizzle) and `sqlite` (raw).
- `db/migrate.ts` — `runMigrations()` creates all tables and applies additive column migrations manually (no migration files; ALTER TABLE is done imperatively with PRAGMA checks).
- `db/seed.ts` — seeds demo data on first launch.

### Service layer (`services/`)

Pure async functions that hit drizzle/sqlite directly. Each domain has its own file (`accounts.ts`, `transactions.ts`, `categories.ts`, `tags.ts`, `loans.ts`, `budget.ts`, `settings.ts`, `analytics.ts`). Services are the only place that should touch `db`.

**Transfer transactions** are stored as two paired rows (both with `transferPairId` set, one `type: 'in'` on the destination, one `type: 'out'` on the source). Services must keep both rows in sync.

**Loan transactions** use `type: 'loan'` and encode direction in the `note` field via a `"Label · user note"` convention (e.g. `"Lent to John · coffee money"`). `lib/derived.ts` exposes helpers to parse this (`getLoanTransactionKind`, `getLoanOriginImpact`, etc.).

Account `balance` is updated atomically in SQL (`balance + delta`) whenever a transaction is created/updated/deleted. `lib/transactionImpact.ts` → `getTransactionBalanceDelta` is the single source of truth for what a transaction does to a balance.

### State layer (`stores/`)

Zustand stores wrap the service layer. Loaded once at startup, then kept in sync after mutations.

- `useAccountsStore` — accounts list; also manages `sortOrder`.
- `useCategoriesStore` — categories (two-level hierarchy: parent → child) + tags in one store.
- `useTransactionsStore` — paginated transaction list with server-side filters; `PAGE_SIZE = 50` (from `lib/layoutTokens.ts`). After mutations it re-fetches from the DB (`load()`) rather than patching in-place, except for simple date-stable updates.
- `useUIStore` — app settings (`Settings` type) with optimistic writes; also holds `privacyGraceUntil` for biometric lock grace period.
- `useTransactionDraftStore` — ephemeral form state for the add-transaction modal (account, category, tags, split rows).
- `useBudgetStore` / `useLoansStore` — budget and loan state.
- `usePersonsStore` — canonical list of person names for loan (and future deposit) autocomplete. Loaded lazily when the loan form opens. Backed by the `persons` table; `upsertPerson()` is called automatically inside `createLoan` / `updateLoanOrigin` in `services/loans.ts`, and the store is refreshed after each loan mutation.

Stores are **not** loaded in the store files themselves — they are bootstrapped in `app/_layout.tsx` (`runMigrations` → load accounts/settings/categories, then seed if first run).

### Navigation

expo-router file-based:

```
app/
  _layout.tsx          Root Stack — bootstraps DB + stores, wraps in SecurityGuard
  (tabs)/
    _layout.tsx        Custom tab bar with animated pill indicator + FAB add button
    index.tsx          Home (net worth, sparklines, account cards)
    activity.tsx       Transaction list with filters
    insights.tsx       Charts / analytics
    settings.tsx       Settings entry point
  modals/              Pushed as Stack screens (add-transaction, split, loan-settlement, etc.)
  settings/            Stack sub-navigator for settings forms
  loan/[id].tsx        Loan detail
  budget/[id].tsx      Budget detail
  account/[id].tsx     Account detail
  accounts/index.tsx   Accounts list
  deposits.tsx         Fixed deposits list
  loans.tsx            Loans list
  budget.tsx           Budget list
```

Tab bar has 5 slots: Home | Activity | **[FAB +]** | Insights | Settings. The FAB opens `/modals/add-transaction`. Pressing an already-active tab triggers a reset via `lib/tabResetRegistry.ts`.

### Theming

`lib/theme.ts` is the single source of theming:

- `getThemePalette(mode)` returns an `AppThemePalette` object with every color token needed by components.
- `useAppTheme()` hook — reads `useUIStore` settings + system scheme, returns `{ mode, palette }`. **All components receive palette as a prop or call this hook** — never hardcode colors.
- Light background: `#F5F7FB`, dark background: `#000000`.

### Design tokens

`lib/design.ts` defines raw spacing/radius/text-size constants. `lib/layoutTokens.ts` re-exports them and adds domain-specific layout constants (`ACTIVITY_LAYOUT`, `HOME_SURFACE`, `HOME_RADIUS`, etc.) and `getTxTypeConfig(palette)` for per-transaction-type colors/icons.

### UI primitives (`components/ui/`)

- `AppIcon` — wraps `lucide-react-native`; converts kebab-case icon names to PascalCase.
- `AppText` / `AnimatedText` — thin wrappers around RN `Text`.
- `BottomSheet` — custom bottom sheet (not a library).
- `AppButton` (`FilledButton`, text variants) — use `PRIMARY_ACTION` / `BUTTON_TOKENS` tokens.
- `AppDonutChart` / `AppSparklineChart` — chart wrappers around `react-native-gifted-charts`.
- Icons must use Feather-compatible names (a migration in `db/migrate.ts` maps old Ionicons names to Feather equivalents).

### Testing

- `tests/*.test.ts` — run with Node's built-in test runner (`--experimental-strip-types`). Cover pure utility functions (`dateUtils`, `ui-format`, `derived`).
- `tests/*.spec.ts` — run with Jest + ts-jest. Cover services and more complex logic (`transactions.service.spec.ts`, `calculator-math.spec.ts`, etc.). Jest config is in `jest.config.js` (testEnvironment: node; uses `better-sqlite3` for in-process DB, not expo-sqlite).

When writing service tests, use `better-sqlite3` directly (not `expo-sqlite`) — see existing spec files for the pattern.
