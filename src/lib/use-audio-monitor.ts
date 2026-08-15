/**
 * Audio distraction monitoring.
 *
 * Watches how loud the cabin is and calls back when it stays loud — shouting,
 * music cranked past the point of hearing a siren, a carful of friends. It
 * measures the microphone's level meter and nothing else: the audio itself is
 * never inspected, never uploaded, and the temporary file the OS insists on
 * writing is deleted the moment monitoring stops.
 *
 * Metering only exists while a recording is active, which is the whole reason a
 * file is involved at all. `MONITOR_RECORDING_OPTIONS` therefore asks for the
 * smallest, ugliest audio the platforms will give us — mono, low bitrate — since
 * quality is irrelevant to a number that only measures amplitude.
 *
 * The thresholds below are starting points, not calibrated values. Cabin noise
 * varies enormously between cars, phones, and mounting positions; see TODO.md
 * for the road-test tuning pass.
 */

import { File } from 'expo-file-system';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Quality is irrelevant when only the level meter is read. */
const MONITOR_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.LOW_QUALITY,
  isMeteringEnabled: true,
  numberOfChannels: 1,
};

/**
 * Level meters report dBFS: 0 is the loudest the microphone can encode and
 * roughly -160 is silence. Normal conversation in a moving car tends to sit
 * well below this; sustained noise above it is the thing worth interrupting for.
 */
const LOUD_THRESHOLD_DBFS = -12;

/** A car door or a pothole spikes the meter. Only sustained noise counts. */
const SUSTAIN_MS = 1_500;

/** One alert a minute at most — a nagging app gets muted, and then it is useless. */
const COOLDOWN_MS = 60_000;

const SAMPLE_INTERVAL_MS = 400;

export type AudioMonitorStatus = 'idle' | 'requesting' | 'denied' | 'monitoring' | 'error';

export type AudioMonitor = {
  status: AudioMonitorStatus;
  /** Most recent level in dBFS. Null before the first sample arrives. */
  level: number | null;
  errorMessage: string | null;
};

export function useAudioMonitor({
  enabled,
  onLoud,
}: {
  enabled: boolean;
  /** Called with the offending level once noise has been sustained. */
  onLoud: (level: number) => void;
}): AudioMonitor {
  const recorder = useAudioRecorder(MONITOR_RECORDING_OPTIONS);

  const [status, setStatus] = useState<AudioMonitorStatus>('idle');
  const [level, setLevel] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Held in a ref so a new callback identity on every render does not tear the
  // microphone down and build it back up.
  const onLoudRef = useRef(onLoud);
  useEffect(() => {
    onLoudRef.current = onLoud;
  }, [onLoud]);

  const teardown = useCallback(async () => {
    // Read the uri before stopping; the recorder clears it on the way down.
    const uri = recorder.uri;

    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {
      // Already stopped, or the session was torn down under us.
    }

    try {
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      // Restoring the audio session is best-effort.
    }

    // The file only ever existed because metering requires a live recording.
    // Nothing about it is meant to outlive the drive.
    if (uri) {
      try {
        const file = new File(uri);
        if (file.exists) file.delete();
      } catch {
        // A leftover file in the cache directory is not worth failing over.
      }
    }
  }, [recorder]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setLevel(null);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let loudSince: number | null = null;
    let lastAlertAt = 0;

    async function start() {
      setStatus('requesting');
      setErrorMessage(null);

      try {
        const permission = await requestRecordingPermissionsAsync();
        if (cancelled) return;

        if (!permission.granted) {
          setStatus('denied');
          return;
        }

        // mixWithOthers matters: taking exclusive audio focus would stop the
        // driver's music every time a drive starts, which nobody would keep on.
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        });
        if (cancelled) return;

        await recorder.prepareToRecordAsync();
        if (cancelled) return;

        recorder.record();
        setStatus('monitoring');

        timer = setInterval(() => {
          const { metering } = recorder.getStatus();
          if (typeof metering !== 'number') return;

          setLevel(metering);

          const now = Date.now();

          if (metering < LOUD_THRESHOLD_DBFS) {
            loudSince = null;
            return;
          }

          loudSince ??= now;

          if (now - loudSince >= SUSTAIN_MS && now - lastAlertAt >= COOLDOWN_MS) {
            lastAlertAt = now;
            loudSince = null;
            onLoudRef.current(metering);
          }
        }, SAMPLE_INTERVAL_MS);
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Could not start audio monitoring.'
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      void teardown();
    };
  }, [enabled, recorder, teardown]);

  return { status, level, errorMessage };
}

/** Turns a dBFS reading into something a teenager would actually parse. */
export function describeLevel(level: number): string {
  if (level >= -6) return 'very loud';
  if (level >= LOUD_THRESHOLD_DBFS) return 'loud';
  return 'normal';
}
