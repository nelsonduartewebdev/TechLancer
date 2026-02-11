import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { apiService } from '../../../lib/api';

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await apiService.getTicket(id);
        setTicket(data);
      } catch (e) {
        setError('Não foi possível carregar o pedido.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  if (error || !ticket) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.errorText}>{error || 'Pedido não encontrado.'}</Text>
      </View>
    );
  }

  const categoryLabel = ticket.category?.label_pt || ticket.category?.label_en || ticket.category?.name || '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>{ticket.title}</Text>
        <View style={[styles.badge, ticket.status === 'closed' ? styles.badgeSuccess : styles.badgeOpen]}>
          <Text style={styles.badgeText}>
            {ticket.status === 'closed' ? 'Concluído' : 'Aberto'}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>{categoryLabel} · {formatDate(ticket.created_at)}</Text>
      {ticket.description ? (
        <Text style={styles.description}>{ticket.description}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeOpen: {
    backgroundColor: '#DBEAFE',
  },
  badgeSuccess: {
    backgroundColor: '#D1FAE5',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  meta: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
});
