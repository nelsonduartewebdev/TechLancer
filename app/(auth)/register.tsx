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
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../lib/auth';
import { apiService } from '../../lib/api';
import { registerRateLimiter } from '../../lib/rateLimiter';
import {
  isValidEmail,
  isAgeValid,
  formatDateInput,
  isPasswordValid,
  sanitizeEmail,
  sanitizeName,
  sanitizeDate,
  getPasswordStrength,
  getPasswordRequirements,
  PasswordStrength,
} from '../../lib/validation';
import { useAuth } from '../../contexts/AuthContext';

const REGISTER_DRAFT_KEY = 'techlancer_register_draft';

// Password Strength Bar Component
const PasswordStrengthBar = ({ password }: { password: string }) => {
  const strength = getPasswordStrength(password);

  const getStrengthColor = (strength: PasswordStrength): string => {
    switch (strength) {
      case 'weak':
        return '#dc2626';
      case 'medium':
        return '#d97706';
      case 'strong':
        return '#16a34a';
      case 'very-strong':
        return '#15803d';
      default:
        return '#d1d5db';
    }
  };

  const getStrengthFlex = (strength: PasswordStrength): number => {
    switch (strength) {
      case 'weak':
        return 0.25;
      case 'medium':
        return 0.5;
      case 'strong':
        return 0.75;
      case 'very-strong':
        return 1;
      default:
        return 0;
    }
  };

  const getStrengthLabel = (strength: PasswordStrength): string => {
    switch (strength) {
      case 'weak':
        return 'Weak';
      case 'medium':
        return 'Medium';
      case 'strong':
        return 'Strong';
      case 'very-strong':
        return 'Very Strong';
      default:
        return '';
    }
  };

  if (password.length === 0) {
    return null;
  }

  return (
    <View style={styles.passwordStrengthContainer}>
      <View
        style={[
          styles.passwordStrengthBar,
          {
            flexDirection: 'row',
          },
        ]}
      >
        <View
          style={[
            styles.passwordStrengthFill,
            {
              flex: getStrengthFlex(strength),
              backgroundColor: getStrengthColor(strength),
            },
          ]}
        />
      </View>
      <Text style={[styles.passwordStrengthLabel, { color: getStrengthColor(strength) }]}>
        {getStrengthLabel(strength)}
      </Text>
    </View>
  );
};

// Password Requirements Component
const PasswordRequirements = ({ password }: { password: string }) => {
  const requirements = getPasswordRequirements(password);

  if (password.length === 0) {
    return null;
  }

  const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
    <View style={styles.requirementItem}>
      <Text style={[styles.requirementIcon, { color: met ? '#16a34a' : '#9ca3af' }]}>
        {met ? '✓' : '○'}
      </Text>
      <Text style={[styles.requirementText, { color: met ? '#16a34a' : '#6b7280' }]}>{text}</Text>
    </View>
  );

  return (
    <View style={styles.passwordRequirementsContainer}>
      <RequirementItem met={requirements.length} text="At least 8 characters" />
      <RequirementItem met={requirements.uppercase} text="One uppercase letter" />
      <RequirementItem met={requirements.lowercase} text="One lowercase letter" />
      <RequirementItem met={requirements.number} text="One number" />
      <RequirementItem met={requirements.symbol} text="One symbol" />
    </View>
  );
};

