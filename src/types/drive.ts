/**
 * Core domain types. These mirror the Supabase schema in `supabase/schema.sql` —
 * keep the two in sync when either changes.
 */

/** Matches the `user_role` enum in Postgres. */
export type Role = 'parent' | 'child';

export type Profile = {
  id: string;
  username: string;
  role: Role;
  /** Null until the user creates or joins a family. */
  familyId: string | null;
};

export type Family = {
  id: string;
  name: string;
  /** Six characters, shared with children so they can join. */
  code: string;
  createdBy: string;
};

/** A single GPS sample taken while a drive is in progress. */
export type DrivePoint = {
  /** Unix epoch milliseconds. */
  t: number;
  lat: number;
  lon: number;
  /** Metres per second. `null` when the OS could not resolve a speed. */
  speed: number | null;
  /** Horizontal accuracy in metres, when reported. */
  accuracy: number | null;
};

/** Something worth telling a parent about, detected during a drive. */
export type DriveEventType = 'speeding' | 'hard_brake' | 'rapid_accel' | 'phone_distraction';

export type DriveEvent = {
  id: string;
  type: DriveEventType;
  /** Unix epoch milliseconds. */
  at: number;
  /** Human-readable detail, e.g. "47 mph in a 25 zone". */
  detail: string;
  lat?: number;
  lon?: number;
};

export type DriveStatus = 'active' | 'completed';

export type Drive = {
  id: string;
  driverId: string;
  driverName: string;
  status: DriveStatus;
  /** Unix epoch milliseconds. */
  startedAt: number;
  /** Unix epoch milliseconds. `null` while the drive is still active. */
  endedAt: number | null;
  /** Metres. */
  distanceMeters: number;
  /** Metres per second. */
  topSpeed: number;
  /** Metres per second. */
  avgSpeed: number;
  /** 0–100, higher is safer. */
  safetyScore: number;
  events: DriveEvent[];
  /** Route polyline. Empty in list views, populated on the detail screen. */
  route: DrivePoint[];
};

/** A child in the same family, as the parent's Live tab sees them. */
export type LinkedDriver = {
  id: string;
  name: string;
  /** Present only while they are on a drive. */
  activeDriveId: string | null;
  lastSeenAt: number | null;
  lastLocation: { lat: number; lon: number } | null;
  /** Rolling average of recent drives, 0–100. */
  weekScore: number;
};
