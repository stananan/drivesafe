/**
 * The rolling dashcam.
 *
 * Nothing available to an Expo app can join video files, so a clip is however
 * many pieces it was recorded in. That constraint drives the whole design.
 *
 * So the camera runs a single recording at a time. Saving stops that recording
 * and keeps the file — everything it has captured since it started, up to
 * `SEGMENT_MAX_SECONDS`.
 *
 * The case that needs care is a save arriving moments after a recording began,
 * when there is barely any footage in the current file. This used to be handled
 * by sleeping until the recording was long enough, which meant a driver could
 * ask for a clip and watch a spinner for the better part of twenty seconds —
 * and the footage they actually wanted, the seconds *before* they asked, had
 * already been thrown away with the previous file.
 *
 * So the previous segment is now kept rather than deleted, and a short save
 * hands back both files as an ordered pair. The clip is two parts instead of
 * one, which the database, the uploader and the player have all supported from
 * the start. Nothing waits, and the moment before the save is in the clip —
 * which for a dashcam is the whole point.
 *
 * The cost is one extra file on disk: at any moment the dashcam holds the
 * recording in progress and the one before it, and nothing older.
 *
 * Video records with sound when the caller says it can. Whether a phone will
 * give the microphone to the camera and the loudness monitor at once is an open
 * question, so `audioEnabled` can be flipped off after a failure: changing it
 * restarts the loop, and the retry runs muted.
 */

import { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Below this, a saved recording is too short to be worth keeping on its own and
 * the segment before it is sent along with it.
 */
export const CLIP_MIN_SECONDS = 20;

/**
 * And never longer than this. The cap exists so a recording cannot grow to the
 * length of the whole drive — at 720p that would be hundreds of megabytes for a
 * single save, against a free storage tier of one gigabyte.
 *
 * Halved from forty when saving stopped waiting. A save now uploads the segment
 * before it as well as the current one, so the cap is not just the longest a
 * recording runs, it is also the size of the history carried along with every
 * clip. Twenty keeps a saved clip at roughly the twenty to forty seconds the
 * app promises while keeping any single upload small enough to finish on a
 * phone connection.
 */
const SEGMENT_MAX_SECONDS = 20;

export type DashcamStatus = 'idle' | 'starting' | 'recording' | 'error';

export type DashcamSegment = {
  uri: string;
  /** Unix epoch milliseconds. */
  startedAt: number;
  durationSeconds: number;
};

export type Dashcam = {
  status: DashcamStatus;
  /** Attach to the `<CameraView>` this hook drives. */
  cameraRef: React.RefObject<CameraView | null>;
  /** Seconds the current recording has been running. */
  bufferedSeconds: number;
  errorMessage: string | null;
  /**
   * Ends the current recording and hands back what it captured, oldest first.
   * Returns two segments when the recording was too short to stand alone, one
   * when it was long enough, and none when there was nothing recording.
   *
   * Never waits. Whatever is on disk at the moment of the call is the clip.
   */
  flush: () => Promise<DashcamSegment[]>;
  /** Deletes segments once the caller is done with them. */
  release: (segments: DashcamSegment[]) => void;
};

function discard(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A file left in the cache is not worth failing a drive over; the OS clears
    // that directory on its own schedule.
  }
}

