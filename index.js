// Custom entry — registers the widget headless task in the JS context BEFORE
// expo-router boots. Required so Android can render the widget even when the
// main app isn't open (boot, AlarmManager wake, etc).
//
// The widget handler is wrapped in try/catch defensively: it transitively
// imports SQLite, services, and stores, all of which can throw in a headless
// JS context where the full RN environment isn't available. If anything in the
// widget chain throws at module-load time, we log and let the main app boot
// instead of crashing the whole process.
try {
  require('./widgets/widgetTaskHandler');
} catch (err) {
  console.error('[index] widget handler failed to load:', err);
}

require('expo-router/entry');
