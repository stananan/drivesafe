/**
 * Keeps a signed-in area honest about whether it should still be on screen.
 *
 * `app/index.tsx` decides where someone belongs, but it only runs when the
 * router passes through "/". Anything that changes underneath a tab — signing
 * out, deleting the account, leaving the family — leaves the tabs mounted over
 * a session that no longer exists, which reads as "it didn't sign me out" even
 * though the session is long gone.
 *
 * Each protected group asks this on every render instead, and redirects the
 * moment its own preconditions stop holding.
 */

import { useSession } from '@/lib/session';

type Guarded = 'parent' | 'child';

export function useRouteGuard(expected: Guarded): string | null {
  const { isLoading, session, profile } = useSession();

  // Still resolving. Redirecting now would bounce a valid session out to the
  // sign-in screen every cold start.
  if (isLoading) return null;

  if (!session) return '/(auth)/sign-in';

  // Signed in, profile not back yet — the auth trigger creates it, so this is a
  // network moment rather than a broken account.
  if (!profile) return null;

  if (!profile.familyId) return '/family-setup';

  // Role changed under us, or this group was entered directly. Let the gate at
  // the root work out where they actually belong.
  if (profile.role !== expected) return '/';

  return null;
}