export function useDashcam({
  enabled,
  audioEnabled,
}: {
  enabled: boolean;
  /**
   * Whether the caller's `<CameraView>` is currently unmuted. Not used to
   * configure anything here — `mute` is a view prop, not a recording option —
   * but changing it restarts the loop, which is what makes the fallback work.
   */
  audioEnabled: boolean;
}): Dashcam {
  const cameraRef = useRef<CameraView | null>(null);

  const [status, setStatus] = useState<DashcamStatus>('idle');
  const [bufferedSeconds, setBufferedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** When the recording currently running began. Null between recordings. */
  const startedAt = useRef<number | null>(null);

  /**
   * The last completed recording, held rather than deleted.
   *
   * This is the trailing history: when a save lands early in a new recording,
   * this file is what actually contains the moment the driver is asking for.
   * Exactly one is kept, and it is discarded as soon as the next recording
   * finishes and takes its place.
   */
  const previous = useRef<DashcamSegment | null>(null);

  /** Set while a flush waits for the current recording to be handed over. */
  const pendingSave = useRef<((segments: DashcamSegment[]) => void) | null>(null);

  const release = useCallback((segments: DashcamSegment[]) => {
    for (const segment of segments) discard(segment.uri);
  }, []);

  const flush = useCallback(async (): Promise<DashcamSegment[]> => {
    if (status !== 'recording' || !cameraRef.current || startedAt.current === null) {
      return [];
    }

    // No waiting. Stopping the recording is the whole of it — the loop decides
    // below whether the previous segment needs to go with it.
    return new Promise<DashcamSegment[]>((resolve) => {
      pendingSave.current = resolve;

      try {
        cameraRef.current?.stopRecording();
      } catch {
        pendingSave.current = null;
        resolve([]);
        return;
      }

      // Never leave a caller waiting on a camera that failed to stop.
      setTimeout(() => {
        if (pendingSave.current === resolve) {
          pendingSave.current = null;
          resolve([]);
        }
      }, 5_000);
    });
  }, [status]);

  // Ticks the "how much is held" readout, so the recording loop does not have
  // to re-render once a second on its own account.
  useEffect(() => {
    if (status !== 'recording') {
      setBufferedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      if (startedAt.current === null) return;

      setBufferedSeconds(
        Math.min(SEGMENT_MAX_SECONDS, Math.round((Date.now() - startedAt.current) / 1000))
      );
    }, 1_000);

    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    let activeCamera: CameraView | null = null;

    async function loop() {
      setStatus('starting');
      setErrorMessage(null);

      // The camera needs a moment after mount before it will accept a
      // recording; starting immediately fails on both platforms.
      await new Promise((resolve) => setTimeout(resolve, 600));

      while (!cancelled) {
        const camera = cameraRef.current;
        if (!camera) break;

        activeCamera = camera;
        const began = Date.now();
        startedAt.current = began;

        try {
          setStatus('recording');

          const result = await camera.recordAsync({ maxDuration: SEGMENT_MAX_SECONDS });

          startedAt.current = null;

          if (cancelled) {
            if (result?.uri) discard(result.uri);
            break;
          }

          const waiting = pendingSave.current;

          if (waiting && result?.uri) {
            const current: DashcamSegment = {
              uri: result.uri,
              startedAt: began,
              durationSeconds: (Date.now() - began) / 1000,
            };

            // A recording that stopped early has little in it, and what the
            // driver asked for is in the file before it. Send both, oldest
            // first, and let the clip be two parts.
            const tooShort = current.durationSeconds < CLIP_MIN_SECONDS;
            const segments =
              tooShort && previous.current ? [previous.current, current] : [current];

            // Anything not handed over stays ours to delete. Ownership of what
            // is handed over passes to the caller, who calls release().
            if (previous.current && !segments.includes(previous.current)) {
              discard(previous.current.uri);
            }
            previous.current = null;

            pendingSave.current = null;
            waiting(segments);
          } else if (result?.uri) {
            // Nobody wanted it, so it becomes the trailing history and the file
            // it replaces is deleted. One segment of storage, not an hour of it.
            if (previous.current) discard(previous.current.uri);

            previous.current = {
              uri: result.uri,
              startedAt: began,
              durationSeconds: (Date.now() - began) / 1000,
            };
          }
        } catch (error) {
          startedAt.current = null;

          if (cancelled) break;

          // A save waiting on a recording that just failed must not hang. The
          // previous segment is still good footage, so hand that over rather
          // than nothing at all.
          const waiting = pendingSave.current;
          if (waiting) {
            const salvage = previous.current ? [previous.current] : [];
            previous.current = null;
            pendingSave.current = null;
            waiting(salvage);
          }

          setStatus('error');
          setErrorMessage(
            error instanceof Error ? error.message : 'The dashcam stopped recording.'
          );
          break;
        }
      }
    }

    void loop();

    return () => {
      cancelled = true;
      startedAt.current = null;

      // The trailing file is only useful while the dashcam is running. Leaving
      // it behind would put a stray recording in the cache for every drive.
      if (previous.current) discard(previous.current.uri);
      previous.current = null;

      try {
        activeCamera?.stopRecording();
      } catch {
        // Already stopped, or the view is gone.
      }
    };
  }, [enabled, audioEnabled]);

  return { status, cameraRef, bufferedSeconds, errorMessage, flush, release };
}
