/**
 * Drive persistence and the queries both interfaces read through.
 *
 * Row-level security decides what comes back — a child sees only their own
 * drives, a parent sees every drive in their family — so these functions do not
 * re-filter by role. The database is the authority, not the client.
 */

import { scoreDrive } from '@/lib/scoring';
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
  audio_monitoring: boolean;
  current_speed: number;
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
  'id, driver_id, started_at, ended_at, distance_meters, top_speed, avg_speed, safety_score, audio_monitoring, current_speed, profiles!drives_driver_id_fkey(username)';

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
    audioMonitoring: row.audio_monitoring,
    currentSpeed: row.current_speed,
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

export type LiveDrive = {
  drive: Drive;
  /** The driver's most recent published position, when they are sharing. */
  position: { lat: number; lon: number; at: number } | null;
};

/**
 * A drive in progress, for the parent's live dashboard.
 *
 * Deliberately does not pull `drive_points`: the trace is only uploaded when the
 * drive ends, so mid-drive there is nothing there to draw. The live map follows
 * the driver's published position instead, which is a single row that updates
 * every few seconds rather than a polyline that grows all trip.
 */
export async function getLiveDrive(driveId: string): Promise<LiveDrive | null> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('drives')
    .select(DRIVE_COLUMNS)
    .eq('id', driveId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as DriveRow;

  const [{ data: eventRows }, { data: profileRow }] = await Promise.all([
    supabase
      .from('drive_events')
      .select('id, type, occurred_at, detail, lat, lon')
      .eq('drive_id', driveId)
      .order('occurred_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('last_lat, last_lon, last_location_at, location_sharing')
      .eq('id', row.driver_id)
      .maybeSingle<{
        last_lat: number | null;
        last_lon: number | null;
        last_location_at: string | null;
        location_sharing: boolean;
      }>(),
  ]);

  const events = ((eventRows ?? []) as EventRow[]).map(toEvent);

  const hasPosition =
    profileRow?.location_sharing &&
    profileRow.last_lat !== null &&
    profileRow.last_lon !== null;

  return {
    drive: toDrive(row, events),
    position: hasPosition
      ? {
          lat: profileRow.last_lat!,
          lon: profileRow.last_lon!,
          at: profileRow.last_location_at
            ? new Date(profileRow.last_location_at).getTime()
            : Date.now(),
        }
      : null,
  };
}

/**
 * The children in the caller's family, as the parent's Live tab sees them:
 * where they are, whether they are driving right now, and how they have been
 * scoring. One query rather than three so the tab renders in a single pass.
 */
export async function listFamilyDrivers(familyId: string): Promise<LinkedDriver[]> {
  const supabase = requireSupabase();

  const { data: profileRows, error } = await supabase
    .from('profiles')
    .select('id, username, last_lat, last_lon, last_location_at, location_sharing')
    .eq('family_id', familyId)
    .eq('role', 'child');

  if (error) throw new Error(error.message);

  const children = (profileRows ?? []) as {
    id: string;
    username: string;
    last_lat: number | null;
    last_lon: number | null;
    last_location_at: string | null;
    location_sharing: boolean;
  }[];
  if (children.length === 0) return [];

  const { data: driveRows } = await supabase
    .from('drives')
    .select('id, driver_id, started_at, ended_at, safety_score, audio_monitoring')
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
    audio_monitoring: boolean;
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

    // Prefer the location timestamp: a driver sitting in traffic is still
    // "seen" even though their last drive ended hours ago.
    const lastDriveAt = theirs[0]
      ? new Date(theirs[0].ended_at ?? theirs[0].started_at).getTime()
      : null;
    const lastFixAt = child.last_location_at
      ? new Date(child.last_location_at).getTime()
      : null;

    const isSharing =
      child.location_sharing && child.last_lat !== null && child.last_lon !== null;

    return {
      id: child.id,
      name: child.username,
      activeDriveId: active?.id ?? null,
      activeAudioMonitoring: active ? active.audio_monitoring : null,
      lastSeenAt: lastFixAt ?? lastDriveAt,
      lastLocation: isSharing ? { lat: child.last_lat!, lon: child.last_lon! } : null,
      weekScore,
    };
  });
}

/**
 * Opens a drive the moment recording begins.
 *
 * The row exists with `ended_at` null for the whole trip, which is what makes a
 * drive visible to a parent while it is happening. Nothing else about the drive
 * is known yet, so the stats start at zero and get filled in by heartbeats.
 */
