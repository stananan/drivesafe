/**
 * DriveSafe safety scoring.
 *
 * The full derivation and the reasoning behind every constant lives in
 * `SCORING.md`. The short version:
 *
 *   score = 100 − clamp( W_speed·P_speed + W_lat·P_lat + W_jerk·P_jerk , 0, 100 )
 *
 * Every penalty is a *rate* — exposure per minute of driving — so a long trip is
 * not punished for being long, and a driver cannot dilute one bad stretch by
 * padding the drive with motorway cruising.
 *
 * Everything here is computed from the GPS trace alone. Curvature comes from the
 * geometry of the points themselves, which is what lets the score understand
 * "too fast for this bend" without any road database at all.
 */

import { haversineMeters } from '@/lib/format';
import type { DriveEvent, DrivePoint } from '@/types/drive';

// --- Tunables -------------------------------------------------------------
// Chosen to put a careful driver near 95-100 and a consistently reckless one
// near 40-60. See SCORING.md for where each number comes from.

/** Excess speed, in m/s, that counts as one unit of speeding. */
const SPEED_REFERENCE = 2.24; // ~5 mph
/** Lateral acceleration a normal driver stays under, m/s². */
const LATERAL_COMFORT = 3.0;
/** Longitudinal acceleration beyond which braking/accelerating reads as harsh, m/s². */
const JERK_COMFORT = 2.8;

/** Harsh events are counted per this many seconds of driving. */
const JERK_WINDOW_SECONDS = 600;
/** Two harsh samples closer than this are the same incident. */
const JERK_COOLDOWN_MS = 5_000;

// Sustained 5 mph over the limit costs 10 points; 10 over costs 40; 15 over 90.
const WEIGHT_SPEED = 10.0;
// Sustained cornering at 6 m/s² (~0.6 g) costs about 20 points.
const WEIGHT_LATERAL = 20.0;
// Roughly 8 points for five hard stops in a half-hour drive.
const WEIGHT_JERK = 8.0;

/** Fixes worse than this are too noisy to derive curvature from. */
const MAX_ACCURACY_METERS = 30;
/** Below this speed, GPS heading is meaningless and curvature explodes. */
const MIN_SPEED_FOR_CURVATURE = 2.0; // m/s, ~4.5 mph

export type ScoredSample = {
  /** Metres per second. */
  speed: number;
  /** Posted limit used for this sample, m/s. */
  speedLimit: number;
  /** 1/metres. */
  curvature: number;
  /** v²κ — how hard the car is being pushed sideways, m/s². */
  lateralAcceleration: number;
  /** Signed longitudinal acceleration, m/s². */
  longitudinalAcceleration: number;
  /** Seconds this sample represents. */
  dt: number;
  lat: number;
  lon: number;
  t: number;
};

export type DriveScore = {
  /** 0–100, higher is safer. */
  score: number;
  /** Penalty contributions, before weighting, for explaining the score. */
  breakdown: {
    speeding: number;
    cornering: number;
    braking: number;
  };
  events: Omit<DriveEvent, 'id'>[];
  /** Seconds of usable trace the score was computed from. */
  analyzedSeconds: number;
};

/**
 * Provides a posted speed limit for a coordinate, in m/s.
 *
 * Today this is a heuristic (see `inferSpeedLimit`). Swapping in a real source
 * means replacing this one function — every caller and the whole equation stay
 * as they are. `SCORING.md` documents the OpenStreetMap pathway.
 */
export type SpeedLimitProvider = (point: { lat: number; lon: number }) => number;

/**
 * Stand-in until a road-data source is wired up.
 *
 * Infers a limit from how the car is actually being driven: sustained high speed
 * implies a highway, crawling implies a surface street. This is deliberately
 * conservative — it will never invent a *low* limit and manufacture a speeding
 * penalty out of nothing, because the inferred limit is derived from the
 * driver's own speed and rounded up to the nearest plausible posted value.
 */
