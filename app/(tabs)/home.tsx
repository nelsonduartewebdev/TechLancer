import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { apiService } from '../../lib/api';
import logger from '../../lib/logger';

export default function HomeScreen() {
  const [dbTestStatus, setDbTestStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [dbTestMessage, setDbTestMessage] = useState<string>('');

  useEffect(() => {
    // Make request to /api/db-test when component mounts
    const testDatabaseConnection = async () => {
      try {
        const response = await apiService.get('/db-test');
        setDbTestStatus('success');
        setDbTestMessage(JSON.stringify(response, null, 2));
        logger.log('Database test successful:', response);
      } catch (error: any) {
        setDbTestStatus('error');
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        setDbTestMessage(errorMessage);
        logger.error('Database test failed:', error);
      }
    };

    testDatabaseConnection();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.content}>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.description}>
          Welcome to TechLancer! This is your home screen.
        </Text>
        
        <View style={styles.dbTestSection}>
          <Text style={styles.dbTestTitle}>Database Connection Test</Text>
          <View style={[
            styles.statusIndicator,
            dbTestStatus === 'loading' && styles.statusLoading,
            dbTestStatus === 'success' && styles.statusSuccess,
            dbTestStatus === 'error' && styles.statusError,
          ]}>
            <Text style={styles.statusText}>
              {dbTestStatus === 'loading' && 'Testing...'}
              {dbTestStatus === 'success' && '✓ Connected'}
              {dbTestStatus === 'error' && '✗ Failed'}
            </Text>
          </View>
          {dbTestMessage && (
            <Text style={styles.dbTestMessage}>{dbTestMessage}</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  dbTestSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  dbTestTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  statusIndicator: {
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  statusLoading: {
    backgroundColor: '#e3f2fd',
  },
  statusSuccess: {
    backgroundColor: '#e8f5e9',
  },
  statusError: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  dbTestMessage: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginTop: 5,
  },
});
