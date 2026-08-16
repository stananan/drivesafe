/**
 * Cabin loudness for a drive, kept current.
 *
 * Three sources, in order of how much work they do:
 *
 *   1. One read on mount, so a parent opening a drive late sees the part they
 *      missed rather than an empty graph.
 *   2. A realtime subscription, which carries every new reading within about a
 *      second of it being written. This is the one doing the work.
 *   3. A slow backstop poll, for the case the socket drops without telling us.
 *      Rare enough that a graph frozen until the next tick is acceptable, and
 *      cheap enough to leave running.
 *
 * Realtime here is `postgres_changes` on a table with row-level security, so a
 * subscriber only ever receives rows they could have selected. That is the
 * reason this is a table rather than a broadcast channel: broadcast is not
 * covered by RLS, and a family's drive data should not rely on a channel name
 * being hard to guess.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { listAudioLevels } from '@/lib/drives';
import { getSupabase } from '@/lib/supabase';
import type { AudioLevel } from '@/types/drive';

/** Only fires when realtime has gone quiet, so it can afford to be lazy. */
const BACKSTOP_MS = 20_000;

type LevelRow = {
  recorded_at: string;
  level: number;
};

/**
 * Merges new readings into the series, dropping anything already held.
 *
 * Readings are keyed by their timestamp, which the recording phone stamps once
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

  // Lets the backstop reconcile without re-arming on every new reading.
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  const pull = useCallback(async (id: string) => {
    try {
      const rows = await listAudioLevels(id);
      setLevels((current) => merge(current, rows));
    } catch {
      // Keep whatever is already drawn; realtime or the next tick will catch up.
    }
  }, []);

  // Reset when the drive changes, so one drive's readings never bleed into the
  // next one's graph.
  useEffect(() => {
    setLevels([]);
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

          setLevels((current) =>
            merge(current, [{ t: new Date(row.recorded_at).getTime(), level: row.level }])
          );
        }
      )
      .subscribe();

    const backstop = setInterval(() => void pull(driveId), BACKSTOP_MS);

    return () => {
      cancelled = true;
      clearInterval(backstop);
      void supabase.removeChannel(channel);
    };
  }, [driveId, enabled, pull]);

  return levels;
}