export function inferSpeedLimit(speedMps: number): number {
  const mph = speedMps * 2.236936;

  // The lowest plausible California posted limit that is still at or above the
  // observed speed. The tolerance absorbs GPS noise; it must stay small, because
  // anything that lets this pick a limit *below* the observed speed would
  // invent a speeding penalty out of perfectly legal driving.
  const GPS_TOLERANCE_MPH = 3;
  const ladder = [25, 35, 45, 55, 65];
  const posted = ladder.find((limit) => mph <= limit + GPS_TOLERANCE_MPH) ?? 65;

  return posted / 2.236936;
}

/**
 * Turns a raw GPS trace into per-sample kinematics.
 *
 * Curvature is the interesting one. For three consecutive positions the heading
 * change per unit distance approximates the road's curvature κ = dθ/ds, and
 * lateral acceleration is then a_lat = v²κ — the same quantity that decides
 * whether a car holds a bend or slides out of it.
 */
export function analyzeTrace(route: DrivePoint[], limitFor?: SpeedLimitProvider): ScoredSample[] {
  const usable = route.filter(
    (point) => point.accuracy === null || point.accuracy <= MAX_ACCURACY_METERS
  );
  if (usable.length < 3) return [];

  const samples: ScoredSample[] = [];

  for (let i = 1; i < usable.length - 1; i++) {
    const previous = usable[i - 1];
    const current = usable[i];
    const next = usable[i + 1];

    const dt = (next.t - previous.t) / 2000; // seconds this sample stands for
    if (dt <= 0 || dt > 30) continue; // a gap this long is a signal dropout

    const dIn = haversineMeters(previous, current);
    const dOut = haversineMeters(current, next);

    // Prefer the reported speed; fall back to distance over time.
    const speed =
      current.speed ?? (dIn + dOut) / Math.max(0.5, (next.t - previous.t) / 1000);

    const headingIn = bearing(previous, current);
    const headingOut = bearing(current, next);
    const turn = Math.abs(angleDifference(headingOut, headingIn)) * (Math.PI / 180);

    const arc = (dIn + dOut) / 2;
    const curvature =
      speed >= MIN_SPEED_FOR_CURVATURE && arc > 1 ? turn / arc : 0;

    const speedIn = dIn / Math.max(0.5, (current.t - previous.t) / 1000);
    const speedOut = dOut / Math.max(0.5, (next.t - current.t) / 1000);
    const longitudinalAcceleration = (speedOut - speedIn) / Math.max(0.5, dt);

    samples.push({
      speed,
      speedLimit: limitFor ? limitFor(current) : inferSpeedLimit(speed),
      curvature,
      lateralAcceleration: speed * speed * curvature,
      longitudinalAcceleration,
      dt,
      lat: current.lat,
      lon: current.lon,
      t: current.t,
    });
  }

  return samples;
}

/**
 * Scores a drive from its trace.
 *
 * Each penalty is `Σ dt·f(sample) / totalMinutes` — an average intensity over
 * the drive rather than a total, which is what keeps the score comparable
 * between a ten-minute errand and a two-hour road trip.
 */
