/**
 * Supabase client.
 *
 * Created lazily so a missing or malformed `.env.local` surfaces as a readable
 * message in the UI instead of a crash at import time. Call sites use
 * `requireSupabase()` when they cannot proceed without it, and `getSupabase()`
 * when they want to degrade gracefully.
 *
 * See `supabase/schema.sql` for the tables and RPCs these keys reach.
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

export function requireSupabase(): SupabaseClient {
  const supabase = getSupabase();

  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and add your project URL and anon key.'
    );
  }

  return supabase;
}

/**
 * Turns a Postgres or GoTrue error into something worth showing a teenager.
 *
 * The schema raises bare sentinels like `family_not_found` from its RPCs; this
 * is the one place that decides how each of them reads.
 */
export function friendlyAuthError(error: { message?: string } | null | undefined): string {
  const raw = error?.message ?? '';

  if (!raw) return 'Something went wrong. Please try again.';

  const known: Record<string, string> = {
    username_taken: 'That username is already taken.',
    family_not_found: "We couldn't find a family with that code. Check it and try again.",
    only_parents_can_create_families: 'Only a parent account can create a family.',
    not_authenticated: 'Please sign in again.',
  };

  for (const [sentinel, message] of Object.entries(known)) {
    if (raw.includes(sentinel)) return message;
  }

  if (raw.includes('Invalid login credentials')) {
    return 'That email or password is not right.';
  }
  if (raw.includes('already registered') || raw.includes('User already registered')) {
    return 'An account already exists for that email.';
  }
  if (raw.includes('Password should be')) {
    return 'Password must be at least 6 characters.';
  }
  if (raw.toLowerCase().includes('email not confirmed')) {
    return 'Check your inbox and confirm your email address first.';
  }
  if (raw.includes('duplicate key') && raw.includes('username')) {
    return 'That username is already taken.';
  }
  // GoTrue collapses any failure inside the signup trigger into this one
  // message. In practice the only way that trigger fails is a taken username.
  if (raw.includes('Database error saving new user')) {
    return 'That username is already taken. Try a different one.';
  }

  return raw;
}
