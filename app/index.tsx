import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { session, role, loading, initialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for auth to initialize before redirecting
    if (!initialized || loading) {
      return;
    }

    // Determine the target route based on auth state and role
    if (!session) {
      // Not authenticated → redirect to welcome screen
      router.replace('/(auth)/welcome');
    } else if (role === 'client') {
      // Client → redirect to client home
      router.replace('/(client)/home');
    } else if (role === 'agent') {
      // Agent → redirect to agent feed
      router.replace('/(agent)/feed');
    } else {
      // Role not set yet or unknown → redirect to welcome
      router.replace('/(auth)/welcome');
    }
  }, [session, role, loading, initialized, router]);

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
