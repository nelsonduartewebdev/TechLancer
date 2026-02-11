import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useRedirectOnce } from '../hooks/useRedirectOnce';

export default function Index() {
  const { session, role, loading, initialized } = useAuth();
  const router = useRouter();
  const runRedirectOnce = useRedirectOnce();

  useEffect(() => {
    // For logged-in users, wait until we have role before redirecting.
    // Otherwise we may redirect to client when role is still null (e.g. right after agent registration).
    const ready = initialized && !loading && (!session || role !== null);
    runRedirectOnce(ready, () => {
      if (!session) {
        router.replace('/(auth)/welcome');
        return;
      }
      if (role === 'agent') {
        router.replace('/(agent)/feed');
        return;
      }
      router.replace('/(client)/tickets');
    });
  }, [session, role, loading, initialized, router, runRedirectOnce]);

  // Show loading indicator while checking auth state
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
