import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../lib/auth';
import { loginRateLimiter } from '../../lib/rateLimiter';
import { sanitizeEmail } from '../../lib/validation';
import { useAuth } from '../../contexts/AuthContext';

// Demo credentials – replace with real demo accounts if your backend provides them
const DEMO_CLIENT = { email: 'nelson.a.duarte@hotmail.com', password: 'TesteCliente2026!?' };
const DEMO_AGENT = { email: 'demo@tecnico.techlancer.com', password: 'demo123' };

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
  const [demoLoading, setDemoLoading] = useState<'client' | 'agent' | null>(null);

  const runLogin = async (emailVal: string, passwordVal: string) => {
    setError(null);
    setRateLimitError(null);
    const sanitizedEmail = sanitizeEmail(emailVal);
    if (!loginRateLimiter.canAttempt(sanitizedEmail)) {
      const timeUntilReset = loginRateLimiter.getTimeUntilReset(sanitizedEmail);
      const minutes = Math.ceil(timeUntilReset / 60000);
      setRateLimitError(`Muitas tentativas. Tente novamente em ${minutes} minuto${minutes !== 1 ? 's' : ''}.`);
      return;
    }
    setIsLoading(true);
    try {
      const { error: authError } = await authService.signInWithApi(emailVal, passwordVal);
      if (authError) throw authError;
      loginRateLimiter.reset(sanitizedEmail);
      await refreshProfile();
      router.replace('/');
    } catch (err: any) {
      const message = err.message || 'Falha no login. Tente novamente.';
      setError(message);
      const remaining = loginRateLimiter.getRemainingAttempts(sanitizedEmail);
      if (remaining === 0) {
        const timeUntilReset = loginRateLimiter.getTimeUntilReset(sanitizedEmail);
        const minutes = Math.ceil(timeUntilReset / 60000);
        setRateLimitError(`Muitas tentativas. Tente novamente em ${minutes} minuto${minutes !== 1 ? 's' : ''}.`);
      } else if (remaining <= 2) {
        setRateLimitError(`${remaining} tentativa${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      return;
    }
    await runLogin(email, password);
  };

  const handleDemoLogin = async (role: 'client' | 'agent') => {
    const creds = role === 'client' ? DEMO_CLIENT : DEMO_AGENT;
    setDemoLoading(role);
    setError(null);
    try {
      await runLogin(creds.email, creds.password);
    } finally {
      setDemoLoading(null);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setSocialLoading(provider);
    setError(null);
    try {
      const { error: authError } = await authService.signInWithOAuth(provider);
      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message || `Login com ${provider === 'google' ? 'Google' : 'Apple'} falhou.`);
    } finally {
      setSocialLoading(null);
    }
  };

  const busy = isLoading || !!socialLoading || !!demoLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.title}>Entrar</Text>
        <Text style={styles.subtitle}>Aceda à sua conta TechLancer</Text>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {rateLimitError ? (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>{rateLimitError}</Text>
          </View>
        ) : null}

        {/* Email */}
        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!busy}
          />
        </View>

        {/* Password + Forgot */}
        <View style={styles.passwordLabelRow}>
          <Text style={styles.label}>Palavra-passe</Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.forgotLink}>Esqueci-me</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="••••••••••"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            editable={!busy}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color="#6b7280"
            />
          </TouchableOpacity>
        </View>

        {/* Login button */}
        <TouchableOpacity
          style={[styles.loginButton, busy && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={busy}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Entrar</Text>
          )}
        </TouchableOpacity>

        {/* Demo rápido */}
        <View style={styles.divider} />
        <Text style={styles.demoTitle}>Demo rápido (mock data)</Text>
        <View style={styles.demoRow}>
          <TouchableOpacity
            style={[styles.demoButton, demoLoading === 'client' && styles.demoButtonDisabled]}
            onPress={() => handleDemoLogin('client')}
            disabled={!!demoLoading || isLoading}
            activeOpacity={0.8}
          >
            {demoLoading === 'client' ? (
              <ActivityIndicator size="small" color="#374151" />
            ) : (
              <Text style={styles.demoButtonText}>Cliente Demo</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.demoButton, demoLoading === 'agent' && styles.demoButtonDisabled]}
            onPress={() => handleDemoLogin('agent')}
            disabled={!!demoLoading || isLoading}
            activeOpacity={0.8}
          >
            {demoLoading === 'agent' ? (
              <ActivityIndicator size="small" color="#374151" />
            ) : (
              <Text style={styles.demoButtonText}>Técnico Demo</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Optional: social + register – keep for functionality, below demo */}
        <View style={styles.divider} />
        <View style={styles.socialContainer}>
          <TouchableOpacity
            style={[styles.socialButton, socialLoading === 'google' && styles.socialButtonDisabled]}
            onPress={() => handleSocialLogin('google')}
            disabled={!!socialLoading || isLoading}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator size="small" color="#333" />
            ) : (
              <Text style={styles.socialButtonText}>Continuar com Google</Text>
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
              <Text style={[styles.socialButtonText, styles.socialButtonTextApple]}>Continuar com Apple</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Não tem conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerLink}>Registar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 32,
  },
  backText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 28,
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  warningContainer: {
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#d97706',
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  forgotLink: {
    fontSize: 14,
    color: '#1e3a5f',
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    borderWidth: 0,
    marginBottom: 20,
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  loginButton: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
    marginBottom: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 24,
  },
  demoTitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  demoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  demoButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  demoButtonDisabled: {
    opacity: 0.6,
  },
  demoButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  socialContainer: {
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
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
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  socialButtonTextApple: {
    color: '#fff',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  registerLink: {
    fontSize: 14,
    color: '#1e3a5f',
    fontWeight: '600',
  },
});
