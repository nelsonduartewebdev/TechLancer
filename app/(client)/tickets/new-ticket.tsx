import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { apiService } from '../../../lib/api';
import profilesService from '../../../lib/profiles';
import { geocodeQuery } from '../../../lib/geocode';
import logger from '../../../lib/logger';
import { label, description as getCategoryDescription } from '../../../lib/i18n';
import { PT_DISTRICTS, getDistrictLocationId, type DistrictId } from '../../../lib/constants/districts';

const MAX_DESC = 500;

export type LocationMode = 'saved' | 'current' | 'manual';

export interface SavedLocation {
  id: string;
  label: string;
  address?: string | null;
  city: string;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  postal_code?: string | null;
}

export default function NewTicketScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationMode, setLocationMode] = useState<LocationMode>('manual');
  const [locationId, setLocationId] = useState('');
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationDistrict, setLocationDistrict] = useState<DistrictId | ''>('');
  const [locationCity, setLocationCity] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState<number | undefined>();
  const [locationLng, setLocationLng] = useState<number | undefined>();
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [deviceBrand, setDeviceBrand] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'urgent'>('normal');
  const [isRemote, setIsRemote] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; label_pt: string; label_en: string; description_pt?: string | null; description_en?: string | null; description?: string | null }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [showUrgencyPicker, setShowUrgencyPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await profilesService.fetchCategories();
        if (!cancelled) setCategories(list);
      } catch (e) {
        logger.error('Failed to load categories', e);
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (locationMode !== 'saved') return;
    let cancelled = false;
    setLoadingLocations(true);
    (async () => {
      try {
        const list = await apiService.getLocations<SavedLocation[]>();
        if (!cancelled) setSavedLocations(Array.isArray(list) ? list : []);
      } catch (e) {
        logger.error('Failed to load locations', e);
        if (!cancelled) setSavedLocations([]);
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    })();
    return () => { cancelled = true; };
  }, [locationMode]);


  const selectedCategory = categories.find((c) => c.id === categoryId);
  const categoryLabel = label(selectedCategory) || selectedCategory?.name || '';
  const categoryDescription = getCategoryDescription(selectedCategory as Record<string, unknown> | null);

  const urgencyLabels: Record<string, string> = {
    low: 'Baixa',
    normal: 'Normal',
    urgent: 'Urgente',
  };
  const urgencyLabel = urgencyLabels[urgency];

  const handleUseCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Ative a localização para usar esta opção.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      let city = '';
      let address = '';
      let district: DistrictId | '' = '';
      try {
        const [rev] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (rev) {
          city = [rev.city, rev.subregion, rev.region].filter(Boolean).join(', ') || '';
          address = [rev.street, rev.streetNumber, rev.district].filter(Boolean).join(', ') || '';
          const regionOrCity = (rev.region || rev.city || '').toLowerCase();
          const match = (Object.entries(PT_DISTRICTS) as [DistrictId, { label: string; uuid: string }][]).find(
            ([_, v]) => v.label.toLowerCase() === regionOrCity
          );
          if (match) district = match[0];
        }
      } catch {
        // leave city/address empty if reverse geocode fails
      }
      setLocationId('');
      setLocationDistrict(district);
      setLocationCity(city);
      setLocationAddress(address);
      setLocationLat(latitude);
      setLocationLng(longitude);
    } catch (e) {
      logger.error('Get current location failed', e);
      Alert.alert('Erro', 'Não foi possível obter a localização. Tente inserir manualmente.');
    } finally {
      setGettingLocation(false);
    }
  };

  const handlePublish = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Campo em falta', 'Indique o título do pedido.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Campo em falta', 'Selecione uma categoria.');
      return;
    }
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      Alert.alert('Campo em falta', 'Descreva o serviço que precisa.');
      return;
    }

    if (!isRemote) {
      if (locationMode === 'saved' && !locationId.trim()) {
        Alert.alert('Campo em falta', 'Selecione uma localização guardada ou escolha outra opção.');
        return;
      }
      if (locationMode === 'manual') {
        if (!locationDistrict || !(locationDistrict in PT_DISTRICTS)) {
          Alert.alert('Campo em falta', 'Selecione o distrito.');
          return;
        }
        if (!locationCity.trim()) {
          Alert.alert('Campo em falta', 'Indique a cidade.');
          return;
        }
      }
    }

    const ticketPayload: Parameters<typeof apiService.createTicket>[0] = {
      title: trimmedTitle,
      description: trimmedDesc,
      category_id: categoryId,
      device_brand: deviceBrand.trim() || undefined,
      device_model: deviceModel.trim() || undefined,
      urgency: urgency || undefined,
      is_remote: isRemote,
    };
    if (!isRemote) {
      if (locationMode === 'saved' && locationId.trim()) {
        ticketPayload.location_id = locationId.trim();
      } else {
        // Manual or current: use district UUID as location_id when available
        if (locationDistrict && locationDistrict in PT_DISTRICTS) {
          ticketPayload.location_id = getDistrictLocationId(locationDistrict);
        }
        if (locationCity.trim()) ticketPayload.city = locationCity.trim();
        if (locationAddress.trim()) ticketPayload.address = locationAddress.trim();
        if (locationLat != null) ticketPayload.latitude = locationLat;
        if (locationLng != null) ticketPayload.longitude = locationLng;
        // Optional geocoding for manual entry when no coords yet
        if (locationLat == null && locationLng == null && (locationCity.trim() || locationAddress.trim())) {
          const query = [locationAddress.trim(), locationCity.trim()].filter(Boolean).join(', ');
          const geo = await geocodeQuery(query);
          if (geo) {
            ticketPayload.latitude = geo.latitude;
            ticketPayload.longitude = geo.longitude;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      await apiService.createTicket(ticketPayload);
      Alert.alert('Pedido publicado', 'O seu pedido foi publicado. Receberá orçamentos em breve.', [
        { text: 'OK', onPress: () => router.replace('/(client)/tickets') },
      ]);
    } catch (e: any) {
      logger.error('Create ticket failed', e);
      const status = e?.status ?? e?.response?.status;
      const data = e?.response?.data;
      const detail = typeof data?.detail === 'string' ? data.detail : data?.message ?? data?.error ?? e?.message;
      const msg = status ? `[${status}] ${detail}` : (detail || 'Não foi possível publicar o pedido.');
      Alert.alert('Erro', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoTicket = () => {
    setTitle('Reparação de ecrã — iPhone 14');
    setDescription(
      'O ecrã do meu iPhone 14 partiu-se após uma queda. Procuro um técnico experiente para substituir o ecrã por um original ou de boa qualidade. O dispositivo funciona normalmente, apenas o ecrã está partido e algumas áreas do toque não respondem.'
    );
    setCategoryId(categories[0]?.id ?? '');
    setLocationMode('manual');
    setLocationId('');
    setLocationDistrict('lisboa');
    setLocationCity('Lisboa');
    setLocationAddress('Av. da Liberdade, 125');
    setLocationLat(38.7223);
    setLocationLng(-9.1393);
    setDeviceBrand('Apple');
    setDeviceModel('iPhone 14');
    setUrgency('normal');
    setIsRemote(false);
  };

  const handleCancel = () => {
    const hasLocation = locationId.trim() || locationDistrict || locationCity.trim() || locationAddress.trim();
    if (title.trim() || description.trim() || categoryId || hasLocation || deviceBrand.trim() || deviceModel.trim()) {
      Alert.alert('Cancelar?', 'Tem a certeza que deseja sair? As alterações serão perdidas.', [
        { text: 'Continuar a editar', style: 'cancel' },
        { text: 'Cancelar', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.demoButton} onPress={handleDemoTicket}>
          <Ionicons name="flask-outline" size={18} color="#6B7280" />
          <Text style={styles.demoButtonText}>Demo Ticket</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.label}>Título do Pedido</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Computador não liga, ecrã partido, etc."
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
          />
          <Text style={styles.helper}>Seja claro e específico</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Categoria</Text>
          <TouchableOpacity
            style={styles.select}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Text style={categoryId ? styles.selectText : styles.selectPlaceholder}>
              {categoryId ? categoryLabel : 'Selecione uma categoria'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>
          {showCategoryPicker && (
            <View style={styles.picker}>
              {loadingCategories ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.pickerItem}
                    onPress={() => {
                      setCategoryId(c.id);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{label(c) || c.name}</Text>
                    {categoryId === c.id && <Ionicons name="checkmark" size={20} color="#111827" />}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
          {categoryDescription && (
            <View style={styles.categoryDescriptionBox}>
              <Text style={styles.categoryDescriptionText}>{categoryDescription}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Descreva o serviço que precisa em detalhe."
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={(t) => setDescription(t.slice(0, MAX_DESC))}
            multiline
            numberOfLines={4}
          />
          <Text style={styles.helper}>{description.length} / {MAX_DESC} caracteres</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={[styles.label, styles.switchRowLabel]}>Pode ser feito remotamente</Text>
            <Switch
              value={isRemote}
              onValueChange={setIsRemote}
              trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
              thumbColor={isRemote ? '#1E40AF' : '#fff'}
            />
          </View>
          <Text style={styles.helper}>Marque se o serviço pode ser feito à distância ou online</Text>
        </View>

        {!isRemote && (
          <View style={styles.section}>
            <Text style={styles.label}>Localização</Text>
            <View style={styles.locationModeRow}>
              {(['saved', 'current', 'manual'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.locationModeButton, locationMode === mode && styles.locationModeButtonActive]}
                  onPress={() => {
                    setLocationMode(mode);
                    setShowLocationPicker(false);
                    setShowDistrictPicker(false);
                    if (mode !== 'saved') setLocationId('');
                    if (mode !== 'manual') {
                      setLocationDistrict('');
                      setLocationCity('');
                      setLocationAddress('');
                      setLocationLat(undefined);
                      setLocationLng(undefined);
                    }
                  }}
                >
                  <Text style={[styles.locationModeButtonText, locationMode === mode && styles.locationModeButtonTextActive]}>
                    {mode === 'saved' ? 'Guardada' : mode === 'current' ? 'Atual' : 'Inserir'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {locationMode === 'saved' && (
              <>
                <TouchableOpacity
                  style={styles.select}
                  onPress={() => setShowLocationPicker(!showLocationPicker)}
                  disabled={loadingLocations}
                >
                  <Text style={locationId ? styles.selectText : styles.selectPlaceholder}>
                    {loadingLocations
                      ? 'A carregar...'
                      : locationId
                        ? (savedLocations.find((l) => l.id === locationId)?.label ?? savedLocations.find((l) => l.id === locationId)?.city ?? locationId)
                        : 'Selecione uma localização'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </TouchableOpacity>
                {showLocationPicker && (
                  <View style={styles.picker}>
                    {savedLocations.length === 0 ? (
                      <Text style={styles.helper}>Sem localizações guardadas. Use "Inserir" e guarde depois no seu perfil.</Text>
                    ) : (
                      savedLocations.map((loc) => (
                        <TouchableOpacity
                          key={loc.id}
                          style={styles.pickerItem}
                          onPress={() => {
                            setLocationId(loc.id);
                            setShowLocationPicker(false);
                          }}
                        >
                          <Text style={styles.pickerItemText}>{loc.label} — {loc.city}</Text>
                          {locationId === loc.id && <Ionicons name="checkmark" size={20} color="#111827" />}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </>
            )}

            {locationMode === 'current' && (
              <View style={styles.currentLocationBlock}>
                <TouchableOpacity
                  style={[styles.currentLocationButton, gettingLocation && styles.currentLocationButtonDisabled]}
                  onPress={handleUseCurrentLocation}
                  disabled={gettingLocation}
                >
                  {gettingLocation ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="locate" size={22} color="#fff" />
                      <Text style={styles.currentLocationButtonText}>Usar minha localização</Text>
                    </>
                  )}
                </TouchableOpacity>
                {(locationCity || locationLat != null) && (
                  <Text style={styles.helper}>
                    {locationCity && `${locationCity}${locationAddress ? `, ${locationAddress}` : ''}`}
                    {locationLat != null && locationLng != null && ` (${locationLat.toFixed(4)}, ${locationLng.toFixed(4)})`}
                  </Text>
                )}
              </View>
            )}

            {locationMode === 'manual' && (
              <>
                <Text style={[styles.label, { marginTop: 0 }]}>Distrito *</Text>
                <TouchableOpacity
                  style={styles.select}
                  onPress={() => setShowDistrictPicker(!showDistrictPicker)}
                >
                  <Text style={locationDistrict ? styles.selectText : styles.selectPlaceholder}>
                    {locationDistrict ? PT_DISTRICTS[locationDistrict].label : 'Selecione o distrito'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </TouchableOpacity>
                {showDistrictPicker && (
                  <View style={styles.picker}>
                    {(Object.keys(PT_DISTRICTS) as DistrictId[]).map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={styles.pickerItem}
                        onPress={() => {
                          setLocationDistrict(d);
                          setShowDistrictPicker(false);
                        }}
                      >
                        <Text style={styles.pickerItemText}>{PT_DISTRICTS[d].label}</Text>
                        {locationDistrict === d && <Ionicons name="checkmark" size={20} color="#111827" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={[styles.label, { marginTop: 12 }]}>Cidade *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Lisboa, Porto, Coimbra"
                  placeholderTextColor="#9CA3AF"
                  value={locationCity}
                  onChangeText={setLocationCity}
                />
                <Text style={[styles.label, { marginTop: 12 }]}>Morada (opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Morada completa"
                  placeholderTextColor="#9CA3AF"
                  value={locationAddress}
                  onChangeText={setLocationAddress}
                />
              </>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Dispositivo (Opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Marca (ex: Apple, Dell, Samsung)"
            placeholderTextColor="#9CA3AF"
            value={deviceBrand}
            onChangeText={setDeviceBrand}
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            placeholder="Modelo (ex: MacBook Pro 2023)"
            placeholderTextColor="#9CA3AF"
            value={deviceModel}
            onChangeText={setDeviceModel}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Urgência</Text>
          <TouchableOpacity
            style={styles.select}
            onPress={() => setShowUrgencyPicker(!showUrgencyPicker)}
          >
            <Text style={styles.selectText}>{urgencyLabel}</Text>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>
          {showUrgencyPicker && (
            <View style={styles.picker}>
              {(['low', 'normal', 'urgent'] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={styles.pickerItem}
                  onPress={() => {
                    setUrgency(u);
                    setShowUrgencyPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{urgencyLabels[u]}</Text>
                  {urgency === u && <Ionicons name="checkmark" size={20} color="#111827" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Fotos (Opcional)</Text>
          <Text style={styles.helper}>Adicione até 5 fotos para ajudar os técnicos a compreender melhor o serviço</Text>
          <TouchableOpacity style={styles.photoButton} disabled>
            <Ionicons name="cloud-upload-outline" size={28} color="#6B7280" />
            <Text style={styles.photoButtonText}>Adicionar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={24} color="#1E40AF" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Como funciona?</Text>
            <Text style={styles.infoItem}>• O seu pedido será visível para técnicos qualificados</Text>
            <Text style={styles.infoItem}>• Receberá orçamentos de vários profissionais</Text>
            <Text style={styles.infoItem}>• Compare preços e perfis antes de escolher</Text>
            <Text style={styles.infoItem}>• Pagamento seguro apenas após conclusão do serviço</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={submitting}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handlePublish}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Publicar Pedido</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 20,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  demoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchRowLabel: {
    flex: 1,
    marginBottom: 0,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helper: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectText: {
    fontSize: 16,
    color: '#111827',
  },
  selectPlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  picker: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#111827',
  },
  categoryDescriptionBox: {
    marginTop: 4,
    padding: 12,
  },
  categoryDescriptionText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  locationModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  locationModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  locationModeButtonActive: {
    borderColor: '#111827',
    backgroundColor: '#F3F4F6',
  },
  locationModeButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  locationModeButtonTextActive: {
    color: '#111827',
  },
  currentLocationBlock: {
    marginTop: 4,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  currentLocationButtonDisabled: {
    opacity: 0.7,
  },
  currentLocationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  photoButton: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
