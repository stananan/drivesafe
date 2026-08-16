/**
 * Cabin loudness for a drive, kept current.
 *
 * Two sources, deliberately overlapping:
 *
 *   1. A realtime subscription, which delivers each reading within about a
 *      second of it being written.
 *   2. A short incremental poll, asking only for readings newer than the last
 *      one held.
 *
 * The poll is not a fallback bolted on for safety — it is what guarantees the
 * graph moves. Realtime on this table depends on `drive_audio_levels` being in
 * the `supabase_realtime` publication, and a project that has not re-run
 * `supabase/schema.sql` since that was added will silently receive nothing. A
 * graph that stutters forward every twenty seconds is indistinguishable from a
 * broken feature, so the poll is fast enough to carry the whole load alone and
 * realtime simply makes it smoother.
 *
 * Asking only for what is new is what makes that affordable. Re-reading the
 * whole series every second would get slower as the drive got longer, which is
 * the opposite of what a live view needs.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { listAudioLevels } from '@/lib/drives';
import { getSupabase } from '@/lib/supabase';
import type { AudioLevel } from '@/types/drive';

/** Fast enough to look continuous at two readings a second. */
const POLL_MS = 1_500;

type LevelRow = {
  recorded_at: string;
  level: number;
};

/**
 * Merges new readings into the series, dropping anything already held.
 *
 * Readings are keyed by their timestamp, which the recording phone stamps twice
 * a second — close enough to unique that a collision would need two readings in
 * the same millisecond, and harmless if one ever happened.
 */
function merge(existing: AudioLevel[], incoming: AudioLevel[]): AudioLevel[] {
  if (incoming.length === 0) return existing;

  const seen = new Set(existing.map((sample) => sample.t));
  const fresh = incoming.filter((sample) => !seen.has(sample.t));

  if (fresh.length === 0) return existing;

  return [...existing, ...fresh].sort((a, b) => a.t - b.t);
}

export function useLiveAudioLevels({
  driveId,
  enabled,
}: {
  driveId: string | null;
  /** Set false once a drive has ended; the series stops changing at that point. */
  enabled: boolean;
}): AudioLevel[] {
  const [levels, setLevels] = useState<AudioLevel[]>([]);

  // Newest timestamp held, so each poll asks only for what it does not have.
  const latestAt = useRef(0);

  const pull = useCallback(async (id: string) => {
    try {
      const rows = await listAudioLevels(id, latestAt.current || undefined);
      if (rows.length === 0) return;

      latestAt.current = Math.max(latestAt.current, rows[rows.length - 1].t);
      setLevels((current) => merge(current, rows));
    } catch {
      // Keep whatever is already drawn; the next tick tries again.
    }
  }, []);

  // Reset when the drive changes, so one drive's readings never bleed into the
  // next one's graph.
  useEffect(() => {
    setLevels([]);
    latestAt.current = 0;
  }, [driveId]);

  useEffect(() => {
    if (!driveId || !enabled) return;

    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;

    void pull(driveId);

    const channel = supabase
      .channel(`drive-audio-${driveId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'drive_audio_levels',
          filter: `drive_id=eq.${driveId}`,
        },
        (payload) => {
          if (cancelled) return;

          const row = payload.new as LevelRow;
          if (typeof row?.level !== 'number') return;

          const sample = { t: new Date(row.recorded_at).getTime(), level: row.level };
          latestAt.current = Math.max(latestAt.current, sample.t);
          setLevels((current) => merge(current, [sample]));
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn(
            'Realtime unavailable for drive_audio_levels — falling back to polling. Re-run supabase/schema.sql if this persists.'
          );
        }
      });

    const timer = setInterval(() => void pull(driveId), POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [driveId, enabled, pull]);

  return levels;
}
