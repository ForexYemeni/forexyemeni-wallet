package com.forexyemeni.wallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
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
 * Custom FirebaseMessagingService that ALWAYS delivers notifications with sound,
 * even when the app is completely killed by the user or system.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "forexyemeni_notifications";
    private static final String CHANNEL_ID_URGENT = "forexyemeni_urgent";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        // Start the keep-alive service when FCM token refreshes
        startKeepAliveService();
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        // 1. Ensure channels exist
        createNotificationChannels();

        // 2. Wake up the device screen briefly for important notifications
        wakeUpDevice();

        // 3. Extract notification data
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

        // 4. Determine if high-priority (transactions, transfers)
        String msgType = data.getString("type", "");
        boolean isUrgent = msgType.contains("transfer") || msgType.contains("deposit") 
            || msgType.contains("withdraw") || msgType.contains("payment")
            || (title != null && (title.contains("تحويل") || title.contains("إيداع") 
                || title.contains("سحب") || title.contains("دف")));

        // 5. Show heads-up notification with sound
        showNotification(title, body, data, isUrgent);
    }

    private void wakeUpDevice() {
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null && !powerManager.isInteractive()) {
            PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                PowerManager.SCREEN_DIM_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "forexyemeni:notification_wake"
            );
            wakeLock.acquire(3000); // Wake for 3 seconds
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/notification");

        // Main notification channel - HIGH importance (shows heads-up)
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "إشعارات فوركس يمني",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("إشعارات المعاملات والأحداث المهمة");
        channel.enableLights(true);
        channel.setLightColor(0xFFD4AF37); // Gold color
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
        channel.setSound(soundUri, audioAttributes);
        channel.setBypassDnd(true); // Break through Do Not Disturb
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        channel.setShowBadge(true);

        manager.deleteNotificationChannel(CHANNEL_ID);
        manager.createNotificationChannel(channel);

        // Urgent channel for transactions - MAX importance
        NotificationChannel urgentChannel = new NotificationChannel(
                CHANNEL_ID_URGENT,
                "إشعارات المعاملات",
                NotificationManager.IMPORTANCE_MAX
        );
        urgentChannel.setDescription("إشعارات التحويلات والإيداعات والسحوبات");
        urgentChannel.enableLights(true);
        urgentChannel.setLightColor(0xFFD4AF37);
        urgentChannel.enableVibration(true);
        urgentChannel.setVibrationPattern(new long[]{0, 800, 200, 800});
        urgentChannel.setSound(soundUri, audioAttributes);
        urgentChannel.setBypassDnd(true);
        urgentChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        urgentChannel.setShowBadge(true);

        manager.deleteNotificationChannel(CHANNEL_ID_URGENT);
        manager.createNotificationChannel(urgentChannel);
    }

    private void showNotification(String title, String body, Bundle data, boolean isUrgent) {
        Context context = getApplicationContext();
        NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        String channelId = isUrgent ? CHANNEL_ID_URGENT : CHANNEL_ID;

        // Intent to open app when notification is tapped
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        if (data != null) intent.putExtras(data);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);

        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/notification");
        int notificationId = new Random().nextInt(100000);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.ic_stat_icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setSound(soundUri)
                .setDefaults(NotificationCompat.DEFAULT_VIBRATE | NotificationCompat.DEFAULT_LIGHTS)
                .setContentIntent(pendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setWhen(System.currentTimeMillis())
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setOnlyAlertOnce(false);

        // Full-screen intent for urgent notifications (shows over lock screen)
        if (isUrgent && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent fullScreenIntent = new Intent(context, MainActivity.class);
            fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                context, notificationId, fullScreenIntent, flags
            );
            builder.setFullScreenIntent(fullScreenPendingIntent, true);
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
