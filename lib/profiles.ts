import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { apiService } from './api';

export interface ProfileUpdate {
  full_name?: string;
  phone?: string;
  city?: string;
  avatar_url?: string;
}

export interface AgentProfileUpdate {
  bio?: string;
  service_radius_km?: number;
  service_cities?: string[];
}

export interface Category {
  id: string;
  name: string;
  label_pt: string;
  label_en: string;
  icon: string | null;
  description?: string | null;
  description_pt?: string | null;
  description_en?: string | null;
  sort_order: number;
  is_active: boolean;
}

const profilesService = {
  // Update profile
  updateProfile: async (userId: string, updates: ProfileUpdate) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update agent profile
  updateAgentProfile: async (userId: string, updates: AgentProfileUpdate) => {
    const { data, error } = await supabase
      .from('agent_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Upload avatar to Supabase Storage
  uploadAvatar: async (userId: string, imageUri: string): Promise<string> => {
    try {
      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Get file extension and determine content type
      const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const contentType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `${userId}/${Date.now()}.${fileExtension}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, bytes, {
          contentType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  },

  // Pick image from gallery or camera
  pickImage: async (): Promise<string | null> => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to upload an avatar!');
        return null;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return null;
      }

      return result.assets[0]?.uri || null;
    } catch (error) {
      console.error('Error picking image:', error);
      return null;
    }
  },

  // Pick image from camera
  takePhoto: async (): Promise<string | null> => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera permissions to take a photo!');
        return null;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return null;
      }

      return result.assets[0]?.uri || null;
    } catch (error) {
      console.error('Error taking photo:', error);
      return null;
    }
  },

  // Fetch categories: backend API, fallback to Supabase (backend expects UUIDs)
  fetchCategories: async (): Promise<Category[]> => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const fromApi = await apiService.getCategories();
    // Only use API result if it returns real UUIDs; mocks use slugs which cause "invalid uuid" on ticket create
    if (fromApi.length > 0 && uuidRegex.test(fromApi[0].id)) {
      return fromApi.map((c: any, i) => ({
        id: c.id,
        name: c.name,
        label_pt: c.label_pt ?? c.name,
        label_en: c.label_en ?? c.name,
        icon: null,
        description: c.description ?? null,
        description_pt: c.description_pt ?? c.description ?? null,
        description_en: c.description_en ?? c.description ?? null,
        sort_order: i,
        is_active: true,
      }));
    }
    // Fallback: fetch from Supabase (source of truth for UUID category ids)
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, label_pt, label_en, icon, description, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) return [];
    return (data || []).map((c) => ({
      id: c.id,
      name: c.name,
      label_pt: c.label_pt ?? c.name,
      label_en: c.label_en ?? c.name,
      icon: c.icon ?? null,
      description: c.description ?? null,
      description_pt: c.description ?? null,
      description_en: c.description ?? null,
      sort_order: c.sort_order ?? 0,
      is_active: c.is_active ?? true,
    }));
  },

  // Get agent's selected categories
  getAgentCategories: async (agentId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('agent_categories')
      .select('category_id')
      .eq('agent_id', agentId);

    if (error) throw error;
    return data.map((item) => item.category_id);
  },

  // Update agent categories
  updateAgentCategories: async (agentId: string, categoryIds: string[]) => {
    // Delete existing
    await supabase
      .from('agent_categories')
      .delete()
      .eq('agent_id', agentId);

    // Insert new
    if (categoryIds.length > 0) {
      const { error } = await supabase
        .from('agent_categories')
        .insert(
          categoryIds.map((categoryId) => ({
            agent_id: agentId,
            category_id: categoryId,
          }))
        );

      if (error) throw error;
    }
  },

  // Get public profile (for preview)
  getPublicProfile: async (userId: string) => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, city, role')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    if (profile.role === 'agent') {
      const { data: agentProfile, error: agentError } = await supabase
        .from('agent_profiles')
        .select('bio, verification_status, avg_rating, total_reviews, total_jobs_completed')
        .eq('id', userId)
        .single();

      if (agentError) throw agentError;

      const { data: categories } = await supabase
        .from('agent_categories')
        .select('category_id, categories(name, label_pt, label_en, icon)')
        .eq('agent_id', userId);

      return {
        ...profile,
        agentProfile,
        categories: categories || [],
      };
    }

    return profile;
  },
};

export default profilesService;
