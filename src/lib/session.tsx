/**
 * Who is holding the phone.
 *
 * DriveSafe ships one binary with two very different interfaces, so the chosen
 * role is the first thing the app resolves and the last thing it forgets. It is
 * persisted locally; when Supabase auth lands, the role moves onto the user
 * profile row and this provider reads it from the session instead.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';

import type { Role } from '@/types/drive';

const STORAGE_KEY = 'drivesafe.role';

type SessionValue = {
  /** `null` once loaded means "no role chosen yet" — show the welcome screen. */
  role: Role | null;
  /** True until the persisted role has been read off disk. */
  isLoading: boolean;
  setRole: (role: Role) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'parent' || stored === 'teen') setRoleState(stored);
      })
      .catch(() => {
        // A read failure just means we show the welcome screen again.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setRole = useCallback(async (next: Role) => {
    setRoleState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const signOut = useCallback(async () => {
    setRoleState(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ role, isLoading, setRole, signOut }),
    [role, isLoading, setRole, signOut]
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside a <SessionProvider>');
  return value;
}
