/**
 * The rolling dashcam.
 *
 * A saved clip is exactly one file. That constraint drives the whole design,
 * because nothing available to an Expo app can join video: if a clip is to be
 * one piece, it has to be recorded as one piece.
 *
 * So the camera runs a single recording at a time and throws it away when it
 * ends unsaved. Saving stops that recording and keeps the file — everything it
 * has captured since it started, which is at least the last twenty seconds and
 * at most `SEGMENT_MAX_SECONDS`. Overshooting is fine: a clip that runs long
 * carries extra context before the moment, whereas one that stops short has
 * missed the thing worth keeping.
 *
 * The case that needs care is a save arriving moments after a recording began,
 * when there is barely any footage to hand back. Rather than return a
 * two-second clip, or reach for the previous file and produce a second part,
 * the flush waits until the recording is long enough. The clip then also holds
 * a few seconds of what happened next, which for a dashcam is no bad thing.
 *
 * Video records with sound when the caller says it can. Whether a phone will
 * give the microphone to the camera and the loudness monitor at once is an open
 * question, so `audioEnabled` can be flipped off after a failure: changing it
 * restarts the loop, and the retry runs muted.
 */

import { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

/** A saved clip is never shorter than this. */
export const CLIP_MIN_SECONDS = 20;

/**
 * And never longer than this. The cap exists so a recording cannot grow to the
 * length of the whole drive — at 720p that would be hundreds of megabytes for a
 * single save, against a free storage tier of one gigabyte.
 */
const SEGMENT_MAX_SECONDS = 40;

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
   * Ends the current recording and hands back its file, waiting first if it has
   * not yet reached `CLIP_MIN_SECONDS`. Resolves null when there is nothing
   * recording to keep.
   */
  flush: () => Promise<DashcamSegment | null>;
  /** Deletes a segment once the caller is done with it. */
  release: (segment: DashcamSegment | null) => void;
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

  /** Set while a flush waits for the current recording to be handed over. */
  const pendingSave = useRef<((segment: DashcamSegment | null) => void) | null>(null);

  const release = useCallback((segment: DashcamSegment | null) => {
    if (segment) discard(segment.uri);
  }, []);

  const flush = useCallback(async (): Promise<DashcamSegment | null> => {
    if (status !== 'recording' || !cameraRef.current || startedAt.current === null) {
      return null;
    }

    // Too little footage to be worth keeping yet. Let it run on rather than
    // save a two-second clip or graft a second file onto the front.
    const elapsed = (Date.now() - startedAt.current) / 1000;
    if (elapsed < CLIP_MIN_SECONDS) {
      await new Promise((resolve) =>
        setTimeout(resolve, (CLIP_MIN_SECONDS - elapsed) * 1000)
      );
    }

    return new Promise<DashcamSegment | null>((resolve) => {
      pendingSave.current = resolve;

      try {
        cameraRef.current?.stopRecording();
      } catch {
        pendingSave.current = null;
        resolve(null);
        return;
      }

      // Never leave a caller waiting on a camera that failed to stop.
      setTimeout(() => {
        if (pendingSave.current === resolve) {
          pendingSave.current = null;
          resolve(null);
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
            // Someone is saving this one. It belongs to them now, and they call
            // release() when they are done with it.
            pendingSave.current = null;
            waiting({
              uri: result.uri,
              startedAt: began,
              durationSeconds: (Date.now() - began) / 1000,
            });
          } else if (result?.uri) {
            // Nobody wanted it. This is the normal case, and the reason an hour
            // of dashcam costs no storage at all.
            discard(result.uri);
          }
        } catch (error) {
          startedAt.current = null;

          if (cancelled) break;

          // A save waiting on a recording that just failed must not hang.
          const waiting = pendingSave.current;
          if (waiting) {
            pendingSave.current = null;
            waiting(null);
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

      try {
        activeCamera?.stopRecording();
      } catch {
        // Already stopped, or the view is gone.
      }
    };
  }, [enabled, audioEnabled]);

  return { status, cameraRef, bufferedSeconds, errorMessage, flush, release };
}
