import { supabase } from './supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

export const authService = {
  // Sign up with email and password
  signUp: async (email: string, password: string): Promise<AuthResponse> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return {
      user: data.user,
      session: data.session,
      error,
    };
  },

  // Sign in with email and password
  signIn: async (email: string, password: string): Promise<AuthResponse> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return {
      user: data.user,
      session: data.session,
      error,
    };
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
};
