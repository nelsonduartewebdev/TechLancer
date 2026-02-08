export default {
  expo: {
    name: 'TechLancer',
    slug: 'techlancer',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.techlancer.app',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.techlancer.app',
    },
    web: {
      bundler: 'metro',
      output: 'static',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-camera',
      'expo-image-picker',
      'expo-location',
      'expo-notifications',
    ],
    scheme: 'techlancer',
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: '',
      },
      // Logging: in dev logs always show; set enableLogging: false in prod to reduce noise
      enableLogging: true,
      enableApiLogging: true,
      // Environment variables can be accessed here
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1',
    },
  },
};
