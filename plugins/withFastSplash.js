// Expo config plugin: makes the Android 12+ system splash dismiss faster.
//
// Adds windowSplashScreenAnimationDuration=0 to the splash theme. This is the
// OS-enforced minimum time the icon is shown before the app is allowed to
// dismiss the splash. Default varies per device (500–1000ms). Setting to 0 lets
// expo-splash-screen's OnPreDrawListener dismiss the splash the moment the
// first React frame is ready, instead of waiting out a system-mandated hold.

const { withAndroidStyles } = require('@expo/config-plugins');

const SPLASH_THEME_NAME = 'Theme.App.SplashScreen';
const ATTR = 'windowSplashScreenAnimationDuration';

module.exports = function withFastSplash(config) {
  return withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults?.resources?.style;
    if (!Array.isArray(styles)) return cfg;
    const splashStyle = styles.find((s) => s?.$?.name === SPLASH_THEME_NAME);
    if (!splashStyle) return cfg;
    splashStyle.item = splashStyle.item || [];
    const existing = splashStyle.item.find((i) => i?.$?.name === ATTR);
    if (existing) {
      existing._ = '0';
    } else {
      splashStyle.item.push({ $: { name: ATTR }, _: '0' });
    }
    return cfg;
  });
};
