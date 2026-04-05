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

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Random;

/**
 * Custom FirebaseMessagingService that ALWAYS displays notifications with sound,
 * even when the app is completely killed.
 *
 * The Capacitor plugin's MessagingService only stores messages when the bridge
 * is unavailable (app killed) without creating notifications. This service
 * overrides that behavior by creating notifications directly via NotificationManager.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "forexyemeni_notifications";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        // 1. Ensure notification channel exists with sound
        createNotificationChannel();

        // 2. Extract notification data
        String title = null;
        String body = null;

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }

        // Fallback to data fields
        Bundle data = new Bundle();
        for (String key : remoteMessage.getData().keySet()) {
            data.putString(key, remoteMessage.getData().get(key));
        }

        if (title == null) title = data.getString("title");
        if (body == null) body = data.getString("body");

        if (title == null) title = "فوركس يمني";
        if (body == null) body = "لديك إشعار جديد";

        // 3. Always display notification with sound (works even when killed)
        showNotification(title, body, data);
    }

    /**
     * Create or update the notification channel with explicit sound settings.
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/notification");

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "إشعارات فوركس يمني",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("إشعارات المعاملات والأحداث المهمة");
        channel.enableLights(true);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 300, 200, 300});
        channel.setSound(soundUri, audioAttributes);
        channel.setBypassDnd(true);
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        manager.deleteNotificationChannel(CHANNEL_ID);
        manager.createNotificationChannel(channel);
    }

    /**
     * Show a notification with explicit sound, vibration, and high priority.
     * Works regardless of app state: foreground, background, or killed.
     */
    private void showNotification(String title, String body, Bundle data) {
        Context context = getApplicationContext();
        NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        // Intent to open app when tapped
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);

        if (data != null) {
            intent.putExtras(data);
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);

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

        try {
            builder.setLargeIcon(android.graphics.BitmapFactory.decodeResource(
                    context.getResources(), R.mipmap.ic_launcher));
        } catch (Exception ignored) {}

        notificationManager.notify(notificationId, builder.build());
    }
}
