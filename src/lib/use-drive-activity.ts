/**
 * Tells a parent the moment a drive starts or ends.
 *
 * Without this the Live tab only learns about a drive on its next poll, so a
 * driver could pull away and sit there for the better part of a minute before
 * anything on their parent's screen acknowledged it. Starting a drive is the
 * single most time-sensitive event in the app — it is the whole reason a parent
 * opens it — so it gets a signal rather than a wait.
 *
 * Subscribes to the whole `drives` table and lets row-level security do the
 * filtering: a parent only ever receives rows for their own family, because
 * those are the only rows they could have selected. Both INSERT and UPDATE
 * matter — the first is a drive beginning, the second is usually it ending.
 */

import { useEffect, useRef } from 'react';

import { getSupabase } from '@/lib/supabase';

export function useDriveActivity({
  enabled,
  onChange,
}: {
  enabled: boolean;
  /** Fired on any drive appearing or changing in the caller's family. */
  onChange: () => void;
}): void {
  // Held in a ref so a caller passing an inline function does not resubscribe
  // on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel('family-drive-activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'drives' },
        () => onChangeRef.current()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drives' },
        () => onChangeRef.current()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled]);
}
