import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.backendUrl;

// Platform-specific storage
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

interface User {
  id: string;
  email: string;
  name: string;
  auth_provider: string;
  avatar?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, resetToken: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load stored token on app start
  useEffect(() => {
    loadStoredToken();
  }, []);

  const loadStoredToken = async () => {
    try {
      const storedToken = await storage.getItem('auth_token');
      if (storedToken) {
        setToken(storedToken);
        await verifyToken(storedToken);
      }
    } catch (error) {
      console.error('Error loading token:', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async (authToken: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        await signOut();
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      await signOut();
    }
  };

  const saveAuthData = async (authToken: string, userData: User) => {
    await storage.setItem('auth_token', authToken);
    setToken(authToken);
    setUser(userData);
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const data = await response.json();
      await saveAuthData(data.token, data.user);
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      await saveAuthData(data.token, data.user);
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });

      if (error) throw error;

      // Listen for auth state change
      const { data: authData } = await supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await syncSupabaseUser(session.user, 'google');
        }
      });
    } catch (error: any) {
      throw new Error(error.message || 'Google sign-in failed');
    }
  };

  const signInWithApple = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
      });

      if (error) throw error;

      // Listen for auth state change
      const { data: authData } = await supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await syncSupabaseUser(session.user, 'apple');
        }
      });
    } catch (error: any) {
      throw new Error(error.message || 'Apple sign-in failed');
    }
  };

  const syncSupabaseUser = async (supabaseUser: any, provider: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/supabase-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supabase_user_id: supabaseUser.id,
          email: supabaseUser.email,
          auth_provider: provider,
          name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0],
          avatar: supabaseUser.user_metadata?.avatar_url,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync user');
      }

      const data = await response.json();
      await saveAuthData(data.token, data.user);
    } catch (error: any) {
      throw new Error(error.message || 'User sync failed');
    }
  };

  const signOut = async () => {
    try {
      await storage.removeItem('auth_token');
      await supabase.auth.signOut();
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reset email');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Password reset failed');
    }
  };

  const resetPassword = async (email: string, resetToken: string, newPassword: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, reset_token: resetToken, new_password: newPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Password reset failed');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Password reset failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithApple,
        signOut,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
