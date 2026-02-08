import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
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

// Password Strength Bar Component
const PasswordStrengthBar = ({ password }: { password: string }) => {
  const strength = getPasswordStrength(password);

  const getStrengthColor = (strength: PasswordStrength): string => {
    switch (strength) {
      case 'weak':
        return '#d32f2f';
      case 'medium':
        return '#ff9800';
      case 'strong':
        return '#4caf50';
      case 'very-strong':
        return '#2e7d32';
      default:
        return '#ccc';
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
      <Text style={[styles.requirementIcon, { color: met ? '#4caf50' : '#999' }]}>
        {met ? '✓' : '○'}
      </Text>
      <Text style={[styles.requirementText, { color: met ? '#4caf50' : '#666' }]}>{text}</Text>
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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const handleRegister = async () => {
    console.log('[Register] Sign up attempt started');
    // Reset errors
    setError(null);
    setRateLimitError(null);

    // Validate all fields are filled
    if (!email.trim() || !password.trim() || !repeatPassword.trim() || !fullName.trim() || !dateOfBirth.trim()) {
      console.log('[Register] Validation failed: missing required fields');
      setError('Please fill in all fields');
      return;
    }

    // Check rate limiting
    const sanitizedEmail = sanitizeEmail(email);
    if (!registerRateLimiter.canAttempt(sanitizedEmail)) {
      console.log('[Register] Rate limit exceeded for email:', sanitizedEmail);
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
      setError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!isPasswordValid(password)) {
      console.log('[Register] Validation failed: password does not meet requirements');
      setError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol');
      return;
    }

    // Validate passwords match
    if (password !== repeatPassword) {
      console.log('[Register] Validation failed: passwords do not match');
      setError('Passwords do not match');
      return;
    }

    // Validate age (18+)
    if (!isAgeValid(dateOfBirth)) {
      console.log('[Register] Validation failed: age requirement (18+) not met');
      setError('You must be at least 18 years old to register');
      return;
    }

    console.log('[Register] Validation passed, calling API register', { email: sanitizedEmail, role });
    setIsLoading(true);

    try {
      // Convert date from DD/MM/YYYY to YYYY-MM-DD format
      const dateParts = dateOfBirth.split('/');
      const dataNascimento = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

      // Register via API with all required fields (nome, data_nascimento, tipo)
      await apiService.register({
        email: sanitizedEmail,
        password,
        nome: sanitizeName(fullName),
        data_nascimento: dataNascimento,
        tipo: role,
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

      console.log('[Register] Profile refreshed, navigating to /');
      // Navigation will be handled by index.tsx based on role
      router.replace('/');
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed. Please try again.';
      console.log('[Register] Sign up error:', errorMessage, err);
      setError(errorMessage);

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

  const handleDateChange = (text: string) => {
    const sanitized = sanitizeDate(text);
    const formatted = formatDateInput(sanitized);
    if (formatted.length <= 10) {
      setDateOfBirth(formatted);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Register</Text>
      <Text style={styles.subtitle}>Create your TechLancer account</Text>

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

      {/* Role Selection */}
      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[styles.roleButton, role === 'client' && styles.roleButtonActive]}
          onPress={() => setRole('client')}
        >
          <Text style={[styles.roleButtonText, role === 'client' && styles.roleButtonTextActive]}>
            Client
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleButton, role === 'agent' && styles.roleButtonActive]}
          onPress={() => setRole('agent')}
        >
          <Text style={[styles.roleButtonText, role === 'agent' && styles.roleButtonTextActive]}>
            Agent
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        maxLength={100}
        editable={!isLoading}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={(text) => setEmail(sanitizeEmail(text))}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        maxLength={255}
        editable={!isLoading}
      />

      <TextInput
        style={styles.input}
        placeholder="Date of Birth (DD/MM/YYYY)"
        value={dateOfBirth}
        onChangeText={handleDateChange}
        keyboardType="numeric"
        maxLength={10}
        editable={!isLoading}
      />

      <TextInput
        style={styles.input}
        placeholder="Secure Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        editable={!isLoading}
      />

      {/* Password Security Bar */}
      <PasswordStrengthBar password={password} />

      {/* Password Requirements */}
      <PasswordRequirements password={password} />

      <TextInput
        style={[
          styles.input,
          repeatPassword && password !== repeatPassword ? styles.inputError : undefined,
        ]}
        placeholder="Repeat Password"
        value={repeatPassword}
        onChangeText={setRepeatPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        editable={!isLoading}
      />

      {repeatPassword && password !== repeatPassword && (
        <Text style={styles.passwordMismatchText}>Passwords do not match</Text>
      )}

      <TouchableOpacity
        style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
        onPress={handleRegister}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.registerButtonText}>Register</Text>
        )}
      </TouchableOpacity>

      <View style={styles.loginContainer}>
        <Text style={styles.loginText}>Already have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginLink}>Log In</Text>
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
    marginBottom: 30,
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
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  roleButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  roleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: '#fff',
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
  inputError: {
    borderColor: '#d32f2f',
  },
  passwordStrengthContainer: {
    marginBottom: 10,
  },
  passwordStrengthBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
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
    marginBottom: 15,
    paddingLeft: 5,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  requirementIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  requirementText: {
    fontSize: 12,
  },
  passwordMismatchText: {
    fontSize: 12,
    color: '#d32f2f',
    marginBottom: 15,
    marginTop: -10,
  },
  registerButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});
