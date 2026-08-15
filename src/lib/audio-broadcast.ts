/**
 * Streams the cabin loudness reading from a driver's phone to whoever is
 * watching their drive.
 *
 * Uses a Supabase Realtime *broadcast* channel rather than the database. These
 * readings are only interesting while they are happening — a parent watching a
 * live drive wants the last minute, and nobody wants the minute before that.
 * Broadcast is ephemeral by construction, so nothing is written down, which
 * also keeps the promise that DriveSafe stores no audio-derived history beyond
 * the alerts themselves.
 *
 * The channel is named for the drive id, which is a uuid only visible to that
 * family through row-level security. That is obscurity rather than enforcement:
 * broadcast channels are not RLS-protected, so anyone who learned a drive id
 * could subscribe. Tightening this means Realtime Authorization policies — see
 * TODO.md.
 */

import { useEffect, useRef, useState } from 'react';

import { getSupabase } from '@/lib/supabase';

/** One reading a second is plenty for a graph, and 1/25th the message volume. */
const SEND_INTERVAL_MS = 1_000;

/** Roughly the last minute at the send rate above. */
const FEED_SAMPLES = 60;

function channelName(driveId: string): string {
  return `drive-audio-${driveId}`;
}

/**
 * Driver side: publishes the current level on a timer.
 *
 * Takes the level through a ref rather than as a dependency so a reading
 * arriving every 400 ms does not tear the channel down and rebuild it.
 */
export function useAudioLevelBroadcast({
  driveId,
  level,
  enabled,
}: {
  driveId: string | null;
  level: number | null;
  enabled: boolean;
}): void {
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    if (!enabled || !driveId) return;

    const supabase = getSupabase();
    if (!supabase) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const channel = supabase.channel(channelName(driveId));

    channel.subscribe((status) => {
      // Sending before the socket is joined silently drops the message.
      if (status !== 'SUBSCRIBED' || timer) return;

      timer = setInterval(() => {
        if (levelRef.current === null) return;

        void channel.send({
          type: 'broadcast',
          event: 'level',
          payload: { level: levelRef.current, at: Date.now() },
        });
      }, SEND_INTERVAL_MS);
    });

    return () => {
      if (timer) clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [driveId, enabled]);
}

/**
 * Parent side: collects recent levels into a rolling window for the graph.
 *
 * Returns an empty array when the driver is not broadcasting — which is the
 * normal state whenever audio alerts are off, so callers should treat "empty"
 * as "nothing to show", not as an error.
 */
export function useAudioLevelFeed({
  driveId,
  enabled,
}: {
  driveId: string | null;
  enabled: boolean;
}): number[] {
  const [levels, setLevels] = useState<number[]>([]);

  useEffect(() => {
    if (!enabled || !driveId) {
      setLevels([]);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(channelName(driveId))
      .on('broadcast', { event: 'level' }, (message) => {
        const next = (message.payload as { level?: number } | undefined)?.level;
        if (typeof next !== 'number') return;

        setLevels((history) =>
          history.length < FEED_SAMPLES
            ? [...history, next]
            : [...history.slice(history.length - FEED_SAMPLES + 1), next]
        );
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driveId, enabled]);

  return levels;
}
