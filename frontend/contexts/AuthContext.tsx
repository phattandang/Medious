import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

// Complete any pending auth sessions
WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;

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
  bio?: string;
  followers_count?: number;
  following_count?: number;
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

  // Create redirect URI for OAuth
  const redirectUri = makeRedirectUri({
    scheme: 'medious',
  });

  // Log the redirect URI prominently
  console.log('='.repeat(60));
  console.log('📱 OAUTH REDIRECT URI:', redirectUri);
  console.log('Add this EXACT URL to Supabase > Auth > URL Configuration > Redirect URLs');
  console.log('='.repeat(60));

  // Load stored token on app start
  useEffect(() => {
    loadStoredToken();
    
    // Listen for Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      if (event === 'SIGNED_IN' && session) {
        await syncSupabaseUser(session.user, session.user.app_metadata?.provider || 'google');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadStoredToken = async () => {
    try {
      const storedToken = await storage.getItem('auth_token');
      if (storedToken) {
        setToken(storedToken);
        await verifyToken(storedToken);
        // Ensure Supabase session for Storage access
        await ensureSupabaseSession();
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
          'ngrok-skip-browser-warning': 'true',
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

  // Ensure user has a Supabase session for Storage access
  const ensureSupabaseSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Sign in anonymously to get a valid session for Storage
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.warn('Failed to create anonymous Supabase session:', error.message);
      } else {
        console.log('Created anonymous Supabase session for Storage access');
      }
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log('Attempting registration to:', `${BACKEND_URL}/api/auth/register`);
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let error;
        if (contentType && contentType.includes('application/json')) {
          error = await response.json();
          throw new Error(error.detail || 'Registration failed');
        } else {
          const text = await response.text();
          console.error('Non-JSON response:', text);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid server response format');
      }

      const data = await response.json();
      await saveAuthData(data.token, data.user);

      // Ensure Supabase session for Storage access
      await ensureSupabaseSession();
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Registration failed');
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting login to:', `${BACKEND_URL}/api/auth/login`);
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let error;
        if (contentType && contentType.includes('application/json')) {
          error = await response.json();
          throw new Error(error.detail || 'Login failed');
        } else {
          const text = await response.text();
          console.error('Non-JSON response:', text);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid server response format');
      }

      const data = await response.json();
      await saveAuthData(data.token, data.user);

      // Ensure Supabase session for Storage access
      await ensureSupabaseSession();
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('🔑 Starting Google OAuth...');
      console.log('📱 Redirect URI:', redirectUri);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        console.error('❌ Supabase OAuth error:', error);
        throw new Error(
          'Google OAuth is not configured. Please enable Google provider in Supabase Dashboard > Authentication > Providers > Google.'
        );
      }

      if (!data?.url) {
        throw new Error('Failed to generate OAuth URL. Is Google provider enabled in Supabase?');
      }

      console.log('🌐 Opening OAuth URL:', data.url);

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri,
        { showInRecents: true }
      );

      console.log('📲 WebBrowser result:', result.type);

      if (result.type === 'success' && result.url) {
        console.log('✅ OAuth callback received, URL:', result.url);

        // Parse tokens - handle both hash fragment (#) and query params (?)
        const callbackUrl = new URL(result.url);
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        // Try hash fragment first (implicit flow)
        if (callbackUrl.hash) {
          const hashParams = new URLSearchParams(callbackUrl.hash.slice(1));
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
        }

        // Try query params (PKCE flow returns code)
        if (!accessToken) {
          const code = callbackUrl.searchParams.get('code');
          if (code) {
            console.log('🔄 Exchanging PKCE code for session...');
            const { data: sessionData, error: sessionError } =
              await supabase.auth.exchangeCodeForSession(code);

            if (sessionError) {
              console.error('❌ Code exchange error:', sessionError);
              throw sessionError;
            }

            if (sessionData.user) {
              console.log('👤 Syncing user to backend...');
              await syncSupabaseUser(sessionData.user, 'google');
            }
            return;
          }
        }

        if (accessToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            console.error('❌ Session error:', sessionError);
            throw sessionError;
          }

          if (sessionData.user) {
            console.log('👤 Syncing user to backend...');
            await syncSupabaseUser(sessionData.user, 'google');
          }
        } else {
          console.error('❌ No access token or code in callback URL');
          throw new Error('Authentication failed - no credentials received');
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Google sign-in was cancelled');
      }
    } catch (error: any) {
      console.error('❌ Google sign-in error:', error);
      throw new Error(error.message || 'Google sign-in failed');
    }
  };

  const signInWithApple = async () => {
    try {
      console.log('🍎 Starting Apple OAuth...');
      console.log('📱 Redirect URI:', redirectUri);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('❌ Supabase Apple OAuth error:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('Failed to generate Apple OAuth URL.');
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri,
        { showInRecents: true }
      );

      if (result.type === 'success' && result.url) {
        const callbackUrl = new URL(result.url);
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        if (callbackUrl.hash) {
          const hashParams = new URLSearchParams(callbackUrl.hash.slice(1));
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
        }

        if (!accessToken) {
          const code = callbackUrl.searchParams.get('code');
          if (code) {
            const { data: sessionData, error: sessionError } =
              await supabase.auth.exchangeCodeForSession(code);
            if (sessionError) throw sessionError;
            if (sessionData.user) {
              await syncSupabaseUser(sessionData.user, 'apple');
            }
            return;
          }
        }

        if (accessToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          if (sessionError) throw sessionError;
          if (sessionData.user) {
            await syncSupabaseUser(sessionData.user, 'apple');
          }
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Apple sign-in was cancelled');
      }
    } catch (error: any) {
      console.error('❌ Apple sign-in error:', error);
      throw new Error(error.message || 'Apple sign-in failed');
    }
  };

  const syncSupabaseUser = async (supabaseUser: any, provider: string) => {
    try {
      console.log('Syncing user to backend:', supabaseUser.email);
      const response = await fetch(`${BACKEND_URL}/api/auth/supabase-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          supabase_user_id: supabaseUser.id,
          email: supabaseUser.email,
          auth_provider: provider,
          name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
          avatar: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to sync user');
        } else {
          throw new Error(`Server error: ${response.statusText}`);
        }
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid server response format');
      }

      const data = await response.json();
      await saveAuthData(data.token, data.user);
    } catch (error: any) {
      console.error('User sync error:', error);
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
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to send reset email');
        } else {
          throw new Error(`Server error: ${response.statusText}`);
        }
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
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ email, reset_token: resetToken, new_password: newPassword }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let error;
        if (contentType && contentType.includes('application/json')) {
          error = await response.json();
          throw new Error(error.detail || 'Password reset failed');
        } else {
          throw new Error(`Server error: ${response.statusText}`);
        }
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