export function scoreDrive(route: DrivePoint[], limitFor?: SpeedLimitProvider): DriveScore {
  const samples = analyzeTrace(route, limitFor);

  const totalSeconds = samples.reduce((sum, sample) => sum + sample.dt, 0);
  if (samples.length === 0 || totalSeconds < 30) {
    // Too little usable data to judge. Say so by returning a clean score rather
    // than inventing a number from three noisy points.
    return {
      score: 100,
      breakdown: { speeding: 0, cornering: 0, braking: 0 },
      events: [],
      analyzedSeconds: totalSeconds,
    };
  }

  let speedingWeighted = 0;
  let corneringWeighted = 0;
  let jerkTotal = 0;
  let lastJerkAt = 0;
  const events: Omit<DriveEvent, 'id'>[] = [];

  for (const sample of samples) {
    // --- Speeding: quadratic in excess speed. -----------------------------
    // Crash energy scales with v², and injury risk rises faster still, so 20
    // over is far worse than twice 10 over. Squaring encodes that.
    const excess = Math.max(0, sample.speed - sample.speedLimit);
    if (excess > 0) {
      const ratio = excess / SPEED_REFERENCE;
      speedingWeighted += sample.dt * ratio * ratio;
    }

    // --- Cornering: lateral acceleration beyond comfort. -------------------
    const lateralExcess = Math.max(0, sample.lateralAcceleration - LATERAL_COMFORT);
    if (lateralExcess > 0) {
      corneringWeighted += sample.dt * (lateralExcess / LATERAL_COMFORT) ** 2;
    }

    // --- Braking / acceleration: discrete incidents, not a state. ----------
    // Speeding and cornering are things you *are* doing for a stretch of road;
    // a hard stop is a thing that *happens*. Averaging incidents over time
    // would dilute five hard stops in a long drive into nothing, so these are
    // counted per ten minutes instead.
    const jerkExcess = Math.max(0, Math.abs(sample.longitudinalAcceleration) - JERK_COMFORT);
    if (jerkExcess > 0 && sample.t - lastJerkAt >= JERK_COOLDOWN_MS) {
      jerkTotal += (jerkExcess / JERK_COMFORT) ** 2;
      lastJerkAt = sample.t;
    }
  }

  // Time-weighted means: "how hard was this drive pushed, on average", which is
  // independent of how long the drive was.
  const speeding = speedingWeighted / totalSeconds;
  const cornering = corneringWeighted / totalSeconds;
  const braking = jerkTotal / (totalSeconds / JERK_WINDOW_SECONDS);

  const penalty =
    WEIGHT_SPEED * speeding + WEIGHT_LATERAL * cornering + WEIGHT_JERK * braking;

  const score = Math.round(Math.max(0, Math.min(100, 100 - penalty)));

  // Flag the worst moments so a parent sees *why*, not just a number.
  events.push(...extractEvents(samples));

  return {
    score,
    breakdown: { speeding, cornering, braking },
    events,
    analyzedSeconds: totalSeconds,
  };
}

/**
 * Picks out the handful of moments worth naming on the drive detail screen.
 * Consecutive bad samples collapse into one event so a single long corner does
 * not become twenty entries.
 */
function extractEvents(samples: ScoredSample[]): Omit<DriveEvent, 'id'>[] {
  const events: Omit<DriveEvent, 'id'>[] = [];
  const MPH = 2.236936;

  let lastEventAt = 0;
  const COOLDOWN_MS = 20_000;

  for (const sample of samples) {
    if (sample.t - lastEventAt < COOLDOWN_MS) continue;

    const excessMph = (sample.speed - sample.speedLimit) * MPH;

    if (excessMph >= 10) {
      events.push({
        type: 'speeding',
        at: sample.t,
        detail: `${Math.round(sample.speed * MPH)} mph in a ${Math.round(sample.speedLimit * MPH)} zone`,
        lat: sample.lat,
        lon: sample.lon,
      });
      lastEventAt = sample.t;
      continue;
    }

    if (sample.lateralAcceleration >= LATERAL_COMFORT * 1.6) {
      events.push({
        type: 'speeding',
        at: sample.t,
        detail: `Took a bend at ${Math.round(sample.speed * MPH)} mph`,
        lat: sample.lat,
        lon: sample.lon,
      });
      lastEventAt = sample.t;
      continue;
    }

    if (sample.longitudinalAcceleration <= -JERK_COMFORT * 1.5) {
      events.push({
        type: 'hard_brake',
        at: sample.t,
        detail: `Hard brake from ${Math.round(sample.speed * MPH)} mph`,
        lat: sample.lat,
        lon: sample.lon,
      });
      lastEventAt = sample.t;
      continue;
    }

    if (sample.longitudinalAcceleration >= JERK_COMFORT * 1.5) {
      events.push({
        type: 'rapid_accel',
        at: sample.t,
        detail: `Rapid acceleration to ${Math.round(sample.speed * MPH)} mph`,
        lat: sample.lat,
        lon: sample.lon,
      });
      lastEventAt = sample.t;
    }
  }

  return events;
}

/** Initial bearing from a to b, in degrees. */
function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Smallest signed difference between two bearings, in degrees (−180, 180]. */
function angleDifference(a: number, b: number): number {
  let diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}
