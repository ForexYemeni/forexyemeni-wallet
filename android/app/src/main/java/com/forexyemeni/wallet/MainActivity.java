package com.forexyemeni.wallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Channel IDs must match MyFirebaseMessagingService.java (fx_v8)
    private static final String CHANNEL_ID = "fx_v8";
    private static final String CHANNEL_ID_URGENT = "fx_urgent_v8";

    private View offlineView;
    private Handler retryHandler = new Handler(Looper.getMainLooper());
    private Runnable retryRunnable;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        startKeepAliveService();
        requestBatteryOptimization();

        // Check internet on launch
        if (!isNetworkAvailable()) {
            showOfflineScreen();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        startKeepAliveService();

        // If we come back online, hide offline screen
        if (offlineView != null && isNetworkAvailable()) {
            hideOfflineScreen();
            // Reload the web app via Capacitor bridge
            if (getBridge() != null) {
                getBridge().reload();
            }
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        if (offlineView != null && isNetworkAvailable()) {
            hideOfflineScreen();
            if (getBridge() != null) {
                getBridge().reload();
            }
        }
    }

    /**
     * Show a nice offline screen when no internet is available.
     */
    private void showOfflineScreen() {
        runOnUiThread(() -> {
            // Hide the WebView (Capacitor bridge)
            View webView = findViewById(android.R.id.content);
            if (webView == null) return;

            // If already showing, don't recreate
            if (offlineView != null && offlineView.getParent() != null) return;

            // Create offline layout
            LinearLayout layout = new LinearLayout(this);
            layout.setOrientation(LinearLayout.VERTICAL);
            layout.setGravity(Gravity.CENTER);
            layout.setBackgroundColor(Color.parseColor("#0a0a14"));
            layout.setPadding(48, 48, 48, 48);

            // WiFi/Signal icon using Unicode
            TextView iconText = new TextView(this);
            iconText.setText("📡");
            iconText.setTextSize(64);
            iconText.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
            );
            iconParams.setMargins(0, 0, 0, 24);
            layout.addView(iconText, iconParams);

            // Title
            TextView title = new TextView(this);
            title.setText("لا يوجد اتصال بالإنترنت");
            title.setTextColor(Color.parseColor("#FFFFFF"));
            title.setTextSize(22);
            title.setTypeface(null, Typeface.BOLD);
            title.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
            );
            titleParams.setMargins(0, 0, 0, 12);
            layout.addView(title, titleParams);

            // Description
            TextView desc = new TextView(this);
            desc.setText("تحقق من اتصالك بالإنترنت وحاول مرة أخرى");
            desc.setTextColor(Color.parseColor("#888888"));
            desc.setTextSize(14);
            desc.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams descParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
            );
            descParams.setMargins(0, 0, 0, 40);
            layout.addView(desc, descParams);

            // Retry button
            Button retryBtn = new Button(this);
            retryBtn.setText("إعادة المحاولة");
            retryBtn.setTextColor(Color.parseColor("#0a0a14"));
            retryBtn.setTextSize(16);
            retryBtn.setTypeface(null, Typeface.BOLD);
            retryBtn.setAllCaps(false);
            retryBtn.setBackgroundColor(Color.parseColor("#D4AF37"));
            retryBtn.setPadding(32, 16, 32, 16);
            retryBtn.setMinHeight(56);
            LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
            );
            btnParams.setMargins(0, 0, 0, 20);
            layout.addView(retryBtn, btnParams);

            retryBtn.setOnClickListener(v -> {
                if (isNetworkAvailable()) {
                    hideOfflineScreen();
                    if (getBridge() != null) {
                        getBridge().reload();
                    }
                } else {
                    // Shake effect or just show "still offline"
                    desc.setText("لا يزال لا يوجد اتصال... حاول لاحقاً");
                    retryHandler.postDelayed(() -> {
                        desc.setText("تحقق من اتصالك بالإنترنت وحاول مرة أخرى");
                    }, 2000);
                }
            });

            // Auto-retry status text
            TextView autoRetry = new TextView(this);
            autoRetry.setText("سيتم إعادة المحاولة تلقائياً عند توفر الاتصال...");
            autoRetry.setTextColor(Color.parseColor("#555555"));
            autoRetry.setTextSize(11);
            autoRetry.setGravity(Gravity.CENTER);
            layout.addView(autoRetry);

            // Add to window
            android.view.ViewGroup decorView = (android.view.ViewGroup) getWindow().getDecorView();
            android.view.ViewGroup rootView = (android.view.ViewGroup) decorView.getChildAt(0);

            LinearLayout.LayoutParams fullParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.MATCH_PARENT
            );
            offlineView = layout;
            rootView.addView(layout, fullParams);

            // Start auto-retry every 3 seconds
            retryRunnable = () -> {
                if (offlineView != null && offlineView.getParent() != null) {
                    if (isNetworkAvailable()) {
                        hideOfflineScreen();
                        if (getBridge() != null) {
                            getBridge().reload();
                        }
                    } else {
                        retryHandler.postDelayed(retryRunnable, 3000);
                    }
                }
            };
            retryHandler.postDelayed(retryRunnable, 3000);
        });
    }

    /**
     * Hide the offline screen.
     */
    private void hideOfflineScreen() {
        runOnUiThread(() -> {
            if (offlineView != null && offlineView.getParent() != null) {
                ((android.view.ViewGroup) offlineView.getParent()).removeView(offlineView);
                offlineView = null;
            }
            if (retryHandler != null && retryRunnable != null) {
                retryHandler.removeCallbacks(retryRunnable);
            }
        });
    }

    /**
     * Check if network is available.
     */
    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
            return activeNetwork != null && activeNetwork.isConnectedOrConnecting();
        } catch (Exception e) {
            return false;
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();

                Uri defaultSound = android.media.RingtoneManager.getDefaultUri(
                    android.media.RingtoneManager.TYPE_NOTIFICATION);

                if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                    NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "إشعارات فوركس يمني",
                        NotificationManager.IMPORTANCE_MAX
                    );
                    channel.setDescription("إشعارات المعاملات والأحداث المهمة");
                    channel.enableLights(true);
                    channel.setLightColor(0xFFD4AF37);
                    channel.enableVibration(true);
                    channel.setVibrationPattern(new long[]{0, 300, 200, 300});
                    channel.setSound(defaultSound, audioAttributes);
                    channel.setBypassDnd(true);
                    channel.setLockscreenVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC);
                    channel.setShowBadge(true);
                    manager.createNotificationChannel(channel);
                }

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
                    }
                }
            }
        }
    }
}
