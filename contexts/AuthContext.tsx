import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { apiService } from '../lib/api';

// Types for profile data
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  date_of_birth: string | null;
  role: 'client' | 'agent';
  is_active: boolean;
  city: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface AgentProfile {
  id: string;
  bio: string | null;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  verified_at: string | null;
  service_radius_km: number;
  service_cities: string[] | null;
  subscription_tier: 'free' | 'pro';
  subscription_expires_at: string | null;
  highlight_credits: number;
  avg_rating: number;
  total_reviews: number;
  total_jobs_completed: number;
  total_earnings: number;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  agentProfile: AgentProfile | null;
  role: 'client' | 'agent' | null;
  loading: boolean;
  initialized: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Fetch current user profile from backend GET /profiles/:id (Bearer token)
  const fetchProfile = async (userId: string) => {
    try {
      const data = await apiService.getProfile<Record<string, any>>(userId);
      if (data && typeof data === 'object') {
        // Support both { profile, agent_profile } or flat profile object
        const profileData = data.profile ?? data;
        const agentData = data.agent_profile ?? profileData.agent_profile ?? null;
        setProfile(profileData as Profile);
        setAgentProfile((agentData ?? null) as AgentProfile | null);
      } else {
        setProfile(null);
        setAgentProfile(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      setAgentProfile(null);
    }
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initializeAuth = async () => {
      setLoading(true);

      // Get current session from Supabase (persisted via AsyncStorage)
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (mounted) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        }
      }

      // Listen to auth state changes
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          if (!mounted) return;

          console.log('Auth state changed:', event);
          
          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user) {
            await fetchProfile(newSession.user.id);
          } else {
            setProfile(null);
            setAgentProfile(null);
          }

          // Mark as initialized after first auth state change
          if (mounted) {
            setInitialized(true);
            setLoading(false);
          }
        }
      );

      subscription = authSubscription;

      if (mounted) {
        setInitialized(true);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Handle token refresh (Supabase does this automatically, but we update our state)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession && currentSession !== session) {
        setSession(currentSession);
      }
    };

    // Check session every 5 minutes to catch token refreshes
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [session]);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setSession(null);
      setUser(null);
      setProfile(null);
      setAgentProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    agentProfile,
    role: profile?.role ?? null,
    loading,
    initialized,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
