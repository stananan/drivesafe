/**
 * Local stand-in for Supabase.
 *
 * Every screen reads through these helpers, so swapping in real queries later is
 * a change in one file rather than a rewrite of the UI. The routes trace real
 * roads in Marin and Sonoma counties — California's 2nd district — so the demo
 * video looks like the district it was built for.
 */

import type { Drive, DriveEvent, DrivePoint, LinkedDriver } from '@/types/drive';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Walks a straight line between two coordinates, emitting a fix every few
 * seconds. Good enough to draw a route and exercise the summary math.
 */
function synthesizeRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  startedAt: number,
  samples: number,
  cruiseMps: number
): DrivePoint[] {
  return Array.from({ length: samples }, (_, i) => {
    const progress = i / (samples - 1);
    // Ease in and out so the speed trace is not a flat line.
    const speedFactor = Math.sin(progress * Math.PI) * 0.45 + 0.7;

    return {
      t: startedAt + i * 4000,
      lat: from.lat + (to.lat - from.lat) * progress,
      lon: from.lon + (to.lon - from.lon) * progress,
      speed: cruiseMps * speedFactor,
      accuracy: 6,
    };
  });
}

const NOVATO = { lat: 38.1074, lon: -122.5697 };
const SAN_RAFAEL = { lat: 37.9735, lon: -122.5311 };
const PETALUMA = { lat: 38.2324, lon: -122.6367 };
const SAUSALITO = { lat: 37.8591, lon: -122.4853 };

function makeEvent(
  id: string,
  type: DriveEvent['type'],
  at: number,
  detail: string
): DriveEvent {
  return { id, type, at, detail };
}

const now = Date.now();

export const DEMO_DRIVER_ID = 'teen-1';
export const DEMO_DRIVER_NAME = 'Alex';

const drives: Drive[] = [
  {
    id: 'drive-3',
    driverId: DEMO_DRIVER_ID,
    driverName: DEMO_DRIVER_NAME,
    status: 'completed',
    startedAt: now - 3 * HOUR,
    endedAt: now - 3 * HOUR + 22 * MINUTE,
    distanceMeters: 17_400,
    topSpeed: 29.5,
    avgSpeed: 13.2,
    safetyScore: 94,
    events: [makeEvent('e-1', 'hard_brake', now - 3 * HOUR + 11 * MINUTE, 'Hard brake on Hwy 101')],
    route: synthesizeRoute(NOVATO, SAN_RAFAEL, now - 3 * HOUR, 40, 24),
  },
  {
    id: 'drive-2',
    driverId: DEMO_DRIVER_ID,
    driverName: DEMO_DRIVER_NAME,
    status: 'completed',
    startedAt: now - 26 * HOUR,
    endedAt: now - 26 * HOUR + 31 * MINUTE,
    distanceMeters: 24_900,
    topSpeed: 33.1,
    avgSpeed: 14.8,
    safetyScore: 78,
    events: [
      makeEvent('e-2', 'speeding', now - 26 * HOUR + 9 * MINUTE, '74 mph in a 65 zone'),
      makeEvent('e-3', 'rapid_accel', now - 26 * HOUR + 18 * MINUTE, 'Rapid acceleration merging'),
      makeEvent('e-4', 'hard_brake', now - 26 * HOUR + 24 * MINUTE, 'Hard brake near Petaluma Blvd'),
    ],
    route: synthesizeRoute(SAN_RAFAEL, PETALUMA, now - 26 * HOUR, 48, 27),
  },
  {
    id: 'drive-1',
    driverId: DEMO_DRIVER_ID,
    driverName: DEMO_DRIVER_NAME,
    status: 'completed',
    startedAt: now - 50 * HOUR,
    endedAt: now - 50 * HOUR + 18 * MINUTE,
    distanceMeters: 12_100,
    topSpeed: 25.4,
    avgSpeed: 11.7,
    safetyScore: 100,
    events: [],
    route: synthesizeRoute(SAUSALITO, SAN_RAFAEL, now - 50 * HOUR, 32, 21),
  },
];

const drivers: LinkedDriver[] = [
  {
    id: DEMO_DRIVER_ID,
    name: DEMO_DRIVER_NAME,
    activeDriveId: null,
    lastSeenAt: now - 12 * MINUTE,
    lastLocation: SAN_RAFAEL,
    weekScore: 91,
  },
];

export function listDrives(): Drive[] {
  return [...drives].sort((a, b) => b.startedAt - a.startedAt);
}

export function getDrive(id: string): Drive | undefined {
  return drives.find((drive) => drive.id === id);
}

export function listLinkedDrivers(): LinkedDriver[] {
  return drivers;
}

/** Rolling safety average across every completed drive, 0–100. */
export function weeklyScore(): number {
  const completed = drives.filter((drive) => drive.status === 'completed');
  if (completed.length === 0) return 100;

  const total = completed.reduce((sum, drive) => sum + drive.safetyScore, 0);
  return Math.round(total / completed.length);
}

export function totalMilesThisWeek(): number {
  const cutoff = now - 7 * 24 * HOUR;
  const meters = drives
    .filter((drive) => drive.startedAt >= cutoff)
    .reduce((sum, drive) => sum + drive.distanceMeters, 0);

  return meters / 1609.344;
}
