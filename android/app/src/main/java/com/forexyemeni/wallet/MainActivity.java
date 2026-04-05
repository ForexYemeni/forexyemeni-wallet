package com.forexyemeni.wallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.Bundle;
import android.provider.Settings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Channel IDs must match MyFirebaseMessagingService.java (fx_v6)
    private static final String CHANNEL_ID = "fx_v6";
    private static final String CHANNEL_ID_URGENT = "fx_urgent_v6";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        startKeepAliveService();
        requestBatteryOptimization();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Restart keep-alive service when app is brought to front
        startKeepAliveService();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();

                // Use SYSTEM DEFAULT notification sound (most reliable across all devices)
                Uri defaultSound = android.media.RingtoneManager.getDefaultUri(
                    android.media.RingtoneManager.TYPE_NOTIFICATION);

                // Main channel - only create if not exists
                if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                    NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "إشعارات فوركس يمني",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("إشعارات المعاملات والأحداث المهمة");
                    channel.enableLights(true);
                    channel.setLightColor(0xFFD4AF37);
                    channel.enableVibration(true);
                    channel.setVibrationPattern(new long[]{0, 300, 150, 300});
                    channel.setSound(defaultSound, audioAttributes);
                    channel.setBypassDnd(true);
                    channel.setLockscreenVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC);
                    channel.setShowBadge(true);
                    manager.createNotificationChannel(channel);
                }

                // Urgent channel - only create if not exists
                if (manager.getNotificationChannel(CHANNEL_ID_URGENT) == null) {
                    NotificationChannel urgentChannel = new NotificationChannel(
                        CHANNEL_ID_URGENT,
                        "إشعارات المعاملات",
                        NotificationManager.IMPORTANCE_MAX
                    );
                    urgentChannel.setDescription("إشعارات التحويلات والإيداعات والسحوبات");
                    urgentChannel.enableLights(true);
                    urgentChannel.setLightColor(0xFFD4AF37);
                    urgentChannel.enableVibration(true);
                    urgentChannel.setVibrationPattern(new long[]{0, 500, 150, 500});
                    urgentChannel.setSound(defaultSound, audioAttributes);
                    urgentChannel.setBypassDnd(true);
                    urgentChannel.setLockscreenVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC);
                    urgentChannel.setShowBadge(true);
                    manager.createNotificationChannel(urgentChannel);
                }
            }
        }
    }

    private void startKeepAliveService() {
        Intent serviceIntent = new Intent(this, NotificationKeepAliveService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void requestBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent();
            String packageName = getPackageName();
            android.content.pm.PackageManager pm = getPackageManager();
            
            if (intent.resolveActivity(pm) != null) {
                PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (powerManager != null && !powerManager.isIgnoringBatteryOptimizations(packageName)) {
                    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    try {
                        startActivity(intent);
                    } catch (Exception ignored) {
                        // Some devices don't support this
                    }
                }
            }
        }
    }
}