export default function RegisterScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [role, setRole] = useState<'client' | 'agent'>('client');
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  // Restore draft (no password) when screen mounts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REGISTER_DRAFT_KEY);
        if (cancelled || !raw) return;
        const draft = JSON.parse(raw) as { fullName?: string; email?: string; dateOfBirth?: string; role?: 'client' | 'agent'; city?: string };
        if (draft.fullName != null) setFullName(draft.fullName);
        if (draft.email != null) setEmail(draft.email);
        if (draft.dateOfBirth != null) setDateOfBirth(draft.dateOfBirth);
        if (draft.role === 'client' || draft.role === 'agent') setRole(draft.role);
        if (draft.city != null) setCity(draft.city);
      } catch {
        // ignore parse/storage errors
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRegister = async () => {
    console.log('[Register] Sign up attempt started');
    // Reset errors
    setError(null);
    setRateLimitError(null);

    // Validate all fields are filled
    if (!email.trim() || !password.trim() || !repeatPassword.trim() || !fullName.trim() || !dateOfBirth.trim()) {
      console.log('[Register] Validation failed: missing required fields');
      saveDraft({ fullName, email, dateOfBirth, role, city });
      setError('Please fill in all fields');
      return;
    }

    // Check rate limiting
    const sanitizedEmail = sanitizeEmail(email);
    if (!registerRateLimiter.canAttempt(sanitizedEmail)) {
      console.log('[Register] Rate limit exceeded for email:', sanitizedEmail);
      saveDraft({ fullName, email, dateOfBirth, role, city });
      const timeUntilReset = registerRateLimiter.getTimeUntilReset(sanitizedEmail);
      const hours = Math.ceil(timeUntilReset / 3600000);
      setRateLimitError(
        `Too many registration attempts. Please try again in ${hours} hour${hours !== 1 ? 's' : ''}.`
      );
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      console.log('[Register] Validation failed: invalid email format');
      saveDraft({ fullName, email, dateOfBirth, role, city });
      setError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!isPasswordValid(password)) {
      console.log('[Register] Validation failed: password does not meet requirements');
      saveDraft({ fullName, email, dateOfBirth, role, city });
      setError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol');
      return;
    }

    // Validate passwords match
    if (password !== repeatPassword) {
      console.log('[Register] Validation failed: passwords do not match');
      saveDraft({ fullName, email, dateOfBirth, role, city });
      setError('Passwords do not match');
      return;
    }

    // Validate age (18+)
    if (!isAgeValid(dateOfBirth)) {
      console.log('[Register] Validation failed: age requirement (18+) not met');
      saveDraft({ fullName, email, dateOfBirth, role, city });
      setError('You must be at least 18 years old to register');
      return;
    }

    console.log('[Register] Validation passed, calling API register', { email: sanitizedEmail, role });
    setIsLoading(true);

    try {
      // Convert date from DD/MM/YYYY to YYYY-MM-DD format
      const dateParts = dateOfBirth.split('/');
      const dataNascimento = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

      // Register via API with all required fields (full_name, date_of_birth, role) and optional city
      await apiService.register({
        email: sanitizedEmail,
        password,
        full_name: sanitizeName(fullName),
        date_of_birth: dataNascimento,
        role,
        ...(city.trim() && { city: city.trim() }),
      });

      console.log('[Register] API register successful, signing in');
      // Sign in to set Supabase session (same flow as login)
      const { error: signInError } = await authService.signInWithApi(sanitizedEmail, password);
      if (signInError) {
        console.log('[Register] Sign in after register failed:', signInError);
        throw signInError;
      }

      console.log('[Register] Sign in successful, refreshing profile');
      // Reset rate limiter on successful registration
      registerRateLimiter.reset(sanitizedEmail);

      // Refresh profile to get role
      await refreshProfile();

      console.log('[Register] Profile refreshed, navigating to app dashboard');
      await AsyncStorage.removeItem(REGISTER_DRAFT_KEY);
      router.replace('/');
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed. Please try again.';
      console.log('[Register] Sign up error:', errorMessage, err);
      setError(errorMessage);
      saveDraft({ fullName, email, dateOfBirth, role, city });

      // Update rate limit info
      const remaining = registerRateLimiter.getRemainingAttempts(sanitizedEmail);
      if (remaining === 0) {
        const timeUntilReset = registerRateLimiter.getTimeUntilReset(sanitizedEmail);
        const hours = Math.ceil(timeUntilReset / 3600000);
        setRateLimitError(
          `Too many failed attempts. Please try again in ${hours} hour${hours !== 1 ? 's' : ''}.`
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveDraft = (data: { fullName: string; email: string; dateOfBirth: string; role: 'client' | 'agent'; city?: string }) => {
    AsyncStorage.setItem(
      REGISTER_DRAFT_KEY,
      JSON.stringify({ fullName: data.fullName, email: data.email, dateOfBirth: data.dateOfBirth, role: data.role, city: data.city ?? '' })
    ).catch(() => {});
  };

  const handleDateChange = (text: string) => {
    const sanitized = sanitizeDate(text);
    const formatted = formatDateInput(sanitized);
    if (formatted.length <= 10) {
      setDateOfBirth(formatted);
    }
  };

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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.subtitle}>Crie a sua conta TechLancer</Text>

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

        {/* Role Selection */}
        <Text style={styles.label}>Tipo de conta</Text>
        <View style={styles.roleContainer}>
          <TouchableOpacity
            style={[styles.roleButton, role === 'client' && styles.roleButtonActive]}
            onPress={() => setRole('client')}
            activeOpacity={0.8}
          >
            <Text style={[styles.roleButtonText, role === 'client' && styles.roleButtonTextActive]}>
              Cliente
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleButton, role === 'agent' && styles.roleButtonActive]}
            onPress={() => setRole('agent')}
            activeOpacity={0.8}
          >
            <Text style={[styles.roleButtonText, role === 'agent' && styles.roleButtonTextActive]}>
              Técnico
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Nome completo</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="O seu nome"
            placeholderTextColor="#9ca3af"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            maxLength={100}
            editable={!isLoading}
          />
        </View>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={(text) => setEmail(sanitizeEmail(text))}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            maxLength={255}
            editable={!isLoading}
          />
        </View>

        <Text style={styles.label}>Data de nascimento (DD/MM/AAAA)</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#9ca3af"
            value={dateOfBirth}
            onChangeText={handleDateChange}
            keyboardType="numeric"
            maxLength={10}
            editable={!isLoading}
          />
        </View>

        <Text style={styles.label}>Cidade (opcional)</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Ex: Lisboa, Porto"
            placeholderTextColor="#9ca3af"
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
            maxLength={100}
            editable={!isLoading}
          />
        </View>

        <Text style={styles.label}>Palavra-passe</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Mín. 8 caracteres, maiúscula, número e símbolo"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            editable={!isLoading}
          />
        </View>

        {/* Password Strength Bar – logic unchanged */}
        <PasswordStrengthBar password={password} />

        {/* Password Requirements – logic unchanged */}
        <PasswordRequirements password={password} />

        <Text style={styles.label}>Repetir palavra-passe</Text>
        <View
          style={[
            styles.inputWrapper,
            repeatPassword && password !== repeatPassword ? styles.inputWrapperError : undefined,
          ]}
        >
          <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Repetir palavra-passe"
            placeholderTextColor="#9ca3af"
            value={repeatPassword}
            onChangeText={setRepeatPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            editable={!isLoading}
          />
        </View>

        {repeatPassword && password !== repeatPassword ? (
          <Text style={styles.passwordMismatchText}>As palavras-passe não coincidem</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.registerButtonText}>Criar conta</Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Já tem conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLink}>Entrar</Text>
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
    marginBottom: 24,
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
    marginBottom: 24,
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
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  roleButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  roleButtonActive: {
    borderColor: '#1e3a5f',
    backgroundColor: '#1e3a5f',
  },
  roleButtonText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: '#fff',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginBottom: 20,
  },
  inputWrapperError: {
    borderWidth: 1.5,
    borderColor: '#dc2626',
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
  passwordStrengthContainer: {
    marginBottom: 10,
  },
  passwordStrengthBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 5,
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 3,
  },
  passwordStrengthLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  passwordRequirementsContainer: {
    marginBottom: 16,
    paddingLeft: 4,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  requirementIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  requirementText: {
    fontSize: 13,
  },
  passwordMismatchText: {
    fontSize: 13,
    color: '#dc2626',
    marginTop: -8,
    marginBottom: 4,
  },
  registerButton: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
    marginBottom: 24,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loginLink: {
    fontSize: 14,
    color: '#1e3a5f',
    fontWeight: '600',
  },
});
