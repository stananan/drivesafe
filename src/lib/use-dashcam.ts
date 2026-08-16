/**
 * The rolling-buffer dashcam.
 *
 * Phones will not hand you a ring buffer of video. What they will do is record
 * a clip of a fixed length and give you a file, so that is what this does: back
 * to back segments, keeping the trailing few and deleting the rest as they fall
 * out of the window. Saving a clip keeps whichever segments are on disk at that
 * moment, which is why a saved clip is several files and not one.
 *
 * Two consequences worth knowing before reading the code:
 *
 *   - There is a gap of a few hundred milliseconds between segments while the
 *     camera stops and starts. Nothing can be done about that without native
 *     code, and it is far better than the alternative of holding an hour of
 *     footage to guarantee continuity.
 *   - Video is recorded muted, deliberately. The microphone belongs to the
 *     loudness monitor, two recorders fighting over it ends badly on iOS, and
 *     an app that promises never to record audio should not quietly ship a
 *     camera that does.
 */

import { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Segment length. Short segments mean less footage lost to the gap between
 * them and a tighter window around the moment worth keeping; long segments mean
 * fewer files and less restart overhead. Fifteen seconds keeps a saved clip
 * within a few seconds of what someone actually meant to capture.
 */
const SEGMENT_SECONDS = 15;

/** Four segments, so a saved clip reaches about a minute back. */
const RING_SIZE = 4;

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
  /** Segments currently buffered, oldest first. */
  buffered: number;
  errorMessage: string | null;
  /**
   * Ends the segment in progress and returns the whole trailing window, so a
   * saved clip runs right up to the moment it was asked for rather than
   * stopping wherever the last segment happened to end.
   */
  flush: () => Promise<DashcamSegment[]>;
  /** Releases segments once they have been dealt with. */
  release: (segments: DashcamSegment[]) => void;
};

function discard(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A segment left in the cache is not worth failing a drive over; the OS
    // clears that directory on its own schedule.
  }
}

export function useDashcam({ enabled }: { enabled: boolean }): Dashcam {
  const cameraRef = useRef<CameraView | null>(null);

  const [status, setStatus] = useState<DashcamStatus>('idle');
  const [buffered, setBuffered] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ring = useRef<DashcamSegment[]>([]);

  // Segments handed to a caller, which must survive until they say otherwise.
  const retained = useRef<Set<string>>(new Set());

  // Set while a flush waits for the segment in progress to land.
  const pendingFlush = useRef<(() => void) | null>(null);

  const prune = useCallback(() => {
    while (ring.current.length > RING_SIZE) {
      const oldest = ring.current.shift();
      if (oldest && !retained.current.has(oldest.uri)) discard(oldest.uri);
    }

    setBuffered(ring.current.length);
  }, []);

  const release = useCallback(
    (segments: DashcamSegment[]) => {
      for (const segment of segments) {
        retained.current.delete(segment.uri);
        // Anything already out of the window can go now that it is free.
        if (!ring.current.some((held) => held.uri === segment.uri)) discard(segment.uri);
      }
    },
    []
  );

  const flush = useCallback(async (): Promise<DashcamSegment[]> => {
    // Close the segment in progress so the clip includes it, then wait for the
    // recording loop to hand it over.
    if (status === 'recording' && cameraRef.current) {
      await new Promise<void>((resolve) => {
        pendingFlush.current = resolve;

        try {
          cameraRef.current?.stopRecording();
        } catch {
          resolve();
        }

        // Never leave a caller waiting on a camera that failed to stop.
        setTimeout(() => {
          if (pendingFlush.current === resolve) {
            pendingFlush.current = null;
            resolve();
          }
        }, 3_000);
      });
    }

    const segments = [...ring.current];
    for (const segment of segments) retained.current.add(segment.uri);

    return segments;
  }, [status]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    let cancelled = false;

    // Captured for the cleanup below: by the time it runs, the ref may already
    // have been cleared by React unmounting the camera.
    const retainedFiles = retained.current;
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
        const startedAt = Date.now();

        try {
          setStatus('recording');

          const result = await camera.recordAsync({ maxDuration: SEGMENT_SECONDS });

          if (cancelled) {
            if (result?.uri) discard(result.uri);
            break;
          }

          if (result?.uri) {
            ring.current.push({
              uri: result.uri,
              startedAt,
              durationSeconds: (Date.now() - startedAt) / 1000,
            });
            prune();
          }

          // A flush was waiting on exactly this segment.
          const waiting = pendingFlush.current;
          if (waiting) {
            pendingFlush.current = null;
            waiting();
          }
        } catch (error) {
          if (cancelled) break;

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

      try {
        activeCamera?.stopRecording();
      } catch {
        // Already stopped, or the view is gone.
      }

      // Nothing buffered outlives the drive it was recorded on.
      for (const segment of ring.current) {
        if (!retainedFiles.has(segment.uri)) discard(segment.uri);
      }

      ring.current = [];
      setBuffered(0);
    };
  }, [enabled, prune]);

  return { status, cameraRef, buffered, errorMessage, flush, release };
}
