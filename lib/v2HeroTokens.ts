/**
 * v2HeroTokens — design tokens for the V2 account-detail layout.
 *
 * All spacing/border/color values previously hardcoded inline in
 * `AccountDetailsV2Hero.tsx` and `V2GradientHero.tsx` live here. Edit a value
 * once, it propagates to every V2 surface. Non-V2 code is not affected by
 * changes here.
 */

import type { AppThemePalette } from './theme';

// ── Spacing ────────────────────────────────────────────────────────────────
// Named by semantic role so callers express intent, not magic numbers.
export const V2_SPACING = {
  // Horizontal padding inside each card (left + right edges).
  cardPaddingX: 14,
  // Vertical padding at the top of a card (above first content row).
  cardPaddingTop: 14,
  // Vertical padding at the bottom of a card (below last content row).
  cardPaddingBottom: 14,
  // Vertical gap between sibling cards (Card 1 → Card 2 → Card 3).
  cardGap: 32,
  // Internal tight gap between an icon and its adjacent label.
  iconLabelGap: 12,
  // Vertical gap between row 1 (account name) and row 2 (balance) inside hero.
  nameToBalanceGap: 2,
  // Padding for tab/segment-style strips inside Card 2.
  pillStripPaddingY: 8,
  // Default margin between major content blocks inside Card 2 (e.g. between
  // period chips and the cashflow row).
  blockGap: 10,
} as const;

// ── Border radii ───────────────────────────────────────────────────────────
// These live in the global HOME_RADIUS but we expose them here too for code
// that wants V2-scoped naming.
// (Intentionally not re-exporting — `HOME_RADIUS.card` is still imported
// directly where used; this keeps token churn small.)

// ── Colors ─────────────────────────────────────────────────────────────────
/**
 * Colors used by the V2 hero that aren't (yet) part of the global palette.
 * Most are theme-aware (different value for light vs dark). To resolve, call
 * `v2Colors(palette)` which returns a flat object of resolved color strings.
 *
 * If/when these get promoted to the global palette, replace the implementation
 * with palette lookups — call sites won't change.
 */
function pick<T>(palette: AppThemePalette, lightVal: T, darkVal: T): T {
  return palette.isDark ? darkVal : lightVal;
}

export function v2Colors(palette: AppThemePalette) {
  return {
    // Soft border around each rounded card.
    cardBorder: pick<string>(palette, '#E2E7F4', 'rgba(255,255,255,0.10)'),
    // Soft drop shadow for cards in light mode (dark mode uses no shadow).
    cardShadow: '#94A3B8',
    // SegmentedPillSwitch backgrounds inside hero/period cards.
    pillTrackBg: pick<string>(palette, '#EEF2F8', 'rgba(255,255,255,0.08)'),
    pillThumbBg: pick<string>(palette, '#FFFFFF', palette.surface),
    pillBorder: pick<string>(palette, '#DFE5EF', 'transparent'),
    // Activity view-mode segmented bg (Card 3 tabs).
    activitySegmentBg: pick<string>(palette, '#E8ECF4', 'rgba(255,255,255,0.08)'),
    activitySegmentBorder: pick<string>(palette, '#DFE5EF', 'transparent'),
    // Tooltip / "muted" text on hero gradients.
    onHeroText: '#FFFFFF',
    onHeroMuted: 'rgba(255,255,255,0.75)',
    onHeroSoft: 'rgba(255,255,255,0.52)',
    onHeroIcon: 'rgba(255,255,255,0.90)',
    onHeroIconBg: pick<string>(palette, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.07)'),
    // Tick chart's empty (un-filled) ticks.
    tickEmptyBg: pick<string>(palette, 'rgba(0,0,0,0.08)', 'rgba(255,255,255,0.12)'),
    // Drop-in shadow style for cards. Spread with `...v2Colors(palette).cardElevation`.
    cardElevation: palette.isDark
      ? {}
      : {
        elevation: 6,
        shadowColor: '#94A3B8',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.13,
        shadowRadius: 10,
      },
  };
}

export type V2Colors = ReturnType<typeof v2Colors>;
