/**
 * Drive persistence and the queries both interfaces read through.
 *
 * Row-level security decides what comes back — a child sees only their own
 * drives, a parent sees every drive in their family — so these functions do not
 * re-filter by role. The database is the authority, not the client.
 */

import { requireSupabase } from '@/lib/supabase';
import type { Drive, DriveEvent, DrivePoint, LinkedDriver } from '@/types/drive';

type DriveRow = {
  id: string;
  driver_id: string;
  started_at: string;
  ended_at: string | null;
  distance_meters: number;
  top_speed: number;
  avg_speed: number;
  safety_score: number;
  profiles?: { username: string } | null;
};

type PointRow = {
  recorded_at: string;
  lat: number;
  lon: number;
  speed: number | null;
  accuracy: number | null;
};

type EventRow = {
  id: string;
  type: DriveEvent['type'];
  occurred_at: string;
  detail: string;
  lat: number | null;
  lon: number | null;
};

const DRIVE_COLUMNS =
  'id, driver_id, started_at, ended_at, distance_meters, top_speed, avg_speed, safety_score, profiles!drives_driver_id_fkey(username)';

function toDrive(row: DriveRow, events: DriveEvent[] = [], route: DrivePoint[] = []): Drive {
  return {
    id: row.id,
    driverId: row.driver_id,
    driverName: row.profiles?.username ?? 'Driver',
    status: row.ended_at ? 'completed' : 'active',
    startedAt: new Date(row.started_at).getTime(),
    endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
    distanceMeters: row.distance_meters,
    topSpeed: row.top_speed,
    avgSpeed: row.avg_speed,
    safetyScore: row.safety_score,
    events,
    route,
  };
}

function toEvent(row: EventRow): DriveEvent {
  return {
    id: row.id,
    type: row.type,
    at: new Date(row.occurred_at).getTime(),
    detail: row.detail,
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
  };
}

/**
 * Every drive the signed-in user is allowed to see, newest first.
 *
 * Event counts are fetched in one extra query rather than one per drive, so a
 * long history stays a constant two round trips.
 */
export async function listDrives(limit = 50): Promise<Drive[]> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('drives')
    .select(DRIVE_COLUMNS)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as DriveRow[];
  if (rows.length === 0) return [];

  const { data: eventRows } = await supabase
    .from('drive_events')
    .select('id, drive_id, type, occurred_at, detail, lat, lon')
    .in(
      'drive_id',
      rows.map((row) => row.id)
    );

  const eventsByDrive = new Map<string, DriveEvent[]>();
  for (const row of (eventRows ?? []) as (EventRow & { drive_id: string })[]) {
    const list = eventsByDrive.get(row.drive_id) ?? [];
    list.push(toEvent(row));
    eventsByDrive.set(row.drive_id, list);
  }

  return rows.map((row) => toDrive(row, eventsByDrive.get(row.id) ?? []));
}

/** One drive with its full GPS trace and events, for the detail screen. */
export async function getDrive(id: string): Promise<Drive | null> {
  const supabase = requireSupabase();

  const { data: row, error } = await supabase
    .from('drives')
    .select(DRIVE_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  const [{ data: pointRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from('drive_points')
      .select('recorded_at, lat, lon, speed, accuracy')
      .eq('drive_id', id)
      .order('recorded_at', { ascending: true }),
    supabase
      .from('drive_events')
      .select('id, type, occurred_at, detail, lat, lon')
      .eq('drive_id', id)
      .order('occurred_at', { ascending: true }),
  ]);

  const route: DrivePoint[] = ((pointRows ?? []) as PointRow[]).map((point) => ({
    t: new Date(point.recorded_at).getTime(),
    lat: point.lat,
    lon: point.lon,
    speed: point.speed,
    accuracy: point.accuracy,
  }));

  const events = ((eventRows ?? []) as EventRow[]).map(toEvent);

  return toDrive(row as unknown as DriveRow, events, route);
}

/** The children in the caller's family, as the parent's Live tab sees them. */
export async function listFamilyDrivers(familyId: string): Promise<LinkedDriver[]> {
  const supabase = requireSupabase();

  const { data: profileRows, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('family_id', familyId)
    .eq('role', 'child');

  if (error) throw new Error(error.message);

  const children = (profileRows ?? []) as { id: string; username: string }[];
  if (children.length === 0) return [];

  const { data: driveRows } = await supabase
    .from('drives')
    .select('id, driver_id, started_at, ended_at, safety_score')
    .in(
      'driver_id',
      children.map((child) => child.id)
    )
    .order('started_at', { ascending: false });

  const drives = (driveRows ?? []) as {
    id: string;
    driver_id: string;
    started_at: string;
    ended_at: string | null;
    safety_score: number;
  }[];

  return children.map((child) => {
    const theirs = drives.filter((drive) => drive.driver_id === child.id);
    const active = theirs.find((drive) => drive.ended_at === null);
    const completed = theirs.filter((drive) => drive.ended_at !== null);

    const weekScore =
      completed.length === 0
        ? 100
        : Math.round(
            completed.reduce((sum, drive) => sum + drive.safety_score, 0) / completed.length
          );

    const lastSeenAt = theirs[0]
      ? new Date(theirs[0].ended_at ?? theirs[0].started_at).getTime()
      : null;

    return {
      id: child.id,
      name: child.username,
      activeDriveId: active?.id ?? null,
      lastSeenAt,
      lastLocation: null,
      weekScore,
    };
  });
}

export type SavedDriveInput = {
  driverId: string;
  startedAt: number;
  endedAt: number;
  distanceMeters: number;
  topSpeed: number;
  avgSpeed: number;
  route: DrivePoint[];
};

/**
 * Writes a finished drive and its trace.
 *
 * The trace is inserted in chunks because a long drive can carry thousands of
 * points, and PostgREST rejects a single payload that large.
 */
export async function saveDrive(input: SavedDriveInput): Promise<string> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('drives')
    .insert({
      driver_id: input.driverId,
      started_at: new Date(input.startedAt).toISOString(),
      ended_at: new Date(input.endedAt).toISOString(),
      distance_meters: input.distanceMeters,
      top_speed: input.topSpeed,
      avg_speed: input.avgSpeed,
      safety_score: 100,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) throw new Error(error.message);

  const driveId = data.id;

  const CHUNK = 500;
  for (let i = 0; i < input.route.length; i += CHUNK) {
    const chunk = input.route.slice(i, i + CHUNK).map((point) => ({
      drive_id: driveId,
      recorded_at: new Date(point.t).toISOString(),
      lat: point.lat,
      lon: point.lon,
      speed: point.speed,
      accuracy: point.accuracy,
    }));

    const { error: pointError } = await supabase.from('drive_points').insert(chunk);
    if (pointError) throw new Error(pointError.message);
  }

  return driveId;
}

/** Rolling safety average across completed drives, 0–100. */
export function averageScore(drives: Drive[]): number {
  const completed = drives.filter((drive) => drive.status === 'completed');
  if (completed.length === 0) return 100;

  return Math.round(
    completed.reduce((sum, drive) => sum + drive.safetyScore, 0) / completed.length
  );
}

/** Total miles driven in the last seven days. */
export function milesThisWeek(drives: Drive[]): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const meters = drives
    .filter((drive) => drive.startedAt >= cutoff)
    .reduce((sum, drive) => sum + drive.distanceMeters, 0);

  return meters / 1609.344;
}
