import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { apiService } from '../lib/api';
import logger from '../lib/logger';

export default function Index() {
  const router = useRouter();
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      setIsChecking(true);
      try {
        const healthy = await apiService.checkHealth();
        setIsHealthy(healthy);
      } catch (error) {
        logger.error('Health check error:', error);
        setIsHealthy(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkHealth();
  }, []);


  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>TechLancer</Text>
      <Text style={styles.subtitle}>Welcome to TechLancer</Text>
      
      {isChecking ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Checking connection...</Text>
        </View>
      ) : (
        <>
          {!isHealthy && (
            <Text style={styles.errorMessage}>
              There's a problem connecting to the database. Try again later.
            </Text>
          )}
         
          
         {isHealthy && <View style={styles.authButtonsContainer}>
            <TouchableOpacity 
              style={styles.authButton}
              onPress={() => router.push('/login')}
            >
              <Text style={styles.authButtonText}>Log In</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.authButton}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.authButtonText}>Register</Text>
            </TouchableOpacity>
          </View>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonTextDisabled: {
    color: '#999',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  errorMessage: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  authButtonsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 20,
  },
  authButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
