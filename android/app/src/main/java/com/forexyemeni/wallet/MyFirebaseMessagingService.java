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

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Random;

/**
 * Custom FirebaseMessagingService that ALWAYS delivers notifications with LOUD sound,
 * even when the app is completely killed by the user or system.
 * 
 * This service overrides Capacitor's default behavior which may not play sound
 * reliably when the app is in foreground.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    // Use a unique channel ID to avoid cached channel settings
    private static final String CHANNEL_ID = "fx_wallet_notif_v3";
    private static final String CHANNEL_ID_URGENT = "fx_wallet_urgent_v3";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        startKeepAliveService();
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
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

        String msgType = data.getString("type", "");
        boolean isUrgent = msgType.contains("transfer") || msgType.contains("deposit") 
            || msgType.contains("withdraw") || msgType.contains("payment")
            || (title != null && (title.contains("تحويل") || title.contains("إيداع") 
                || title.contains("سحب") || title.contains("دف")));

        showNotification(title, body, data, isUrgent);
    }

    private void wakeUpDevice() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager != null && !powerManager.isInteractive()) {
                PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                    PowerManager.SCREEN_DIM_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "forexyemeni:wake"
                );
                wakeLock.acquire(3000);
            }
        } catch (Exception ignored) {}
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        // Use the DEFAULT notification sound as primary (always works)
        Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        // Also use our custom sound
        Uri customSound = Uri.parse("android.resource://" + getPackageName() + "/raw/notification");

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        // Main channel
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "إشعارات فوركس يمني",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("إشعارات المعاملات والأحداث المهمة");
        channel.enableLights(true);
        channel.setLightColor(0xFFD4AF37);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
        channel.setSound(defaultSound, audioAttributes);
        channel.setBypassDnd(true);
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        channel.setShowBadge(true);

        try {
            manager.deleteNotificationChannel(CHANNEL_ID);
        } catch (Exception ignored) {}
        manager.createNotificationChannel(channel);

        // Urgent channel for transactions
        NotificationChannel urgentChannel = new NotificationChannel(
                CHANNEL_ID_URGENT,
                "إشعارات المعاملات الحرجة",
                NotificationManager.IMPORTANCE_MAX
        );
        urgentChannel.setDescription("إشعارات التحويلات والإيداعات والسحوبات");
        urgentChannel.enableLights(true);
        urgentChannel.setLightColor(0xFFD4AF37);
        urgentChannel.enableVibration(true);
        urgentChannel.setVibrationPattern(new long[]{0, 800, 200, 800});
        urgentChannel.setSound(customSound, audioAttributes);
        urgentChannel.setBypassDnd(true);
        urgentChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        urgentChannel.setShowBadge(true);

        try {
            manager.deleteNotificationChannel(CHANNEL_ID_URGENT);
        } catch (Exception ignored) {}
        manager.createNotificationChannel(urgentChannel);
    }

    private void showNotification(String title, String body, Bundle data, boolean isUrgent) {
        Context context = getApplicationContext();
        NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        String channelId = isUrgent ? CHANNEL_ID_URGENT : CHANNEL_ID;

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        if (data != null) intent.putExtras(data);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);

        // Use BOTH custom sound and default sound to guarantee sound plays
        Uri customSound = Uri.parse("android.resource://" + getPackageName() + "/raw/notification");
        Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        int notificationId = new Random().nextInt(100000);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.ic_stat_icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setSound(customSound)
                .setDefaults(NotificationCompat.DEFAULT_VIBRATE | NotificationCompat.DEFAULT_LIGHTS | NotificationCompat.DEFAULT_SOUND)
                .setContentIntent(pendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setWhen(System.currentTimeMillis())
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setOnlyAlertOnce(false);

        // Full-screen for urgent on lock screen
        if (isUrgent && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent fsIntent = new Intent(context, MainActivity.class);
            fsIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent fsPendingIntent = PendingIntent.getActivity(context, notificationId, fsIntent, flags);
            builder.setFullScreenIntent(fsPendingIntent, true);
        }

        try {
            builder.setLargeIcon(android.graphics.BitmapFactory.decodeResource(
                    context.getResources(), R.mipmap.ic_launcher));
        } catch (Exception ignored) {}

        notificationManager.notify(notificationId, builder.build());
    }

    private void startKeepAliveService() {
        Intent serviceIntent = new Intent(this, NotificationKeepAliveService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }
}
