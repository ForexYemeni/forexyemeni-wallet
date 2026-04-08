---
Task ID: 3b
Agent: Main
Task: Fix FCM push notifications + update google-services.json for com.forexyemeni.wallet1 + ErrorBoundary logging

Work Log:
- User uploaded new google-services.json with both com.forexyemeni.wallet and com.forexyemeni.wallet1 package names
- Updated android/app/google-services.json to include both package entries
- Updated android/app/build.gradle: applicationId changed to "com.forexyemeni.wallet1" (kept namespace as com.forexyemeni.wallet to avoid breaking Java package references)
- Fixed push-notification.ts: Added comprehensive console.error logging throughout the FCM sending pipeline
- Fixed /api/fcm/send/route.ts: Updated to use BOTH notification+data fields instead of data-only
- Fixed ErrorBoundary in page.tsx: Added componentDidCatch logging
- Build successful, pushed to GitHub (commit 91135c4)

Stage Summary:
- FCM: Added comprehensive error logging to diagnose notification failures on Vercel
- google-services.json: Now includes com.forexyemeni.wallet1
- /api/fcm/send: Now uses same notification+data strategy as push-notification.ts
- Admin devices: Previous fix confirmed, crash should be resolved once deployed

---
Task ID: 4
Agent: Main
Task: Build Android APK with updated google-services.json and com.forexyemeni.wallet1 package name

Work Log:
- Installed Android SDK command-line tools (cmdline-tools-linux-11076708_latest.zip) to /home/z/android-sdk
- Accepted Android SDK licenses
- Installed platform-tools, platforms;android-36, build-tools;36.0.0
- Downloaded JDK 21 (only JRE was installed, needed javac for compilation) to /home/z/jdk-21.0.10
- Updated capacitor.config.ts: appId changed from 'com.forexyemeni.wallet' to 'com.forexyemeni.wallet1'
- Created minimal out/ directory for Capacitor sync
- Ran npx cap sync android — synced plugins successfully (5 Capacitor plugins)
- Built APK: ./gradlew assembleDebug — BUILD SUCCESSFUL in 56s (246 tasks)
- APK saved to /home/z/my-project/download/forexyemeni-wallet1-v3.6.0-debug.apk (5.6MB)

Stage Summary:
- APK built successfully with new package name com.forexyemeni.wallet1
- google-services.json includes both com.forexyemeni.wallet and com.forexyemeni.wallet1
- APK includes updated FCM configuration matching Firebase project forexyemeni-wallet-ed009
- File: /home/z/my-project/download/forexyemeni-wallet1-v3.6.0-debug.apk (5.6MB)

---
Task ID: 5
Agent: Main
Task: Build ForexYemeni Wallet APK using webtoapp-builder template

Work Log:
- Cloned GitHub repo https://github.com/Ayoubvvch/webtoapp-builder.git
- Analyzed repo structure: Android WebView-based template for converting web apps to APK
- Customized template for ForexYemeni Wallet:
  - Changed URL from local files to https://forexyemeni-wallet.vercel.app
  - Changed app name to "فوركس يمني"
  - Changed package to com.forexyemeni.wallet
  - Added dark/gold theme matching the web app
  - Added fullscreen immersive mode, portrait-only orientation
  - Added error pages for no internet / loading errors (in Arabic)
  - Added network security config for HTTPS domains
  - Added GitHub Actions workflow for future cloud builds
- Fixed compilation errors: replaced non-existent APIs (setRenderScalesContentAsText, NET_CAPABILITY_NET_CAPABLE)
- Used Gradle 8.14.3 with AGP 8.7.3 (leverage cached dependencies)
- BUILD SUCCESSFUL in 19s

Stage Summary:
- APK built: ForexYemeni-Wallet-WebView-v1.0.0.apk (5.6MB)
- File: /home/z/my-project/download/ForexYemeni-Wallet-WebView-v1.0.0.apk
- This is a lightweight WebView wrapper that loads the Vercel URL
- Does NOT include FCM/push notifications (unlike Capacitor version)
- Suitable for users who want a simple APK without Firebase dependencies
