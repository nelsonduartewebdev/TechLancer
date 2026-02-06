import { Stack } from 'expo-router';
import { useEffect } from 'react';
import 'react-native-url-polyfill/auto';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'TechLancer' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
