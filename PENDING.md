# Pending / Backlog

Lightweight running list of known-incomplete work and deferred ideas. Keep
entries short; move anything actively in-progress to a branch/PR and delete it
here once shipped.

Status key: 🔴 not started · 🟡 in progress · 🟢 done (remove on next pass)

---

## Widgets

- 🔴 **Render widgets on boot / after app update.** Widgets are blank until the
  app is opened once after a reboot or fresh APK install. Root cause: the widget
  content is a JS-rendered bitmap (`react-native-android-widget`), and the
  headless render task can't run on a stopped/just-installed app, and nothing
  re-triggers a render on boot (`updatePeriodMillis: 0`, no `BOOT_COMPLETED`
  receiver).
  - Plan: custom Expo config plugin to (a) set a branded static `initialLayout`
    so the widget is never visually blank, and (b) add a `BOOT_COMPLETED`
    receiver that calls `requestWidgetUpdate` to re-render real data after reboot.
  - Known limit: a brand-new install (never opened) can only show the static
    placeholder — live data is impossible before first launch (no JS runtime).
  - Needs a real `expo prebuild` + device build to verify.

---

## Theming

- 🔴 **Dark mode.** Finish/verify dark-mode support across all screens and
  components (palette coverage, contrast, charts, widgets).

---

## Notes

- This file is a backlog, not a spec. For anything non-trivial, capture detail in
  the relevant PR/commit; this list is just so deferred items aren't forgotten.
