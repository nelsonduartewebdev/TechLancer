import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiService } from '../../../lib/api';
import logger from '../../../lib/logger';

type TabType = 'active' | 'history';

interface TicketItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  category?: { name?: string; label_pt?: string; label_en?: string };
  category_id?: string;
  created_at?: string;
  updated_at?: string;
}

export default function ClientTicketsScreen() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabType>('active');
  const [activeTickets, setActiveTickets] = useState<TicketItem[]>([]);
  const [historyTickets, setHistoryTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setError(null);
      const baseParams: { search?: string } = {};
      if (search.trim()) baseParams.search = search.trim();
      const [activeData, historyData] = await Promise.all([
        apiService.getTickets({ ...baseParams, status: 'open' }),
        apiService.getTickets({ ...baseParams, status: 'closed' }),
      ]);
      const toList = (data: any) =>
        Array.isArray(data) ? data : data?.tickets ?? data?.data ?? [];
      setActiveTickets(toList(activeData));
      setHistoryTickets(toList(historyData));
    } catch (e: any) {
      logger.error('Failed to fetch tickets', e);
      setError(e?.message || 'Erro ao carregar pedidos.');
      setActiveTickets([]);
      setHistoryTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [fetchTickets]);

  const tickets = tab === 'active' ? activeTickets : historyTickets;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTickets();
  }, [fetchTickets]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const categoryLabel = (t: TicketItem) =>
    t.category?.label_pt || t.category?.label_en || t.category?.name || '';

  const activeCount = activeTickets.length;
  const historyCount = historyTickets.length;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Procurar pedidos..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <TouchableOpacity
        style={styles.newServiceButton}
        onPress={() => router.push('/(client)/tickets/new-ticket')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.newServiceButtonText}>Pedir Novo Serviço</Text>
      </TouchableOpacity>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Ativos ({activeCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && styles.tabActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
            Histórico ({historyCount})
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {tickets.length === 0 && !error && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {tab === 'active' ? 'Nenhum pedido ativo.' : 'Nenhum pedido no histórico.'}
              </Text>
            </View>
          )}
          {tickets.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.card}
              onPress={() => router.push(`/(client)/tickets/${t.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardLeft}>
                {tab === 'history' ? (
                  <View style={styles.iconCircleSuccess}>
                    <Ionicons name="checkmark" size={22} color="#fff" />
                  </View>
                ) : (
                  <View style={styles.iconCircle}>
                    <Ionicons name="time-outline" size={22} color="#6B7280" />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{t.title}</Text>
                    <View style={[styles.badge, tab === 'history' ? styles.badgeSuccess : styles.badgeOpen]}>
                      <Text style={styles.badgeText}>
                        {tab === 'history' ? 'Concluído' : 'Aberto'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardMeta}>
                    {categoryLabel(t)} · {formatDate(t.created_at)}
                  </Text>
                  {t.description ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>{t.description}</Text>
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 0,
  },
  newServiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  newServiceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#111827',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconCircleSuccess: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOpen: {
    backgroundColor: '#DBEAFE',
  },
  badgeSuccess: {
    backgroundColor: '#D1FAE5',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  cardMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
  },
  errorBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#B91C1C',
  },
});
