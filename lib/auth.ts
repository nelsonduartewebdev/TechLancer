import { supabase } from './supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { apiService } from './api';

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

/** Response shape from Railway API POST /api/auth/login (when it returns Supabase tokens) */
interface ApiLoginResponse {
  access_token?: string;
  refresh_token?: string;
  token?: string;
  user?: User;
  session?: Session;
}

export interface SignUpOptions {
  email: string;
  password: string;
  full_name: string;
  role: 'client' | 'agent';
  date_of_birth?: string;
}

export const authService = {
  // Sign up with email and password
  signUp: async (options: SignUpOptions): Promise<AuthResponse> => {
    console.log('[authService] signUp called', { email: options.email, role: options.role });
    const { data, error } = await supabase.auth.signUp({
      email: options.email,
      password: options.password,
      options: {
        data: {
          full_name: options.full_name,
          role: options.role,
          date_of_birth: options.date_of_birth,
        },
      },
    });
    if (error) {
      console.log('[authService] signUp error:', error.message, error);
    } else {
      console.log('[authService] signUp success:', { userId: data.user?.id, session: !!data.session });
    }
    return {
      user: data.user,
      session: data.session,
      error,
    };
  },


  /**
   * Sign in via Railway API (POST /api/auth/login), then set Supabase session if backend returns tokens.
   * Use this so the app uses the same auth as Swagger and gets a consistent 200.
   */
  signInWithApi: async (email: string, password: string): Promise<AuthResponse> => {
    try {
      console.log('[authService] signInWithApi called', { email });
      const data = (await apiService.login({ email, password })) as ApiLoginResponse;
      console.log('[authService] apiService.login response:', data);

      // Use top-level tokens or tokens nested under session (backend may return either)
      const accessToken =
        data.access_token ?? data.token ?? data.session?.access_token;
      const refreshToken = data.refresh_token ?? data.session?.refresh_token;

      if (accessToken && refreshToken) {
        console.log('[authService] Got accessToken and refreshToken from API. Setting Supabase session.');
        const { data: sessionData, error: setError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setError) {
          console.log('[authService] supabase.auth.setSession error:', setError);
          return { user: null, session: null, error: setError };
        }
        console.log('[authService] supabase.auth.setSession success:', sessionData);
        return {
          user: sessionData.user,
          session: sessionData.session,
          error: null,
        };
      }

      if (data.user && data.session) {
        console.log('[authService] Received user and session directly from API response (no tokens to set).');
        return { user: data.user, session: data.session, error: null };
      }

      console.log('[authService] Returning API user/session fallback:', {
        user: data.user ?? null,
        session: data.session ?? null,
      });
      return {
        user: data.user ?? null,
        session: data.session ?? null,
        error: null,
      };
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? 'Login failed';
      console.log('[authService] signInWithApi error:', message, err);
      return {
        user: null,
        session: null,
        error: { message, name: 'AuthApiError', status: err?.status } as AuthError,
      };
    }
  },

  // Sign out
  signOut: async (): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Get current session
  getSession: async (): Promise<Session | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  // Get current user
  getCurrentUser: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // Listen to auth state changes
  onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  },

  // Reset password
  resetPassword: async (email: string): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  },

  // Update password
  updatePassword: async (newPassword: string): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  },

  // Sign in with OAuth (Google, Apple)
  signInWithOAuth: async (provider: 'google' | 'apple'): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL || 'techlancer://auth/callback'}`,
      },
    });
    return { error };
  },
};
