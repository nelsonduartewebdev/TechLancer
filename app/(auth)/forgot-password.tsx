import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { authService } from '../../lib/auth';
import { sanitizeEmail, isValidEmail } from '../../lib/validation';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleResetPassword = async () => {
    // Reset errors
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    const sanitizedEmail = sanitizeEmail(email);
    
    if (!isValidEmail(sanitizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const { error: resetError } = await authService.resetPassword(sanitizedEmail);
      
      if (resetError) {
        setError(resetError.message || 'Failed to send reset email. Please try again.');
      } else {
        setIsSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', padding: 20, justifyContent: 'center' }}>
        <StatusBar style="auto" />
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 20 }}>✓</Text>
          <Text style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 10, color: '#333', textAlign: 'center' }}>
            Check Your Email
          </Text>
          <Text style={{ fontSize: 18, color: '#666', marginBottom: 20, textAlign: 'center', paddingHorizontal: 20 }}>
            We've sent a password reset link to {email}
          </Text>
          <Text style={{ fontSize: 14, color: '#999', textAlign: 'center', paddingHorizontal: 20 }}>
            If you don't see the email, check your spam folder or try again.
          </Text>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: '#007AFF',
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 8,
            alignItems: 'center',
            marginBottom: 20,
          }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Back to Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setIsSuccess(false);
            setEmail('');
          }}
          style={{ alignItems: 'center' }}
        >
          <Text style={{ fontSize: 14, color: '#007AFF' }}>
            Send another email
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 20, justifyContent: 'center' }}>
      <StatusBar style="auto" />
      <Text style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 10, color: '#333', textAlign: 'center' }}>
        Forgot Password?
      </Text>
      <Text style={{ fontSize: 18, color: '#666', marginBottom: 40, textAlign: 'center' }}>
        Enter your email address and we'll send you a link to reset your password.
      </Text>

      {error && (
        <Text style={{ fontSize: 14, color: '#d32f2f', marginBottom: 20, textAlign: 'center' }}>
          {error}
        </Text>
      )}

      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16 }}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoFocus
      />

      <TouchableOpacity
        style={{
          backgroundColor: '#007AFF',
          paddingHorizontal: 30,
          paddingVertical: 15,
          borderRadius: 8,
          alignItems: 'center',
          marginBottom: 20,
        }}
        onPress={handleResetPassword}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Send Reset Link</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{ alignItems: 'center' }}
      >
        <Text style={{ fontSize: 14, color: '#007AFF' }}>
          Back to Login
        </Text>
      </TouchableOpacity>
    </View>
  );
}
