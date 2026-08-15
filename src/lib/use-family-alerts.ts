/**
 * Live alerts for a parent, while they have the app open.
 *
 * Subscribes to `drive_events` inserts across the whole table and lets row-level
 * security do the filtering — a parent only ever receives rows they could have
 * selected, which is exactly their own family's drives. That is simpler and
 * safer than trying to express "my family" as a realtime filter, because
 * `drive_events` has no family column to filter on.
 *
 * Only `loud_audio` raises an alert. Every other event type is written in bulk
 * by `finishDrive` when a trip ends, so alerting on those would fire a burst of
 * notifications the moment a drive finished — which is both useless and the
 * fastest way to get a parent to turn notifications off.
 */

import { useCallback, useEffect, useState } from 'react';

import { presentLocalAlert } from '@/lib/notifications';
import { getSupabase } from '@/lib/supabase';

export type FamilyAlert = {
  driveId: string;
  driverName: string;
  detail: string;
  /** Unix epoch milliseconds. */
  at: number;
};

type EventRow = {
  drive_id: string;
  type: string;
  detail: string;
  occurred_at: string;
};

export function useFamilyAlerts({ enabled }: { enabled: boolean }): {
  alert: FamilyAlert | null;
  dismiss: () => void;
} {
  const [alert, setAlert] = useState<FamilyAlert | null>(null);

  const dismiss = useCallback(() => setAlert(null), []);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;

    const channel = supabase
      .channel('family-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'drive_events' },
        (payload) => {
          const row = payload.new as EventRow;
          if (row.type !== 'loud_audio') return;

          void (async () => {
            // The event carries only a drive id, and a parent with more than one
            // driver needs to know which of them it was.
            const { data } = await supabase
              .from('drives')
              .select('profiles!drives_driver_id_fkey(username)')
              .eq('id', row.drive_id)
              .maybeSingle<{ profiles: { username: string } | null }>();

            if (cancelled) return;

            const driverName = data?.profiles?.username ?? 'Your driver';

            setAlert({
              driveId: row.drive_id,
              driverName,
              detail: row.detail,
              at: new Date(row.occurred_at).getTime(),
            });

            await presentLocalAlert(
              `You should call ${driverName}`,
              'It has got loud in the car while they are driving.'
            );
          })();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [enabled]);

  return { alert, dismiss };
}
