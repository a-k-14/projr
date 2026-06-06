import { oklchToHex } from './categoryColors';

/** Shared visual tokens for the "Other Assets" feature tile (used in home + assets screen). */
export const ASSET_TONE = '#9A7440';
export const ASSET_BG = '#F4EEDC';
/** Darker surface for the assets hero card — matches the L≈0.45 depth of loans/deposits hero cards. */
export const ASSET_HERO_SURFACE = oklchToHex(0.45, 0.06, 70); // Hue 70 represents gold/amber
