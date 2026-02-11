import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided');
}

// Custom storage adapter that handles large values by splitting across keys
const LargeSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    // Check if value was chunked
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
    if (chunkCount) {
      const count = parseInt(chunkCount, 10);
      const chunks: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (chunk) chunks.push(chunk);
      }
      return chunks.join('');
    }
    // Try reading as a single value (backwards compat)
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    const CHUNK_SIZE = 1800; // Stay under the 2048 limit
    if (value.length <= CHUNK_SIZE) {
      // Small enough - store directly and clean up any old chunks
      await SecureStore.setItemAsync(key, value);
      const oldChunks = await SecureStore.getItemAsync(`${key}_chunks`);
      if (oldChunks) {
        const count = parseInt(oldChunks, 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }
    } else {
      // Split into chunks
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }
      await SecureStore.setItemAsync(`${key}_chunks`, chunks.length.toString());
      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
      }
      // Clean up the old single-value key
      try { await SecureStore.deleteItemAsync(key); } catch {}
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    // Remove single value
    try { await SecureStore.deleteItemAsync(key); } catch {}
    // Remove chunks if any
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
    if (chunkCount) {
      const count = parseInt(chunkCount, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      }
      await SecureStore.deleteItemAsync(`${key}_chunks`);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: LargeSecureStoreAdapter,
    detectSessionInUrl: Platform.OS === 'web',
    persistSession: true,
    autoRefreshToken: true,
  },
});
