import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { apiService } from '../lib/api';
import { loginRateLimiter } from '../lib/rateLimiter';
import { sanitizeEmail } from '../lib/validation';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const handleLogin = async () => {
    // Reset errors
    setError(null);
    setRateLimitError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    // Check rate limiting
    const sanitizedEmail = sanitizeEmail(email);
    if (!loginRateLimiter.canAttempt(sanitizedEmail)) {
      const timeUntilReset = loginRateLimiter.getTimeUntilReset(sanitizedEmail);
      const minutes = Math.ceil(timeUntilReset / 60000);
      setRateLimitError(`Too many login attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
      return;
    }

    setIsLoading(true);

    try {
      await apiService.login({ email: sanitizedEmail, password });
      // Reset rate limiter on successful login
      loginRateLimiter.reset(sanitizedEmail);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Login failed. Please try again.';
      setError(errorMessage);
      
      // Update rate limit info
      const remaining = loginRateLimiter.getRemainingAttempts(sanitizedEmail);
      if (remaining === 0) {
        const timeUntilReset = loginRateLimiter.getTimeUntilReset(sanitizedEmail);
        const minutes = Math.ceil(timeUntilReset / 60000);
        setRateLimitError(`Too many failed attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
      } else if (remaining <= 2) {
        setRateLimitError(`${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 20, justifyContent: 'center' }}>
      <StatusBar style="auto" />
      <Text style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 10, color: '#333', textAlign: 'center' }}>
        Log In
      </Text>
      <Text style={{ fontSize: 18, color: '#666', marginBottom: 40, textAlign: 'center' }}>
        Welcome back to TechLancer
      </Text>

      {error && (
        <Text style={{ fontSize: 14, color: '#d32f2f', marginBottom: 20, textAlign: 'center' }}>
          {error}
        </Text>
      )}

      {rateLimitError && (
        <Text style={{ fontSize: 14, color: '#ff9800', marginBottom: 20, textAlign: 'center' }}>
          {rateLimitError}
        </Text>
      )}

      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 }}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />

      <View style={{ position: 'relative', marginBottom: 20 }}>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, paddingRight: 50 }}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="password"
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={{ position: 'absolute', right: 12, top: 12 }}
        >
          <Text style={{ color: '#007AFF', fontSize: 14, fontWeight: '600' }}>
            {showPassword ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 12, color: '#666', marginBottom: 20, textAlign: 'center', fontStyle: 'italic' }}>
        Password must be at least 8 characters with uppercase, lowercase, number, and symbol
      </Text>

      <TouchableOpacity
        style={{
          backgroundColor: '#007AFF',
          paddingHorizontal: 30,
          paddingVertical: 15,
          borderRadius: 8,
          alignItems: 'center',
          marginBottom: 20,
        }}
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Log In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/register')}
        style={{ alignItems: 'center' }}
      >
        <Text style={{ fontSize: 14, color: '#007AFF' }}>
          Don't have an account? Register
        </Text>
      </TouchableOpacity>
    </View>
  );
}
