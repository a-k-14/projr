// Expo config plugin: schedules an AlarmManager wake-up at ~midnight that triggers
// a widget refresh, then reschedules itself for the next midnight. Survives reboot
// via a BOOT_COMPLETED receiver. Uses setAndAllowWhileIdle (no SCHEDULE_EXACT_ALARM
// permission needed) — fires within ~15 min of the target time even in doze.
//
// Three pieces:
//   1. Kotlin BroadcastReceiver (MidnightUpdateReceiver) — handles ACTION_FIRE
//      and system events (BOOT_COMPLETED, TIME_SET, TIMEZONE_CHANGED).
//   2. AndroidManifest entries — receiver registration + boot permission.
//   3. MainApplication.onCreate hook — schedules the first alarm on app start.

const { withAndroidManifest, withMainApplication, withDangerousMod, AndroidConfig } =
  require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const receiverKotlin = (pkg) => `package ${pkg}.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import java.util.Calendar

/**
 * Fires an AppWidgetManager.ACTION_APPWIDGET_UPDATE at ±midnight so the
 * widget rolls over to the new day's data without requiring the app to be open.
 * Self-reschedules each fire; also re-arms on boot / time / timezone change.
 */
class MidnightUpdateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action == ACTION_FIRE) {
            refreshAllWidgets(context)
        }
        // For all triggers (fire, boot, time changes), (re)schedule the next midnight.
        scheduleNext(context)
    }

    companion object {
        const val ACTION_FIRE = "${pkg}.widget.MIDNIGHT_REFRESH"
        private const val REQUEST_CODE = 8412

        private val WIDGET_CLASSES = listOf(
            "${pkg}.widget.ReniWidget",
            "${pkg}.widget.ReniQuickWidget"
        )

        @JvmStatic
        fun scheduleNext(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                ?: return

            // 00:00:05 next day to ensure today's date math has rolled.
            val nextMidnight = Calendar.getInstance().apply {
                add(Calendar.DAY_OF_MONTH, 1)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 5)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis

            val fireIntent = Intent(context, MidnightUpdateReceiver::class.java).apply {
                action = ACTION_FIRE
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                fireIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // setAndAllowWhileIdle: fires within doze constraints, ±15min from target.
            // No SCHEDULE_EXACT_ALARM permission needed (which is gated on Android 12+).
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                nextMidnight,
                pendingIntent
            )
        }

        private fun refreshAllWidgets(context: Context) {
            val mgr = AppWidgetManager.getInstance(context) ?: return
            for (className in WIDGET_CLASSES) {
                try {
                    val component = ComponentName(context.packageName, className)
                    val ids = mgr.getAppWidgetIds(component)
                    if (ids.isEmpty()) continue
                    val updateIntent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
                        this.component = component
                        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                    }
                    context.sendBroadcast(updateIntent)
                } catch (_: Exception) {
                    // ignore — widget not installed yet, etc.
                }
            }
        }
    }
}
`;

function getAppPackage(config) {
  return (
    AndroidConfig.Package.getPackage(config) ||
    config.android?.package ||
    'com.reni.app'
  );
}

function addReceiverToManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const pkg = getAppPackage(cfg);
    const fireAction = `${pkg}.widget.MIDNIGHT_REFRESH`;
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) return cfg;

    application.receiver = application.receiver || [];
    const exists = application.receiver.some(
      (r) => r.$?.['android:name'] === '.widget.MidnightUpdateReceiver'
    );
    if (!exists) {
      application.receiver.push({
        $: {
          'android:name': '.widget.MidnightUpdateReceiver',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
              { $: { 'android:name': 'android.intent.action.TIME_SET' } },
              { $: { 'android:name': 'android.intent.action.TIMEZONE_CHANGED' } },
              { $: { 'android:name': fireAction } },
            ],
          },
        ],
      });
    }

    cfg.modResults.manifest['uses-permission'] = cfg.modResults.manifest['uses-permission'] || [];
    const hasBootPerm = cfg.modResults.manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.RECEIVE_BOOT_COMPLETED'
    );
    if (!hasBootPerm) {
      cfg.modResults.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.RECEIVE_BOOT_COMPLETED' },
      });
    }
    return cfg;
  });
}

function writeReceiverKotlinFile(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = getAppPackage(cfg);
      const packagePath = pkg.replace(/\./g, '/');
      const dir = path.join(
        cfg.modRequest.projectRoot,
        'android/app/src/main/java',
        packagePath,
        'widget'
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'MidnightUpdateReceiver.kt'),
        receiverKotlin(pkg),
        'utf8'
      );
      return cfg;
    },
  ]);
}

function hookMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    const pkg = getAppPackage(cfg);
    let src = cfg.modResults.contents;
    const importLine = `import ${pkg}.widget.MidnightUpdateReceiver`;
    if (!src.includes(importLine)) {
      // Insert after the last existing import statement.
      src = src.replace(
        /(^import [^\n]+\n)(?![\s\S]*^import )/m,
        `$1${importLine}\n`
      );
    }
    if (!src.includes('MidnightUpdateReceiver.scheduleNext')) {
      // Insert after super.onCreate() inside onCreate().
      src = src.replace(
        /(super\.onCreate\(\)\s*\n)/,
        `$1    MidnightUpdateReceiver.scheduleNext(this)\n`
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withMidnightWidgetRefresh(config) {
  config = writeReceiverKotlinFile(config);
  config = addReceiverToManifest(config);
  config = hookMainApplication(config);
  return config;
};
