import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import 'react-native-url-polyfill/auto';

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { initialized } = useAuth();
  // Load custom fonts if needed (empty object means no custom fonts)
  const [fontsLoaded] = useFonts({
    // Add custom fonts here if needed
    // Example: 'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
  });

  useEffect(() => {
    // Hide splash screen when auth state is resolved and fonts are loaded
    if (initialized && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [initialized, fontsLoaded]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'TechLancer' }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(client)" options={{ headerShown: false }} />
      <Stack.Screen name="(agent)" options={{ headerShown: false }} />
      <Stack.Screen name="(shared)/notifications" options={{ headerShown: false }} />
      <Stack.Screen name="(shared)/settings" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
