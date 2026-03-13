/**
 * Entrevoz Supabase Client
 *
 * Supabase client for realtime communication and data persistence.
 *
 * @version 2.0.0
 */

import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// Entrevoz Supabase project
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://zeqzygfxcmaettmbkusr.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcXp5Z2Z4Y21hZXR0bWJrdXNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NjQxODQsImV4cCI6MjA4ODQ0MDE4NH0.8p-h6iXs9mrADuc83qbc_XqwuNxxC41BGO431mAohrk";

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE ADAPTER (Platform-specific)
// ═══════════════════════════════════════════════════════════════════════════════

const getStorage = () => {
  if (Platform.OS === "web") {
    // Web: use localStorage
    return {
      getItem: (key: string) => {
        if (typeof window !== "undefined") {
          return Promise.resolve(window.localStorage.getItem(key));
        }
        return Promise.resolve(null);
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, value);
        }
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(key);
        }
        return Promise.resolve();
      },
    };
  }
  // Native: use AsyncStorage
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AsyncStorage =
    require("@react-native-async-storage/async-storage").default;
  return AsyncStorage;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT CREATION
// ═══════════════════════════════════════════════════════════════════════════════

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default supabase;
