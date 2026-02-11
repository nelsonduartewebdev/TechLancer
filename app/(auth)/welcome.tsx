import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const FEATURES = [
  {
    icon: 'people-outline' as const,
    title: 'Técnicos Verificados',
    description: 'Profissionais qualificados e avaliados',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Pagamento Seguro',
    description: 'Proteção em todas as transações',
  },
  {
    icon: 'time-outline' as const,
    title: 'Resposta Rápida',
    description: 'Orçamentos em minutos',
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Ionicons name="construct-outline" size={40} color="#374151" />
          </View>
          <Text style={styles.title}>Bem-vindo ao TechLancer</Text>
          <Text style={styles.subtitle}>
            Conectamos você aos melhores técnicos da sua região
          </Text>
        </View>

        {/* Feature highlights */}
        <View style={styles.features}>
          {FEATURES.map(({ icon, title, description }) => (
            <View key={title} style={styles.featureRow}>
              <View style={styles.featureIconWrapper}>
                <Ionicons name={icon} size={24} color="#374151" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDescription}>{description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Criar Conta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Já tenho conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  features: {
    marginBottom: 40,
    gap: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    borderWidth: 2,
    borderColor: '#1e3a5f',
  },
  secondaryButtonText: {
    color: '#1e3a5f',
    fontSize: 17,
    fontWeight: '600',
  },
});
