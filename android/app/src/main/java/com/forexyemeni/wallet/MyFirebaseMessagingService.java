package com.forexyemeni.wallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Random;

/**
 * FCM Service v6 — Definitive notification sound fix.
 *
 * ROOT CAUSE of previous failures (v2.8.0 → v3.2.0):
 * 1. setDefaults(DEFAULT_ALL) conflicted with channel sound settings on Android 8+
 * 2. deleteChannel+createChannel inherited muted settings on Android 13+
 * 3. Direct RingtoneManager.play() failed silently in Doze/background
 *
 * FIX STRATEGY:
 * - Use a BRAND NEW channel ID (fx_v6) to avoid inheriting broken settings
 * - ONLY create channel if it doesn't exist (never delete+recreate)
 * - DO NOT use setDefaults() — let the channel handle sound/vibration
 * - ONLY use RingtoneManager as FALLBACK for pre-Oreo (no channels)
 * - On Android 8+, the notification channel itself produces the sound
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FX_NOTIFY";
    private static final String CHANNEL_ID = "fx_v6";

    @Override
    public void onCreate() {
        super.onCreate();
        createChannelIfNeeded();
    }

    @Override
    public void onNewToken(@NonNull String token) {
        Log.d(TAG, "New FCM token: " + token.substring(0, Math.min(10, token.length())) + "...");
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Log.d(TAG, "=== NOTIFICATION RECEIVED (v6) ===");

        // Extract notification data
        String title = null, body = null;
        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }
        Bundle data = new Bundle();
        if (remoteMessage.getData() != null) {
            for (String key : remoteMessage.getData().keySet()) {
                data.putString(key, remoteMessage.getData().get(key));
            }
        }
        if (title == null) title = data.getString("title", "فوركس يمني");
        if (body == null) body = data.getString("body", "لديك إشعار جديد");

        Log.d(TAG, "Title: " + title + " | Body: " + body);

        // Ensure channel exists
        createChannelIfNeeded();

        // Vibrate
        vibrateDevice();

        // Wake screen
        wakeScreen();

        // Show notification (channel handles sound on Android 8+)
        showNotification(title, body, data);

        // Fallback: only for pre-Oreo devices where channels don't exist
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            playSystemSoundFallback();
        }
    }

    /**
     * Create notification channel ONLY if it doesn't already exist.
     * NEVER delete and recreate — this inherits muted/broken settings on Android 13+.
     * Uses a fresh channel ID (fx_v6) to avoid broken legacy channels.
     */
    private void createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // Check if channel already exists — DO NOT recreate
            NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
            if (existing != null) {
                Log.d(TAG, "Channel already exists: " + CHANNEL_ID
                    + " sound=" + existing.getSound()
                    + " importance=" + existing.getImportance());
                return;
            }

            // Create fresh channel with system default notification sound
            Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();

            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "إشعارات فوركس يمني", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("إشعارات المعاملات");
            ch.enableLights(true);
            ch.setLightColor(0xFFD4AF37);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 300, 150, 300});
            ch.setSound(defaultSound, attrs);
            ch.setBypassDnd(true);
            ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            ch.setShowBadge(true);

            nm.createNotificationChannel(ch);
            Log.d(TAG, "✅ NEW channel created: " + CHANNEL_ID + " with sound: " + defaultSound);
        } catch (Exception e) {
            Log.e(TAG, "Channel error: " + e.getMessage());
        }
    }

    /**
     * Fallback sound for pre-Oreo devices only.
     * On Android 8+, the notification channel handles sound automatically.
     */
    private void playSystemSoundFallback() {
        try {
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            android.media.Ringtone ringtone = RingtoneManager.getRingtone(getApplicationContext(), soundUri);
            if (ringtone != null) {
                ringtone.setStreamType(android.media.AudioManager.STREAM_NOTIFICATION);
                ringtone.play();
                Log.d(TAG, "✅ Pre-Oreo fallback sound played");
            }
        } catch (Exception e) {
            Log.e(TAG, "Fallback sound error: " + e.getMessage());
        }
    }

    private void vibrateDevice() {
        try {
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                v.vibrate(new long[]{0, 300, 150, 300}, -1);
            }
        } catch (Exception ignored) {}
    }

    private void wakeScreen() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.SCREEN_DIM_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, "fx:wake"
                );
                wl.acquire(3000);
            }
        } catch (Exception ignored) {}
    }

    /**
     * Show notification WITHOUT setDefaults().
     * On Android 8+, the channel's sound/vibration settings are used automatically.
     * DO NOT use setDefaults(DEFAULT_ALL) — it conflicts with channel settings.
     * DO NOT use setSound() on the builder — channel handles it.
     */
    private void showNotification(String title, String body, Bundle data) {
        try {
            Context ctx = getApplicationContext();
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            Intent intent = new Intent(ctx, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.setAction(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
            if (data != null) intent.putExtras(data);

            PendingIntent pi = PendingIntent.getActivity(ctx, 0, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            int nid = new Random().nextInt(100000);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_stat_icon)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setAutoCancel(true)
                    .setContentIntent(pi)
                    .setWhen(System.currentTimeMillis())
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setOnlyAlertOnce(false);

            // For pre-Oreo: set defaults since channels don't exist
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                builder.setPriority(NotificationCompat.PRIORITY_MAX);
                builder.setDefaults(NotificationCompat.DEFAULT_SOUND | NotificationCompat.DEFAULT_VIBRATE);
                builder.setVibrate(new long[]{0, 300, 150, 300});
            }

            try {
                builder.setLargeIcon(android.graphics.BitmapFactory.decodeResource(
                        ctx.getResources(), R.mipmap.ic_launcher));
            } catch (Exception ignored) {}

            nm.notify(nid, builder.build());
            Log.d(TAG, "✅ Notification shown: id=" + nid + " channel=" + CHANNEL_ID);
        } catch (Exception e) {
            Log.e(TAG, "❌ Show notification error: " + e.getMessage());
        }
    }
}
