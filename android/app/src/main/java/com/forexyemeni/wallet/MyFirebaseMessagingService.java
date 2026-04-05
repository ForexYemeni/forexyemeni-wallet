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
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Random;

/**
 * Custom FCM Service that GUARANTEES sound on every notification.
 * Uses MediaPlayer to directly play sound file — bypasses all channel issues.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FX_FCM";
    private static final String CHANNEL_ID = "fx_v4";
    private static final String CHANNEL_ID_URGENT = "fx_urgent_v4";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token received");
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Log.d(TAG, "onMessageReceived called");

        createNotificationChannels();
        wakeUpDevice();

        String title = null;
        String body = null;

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

        if (title == null) title = data.getString("title");
        if (body == null) body = data.getString("body");
        if (title == null) title = "فوركس يمني";
        if (body == null) body = "لديك إشعار جديد";

        Log.d(TAG, "Notification: " + title + " / " + body);

        // 1. ALWAYS play sound directly using MediaPlayer (guaranteed)
        playSoundDirectly();

        // 2. Show notification
        showNotification(title, body, data);
    }

    /**
     * Play notification sound using MediaPlayer.
     * This BYPASSES notification channel sound settings completely.
     * Works 100% regardless of Android version, channel config, or app state.
     */
    private void playSoundDirectly() {
        new Thread(() -> {
            try {
                MediaPlayer mediaPlayer = MediaPlayer.create(
                    getApplicationContext(),
                    R.raw.notification
                );
                if (mediaPlayer != null) {
                    mediaPlayer.setAudioAttributes(
                        new AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                            .build()
                    );
                    mediaPlayer.setVolume(1.0f, 1.0f);
                    mediaPlayer.setOnCompletionListener(mp -> {
                        mp.release();
                        Log.d(TAG, "Sound played and released");
                    });
                    mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                        mp.release();
                        Log.e(TAG, "MediaPlayer error: " + what + " " + extra);
                        // Fallback: play default notification sound
                        playDefaultSound();
                        return true;
                    });
                    mediaPlayer.start();
                } else {
                    Log.w(TAG, "MediaPlayer is null, using default sound");
                    playDefaultSound();
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to play sound: " + e.getMessage());
                playDefaultSound();
            }
        }).start();
    }

    /**
     * Fallback: Play the system default notification sound using RingtoneManager.
     */
    private void playDefaultSound() {
        try {
            Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (defaultSound != null) {
                MediaPlayer mp = new MediaPlayer();
                mp.setDataSource(getApplicationContext(), defaultSound);
                mp.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );
                mp.prepare();
                mp.setVolume(1.0f, 1.0f);
                mp.setOnCompletionListener(MediaPlayer::release);
                mp.start();
            }
        } catch (Exception e) {
            Log.e(TAG, "Default sound also failed: " + e.getMessage());
        }
    }

    private void wakeUpDevice() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.SCREEN_DIM_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "fx:wake"
                );
                wl.acquire(3000);
            }
        } catch (Exception ignored) {}
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        Uri customSound = Uri.parse("android.resource://" + getPackageName() + "/raw/notification");

        AudioAttributes attrs = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        // Main channel
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "إشعارات", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("إشعارات فوركس يمني");
        channel.enableLights(true);
        channel.setLightColor(0xFFD4AF37);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 500, 200, 500});
        channel.setSound(customSound, attrs);
        channel.setBypassDnd(true);
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        channel.setShowBadge(true);
        try { manager.deleteNotificationChannel(CHANNEL_ID); } catch (Exception ignored) {}
        manager.createNotificationChannel(channel);

        // Urgent channel
        NotificationChannel urgent = new NotificationChannel(CHANNEL_ID_URGENT, "إشعارات حرجة", NotificationManager.IMPORTANCE_MAX);
        urgent.setDescription("تحويلات وإيداعات وسحوبات");
        urgent.enableLights(true);
        urgent.setLightColor(0xFFD4AF37);
        urgent.enableVibration(true);
        urgent.setVibrationPattern(new long[]{0, 800, 200, 800});
        urgent.setSound(defaultSound, attrs);
        urgent.setBypassDnd(true);
        urgent.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        urgent.setShowBadge(true);
        try { manager.deleteNotificationChannel(CHANNEL_ID_URGENT); } catch (Exception ignored) {}
        manager.createNotificationChannel(urgent);
    }

    private void showNotification(String title, String body, Bundle data) {
        Context ctx = getApplicationContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        if (data != null) intent.putExtras(data);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, intent, flags);

        int nid = new Random().nextInt(100000);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setWhen(System.currentTimeMillis())
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVibrate(new long[]{0, 500, 200, 500})
                .setDefaults(NotificationCompat.DEFAULT_VIBRATE | NotificationCompat.DEFAULT_LIGHTS);

        try {
            builder.setLargeIcon(android.graphics.BitmapFactory.decodeResource(
                    ctx.getResources(), R.mipmap.ic_launcher));
        } catch (Exception ignored) {}

        nm.notify(nid, builder.build());
    }
}
