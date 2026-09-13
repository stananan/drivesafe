/**
 * DriveSafe safety scoring.
 *
 * Two things cost points: going too fast, and letting the car get loud. That is
 * the whole model.
 *
 *   score = 100 − clamp( speeding + distraction , 0, 100 )
 *
 * An earlier version also scored cornering and harsh braking, derived from the
 * geometry of the GPS trace. Both were dropped deliberately, and the reasoning
 * is in `SCORING.md` — the short version is that neither could be verified
 * without a road database, both punished ordinary driving under bad GPS, and a
 * score a teenager does not believe is a score they switch off.
 *
 * What is left is defensible from the trace alone: speed is measured directly
 * by the phone's Doppler receiver rather than inferred from anything, and a
 * noise flag is a discrete event the microphone raised.
 */

import type { DriveEvent, DrivePoint } from '@/types/drive';

// --- Tunables -------------------------------------------------------------

/**
 * The speed above which a drive is penalised when no road data is available.
 *
 * Deliberately high. Without knowing the actual limit, the only honest line is
 * one nobody crosses by accident — and a score that punishes a driver who was
 * doing nothing wrong is worse than one that occasionally lets something go.
 *
 * This is also the number to lower the moment `SpeedLimitProvider` is given a
 * real source, because then the question stops being "is this fast in the
 * abstract" and becomes "is this faster than the road allows".
 */
export const ABSOLUTE_LIMIT_MPH = 80;

/** Excess speed, in m/s, that counts as one unit of speeding. */
const SPEED_REFERENCE = 2.24; // ~5 mph

/**
 * Ten seconds at one unit over the limit costs this many points, and the cost
 * grows with the square of how far over. Sustained 5 over for a minute is about
 * 3 points; 20 over for the same minute is about 48.
 */
const WEIGHT_SPEEDING = 0.5;

/** What one sustained loud spell costs. */
const WEIGHT_DISTRACTION = 5.0;

/** Fixes worse than this are too noisy to trust. */
const MAX_ACCURACY_METERS = 30;

/**
 * A car cannot exceed this, so a reading above it is a bad fix rather than a
 * driver. Only relevant on the fallback path below.
 */
const MAX_PLAUSIBLE_SPEED = 90; // m/s, about 200 mph

const MPH = 2.236936;

export type ScoredSample = {
  /** Metres per second. */
  speed: number;
  /** Limit used for this sample, m/s. */
  speedLimit: number;
  /** Seconds this sample represents. */
  dt: number;
  lat: number;
  lon: number;
  t: number;
};

export type DriveScore = {
  /** 0–100, higher is safer. */
  score: number;
  /** Penalty contributions, for explaining the score. */
  breakdown: {
    speeding: number;
    distraction: number;
  };
  events: Omit<DriveEvent, 'id'>[];
  /** Seconds of usable trace the score was computed from. */
  analyzedSeconds: number;
};

/**
 * Provides a limit for a coordinate, in m/s.
 *
 * The seam for real road data. Give this a source — OpenStreetMap, Mapbox, HERE
 * — and every drive is scored against the road it was actually on, with no other
 * change anywhere. `SCORING.md` documents what that would take.
 */
export type SpeedLimitProvider = (point: { lat: number; lon: number }) => number;

/** The absolute limit, in m/s, used when no road data is available. */
export function absoluteLimit(): number {
  return ABSOLUTE_LIMIT_MPH / MPH;
}

/**
 * Turns a raw GPS trace into per-sample speeds.
 *
 * Speed comes from the phone's own reading wherever it exists. That figure is
 * derived from Doppler shift and is far steadier than anything recovered by
 * differentiating position — a reflection off a building moves a position fix
 * tens of metres without touching the Doppler speed. Distance between fixes is
 * only the fallback, for the times iOS reports -1.
 */
