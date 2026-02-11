import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useRedirectOnce } from '../../hooks/useRedirectOnce';

export default function AuthLayout() {
  const { session, initialized, loading } = useAuth();
  const router = useRouter();
  const runRedirectOnce = useRedirectOnce();

  useEffect(() => {
    const shouldRedirectToApp = initialized && !loading && !!session;
    runRedirectOnce(shouldRedirectToApp, () => router.replace('/'));
  }, [session, initialized, loading, router, runRedirectOnce]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
