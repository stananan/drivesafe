/**
 * Supabase client.
 *
 * The client is created lazily so that a missing or malformed `.env` can never
 * take down app startup — screens call `getSupabase()` and handle `null` by
 * falling back to local demo data. Once you drop real credentials into
 * `.env.local`, every call site starts hitting the real database with no code
 * changes.
 *
 * See `supabase/schema.sql` for the tables these keys are expected to reach.
 */

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when both env vars are present, so the UI can show a setup hint. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (client) return client;

  client = createClient(url!, anonKey!, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // React Native has no URL bar for Supabase to parse a session out of.
      detectSessionInUrl: false,
    },
  });

  return client;
}
