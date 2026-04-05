import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.forexyemeni.wallet',
  appName: 'فوركس يمني',
  webDir: 'out',
  server: {
    // In development, point to the deployed Vercel URL
    url: 'https://forexyemeni-wallet.vercel.app',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['alert', 'sound', 'badge'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#d4af37',
      sound: 'notification.wav',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0a0a14',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a14',
    },
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0a0a14',
  },
};

export default config;
