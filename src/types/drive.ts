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
  /** Whether audio distraction alerts run during this driver's drives. */
  audioAlertsEnabled: boolean;
  /** Whether the dashcam records while this driver is on a drive. */
  dashcamEnabled: boolean;
  /** Whether this person broadcasts their position to the family. */
  locationSharing: boolean;
};

/** Why a dashcam clip was kept instead of being overwritten. */
export type DriveClipReason = 'manual' | 'loud_audio';

/**
 * One saved stretch of dashcam footage.
 *
 * Several files rather than one: the camera records fixed-length segments, and
 * nothing in an Expo app can join them, so the player runs the parts in order.
 */
export type DriveClip = {
  id: string;
  reason: DriveClipReason;
  /** Unix epoch milliseconds at the start of the earliest part. */
  recordedAt: number;
  durationSeconds: number;
  /** False when the phone refused to record sound alongside loudness monitoring. */
  hasAudio: boolean;
  parts: {
    index: number;
    /** Short-lived signed URL, or null when the file could not be signed. */
    url: string | null;
    durationSeconds: number;
    bytes: number;
  }[];
};

/** A clip as the Clips tab sees it: with the drive and driver it belongs to. */
export type FamilyClip = DriveClip & {
  driveId: string;
  driverName: string;
  /** Unix epoch milliseconds the drive began. */
  driveStartedAt: number;
};

/** One cabin-loudness reading taken during a drive. */
export type AudioLevel = {
  /** Unix epoch milliseconds. */
  t: number;
  /** dBFS: 0 is the loudest the microphone can encode, quiet is near -60. */
  level: number;
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
export type DriveEventType =
  | 'speeding'
  | 'hard_brake'
  | 'rapid_accel'
  | 'phone_distraction'
  | 'loud_audio';

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
  /** 0–100, higher is safer. Provisional until the drive ends. */
  safetyScore: number;
  /** Whether audio distraction alerts were on for this drive. */
  audioMonitoring: boolean;
  /** Metres per second at the last heartbeat. Only meaningful while active. */
  currentSpeed: number;
  events: DriveEvent[];
  /** Route polyline. Empty in list views, populated on the detail screen. */
  route: DrivePoint[];
  /** Loudness readings. Empty in list views and when audio alerts were off. */
  audioLevels: AudioLevel[];
};

/** A child in the same family, as the parent's Live tab sees them. */
export type LinkedDriver = {
  id: string;
  name: string;
  /** Present only while they are on a drive. */
  activeDriveId: string | null;
  /** Whether the drive in progress has audio alerts on. Null when parked. */
  activeAudioMonitoring: boolean | null;
  lastSeenAt: number | null;
  lastLocation: { lat: number; lon: number } | null;
  /** Rolling average of recent drives, 0–100. */
  weekScore: number;
};
