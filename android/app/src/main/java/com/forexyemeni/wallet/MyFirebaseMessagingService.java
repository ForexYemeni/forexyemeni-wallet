package com.forexyemeni.wallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
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
 * FCM Service v5 — GUARANTEES sound using RingtoneManager (system default).
 * No custom sound files, no channel dependencies, no MediaPlayer issues.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FX_NOTIFY";
    private static final String CHANNEL_ID = "fx_v5";

    @Override
    public void onCreate() {
        super.onCreate();
        setupChannel();
    }

    @Override
    public void onNewToken(@NonNull String token) {
        Log.d(TAG, "Token: " + token.substring(0, 10) + "...");
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Log.d(TAG, "=== NOTIFICATION RECEIVED ===");

        setupChannel();

        // Extract data
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

        // Step 1: Play system notification sound IMMEDIATELY
        playSystemSound();

        // Step 2: Vibrate
        vibrateDevice();

        // Step 3: Wake screen
        wakeScreen();

        // Step 4: Show notification
        showNotification(title, body, data);
    }

    /**
     * Play the default system notification sound.
     * This is the MOST RELIABLE way to play a sound on Android.
     * Works on ALL devices, ALL Android versions, NO custom files needed.
     */
    private void playSystemSound() {
        try {
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            Ringtone ringtone = RingtoneManager.getRingtone(getApplicationContext(), soundUri);
            if (ringtone != null) {
                ringtone.setStreamType(android.media.AudioManager.STREAM_NOTIFICATION);
                ringtone.play();
                Log.d(TAG, "✅ System sound played via RingtoneManager");
            } else {
                Log.e(TAG, "❌ Ringtone is null");
                // Fallback: try alarm sound
                try {
                    Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                    Ringtone alarm = RingtoneManager.getRingtone(getApplicationContext(), alarmUri);
                    if (alarm != null) {
                        alarm.setStreamType(android.media.AudioManager.STREAM_ALARM);
                        alarm.play();
                        Log.d(TAG, "✅ Alarm sound played as fallback");
                    }
                } catch (Exception e2) {
                    Log.e(TAG, "❌ All sound methods failed");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ playSystemSound error: " + e.getMessage());
        }
    }

    private void vibrateDevice() {
        try {
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                v.vibrate(new long[]{0, 500, 200, 500}, -1);
            }
        } catch (Exception ignored) {}
    }

    private void wakeScreen() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.SCREEN_DIM_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, "fx:w"
                );
                wl.acquire(3000);
            }
        } catch (Exception ignored) {}
    }

    private void setupChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // Use SYSTEM DEFAULT sound for the channel
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
            ch.setVibrationPattern(new long[]{0, 500, 200, 500});
            ch.setSound(defaultSound, attrs);  // System default sound
            ch.setBypassDnd(true);
            ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            ch.setShowBadge(true);

            // Delete old channel first to clear any cached settings
            try { nm.deleteNotificationChannel(CHANNEL_ID); } catch (Exception ignored) {}
            nm.createNotificationChannel(ch);

            Log.d(TAG, "✅ Channel created: " + CHANNEL_ID);
        } catch (Exception e) {
            Log.e(TAG, "Channel error: " + e.getMessage());
        }
    }

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
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    // These defaults ensure sound+ vibration even if channel settings are wrong
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setVibrate(new long[]{0, 500, 200, 500});

            try {
                builder.setLargeIcon(android.graphics.BitmapFactory.decodeResource(
                        ctx.getResources(), R.mipmap.ic_launcher));
            } catch (Exception ignored) {}

            nm.notify(nid, builder.build());
            Log.d(TAG, "✅ Notification shown: " + nid);
        } catch (Exception e) {
            Log.e(TAG, "❌ Show notification error: " + e.getMessage());
        }
    }
}
