import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { apiService } from '../lib/api';
import { isValidEmail, isAgeValid, formatDateInput, isPasswordValid, sanitizeEmail, sanitizeName, sanitizeDate, getPasswordStrength, getPasswordRequirements, PasswordStrength } from '../lib/validation';
import { registerRateLimiter } from '../lib/rateLimiter';

// Password Strength Bar Component
const PasswordStrengthBar = ({ password }: { password: string }) => {
  const strength = getPasswordStrength(password);
  
  const getStrengthColor = (strength: PasswordStrength): string => {
    switch (strength) {
      case 'weak': return '#d32f2f'; // red
      case 'medium': return '#ff9800'; // orange
      case 'strong': return '#4caf50'; // green
      case 'very-strong': return '#2e7d32'; // dark green
      default: return '#ccc';
    }
  };

  const getStrengthFlex = (strength: PasswordStrength): number => {
    switch (strength) {
      case 'weak': return 0.25;
      case 'medium': return 0.5;
      case 'strong': return 0.75;
      case 'very-strong': return 1;
      default: return 0;
    }
  };

  const getStrengthLabel = (strength: PasswordStrength): string => {
    switch (strength) {
      case 'weak': return 'Weak';
      case 'medium': return 'Medium';
      case 'strong': return 'Strong';
      case 'very-strong': return 'Very Strong';
      default: return '';
    }
  };

  if (password.length === 0) {
    return null;
  }

  return (
    <View style={{ marginBottom: 15 }}>
      <View style={{ 
        height: 6, 
        backgroundColor: '#e0e0e0', 
        borderRadius: 3, 
        overflow: 'hidden',
        marginBottom: 5,
        flexDirection: 'row',
      }}>
        <View style={{ 
          height: '100%', 
          flex: getStrengthFlex(strength),
          backgroundColor: getStrengthColor(strength),
          borderRadius: 3,
        }} />
      </View>
      <Text style={{ fontSize: 12, color: getStrengthColor(strength), fontWeight: '600' }}>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
      <Text style={{ fontSize: 14, color: met ? '#4caf50' : '#999', marginRight: 8 }}>
        {met ? '✓' : '○'}
      </Text>
      <Text style={{ fontSize: 12, color: met ? '#4caf50' : '#666' }}>
        {text}
      </Text>
    </View>
  );

  return (
    <View style={{ marginBottom: 15, paddingLeft: 5 }}>
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [tipo, setTipo] = useState<'client' | 'agent'>('client');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const handleRegister = async () => {
    // Reset errors
    setError(null);
    setRateLimitError(null);

    // Validate all fields are filled
    if (!email.trim() || !password.trim() || !repeatPassword.trim() || !nome.trim() || !dataNascimento.trim()) {
      setError('Please fill in all fields');
      return;
    }

    // Check rate limiting (use IP or email as identifier)
    const sanitizedEmail = sanitizeEmail(email);
    if (!registerRateLimiter.canAttempt(sanitizedEmail)) {
      const timeUntilReset = registerRateLimiter.getTimeUntilReset(sanitizedEmail);
      const hours = Math.ceil(timeUntilReset / 3600000);
      setRateLimitError(`Too many registration attempts. Please try again in ${hours} hour${hours !== 1 ? 's' : ''}.`);
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!isPasswordValid(password)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol');
      return;
    }

    // Validate passwords match
    if (password !== repeatPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate age (18+)
    if (!isAgeValid(dataNascimento)) {
      setError('You must be at least 18 years old to register');
      return;
    }

    setIsLoading(true);

    try {
      // Convert date from DD/MM/YYYY to YYYY-MM-DD format for API
      const dateParts = dataNascimento.split('/');
      const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

      // Sanitize all inputs
      await apiService.register({
        email: sanitizedEmail,
        password: password, // Don't sanitize password (needs to be sent as-is)
        nome: sanitizeName(nome),
        data_nascimento: formattedDate,
        tipo,
      });
      
      // Reset rate limiter on successful registration
      registerRateLimiter.reset(sanitizedEmail);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      
      // Update rate limit info
      const remaining = registerRateLimiter.getRemainingAttempts(sanitizedEmail);
      if (remaining === 0) {
        const timeUntilReset = registerRateLimiter.getTimeUntilReset(sanitizedEmail);
        const hours = Math.ceil(timeUntilReset / 3600000);
        setRateLimitError(`Too many failed attempts. Please try again in ${hours} hour${hours !== 1 ? 's' : ''}.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (text: string) => {
    const sanitized = sanitizeDate(text);
    const formatted = formatDateInput(sanitized);
    if (formatted.length <= 10) {
      setDataNascimento(formatted);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ padding: 20, justifyContent: 'center', minHeight: '100%' }}>
      <StatusBar style="auto" />
      <Text style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 10, color: '#333', textAlign: 'center' }}>
        Register
      </Text>
      <Text style={{ fontSize: 18, color: '#666', marginBottom: 40, textAlign: 'center' }}>
        Create your TechLancer account
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
        onChangeText={(text) => setEmail(sanitizeEmail(text))}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        maxLength={255}
      />

      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 16 }}
        placeholder="Secure Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
      />
      
      {/* Password Security Bar */}
      <PasswordStrengthBar password={password} />
      
      {/* Password Requirements */}
      <PasswordRequirements password={password} />

      <TextInput
        style={{ 
          borderWidth: 1, 
          borderColor: repeatPassword && password !== repeatPassword ? '#d32f2f' : '#ccc', 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 15, 
          fontSize: 16 
        }}
        placeholder="Repeat Password"
        value={repeatPassword}
        onChangeText={setRepeatPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
      />
      
      {repeatPassword && password !== repeatPassword && (
        <Text style={{ fontSize: 12, color: '#d32f2f', marginBottom: 15, marginTop: -10 }}>
          Passwords do not match
        </Text>
      )}

      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 }}
        placeholder="Nome"
        value={nome}
        onChangeText={setNome}
        autoCapitalize="words"
        maxLength={100}
      />

      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 }}
        placeholder="Data de Nascimento (DD/MM/YYYY)"
        value={dataNascimento}
        onChangeText={handleDateChange}
        keyboardType="numeric"
        maxLength={10}
      />

      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: tipo === 'client' ? '#007AFF' : '#ccc',
            borderRadius: 8,
            padding: 12,
            backgroundColor: tipo === 'client' ? '#007AFF' : '#fff',
            alignItems: 'center',
            marginRight: 5,
          }}
          onPress={() => setTipo('client')}
        >
          <Text style={{ color: tipo === 'client' ? '#fff' : '#333', fontSize: 16, fontWeight: '600' }}>
            Client
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: tipo === 'agent' ? '#007AFF' : '#ccc',
            borderRadius: 8,
            padding: 12,
            backgroundColor: tipo === 'agent' ? '#007AFF' : '#fff',
            alignItems: 'center',
            marginLeft: 5,
          }}
          onPress={() => setTipo('agent')}
        >
          <Text style={{ color: tipo === 'agent' ? '#fff' : '#333', fontSize: 16, fontWeight: '600' }}>
            Agent
          </Text>
        </TouchableOpacity>
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
        onPress={handleRegister}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Register</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/login')}
        style={{ alignItems: 'center' }}
      >
        <Text style={{ fontSize: 14, color: '#007AFF' }}>
          Already have an account? Log In
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
