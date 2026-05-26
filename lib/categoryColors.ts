/**
 * Perceptually-uniform color derivation via OKLCH.
 *
 * One hue → two tokens:
 *   tile    = pastel bg for icon tiles, soft badges   (L 0.93, C 0.018)
 *   surface = solid surface for hero cards, fills     (L 0.45, C 0.06)
 *
 * OKLCH is computed to sRGB hex at module load time — zero runtime cost.
 *
 * Hue guardrails (from spec):
 *   - Cash and Loans both live in the sage family but are nudged ±10° apart.
 *   - Brand navy (~265°) is reserved for chrome; don't use it as a category surface.
 *   - Keep L/C constants fixed across all categories — per-hue tweaks break the system.
 */

// ── System constants ────────────────────────────────────────────────────────

const TILE_L = 0.93;
const TILE_C = 0.018;
const SURFACE_L = 0.45;
const SURFACE_C = 0.06;

// ── Category hues (OKLCH perceptual space) ──────────────────────────────────

export const CATEGORY_HUES = {
  cash:     140, // sage-green — nudged from loans
  deposits:   8, // dusty rose
  loans:    155, // sage-green — nudged from cash
  cards:    265, // indigo (avoid for surface; use sparingly)
  invest:    60, // ochre
} as const;

export type CategoryKey = keyof typeof CATEGORY_HUES;

// ── OKLCH → sRGB hex ────────────────────────────────────────────────────────

/**
 * Converts OKLCH to a #rrggbb hex string.
 * Out-of-gamut values are clamped to [0, 1] before gamma correction.
 *
 * L ∈ [0, 1]  (0 = black, 1 = white)
 * C ∈ [0, ~0.4]  (chroma; 0 = achromatic)
 * H ∈ [0, 360)  (hue in degrees)
 */
export function oklchToHex(L: number, C: number, H: number): string {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab → LMS (cube-root compressed)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  // Un-compress
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  // LMS → linear sRGB
  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  // Clamp + sRGB gamma
  const toChannel = (c: number): number => {
    const v = Math.max(0, Math.min(1, c));
    return Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255);
  };

  const r = toChannel(rLin);
  const g = toChannel(gLin);
  const bl = toChannel(bLin);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCategoryColors(hue: number): { tile: string; surface: string } {
  return {
    tile:    oklchToHex(TILE_L,    TILE_C,    hue),
    surface: oklchToHex(SURFACE_L, SURFACE_C, hue),
  };
}

/** Pre-computed tokens for every category. Import directly instead of calling getCategoryColors. */
export const CATEGORY_COLORS = Object.fromEntries(
  (Object.entries(CATEGORY_HUES) as [CategoryKey, number][]).map(
    ([key, hue]) => [key, getCategoryColors(hue)]
  )
) as Record<CategoryKey, { tile: string; surface: string }>;
