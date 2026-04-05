package com.forexyemeni.wallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Random;

/**
 * FCM Service v8 — CLEAN & SIMPLE approach.
 *
 * WHY v7 FAILED:
 * 1. deleteAndRecreateChannel() on EVERY message causes race conditions
 * 2. Three simultaneous sound methods cause audio focus conflicts
 * 3. Channel deletion while notification is being posted = silent notification
 *
 * v8 STRATEGY:
 * - Create channel ONCE, NEVER delete it
 * - Use MediaPlayer with R.raw.notification as PRIMARY sound
 * - Notification channel IMPORTANCE_MAX ensures sound plays even in DND
 * - Minimal, clean code — no complexity that can fail
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FX_NOTIFY";
    private static final String CHANNEL_ID = "fx_v8";
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean channelCreated = false;

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
    }

    @Override
    public void onNewToken(@NonNull String token) {
        Log.d(TAG, "onNewToken: " + token.substring(0, Math.min(10, token.length())) + "...");
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Log.d(TAG, "=== FCM RECEIVED v8 ===");
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        // Ensure channel exists (idempotent)
        ensureChannel();

        // Extract title and body from BOTH notification and data fields
        String title = "فوركس يمني";
        String body = "لديك إشعار جديد";

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
            Log.d(TAG, "notification payload: title=" + title);
        }

        if (remoteMessage.getData().size() > 0) {
            Log.d(TAG, "data keys: " + remoteMessage.getData().keySet());
            if (remoteMessage.getData().containsKey("title")) {
                title = remoteMessage.getData().get("title");
            }
            if (remoteMessage.getData().containsKey("body")) {
                body = remoteMessage.getData().get("body");
            }
        }

        Log.d(TAG, "Final: title=" + title + " body=" + body);

        // Play sound FIRST (before notification, on main thread)
        mainHandler.post(this::playNotificationSound);

        // Show notification
        showNotification(title, body, remoteMessage.getData());

        // Play sound AGAIN after 300ms as backup
        mainHandler.postDelayed(this::playNotificationSound, 300);
    }

    /**
     * Create notification channel — ONLY if it doesn't exist.
     * NEVER delete or recreate to avoid race conditions.
     * Uses IMPORTANCE_MAX (highest) so sound plays even in Doze/DND.
     */
    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        if (channelCreated) return;

        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // If channel already exists, just mark as created and return
            if (nm.getNotificationChannel(CHANNEL_ID) != null) {
                channelCreated = true;
                Log.d(TAG, "Channel " + CHANNEL_ID + " already exists");
                return;
            }

            // Clean up OLD channels from previous versions (one-time only)
            String[] oldChannels = {
                "fx_v4", "fx_urgent_v4", "fx_v5", "fx_urgent_v5",
                "fx_v6", "fx_urgent_v6", "fx_v7", "fx_urgent_v7",
                "forexyemeni_notifications", "forexyemeni_urgent",
                "fcm_default_channel", "high_importance_channel"
            };
            for (String old : oldChannels) {
                try { nm.deleteNotificationChannel(old); } catch (Exception ignored) {}
            }

            // Get system default notification sound
            Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            // AudioAttributes with NOTIFICATION usage
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setLegacyStreamType(AudioManager.STREAM_NOTIFICATION)
                    .build();

            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID,
                    "إشعارات فوركس يمني",
                    NotificationManager.IMPORTANCE_MAX  // HIGHEST importance
            );
            ch.setDescription("إشعارات المعاملات والأحداث المهمة");
            ch.enableLights(true);
            ch.setLightColor(0xFFD4AF37);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 300, 200, 300});
            ch.setSound(defaultSound, attrs);
            ch.setBypassDnd(true);  // Bypass Do Not Disturb
            ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            ch.setShowBadge(true);

            nm.createNotificationChannel(ch);
            channelCreated = true;
            Log.d(TAG, "Channel fx_v8 CREATED with IMPORTANCE_MAX");
        } catch (Exception e) {
            Log.e(TAG, "ensureChannel error: " + e.getMessage());
        }
    }

    /**
     * Play notification sound using ONE reliable method.
     * Uses MediaPlayer with R.raw.notification on STREAM_NOTIFICATION.
     * If raw resource fails, falls back to RingtoneManager.
     */
    private void playNotificationSound() {
        Log.d(TAG, "playNotificationSound()");

        // Try raw resource first
        boolean rawOk = tryPlayRaw();
        if (!rawOk) {
            // Fallback to system default
            tryPlaySystemDefault();
        }
    }

    /**
     * Method 1: Play R.raw.notification via MediaPlayer on NOTIFICATION stream.
     */
    private boolean tryPlayRaw() {
        try {
            MediaPlayer mp = MediaPlayer.create(getApplicationContext(), R.raw.notification);
            if (mp == null) {
                Log.w(TAG, "MediaPlayer.create returned null for R.raw.notification");
                return false;
            }
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setLegacyStreamType(AudioManager.STREAM_NOTIFICATION)
                    .build());
            mp.setVolume(1.0f, 1.0f);
            mp.setOnCompletionListener(p -> {
                try { p.release(); } catch (Exception ignored) {}
            });
            mp.setOnErrorListener((p, what, extra) -> {
                Log.e(TAG, "MediaPlayer error: what=" + what + " extra=" + extra);
                try { p.release(); } catch (Exception ignored) {}
                return true;
            });
            mp.start();
            Log.d(TAG, "R.raw.notification PLAYING");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "tryPlayRaw failed: " + e.getMessage());
            return false;
        }
    }

    /**
     * Method 2: Play system default notification sound via RingtoneManager.
     */
    private void tryPlaySystemDefault() {
        try {
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            android.media.Ringtone ringtone = RingtoneManager.getRingtone(getApplicationContext(), soundUri);
            if (ringtone != null) {
                if (ringtone.isPlaying()) ringtone.stop();
                ringtone.play();
                Log.d(TAG, "System default notification sound PLAYING");
            }
        } catch (Exception e) {
            Log.e(TAG, "tryPlaySystemDefault failed: " + e.getMessage());
        }
    }

    private void showNotification(String title, String body, java.util.Map<String, String> dataMap) {
        try {
            Context ctx = getApplicationContext();
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            Intent intent = new Intent(ctx, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.setAction(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
            if (dataMap != null) {
                for (String key : dataMap.keySet()) {
                    intent.putExtra(key, dataMap.get(key));
                }
            }

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
                    .setOnlyAlertOnce(false)
                    .setVibrate(new long[]{0, 300, 200, 300})
                    .setDefaults(NotificationCompat.DEFAULT_VIBRATE);

            // For pre-Oreo: set sound and priority directly on builder
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                builder.setSound(soundUri, AudioManager.STREAM_NOTIFICATION);
                builder.setPriority(NotificationCompat.PRIORITY_MAX);
            }

            try {
                builder.setLargeIcon(android.graphics.BitmapFactory.decodeResource(
                        ctx.getResources(), R.mipmap.ic_launcher));
            } catch (Exception ignored) {}

            nm.notify(nid, builder.build());
            Log.d(TAG, "Notification SHOWN: id=" + nid);
        } catch (Exception e) {
            Log.e(TAG, "showNotification error: " + e.getMessage());
        }
    }
}
