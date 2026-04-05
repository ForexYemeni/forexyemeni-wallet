package com.forexyemeni.wallet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Foreground service that keeps the app process alive so FCM notifications
 * can be received even when the user closes the app from recents.
 * 
 * Android aggressively kills background apps, which prevents the FCM service
 * from delivering notifications. This lightweight foreground service with a
 * silent notification prevents that.
 */
public class NotificationKeepAliveService extends Service {

    private static final String CHANNEL_ID = "forexyemeni_keepalive";
    private static final int NOTIFICATION_ID = 99999;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground();
        return START_STICKY; // Restart if killed by system
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        // Restart the service if it gets destroyed
        Intent restartIntent = new Intent(getApplicationContext(), NotificationKeepAliveService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(restartIntent);
        } else {
            startService(restartIntent);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "خدمة الإشعارات",
                NotificationManager.IMPORTANCE_MIN // Silent - no sound, no vibration
            );
            channel.setDescription("يحافظ على وصول الإشعارات");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void startForeground() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("فوركس يمني")
            .setContentText("الإشعارات مفعّلة")
            .setSmallIcon(R.drawable.ic_stat_icon)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build();

        startForeground(NOTIFICATION_ID, notification);
    }
}
