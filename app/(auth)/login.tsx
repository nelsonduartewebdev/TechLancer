import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { authService } from '../../lib/auth';
import { loginRateLimiter } from '../../lib/rateLimiter';
import { sanitizeEmail } from '../../lib/validation';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);

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
      const { error: authError } = await authService.signInWithApi(email, password);
      
      if (authError) {
        throw authError;
      }

      // Reset rate limiter on successful login
      loginRateLimiter.reset(sanitizedEmail);
      
      // Refresh profile to get role
      await refreshProfile();
      
      // Navigation will be handled by index.tsx based on role
      router.replace('/');
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed. Please try again.';
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

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setSocialLoading(provider);
    setError(null);
    
    try {
      const { error: authError } = await authService.signInWithOAuth(provider);
      
      if (authError) {
        throw authError;
      }
      
      // OAuth will redirect, so we don't need to navigate here
    } catch (err: any) {
      setError(err.message || `${provider === 'google' ? 'Google' : 'Apple'} login failed. Please try again.`);
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Log In</Text>
      <Text style={styles.subtitle}>Welcome back to TechLancer</Text>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {rateLimitError && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>{rateLimitError}</Text>
        </View>
      )}

      {/* Email/Password Login */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!isLoading && !socialLoading}
      />

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="password"
          editable={!isLoading && !socialLoading}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.showPasswordButton}
        >
          <Text style={styles.showPasswordText}>
            {showPassword ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.loginButton, (isLoading || socialLoading) && styles.loginButtonDisabled]}
        onPress={handleLogin}
        disabled={isLoading || !!socialLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.loginButtonText}>Log In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/forgot-password')}
        style={styles.forgotPasswordButton}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Social Login Buttons */}
      <View style={styles.socialContainer}>
        <TouchableOpacity
          style={[styles.socialButton, socialLoading === 'google' && styles.socialButtonDisabled]}
          onPress={() => handleSocialLogin('google')}
          disabled={!!socialLoading || isLoading}
        >
          {socialLoading === 'google' ? (
            <ActivityIndicator size="small" color="#333" />
          ) : (
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.socialButton, styles.socialButtonApple, socialLoading === 'apple' && styles.socialButtonDisabled]}
          onPress={() => handleSocialLogin('apple')}
          disabled={!!socialLoading || isLoading}
        >
          {socialLoading === 'apple' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.socialButtonText, styles.socialButtonTextApple]}>Continue with Apple</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.registerContainer}>
        <Text style={styles.registerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.registerLink}>Register</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
  },
  warningContainer: {
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  warningText: {
    fontSize: 14,
    color: '#ff9800',
    textAlign: 'center',
  },
  socialContainer: {
    marginBottom: 20,
    gap: 12,
  },
  socialButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  socialButtonApple: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  socialButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  socialButtonTextApple: {
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#999',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  showPasswordButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  showPasswordText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#007AFF',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  registerText: {
    fontSize: 14,
    color: '#666',
  },
  registerLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});