export async function startDrive(input: {
  driverId: string;
  startedAt: number;
  audioMonitoring: boolean;
}): Promise<string> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('drives')
    .insert({
      driver_id: input.driverId,
      started_at: new Date(input.startedAt).toISOString(),
      ended_at: null,
      audio_monitoring: input.audioMonitoring,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) throw new Error(error.message);

  return data.id;
}

/**
 * Pushes the in-progress numbers so the parent dashboard has something current.
 *
 * Called on a timer rather than on every GPS fix: a fix arrives about once a
 * second, and a write that often would be wasteful for a screen nobody may be
 * watching. Failures are silent by design — a missed heartbeat costs a stale
 * number for a few seconds and must never interrupt recording.
 */
export async function heartbeatDrive(input: {
  driveId: string;
  distanceMeters: number;
  topSpeed: number;
  avgSpeed: number;
  currentSpeed: number;
}): Promise<void> {
  const supabase = requireSupabase();

  await supabase
    .from('drives')
    .update({
      distance_meters: input.distanceMeters,
      top_speed: input.topSpeed,
      avg_speed: input.avgSpeed,
      current_speed: input.currentSpeed,
    })
    .eq('id', input.driveId);
}

/** Mirrors the driver's audio toggle so the parent sees it change live. */
export async function setDriveAudioMonitoring(
  driveId: string,
  enabled: boolean
): Promise<void> {
  const supabase = requireSupabase();

  const { error } = await supabase
    .from('drives')
    .update({ audio_monitoring: enabled })
    .eq('id', driveId);

  if (error) throw new Error(error.message);
}

/** Records one event as it happens, rather than waiting for the drive to end. */
export async function logDriveEvent(input: {
  driveId: string;
  type: DriveEvent['type'];
  at: number;
  detail: string;
  lat?: number | null;
  lon?: number | null;
}): Promise<void> {
  const supabase = requireSupabase();

  const { error } = await supabase.from('drive_events').insert({
    drive_id: input.driveId,
    type: input.type,
    occurred_at: new Date(input.at).toISOString(),
    detail: input.detail,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
  });

  if (error) throw new Error(error.message);
}

export type FinishedDriveInput = {
  driveId: string;
  endedAt: number;
  distanceMeters: number;
  topSpeed: number;
  avgSpeed: number;
  route: DrivePoint[];
  /**
   * Loud-audio alerts raised during the drive. Counted on the phone as they
   * happen rather than read back from the database, so a failed event insert
   * cannot quietly erase the penalty.
   */
  loudAudioAlerts?: number;
};

/**
 * Closes out a drive: final stats, the score, the derived events, and the trace.
 *
 * The trace is inserted in chunks because a long drive can carry thousands of
 * points, and PostgREST rejects a single payload that large.
 *
 * Order matters. `ended_at` is written first so the drive stops showing as live
 * even if the phone loses signal partway through uploading the trace — a drive
 * that is stuck "in progress" forever is worse than one missing its route.
 */
export async function finishDrive(input: FinishedDriveInput): Promise<void> {
  const supabase = requireSupabase();

  // Scored on the phone from the trace we just recorded — see SCORING.md.
  const scored = scoreDrive(input.route, { loudAudioAlerts: input.loudAudioAlerts ?? 0 });

  const { error } = await supabase
    .from('drives')
    .update({
      ended_at: new Date(input.endedAt).toISOString(),
      distance_meters: input.distanceMeters,
      top_speed: input.topSpeed,
      avg_speed: input.avgSpeed,
      current_speed: 0,
      safety_score: scored.score,
    })
    .eq('id', input.driveId);

  if (error) throw new Error(error.message);

  if (scored.events.length > 0) {
    const { error: eventError } = await supabase.from('drive_events').insert(
      scored.events.map((event) => ({
        drive_id: input.driveId,
        type: event.type,
        occurred_at: new Date(event.at).toISOString(),
        detail: event.detail,
        lat: event.lat ?? null,
        lon: event.lon ?? null,
      }))
    );

    // A missing event list is a worse outcome than a missing score, but neither
    // should lose the drive itself — it is already closed out at this point.
    if (eventError) console.warn('Could not save drive events:', eventError.message);
  }

  const CHUNK = 500;
  for (let i = 0; i < input.route.length; i += CHUNK) {
    const chunk = input.route.slice(i, i + CHUNK).map((point) => ({
      drive_id: input.driveId,
      recorded_at: new Date(point.t).toISOString(),
      lat: point.lat,
      lon: point.lon,
      speed: point.speed,
      accuracy: point.accuracy,
    }));

    const { error: pointError } = await supabase.from('drive_points').insert(chunk);
    if (pointError) throw new Error(pointError.message);
  }
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
