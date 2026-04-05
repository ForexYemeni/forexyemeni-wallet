package com.forexyemeni.wallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
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
 * FCM Service v7 — Nuclear option: ALL sound methods simultaneously.
 *
 * WHY v6 STILL FAILED:
 * 1. Server (Vercel) sends FCM as "notification" type → Android system handles
 *    it in background WITHOUT calling onMessageReceived(). Our channel sound
 *    is never used because the system uses whatever channel is in the FCM payload
 *    (fx_v4 from old Vercel code, which doesn't exist → default silent channel).
 *
 * 2. On some devices, notification channel sound simply doesn't trigger.
 *
 * FIX v7 STRATEGY:
 * - Use MediaPlayer with RAW resource (R.raw.notification) — MOST RELIABLE
 * - Also use RingtoneManager as backup
 * - Play sound REGARDLESS of Android version (not just pre-Oreo)
 * - Set sound explicitly on BOTH channel AND builder
 * - Use a dedicated Handler to ensure sound plays on main thread
 * - Sound plays independently from the notification display
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FX_NOTIFY";
    private static final String CHANNEL_ID = "fx_v7";
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public void onNewToken(@NonNull String token) {
        Log.d(TAG, "New FCM token: " + token.substring(0, Math.min(10, token.length())) + "...");
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Log.d(TAG, "=== NOTIFICATION RECEIVED (v7) ===");
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        // Create/recreate channel to ensure sound settings are correct
        deleteAndRecreateChannel();

        // Extract notification data
        String title = null, body = null;
        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
            Log.d(TAG, "Has notification payload: title=" + title);
        }
        Bundle data = new Bundle();
        if (remoteMessage.getData() != null) {
            for (String key : remoteMessage.getData().keySet()) {
                data.putString(key, remoteMessage.getData().get(key));
            }
            Log.d(TAG, "Data keys: " + remoteMessage.getData().keySet());
        }
        if (title == null) title = data.getString("title", "فوركس يمني");
        if (body == null) body = data.getString("body", "لديك إشعار جديد");

        Log.d(TAG, "Title: " + title + " | Body: " + body);

        // STEP 1: Play sound IMMEDIATELY on main thread (before notification)
        playSoundNow();

        // STEP 2: Vibrate
        vibrateDevice();

        // STEP 3: Wake screen
        wakeScreen();

        // STEP 4: Show notification
        showNotification(title, body, data);

        // STEP 5: Play sound AGAIN after 500ms as backup (in case first was blocked)
        mainHandler.postDelayed(() -> playSoundNow(), 500);
    }

    /**
     * Delete old channel and create fresh one.
     * This ensures no stale settings from previous versions.
     */
    private void deleteAndRecreateChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // Delete ALL old channels from previous versions to prevent conflicts
            String[] oldChannels = {"fx_v4", "fx_urgent_v4", "fx_v5", "fx_urgent_v5",
                                     "fx_v6", "fx_urgent_v6", "forexyemeni_notifications",
                                     "forexyemeni_urgent", "fcm_default_channel"};
            for (String old : oldChannels) {
                try { nm.deleteNotificationChannel(old); } catch (Exception ignored) {}
            }

            // Get system default notification sound
            Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setLegacyStreamType(android.media.AudioManager.STREAM_NOTIFICATION)
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
            ch.enableLights(true);

            nm.createNotificationChannel(ch);
            Log.d(TAG, "✅ Channel " + CHANNEL_ID + " created with sound: " + defaultSound);
        } catch (Exception e) {
            Log.e(TAG, "Channel error: " + e.getMessage());
        }
    }

    /**
     * Legacy channel creation (for onCreate)
     */
    private void createChannel() {
        deleteAndRecreateChannel();
    }

    /**
     * Play notification sound using ALL available methods simultaneously.
     * This is the nuclear option — we try everything to ensure sound plays.
     */
    private void playSoundNow() {
        Log.d(TAG, "🔊 playSoundNow() called");

        // METHOD 1: MediaPlayer with raw resource file (MOST RELIABLE)
        try {
            MediaPlayer mp = MediaPlayer.create(getApplicationContext(), R.raw.notification);
            if (mp != null) {
                mp.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setLegacyStreamType(android.media.AudioManager.STREAM_NOTIFICATION)
                        .build());
                mp.setVolume(1.0f, 1.0f);
                mp.setOnCompletionListener(MediaPlayer::release);
                mp.setOnErrorListener((mp1, what, extra) -> {
                    try { mp1.release(); } catch (Exception ignored) {}
                    return true;
                });
                mp.start();
                Log.d(TAG, "✅ Method 1: MediaPlayer (R.raw.notification) STARTED");
            } else {
                Log.w(TAG, "⚠️ Method 1: MediaPlayer returned null");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Method 1 failed: " + e.getMessage());
        }

        // METHOD 2: RingtoneManager with system default sound (FALLBACK)
        try {
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            android.media.Ringtone ringtone = RingtoneManager.getRingtone(getApplicationContext(), soundUri);
            if (ringtone != null) {
                ringtone.setStreamType(android.media.AudioManager.STREAM_NOTIFICATION);
                // Stop any currently playing ringtone first
                if (ringtone.isPlaying()) ringtone.stop();
                ringtone.play();
                Log.d(TAG, "✅ Method 2: RingtoneManager playing");
            } else {
                Log.w(TAG, "⚠️ Method 2: RingtoneManager returned null");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Method 2 failed: " + e.getMessage());
        }

        // METHOD 3: MediaPlayer with system default URI (EXTRA FALLBACK)
        new Thread(() -> {
            try {
                Thread.sleep(200); // Small delay to avoid conflict with Method 1
                Uri defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                MediaPlayer mp = new MediaPlayer();
                mp.setDataSource(getApplicationContext(), defaultUri);
                mp.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
                mp.prepare();
                mp.setVolume(1.0f, 1.0f);
                mp.setOnCompletionListener(MediaPlayer::release);
                mp.start();
                Log.d(TAG, "✅ Method 3: MediaPlayer (system URI) STARTED");
            } catch (Exception e) {
                Log.e(TAG, "❌ Method 3 failed: " + e.getMessage());
            }
        }).start();
    }

    private void vibrateDevice() {
        try {
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(android.os.VibrationEffect.createWaveform(
                            new long[]{0, 300, 150, 300}, -1));
                } else {
                    v.vibrate(new long[]{0, 300, 150, 300}, -1);
                }
            }
        } catch (Exception ignored) {}
    }

    private void wakeScreen() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                PowerManager.WakeLock wl = pm.newWakeLock(
                        PowerManager.SCREEN_DIM_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                        "fx:wake:v7");
                wl.acquire(5000);
                Log.d(TAG, "✅ Screen wake lock acquired");
            }
        } catch (Exception ignored) {}
    }

    /**
     * Show notification with sound set EXPLICITLY on both channel and builder.
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

            // Get sound URI for explicit builder sound
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

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
                    .setDefaults(NotificationCompat.DEFAULT_VIBRATE)  // Vibration from defaults
                    .setVibrate(new long[]{0, 300, 150, 300});

            // On ALL versions: set sound explicitly on builder
            builder.setSound(soundUri, android.media.AudioManager.STREAM_NOTIFICATION);

            // On pre-Oreo: also set priority and all defaults
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                builder.setPriority(NotificationCompat.PRIORITY_MAX);
                builder.setDefaults(NotificationCompat.DEFAULT_ALL);
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