export function analyzeTrace(route: DrivePoint[], limitFor?: SpeedLimitProvider): ScoredSample[] {
  const usable = route.filter(
    (point) => point.accuracy === null || point.accuracy <= MAX_ACCURACY_METERS
  );
  if (usable.length < 2) return [];

  const samples: ScoredSample[] = [];

  for (let i = 1; i < usable.length; i++) {
    const previous = usable[i - 1];
    const current = usable[i];

    const dt = (current.t - previous.t) / 1000;
    if (dt <= 0 || dt > 30) continue; // a gap this long is a signal dropout

    const speed = current.speed ?? fallbackSpeed(previous, current, dt);
    if (speed === null || speed > MAX_PLAUSIBLE_SPEED) continue;

    samples.push({
      speed,
      speedLimit: limitFor ? limitFor(current) : absoluteLimit(),
      dt,
      lat: current.lat,
      lon: current.lon,
      t: current.t,
    });
  }

  return samples;
}

/** Distance over time, for fixes the OS could not put a speed on. */
function fallbackSpeed(
  previous: DrivePoint,
  current: DrivePoint,
  dt: number
): number | null {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(current.lat - previous.lat);
  const dLon = toRad(current.lon - previous.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(previous.lat)) * Math.cos(toRad(current.lat));

  const metres = 2 * R * Math.asin(Math.sqrt(h));

  return metres / dt;
}

/**
 * Scores a drive.
 *
 * Speeding is time-weighted: it matters how long the car was over the limit and
 * how far over, not how many separate times it happened. Noise is the opposite —
 * a discrete thing that happened, counted flat, because a flag is already
 * rate-limited to one a minute by the monitor that raises it.
 */
export function scoreDrive(
  route: DrivePoint[],
  options: {
    limitFor?: SpeedLimitProvider;
    /**
     * How many sustained loud-audio alerts fired during the drive. These come
     * from the microphone rather than the trace, so they cannot be derived here
     * and have to be handed in by the caller.
     */
    loudAudioAlerts?: number;
    /** Unused by the current model; kept so callers do not have to change. */
    durationSeconds?: number;
  } = {}
): DriveScore {
  const { limitFor, loudAudioAlerts = 0 } = options;

  const samples = analyzeTrace(route, limitFor);
  const analyzedSeconds = samples.reduce((sum, sample) => sum + sample.dt, 0);

  let speeding = 0;

  for (const sample of samples) {
    const excess = Math.max(0, sample.speed - sample.speedLimit);
    if (excess <= 0) continue;

    // Quadratic in how far over, because crash energy goes as v² and the risk
    // of a fatal outcome rises faster still. Ten over is far worse than twice
    // five over, and the arithmetic should say so.
    const units = excess / SPEED_REFERENCE;
    speeding += (sample.dt / 10) * units * units;
  }

  const distraction = loudAudioAlerts;

  const penalty = WEIGHT_SPEEDING * speeding + WEIGHT_DISTRACTION * distraction;

  return {
    score: Math.round(Math.max(0, Math.min(100, 100 - penalty))),
    breakdown: { speeding, distraction },
    events: extractEvents(samples),
    analyzedSeconds,
  };
}

/**
 * Names the stretches worth showing a parent.
 *
 * One event per continuous spell over the limit rather than one per sample, so
 * a minute of motorway speeding is a single line rather than sixty.
 */
function extractEvents(samples: ScoredSample[]): Omit<DriveEvent, 'id'>[] {
  const events: Omit<DriveEvent, 'id'>[] = [];

  let spellStart: ScoredSample | null = null;
  let spellPeak = 0;

  const close = () => {
    if (!spellStart) return;

    events.push({
      type: 'speeding',
      at: spellStart.t,
      detail: `${Math.round(spellPeak * MPH)} mph, over the ${Math.round(
        spellStart.speedLimit * MPH
      )} limit`,
      lat: spellStart.lat,
      lon: spellStart.lon,
    });

    spellStart = null;
    spellPeak = 0;
  };

  for (const sample of samples) {
    if (sample.speed > sample.speedLimit) {
      spellStart ??= sample;
      spellPeak = Math.max(spellPeak, sample.speed);
    } else {
      close();
    }
  }

  close();

  return events;
}
