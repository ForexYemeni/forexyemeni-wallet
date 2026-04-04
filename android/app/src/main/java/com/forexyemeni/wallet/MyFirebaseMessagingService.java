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

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Random;

/**
 * Custom FirebaseMessagingService that ALWAYS displays notifications with sound,
 * even when the app is completely killed.
 *
 * The Capacitor plugin's MessagingService stores messages but doesn't create
 * notifications when the bridge is unavailable (app killed). This service
 * overrides that behavior by creating notifications directly via NotificationManager.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "forexyemeni_notifications";
    private static final String CHANNEL_NAME = "إشعارات فوركس يمني";
    private static final String CHANNEL_DESC = "إشعارات المعاملات والأحداث المهمة";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // 1. Ensure notification channel exists with sound
        createNotificationChannel();

        // 2. Extract notification data
        String title = null;
        String body = null;

        RemoteMessage.Notification notification = remoteMessage.getNotification();
        if (notification != null) {
            title = notification.getTitle();
            body = notification.getBody();
        }

        // Fallback to data fields
        if (title == null) title = remoteMessage.getData().get("title");
        if (body == null) body = remoteMessage.getData().get("body");

        if (title == null) title = "فوركس يمني";
        if (body == null) body = "لديك إشعار جديد";

        // 3. Always display notification with sound
        showNotification(title, body, remoteMessage.getData());

        // 4. If Capacitor bridge is available, also forward to plugin (for JS handling)
        if (PushNotificationsPlugin.staticBridge != null
                && PushNotificationsPlugin.staticBridge.getWebView() != null) {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        // Forward to Capacitor plugin if bridge is available
        PushNotificationsPlugin.onNewToken(token);
    }

    /**
     * Create or update the notification channel with explicit sound settings.
     * This ensures the channel always has the correct sound configuration,
     * even after device reboot or app update.
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        // Create audio attributes for notification sound
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        // Get custom notification sound
        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/notification");

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(CHANNEL_DESC);
        channel.enableLights(true);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 300, 200, 300});
        channel.setSound(soundUri, audioAttributes);
        channel.setBypassDnd(true); // Important: bypass Do Not Disturb
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        // Delete old channel and recreate to ensure sound is updated
        manager.deleteNotificationChannel(CHANNEL_ID);
        manager.createNotificationChannel(channel);
    }

    /**
     * Show a notification with explicit sound, vibration, and high priority.
     * This works regardless of whether the app is in foreground, background, or killed.
     */
    @SuppressWarnings("deprecation")
    private void showNotification(String title, String body, Bundle data) {
        Context context = getApplicationContext();
        NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        // Create intent to open the app when notification is tapped
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);

        // Pass notification data to the activity
        if (data != null) {
            Bundle extras = new Bundle(data);
            intent.putExtras(extras);
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);

        // Build notification with explicit sound
        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/notification");
        int notificationId = new Random().nextInt(100000);

        NotificationCompat.Builder builder;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new NotificationCompat.Builder(context, CHANNEL_ID);
        } else {
            builder = new NotificationCompat.Builder(context)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setVibrate(new long[]{0, 300, 200, 300});
        }

        builder
                .setSmallIcon(R.drawable.ic_stat_icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setSound(soundUri)
                .setDefaults(NotificationCompat.DEFAULT_VIBRATE | NotificationCompat.DEFAULT_LIGHTS)
                .setContentIntent(pendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setWhen(System.currentTimeMillis());

        // Set large icon
        try {
            builder.setLargeIcon(android.graphics.BitmapFactory.decodeResource(
                    context.getResources(), R.mipmap.ic_launcher));
        } catch (Exception ignored) {}

        notificationManager.notify(notificationId, builder.build());
    }
}
