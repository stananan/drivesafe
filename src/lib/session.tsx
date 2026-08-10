/**
 * Who is signed in, what their role is, and which family they belong to.
 *
 * This is the single source of truth the router gates on. It answers three
 * questions in order, and the app shows a different surface for each:
 *   1. Is anyone signed in?          -> no: auth screens
 *   2. Do they belong to a family?   -> no: create/join screen
 *   3. Parent or child?              -> route to that interface
 */

import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { friendlyAuthError, getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Family, Profile, Role } from '@/types/drive';

type SessionValue = {
  /** True until the stored session and profile have been resolved. */
  isLoading: boolean;
  /** Null when signed out. */
  session: Session | null;
  profile: Profile | null;
  family: Family | null;
  /** Set when the environment has no Supabase keys at all. */
  configError: string | null;

  signUp: (input: {
    email: string;
    password: string;
    username: string;
    role: Role;
  }) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signIn: (input: { email: string; password: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;

  createFamily: (name: string) => Promise<{ error: string | null }>;
  joinFamily: (code: string) => Promise<{ error: string | null }>;
  leaveFamily: () => Promise<{ error: string | null }>;

  /** Re-reads the profile and family, e.g. after another device changes them. */
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

type ProfileRow = {
  id: string;
  username: string;
  role: Role;
  family_id: string | null;
};

type FamilyRow = {
  id: string;
  name: string;
  code: string;
  created_by: string;
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    familyId: row.family_id,
  };
}

function toFamily(row: FamilyRow): Family {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    createdBy: row.created_by,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const configError = isSupabaseConfigured
    ? null
    : 'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.';

  // Guards against a slow profile fetch resolving after sign-out and
  // resurrecting a stale profile.
  const loadToken = useRef(0);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    const supabase = getSupabase();
    const token = ++loadToken.current;

    if (!supabase || !userId) {
      setProfile(null);
      setFamily(null);
      return;
    }

    const { data: profileRow, error } = await supabase
      .from('profiles')
      .select('id, username, role, family_id')
      .eq('id', userId)
      .maybeSingle<ProfileRow>();

    if (token !== loadToken.current) return;

    if (error || !profileRow) {
      setProfile(null);
      setFamily(null);
      return;
    }

    setProfile(toProfile(profileRow));

    if (!profileRow.family_id) {
      setFamily(null);
      return;
    }

    const { data: familyRow } = await supabase
      .from('families')
      .select('id, name, code, created_by')
      .eq('id', profileRow.family_id)
      .maybeSingle<FamilyRow>();

    if (token !== loadToken.current) return;

    setFamily(familyRow ? toFamily(familyRow) : null);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadProfile(data.session?.user.id);
      })
      .catch(() => {
        // Offline or unreachable: fall through to the signed-out state.
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadProfile(nextSession?.user.id);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback<SessionValue['signUp']>(
    async ({ email, password, username, role }) => {
      const supabase = getSupabase();
      if (!supabase) return { error: configError, needsEmailConfirmation: false };

      // Checked up front because the database trigger can only report this as
      // an opaque "Database error saving new user" once signup is underway.
      const { data: isAvailable, error: checkError } = await supabase.rpc('username_available', {
        candidate: username.trim(),
      });

      if (!checkError && isAvailable === false) {
        return { error: 'That username is already taken.', needsEmailConfirmation: false };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // The `on_auth_user_created` trigger reads these to build the profile row.
        options: { data: { username: username.trim(), role } },
      });

      if (error) return { error: friendlyAuthError(error), needsEmailConfirmation: false };

      // With email confirmation switched on, Supabase returns a user but no
      // session — there is nothing to route to until they click the link.
      if (!data.session) return { error: null, needsEmailConfirmation: true };

      await loadProfile(data.session.user.id);
      return { error: null, needsEmailConfirmation: false };
    },
    [configError, loadProfile]
  );

  const signIn = useCallback<SessionValue['signIn']>(
    async ({ email, password }) => {
      const supabase = getSupabase();
      if (!supabase) return { error: configError };

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) return { error: friendlyAuthError(error) };

      await loadProfile(data.session?.user.id);
      return { error: null };
    },
    [configError, loadProfile]
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    loadToken.current++;

    setProfile(null);
    setFamily(null);
    setSession(null);

    await supabase?.auth.signOut();
  }, []);

  const createFamily = useCallback<SessionValue['createFamily']>(
    async (name) => {
      const supabase = getSupabase();
      if (!supabase) return { error: configError };

      const { error } = await supabase.rpc('create_family', { family_name: name.trim() });
      if (error) return { error: friendlyAuthError(error) };

      await loadProfile(session?.user.id);
      return { error: null };
    },
    [configError, loadProfile, session]
  );

  const joinFamily = useCallback<SessionValue['joinFamily']>(
    async (code) => {
      const supabase = getSupabase();
      if (!supabase) return { error: configError };

      const { error } = await supabase.rpc('join_family', {
        family_code: code.trim().toUpperCase(),
      });
      if (error) return { error: friendlyAuthError(error) };

      await loadProfile(session?.user.id);
      return { error: null };
    },
    [configError, loadProfile, session]
  );

  const leaveFamily = useCallback<SessionValue['leaveFamily']>(async () => {
    const supabase = getSupabase();
    if (!supabase) return { error: configError };

    const { error } = await supabase.rpc('leave_family');
    if (error) return { error: friendlyAuthError(error) };

    await loadProfile(session?.user.id);
    return { error: null };
  }, [configError, loadProfile, session]);

  const refresh = useCallback(async () => {
    await loadProfile(session?.user.id);
  }, [loadProfile, session]);

  const value = useMemo<SessionValue>(
    () => ({
      isLoading,
      session,
      profile,
      family,
      configError,
      signUp,
      signIn,
      signOut,
      createFamily,
      joinFamily,
      leaveFamily,
      refresh,
    }),
    [
      isLoading,
      session,
      profile,
      family,
      configError,
      signUp,
      signIn,
      signOut,
      createFamily,
      joinFamily,
      leaveFamily,
      refresh,
    ]
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside a <SessionProvider>');
  return value;
}
