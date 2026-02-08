import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../contexts/AuthContext';
import profilesService, { Category } from '../../lib/profiles';
import { Image as ExpoImage } from 'expo-image';

export default function AgentProfileScreen() {
  const { profile, agentProfile, user, signOut, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showCityInput, setShowCityInput] = useState(false);
  const [newCity, setNewCity] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    city: profile?.city || '',
    bio: agentProfile?.bio || '',
    service_radius_km: agentProfile?.service_radius_km || 50,
    service_cities: agentProfile?.service_cities || [],
  });

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Load agent's selected categories
  useEffect(() => {
    if (user && profile?.role === 'agent') {
      loadAgentCategories();
    }
  }, [user, profile]);

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        city: profile.city || '',
      }));
    }
    if (agentProfile) {
      setFormData((prev) => ({
        ...prev,
        bio: agentProfile.bio || '',
        service_radius_km: agentProfile.service_radius_km || 50,
        service_cities: agentProfile.service_cities || [],
      }));
    }
  }, [profile, agentProfile]);

  const loadCategories = async () => {
    try {
      const data = await profilesService.fetchCategories();
      setCategories(data);
    } catch (error: any) {
      console.error('Error loading categories:', error);
    }
  };

  const loadAgentCategories = async () => {
    if (!user) return;
    try {
      const categoryIds = await profilesService.getAgentCategories(user.id);
      setSelectedCategories(categoryIds);
    } catch (error: any) {
      console.error('Error loading agent categories:', error);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setLoading(true);
    try {
      // Update profile
      await profilesService.updateProfile(user.id, {
        full_name: formData.full_name,
        phone: formData.phone || undefined,
        city: formData.city || undefined,
      });

      // Update agent profile
      await profilesService.updateAgentProfile(user.id, {
        bio: formData.bio || undefined,
        service_radius_km: formData.service_radius_km,
        service_cities: formData.service_cities.length > 0 ? formData.service_cities : undefined,
      });

      // Update agent categories
      await profilesService.updateAgentCategories(user.id, selectedCategories);

      await refreshProfile();
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        city: profile.city || '',
      }));
    }
    if (agentProfile) {
      setFormData((prev) => ({
        ...prev,
        bio: agentProfile.bio || '',
        service_radius_km: agentProfile.service_radius_km || 50,
        service_cities: agentProfile.service_cities || [],
      }));
    }
    loadAgentCategories();
    setIsEditing(false);
  };

  const handleAvatarPress = async () => {
    if (!user) return;

    Alert.alert(
      'Change Avatar',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: async () => {
            const uri = await profilesService.takePhoto();
            if (uri) {
              await uploadAvatar(uri);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const uri = await profilesService.pickImage();
            if (uri) {
              await uploadAvatar(uri);
            }
          },
        },
      ]
    );
  };

  const uploadAvatar = async (imageUri: string) => {
    if (!user) return;

    setUploadingAvatar(true);
    try {
      const avatarUrl = await profilesService.uploadAvatar(user.id, imageUri);
      await profilesService.updateProfile(user.id, { avatar_url: avatarUrl });
      await refreshProfile();
      Alert.alert('Success', 'Avatar updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const addServiceCity = () => {
    setShowCityInput(true);
  };

  const handleAddCity = () => {
    if (newCity && newCity.trim()) {
      setFormData((prev) => ({
        ...prev,
        service_cities: [...(prev.service_cities || []), newCity.trim()],
      }));
      setNewCity('');
      setShowCityInput(false);
    }
  };

  const removeServiceCity = (city: string) => {
    setFormData((prev) => ({
      ...prev,
      service_cities: (prev.service_cities || []).filter((c) => c !== city),
    }));
  };

  const handlePreview = async () => {
    if (!user) return;
    try {
      const data = await profilesService.getPublicProfile(user.id);
      setPreviewData(data);
      setShowPreviewModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load preview');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return '#34C759';
      case 'pending':
        return '#FF9500';
      case 'rejected':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getVerificationStatusText = (status: string) => {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'pending':
        return 'Pending Review';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Unverified';
    }
  };

  if (!profile || !agentProfile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const avatarUrl = profile.avatar_url;
  const selectedCategoryLabels = categories
    .filter((cat) => selectedCategories.includes(cat.id))
    .map((cat) => cat.label_en || cat.label_pt);

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.content}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={handleAvatarPress}
            disabled={uploadingAvatar}
            style={styles.avatarContainer}
          >
            {avatarUrl ? (
              <ExpoImage
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {profile.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {uploadingAvatar && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
            {!uploadingAvatar && (
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditText}>✏️</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Verification Status */}
          <View
            style={[
              styles.verificationBadge,
              { backgroundColor: getVerificationStatusColor(agentProfile.verification_status) },
            ]}
          >
            <Text style={styles.verificationText}>
              {getVerificationStatusText(agentProfile.verification_status)}
            </Text>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.section}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile.email}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={formData.full_name}
                onChangeText={(text) =>
                  setFormData({ ...formData, full_name: text })
                }
                placeholder="Enter your full name"
              />
            ) : (
              <Text style={styles.value}>
                {profile.full_name || 'Not set'}
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) =>
                  setFormData({ ...formData, phone: text })
                }
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.value}>{profile.phone || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>City</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={formData.city}
                onChangeText={(text) =>
                  setFormData({ ...formData, city: text })
                }
                placeholder="Enter your city"
              />
            ) : (
              <Text style={styles.value}>{profile.city || 'Not set'}</Text>
            )}
          </View>

          {/* Bio */}
          <View style={styles.field}>
            <Text style={styles.label}>Bio</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.bio}
                onChangeText={(text) =>
                  setFormData({ ...formData, bio: text })
                }
                placeholder="Tell clients about yourself and your expertise..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.value}>
                {agentProfile.bio || 'No bio yet'}
              </Text>
            )}
          </View>

          {/* Categories */}
          <View style={styles.field}>
            <Text style={styles.label}>Service Categories</Text>
            {isEditing ? (
              <>
                <TouchableOpacity
                  style={styles.categoryButton}
                  onPress={() => setShowCategoryModal(true)}
                >
                  <Text style={styles.categoryButtonText}>
                    {selectedCategories.length > 0
                      ? `${selectedCategories.length} selected`
                      : 'Select categories'}
                  </Text>
                </TouchableOpacity>
                {selectedCategoryLabels.length > 0 && (
                  <View style={styles.selectedCategories}>
                    {selectedCategoryLabels.map((label, index) => (
                      <View key={index} style={styles.categoryTag}>
                        <Text style={styles.categoryTagText}>{label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.selectedCategories}>
                {selectedCategoryLabels.length > 0 ? (
                  selectedCategoryLabels.map((label, index) => (
                    <View key={index} style={styles.categoryTag}>
                      <Text style={styles.categoryTagText}>{label}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.value}>No categories selected</Text>
                )}
              </View>
            )}
          </View>

          {/* Service Area */}
          <View style={styles.field}>
            <Text style={styles.label}>Service Area</Text>
            {isEditing ? (
              <>
                <View style={styles.serviceAreaRow}>
                  <Text style={styles.serviceAreaLabel}>Radius (km):</Text>
                  <TextInput
                    style={[styles.input, styles.radiusInput]}
                    value={formData.service_radius_km.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 0;
                      setFormData({ ...formData, service_radius_km: num });
                    }}
                    keyboardType="numeric"
                    placeholder="50"
                  />
                </View>
                <TouchableOpacity
                  style={styles.addCityButton}
                  onPress={addServiceCity}
                >
                  <Text style={styles.addCityButtonText}>+ Add City</Text>
                </TouchableOpacity>
                {showCityInput && (
                  <View style={styles.cityInputContainer}>
                    <TextInput
                      style={[styles.input, styles.cityInput]}
                      value={newCity}
                      onChangeText={setNewCity}
                      placeholder="Enter city name"
                      autoFocus
                    />
                    <View style={styles.cityInputActions}>
                      <TouchableOpacity
                        style={styles.cityInputButton}
                        onPress={() => {
                          setShowCityInput(false);
                          setNewCity('');
                        }}
                      >
                        <Text style={styles.cityInputButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cityInputButton, styles.cityInputButtonPrimary]}
                        onPress={handleAddCity}
                      >
                        <Text style={styles.cityInputButtonTextPrimary}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {formData.service_cities && formData.service_cities.length > 0 && (
                  <View style={styles.citiesList}>
                    {formData.service_cities.map((city, index) => (
                      <View key={index} style={styles.cityTag}>
                        <Text style={styles.cityTagText}>{city}</Text>
                        <TouchableOpacity
                          onPress={() => removeServiceCity(city)}
                          style={styles.removeCityButton}
                        >
                          <Text style={styles.removeCityText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View>
                <Text style={styles.value}>
                  Radius: {agentProfile.service_radius_km} km
                </Text>
                {agentProfile.service_cities &&
                  agentProfile.service_cities.length > 0 && (
                    <View style={styles.citiesList}>
                      {agentProfile.service_cities.map((city, index) => (
                        <View key={index} style={styles.cityTag}>
                          <Text style={styles.cityTagText}>{city}</Text>
                        </View>
                      ))}
                    </View>
                  )}
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {isEditing ? (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.editButton]}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.previewButton]}
                onPress={handlePreview}
              >
                <Text style={styles.previewButtonText}>Preview Public Profile</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Categories</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    selectedCategories.includes(category.id) &&
                      styles.categoryItemSelected,
                  ]}
                  onPress={() => toggleCategory(category.id)}
                >
                  <Text
                    style={[
                      styles.categoryItemText,
                      selectedCategories.includes(category.id) &&
                        styles.categoryItemTextSelected,
                    ]}
                  >
                    {category.label_en || category.label_pt}
                  </Text>
                  {selectedCategories.includes(category.id) && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal
        visible={showPreviewModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Public Profile Preview</Text>
              <TouchableOpacity
                onPress={() => setShowPreviewModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {previewData && (
                <View style={styles.previewContent}>
                  {previewData.avatar_url ? (
                    <ExpoImage
                      source={{ uri: previewData.avatar_url }}
                      style={styles.previewAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.previewAvatarPlaceholder}>
                      <Text style={styles.previewAvatarText}>
                        {previewData.full_name?.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.previewName}>
                    {previewData.full_name}
                  </Text>
                  {previewData.agentProfile && (
                    <>
                      <View
                        style={[
                          styles.previewVerificationBadge,
                          {
                            backgroundColor: getVerificationStatusColor(
                              previewData.agentProfile.verification_status
                            ),
                          },
                        ]}
                      >
                        <Text style={styles.previewVerificationText}>
                          {getVerificationStatusText(
                            previewData.agentProfile.verification_status
                          )}
                        </Text>
                      </View>
                      {previewData.agentProfile.bio && (
                        <Text style={styles.previewBio}>
                          {previewData.agentProfile.bio}
                        </Text>
                      )}
                      <View style={styles.previewStats}>
                        <View style={styles.previewStat}>
                          <Text style={styles.previewStatValue}>
                            {previewData.agentProfile.avg_rating.toFixed(1)}
                          </Text>
                          <Text style={styles.previewStatLabel}>Rating</Text>
                        </View>
                        <View style={styles.previewStat}>
                          <Text style={styles.previewStatValue}>
                            {previewData.agentProfile.total_reviews}
                          </Text>
                          <Text style={styles.previewStatLabel}>Reviews</Text>
                        </View>
                        <View style={styles.previewStat}>
                          <Text style={styles.previewStatValue}>
                            {previewData.agentProfile.total_jobs_completed}
                          </Text>
                          <Text style={styles.previewStatLabel}>Jobs</Text>
                        </View>
                      </View>
                      {previewData.categories &&
                        previewData.categories.length > 0 && (
                          <View style={styles.previewCategories}>
                            <Text style={styles.previewSectionTitle}>
                              Categories
                            </Text>
                            {previewData.categories.map((item: any, index: number) => (
                              <Text key={index} style={styles.previewCategory}>
                                • {item.categories?.label_en || item.categories?.label_pt}
                              </Text>
                            ))}
                          </View>
                        )}
                    </>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarEditText: {
    fontSize: 18,
  },
  verificationBadge: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  verificationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 30,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  categoryButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f0f7ff',
  },
  categoryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  categoryTag: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryTagText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  serviceAreaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceAreaLabel: {
    fontSize: 16,
    color: '#333',
    marginRight: 12,
  },
  radiusInput: {
    width: 80,
  },
  addCityButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  addCityButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  citiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cityTagText: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  removeCityButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeCityText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  actions: {
    marginTop: 20,
    marginBottom: 40,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewButton: {
    backgroundColor: '#34C759',
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#ff3b30',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalScrollView: {
    padding: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  categoryItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  categoryItemText: {
    fontSize: 16,
    color: '#333',
  },
  categoryItemTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  previewContent: {
    alignItems: 'center',
  },
  previewAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  previewAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewAvatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  previewName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  previewVerificationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  previewVerificationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  previewBio: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  previewStats: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  previewStat: {
    alignItems: 'center',
  },
  previewStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  previewStatLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  previewCategories: {
    width: '100%',
    paddingHorizontal: 20,
  },
  previewSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  previewCategory: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  cityInputContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  cityInput: {
    marginBottom: 12,
  },
  cityInputActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cityInputButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cityInputButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  cityInputButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  cityInputButtonTextPrimary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
