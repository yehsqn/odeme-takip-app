import { defineConfig } from '@capacitor/cli';

const config = {
  appId: 'com.yehsqn.odemetakip',
  appName: 'Ödeme Takip',
  webDir: 'dist',
  server: {
    // Development: point to local Vite server
    // For production build, comment out the url line below
    // url: 'http://10.0.2.2:5173', // Android emulator → localhost
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e40af',
      showSpinner: false
    }
  },
  android: {
    buildOptions: {
      releaseType: 'AAB' // Google Play requires AAB
    }
  }
};

export default config;
