import { defineConfig } from '@capacitor/cli';

const config = {
  appId: 'com.PayPulse',
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
    },
    // Google Sign-In (native Android & iOS)
    GoogleAuth: {
      // Web Application OAuth 2.0 Client ID (server-side doğrulama için)
      clientId: '214147261440-rmmia8qnauqmbo4pm382nejch7ddh99t.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      serverClientId: '214147261440-rmmia8qnauqmbo4pm382nejch7ddh99t.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    }
  },
  android: {
    buildOptions: {
      releaseType: 'AAB' // Google Play requires AAB
    }
  }
};

export default config;

