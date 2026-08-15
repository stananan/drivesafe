/**
 * The live drive recorder.
 *
 * Subscribes to high-accuracy GPS while a drive is running and folds each fix
 * into a running summary (distance, top speed, average speed). This hook owns
 * only what is happening on the phone — the drive screen decides what to persist
 * and when, using `stop()`'s summary as the shape to upload.
 *
 * Recording is foreground-only: `watchPositionAsync` with a when-in-use
 * permission stops delivering once the app leaves the screen. That is why the
 * keep-awake lock below exists, and why the app declares no background location
 * entitlement. Making this survive a locked phone is tracked in TODO.md.
 */

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { haversineMeters } from '@/lib/format';
import type { DrivePoint } from '@/types/drive';

/** GPS jitter while parked can otherwise accumulate into phantom miles. */
const MIN_MOVEMENT_METERS = 4;
/** Fixes worse than this are logged but excluded from the distance total. */
const MAX_ACCURACY_METERS = 40;
/** Named lock so an unrelated keep-awake call cannot release ours. */
const KEEP_AWAKE_TAG = 'drivesafe-active-drive';

export type TrackerStatus = 'idle' | 'requesting' | 'denied' | 'recording' | 'error';

export type DriveSummary = {
  startedAt: number;
  endedAt: number;
  distanceMeters: number;
  topSpeed: number;
  avgSpeed: number;
  route: DrivePoint[];
};

export type DriveTracker = {
  status: TrackerStatus;
  /** Null until the first GPS fix arrives. */
  point: DrivePoint | null;
  /** Metres per second, smoothed to avoid a twitchy speedometer. */
  speed: number;
  topSpeed: number;
  distanceMeters: number;
  /** Milliseconds since the drive began; ticks once a second. */
  elapsedMs: number;
  /** The trace so far, so the UI can draw the route as it is recorded. */
  route: DrivePoint[];
  pointCount: number;
  errorMessage: string | null;
  /**
   * Resolves to the drive's start time once GPS is actually flowing, or null if
   * permission was refused or the subscription failed. Returning the timestamp
   * rather than a boolean means the caller can open the drive row without
   * reading back state that has not re-rendered yet.
   */
  start: () => Promise<number | null>;
  stop: () => DriveSummary | null;
};

export function useDriveTracker(): DriveTracker {
  const [status, setStatus] = useState<TrackerStatus>('idle');
  const [point, setPoint] = useState<DrivePoint | null>(null);
  const [speed, setSpeed] = useState(0);
  const [topSpeed, setTopSpeed] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [route, setRoute] = useState<DrivePoint[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const subscription = useRef<Location.LocationSubscription | null>(null);
  const routeRef = useRef<DrivePoint[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const lastFixRef = useRef<DrivePoint | null>(null);

  const teardown = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
  }, []);

  // Never leave a GPS subscription running after the screen goes away.
  useEffect(() => teardown, [teardown]);

  // Hold the screen on for the duration of the drive, and only the drive.
  useEffect(() => {
    if (status !== 'recording') return;

    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {
      // Not being able to hold the screen on is not worth failing a drive over.
    });

    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [status]);

  // Drive clock. Separate from GPS so the timer keeps moving in a tunnel.
  useEffect(() => {
    if (status !== 'recording') return;

    const id = setInterval(() => {
      if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current);
    }, 1000);

    return () => clearInterval(id);
  }, [status]);

  const start = useCallback(async (): Promise<number | null> => {
    setStatus('requesting');
    setErrorMessage(null);

    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();

      if (permission !== Location.PermissionStatus.GRANTED) {
        setStatus('denied');
        return null;
      }

      routeRef.current = [];
      lastFixRef.current = null;
      startedAtRef.current = Date.now();

      setPoint(null);
      setSpeed(0);
      setTopSpeed(0);
      setDistanceMeters(0);
      setElapsedMs(0);
      setRoute([]);

      subscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        (location) => {
          const next: DrivePoint = {
            t: location.timestamp,
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            // iOS reports -1 when it cannot resolve a speed.
            speed:
              typeof location.coords.speed === 'number' && location.coords.speed >= 0
                ? location.coords.speed
                : null,
            accuracy: location.coords.accuracy ?? null,
          };

          routeRef.current.push(next);
          setPoint(next);
          // New array each fix so the route preview re-renders.
          setRoute([...routeRef.current]);

          const previous = lastFixRef.current;
          const usable = next.accuracy === null || next.accuracy <= MAX_ACCURACY_METERS;

          if (previous && usable) {
            const delta = haversineMeters(previous, next);
            if (delta >= MIN_MOVEMENT_METERS) {
              setDistanceMeters((total) => total + delta);
              lastFixRef.current = next;
            }
          } else if (usable) {
            lastFixRef.current = next;
          }

          if (next.speed !== null) {
            setSpeed(next.speed);
            setTopSpeed((best) => Math.max(best, next.speed!));
          }
        }
      );

      setStatus('recording');
      return startedAtRef.current;
    } catch (error) {
      teardown();
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not start location updates.');
      return null;
    }
  }, [teardown]);

  const stop = useCallback((): DriveSummary | null => {
    teardown();
    setStatus('idle');
    setSpeed(0);

    const begunAt = startedAtRef.current;
    startedAtRef.current = null;
    if (!begunAt) return null;

    const endedAt = Date.now();
    const seconds = Math.max(1, (endedAt - begunAt) / 1000);

    return {
      startedAt: begunAt,
      endedAt,
      distanceMeters,
      topSpeed,
      avgSpeed: distanceMeters / seconds,
      route: routeRef.current,
    };
  }, [distanceMeters, topSpeed, teardown]);

  return {
    status,
    point,
    speed,
    topSpeed,
    distanceMeters,
    elapsedMs,
    route,
    pointCount: route.length,
    errorMessage,
    start,
    stop,
  };
}
