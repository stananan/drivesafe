/**
 * Real speed limits, from OpenStreetMap.
 *
 * Without this the score compares every drive against a flat 80 mph, which
 * means a driver doing 50 in a 25 zone is treated as faultless. This asks what
 * road they were actually on.
 *
 * Three things about the data shaped the whole design, all confirmed against a
 * live query over Marin County rather than assumed:
 *
 *   1. **Coverage is partial and predictably so.** In a sample bbox, every
 *      motorway and secondary way carried a `maxspeed`; not one of the 122
 *      residential streets did. So the class fallback below is not a nicety, it
 *      is what handles most of the roads a teenager drives on.
 *   2. **The public endpoints are unreliable.** Of four tried, the first was too
 *      busy, the second returned a 500, the third returned nothing, and the
 *      fourth worked. Hence the list of mirrors and the willingness to give up.
 *   3. **Matching is the hard part, not fetching.** A GPS fix sits within a few
 *      metres of several roads at once — the street being driven, the one
 *      crossing it, the frontage road beside the motorway. Picking the closest
 *      is not good enough, so heading is used as well.
 *
 * Everything here fails soft. A drive scored against a flat limit is worse than
 * one scored against the real road, but it is far better than a drive that does
 * not save because Overpass was busy.
 */

import { absoluteLimit, type SpeedLimitProvider } from '@/lib/scoring';
import type { DrivePoint } from '@/types/drive';

const MPH = 2.236936;
const KMH = 3.6;

/** Tried in order. The public instances fail often enough to need alternatives. */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Long enough for a busy endpoint, short enough not to hold up a drive save. */
const REQUEST_TIMEOUT_MS = 12_000;

/** Roads worth asking about. Footpaths and cycleways are not driven on. */
const DRIVEABLE =
  '^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$';

/**
 * California's prima facie limits by road class, in mph, for the roads OSM does
 * not tag. Derived from CVC 22349 and 22352 — the observed data agrees, with
 * every tagged secondary in the sample reading exactly 35.
 */
const CLASS_LIMITS_MPH: Record<string, number> = {
  motorway: 65,
  motorway_link: 45,
  trunk: 55,
  trunk_link: 45,
  primary: 45,
  primary_link: 35,
  secondary: 35,
  secondary_link: 30,
  tertiary: 35,
  tertiary_link: 30,
  unclassified: 25,
  residential: 25,
  living_street: 15,
  service: 15,
};

/**
 * Added to a limit that was inferred rather than read off the map.
 *
 * A guess that comes in low manufactures a speeding penalty out of legal
 * driving, which is the one failure this feature cannot afford — a driver
 * punished for obeying a sign stops trusting the score entirely. Some
 * residential streets really are posted at 35, so an inferred 25 gets room to
 * be wrong in the safe direction. Tagged limits get no margin: those are read,
 * not guessed.
 */
const INFERRED_MARGIN_MPH = 8;

/** Past this, a fix is not on the road; it is near it. */
const SNAP_METRES = 30;

/** Closer than this, a match is accepted even when heading disagrees. */
const CONFIDENT_SNAP_METRES = 10;

/** Beyond this angle, the road runs across the direction of travel, not along it. */
const MAX_HEADING_DIFFERENCE = 50;

/** Below this, heading is noise and the filter is skipped. */
const MIN_SPEED_FOR_HEADING = 2.5; // m/s

/** A bbox bigger than this is split rather than requested whole. */
const MAX_BBOX_DEGREES = 0.25;

/** Politeness, and a bound on how long scoring can take. */
const MAX_REQUESTS = 4;

type Segment = {
  aLat: number;
  aLon: number;
  bLat: number;
  bLon: number;
  /** Metres per second. */
  limit: number;
  /** True when the limit came from the road class rather than a maxspeed tag. */
  inferred: boolean;
  /** Degrees. */
  bearing: number;
};

/**
 * Reads an OSM `maxspeed` value, in m/s.
 *
 * The tag is free text and carries several conventions. A bare number is km/h
 * by OSM convention; American data almost always says "35 mph" explicitly.
 * Anything not understood returns null rather than a guess — "none",
 * "signals", "variable" and country codes like "RU:urban" all mean the map is
 * not telling us a number.
 */
export function parseMaxspeed(raw: string): number | null {
  const value = raw.trim().toLowerCase();

  if (value === 'walk') return 5 / MPH;

  const mph = value.match(/^(\d+(?:\.\d+)?)\s*mph$/);
  if (mph) return Number(mph[1]) / MPH;

  const kmh = value.match(/^(\d+(?:\.\d+)?)(\s*km\/h)?$/);
  if (kmh) return Number(kmh[1]) / KMH;

  return null;
}

/** The limit implied by a road's class, in m/s, or null for classes we do not rate. */
export function inferFromClass(highway: string): number | null {
  const mph = CLASS_LIMITS_MPH[highway];
  return mph === undefined ? null : (mph + INFERRED_MARGIN_MPH) / MPH;
}

function bearingOf(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * How far apart two bearings are, ignoring which way along the road you are
 * going: a street runs the same direction whichever end you enter it from, so
 * 0 and 180 are the same road.
 */
function headingDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 180;
  return Math.min(diff, 180 - diff);
}

/** Metres from a point to a line segment, flat-earth over these distances. */
function distanceToSegment(
  lat: number,
  lon: number,
  segment: Segment
): number {
  const metresPerLat = 111_320;
  const metresPerLon = 111_320 * Math.cos((lat * Math.PI) / 180);

  const px = (lon - segment.aLon) * metresPerLon;
  const py = (lat - segment.aLat) * metresPerLat;
  const vx = (segment.bLon - segment.aLon) * metresPerLon;
  const vy = (segment.bLat - segment.aLat) * metresPerLat;

  const lengthSquared = vx * vx + vy * vy;
  if (lengthSquared === 0) return Math.hypot(px, py);

  // Where along the segment the perpendicular lands, clamped to its ends.
  const t = Math.max(0, Math.min(1, (px * vx + py * vy) / lengthSquared));

  return Math.hypot(px - t * vx, py - t * vy);
}

export type OverpassWay = {
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

function toSegments(ways: OverpassWay[]): Segment[] {
  const segments: Segment[] = [];

  for (const way of ways) {
    const tags = way.tags ?? {};
    const geometry = way.geometry ?? [];
    if (geometry.length < 2) continue;

    const tagged = tags.maxspeed ? parseMaxspeed(tags.maxspeed) : null;
    const limit = tagged ?? inferFromClass(tags.highway ?? '');
    if (limit === null) continue;

    for (let i = 1; i < geometry.length; i++) {
      const a = geometry[i - 1];
      const b = geometry[i];

      segments.push({
        aLat: a.lat,
        aLon: a.lon,
        bLat: b.lat,
        bLon: b.lon,
        limit,
        inferred: tagged === null,
        bearing: bearingOf(a.lat, a.lon, b.lat, b.lon),
      });
    }
  }

  return segments;
}

async function askOverpass(bbox: BoundingBox): Promise<OverpassWay[]> {
  const query = `[out:json][timeout:20];way["highway"~"${DRIVEABLE}"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out tags geom;`;

  for (const endpoint of ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) continue;

      const body = (await response.json()) as { elements?: OverpassWay[] };
      if (body.elements) return body.elements;
    } catch {
      // Busy, rate-limited, offline, or returning something that is not JSON.
      // Try the next mirror; if they all fail the caller scores without us.
    }

    // A moment between mirrors. These are donated public services and the
    // failure being worked around is usually load.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return [];
}

type BoundingBox = { south: number; west: number; north: number; east: number };

/** Padded so a road running just outside the driven line still comes back. */
function boxAround(points: DrivePoint[]): BoundingBox {
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);

  return {
    south: Math.min(...lats) - 0.002,
    west: Math.min(...lons) - 0.002,
    north: Math.max(...lats) + 0.002,
    east: Math.max(...lons) + 0.002,
  };
}

function widthOf(box: BoundingBox): number {
  return Math.max(box.north - box.south, box.east - box.west);
}

/**
 * The fewest bounding boxes that cover the route without any one of them being
 * too large.
 *
 * Almost every drive fits in one. Splitting unconditionally was costing four
 * requests for a two-minute trip around a housing estate, which is both wasteful
 * and the quickest way to get rate-limited off a free endpoint that the next
 * drive also needs.
 */
function boundingBoxes(route: DrivePoint[]): BoundingBox[] {
  const whole = boxAround(route);
  if (widthOf(whole) <= MAX_BBOX_DEGREES) return [whole];

  // Long drive. Split into as few chunks as will bring each under the cap.
  const chunks = Math.min(MAX_REQUESTS, Math.ceil(widthOf(whole) / MAX_BBOX_DEGREES));
  const size = Math.ceil(route.length / chunks);

  const boxes: BoundingBox[] = [];
  for (let i = 0; i < route.length; i += size) {
    boxes.push(boxAround(route.slice(i, i + size)));
  }

  return boxes.slice(0, MAX_REQUESTS);
}

/**
 * Picks the road a fix was on.
 *
 * Distance alone is not enough. Standing at a junction, the cross street is as
 * close as the one being driven; beside a motorway, the frontage road is closer
 * than the carriageway. Heading resolves both — a road running across the
 * direction of travel is not the road being driven, however near it is.
 *
 * Below walking pace heading is noise, so the filter is dropped and only a very
 * close road is accepted.
 */
function matchSegment(
  point: DrivePoint,
  heading: number | null,
  segments: Segment[]
): Segment | null {
  let best: Segment | null = null;
  let bestDistance = Infinity;
  let closest: Segment | null = null;
  let closestDistance = Infinity;

  for (const segment of segments) {
    const distance = distanceToSegment(point.lat, point.lon, segment);
    if (distance > SNAP_METRES) continue;

    if (distance < closestDistance) {
      closestDistance = distance;
      closest = segment;
    }

    if (heading !== null && headingDifference(segment.bearing, heading) > MAX_HEADING_DIFFERENCE) {
      continue;
    }

    if (distance < bestDistance) {
      bestDistance = distance;
      best = segment;
    }
  }

  if (best) return best;

  // Nothing aligned. Accept the nearest road only if the fix is practically on
  // top of it, which covers junctions and stationary traffic.
  return closestDistance <= CONFIDENT_SNAP_METRES ? closest : null;
}

/**
 * Removes isolated disagreements.
 *
 * One fix matched to a cross street shows up as a single point with a different
 * limit from its neighbours on both sides. Taking the neighbours' value in that
 * case costs nothing when the match was right — a road really does change limit
 * over more than one fix — and removes the spikes when it was wrong.
 */
function smooth(limits: (number | null)[]): (number | null)[] {
  const out = [...limits];

  for (let i = 1; i < limits.length - 1; i++) {
    const previous = limits[i - 1];
    const next = limits[i + 1];

    if (previous !== null && previous === next && limits[i] !== previous) {
      out[i] = previous;
    }
  }

  return out;
}

function keyOf(lat: number, lon: number): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

/**
 * Looks up the real limit for every point of a drive.
 *
 * Resolves null when nothing usable came back, which the caller should treat as
 * "score against the absolute limit" rather than as an error.
 *
 * The work happens here, once, rather than in the returned function: the whole
 * route is known up front, which is what makes heading available for matching
 * and neighbours available for smoothing. The provider itself is then a map
 * lookup.
 */
export async function buildSpeedLimitProvider(
  route: DrivePoint[]
): Promise<SpeedLimitProvider | null> {
  if (route.length < 2) return null;

  const ways: OverpassWay[] = [];

  for (const box of boundingBoxes(route)) {
    ways.push(...(await askOverpass(box)));
  }

  return buildProviderFromWays(route, ways);
}

/**
 * The matching half, separated from the fetching half so it can be tested.
 *
 * Public Overpass instances refuse often enough that a test depending on one
 * tells you about their load rather than about this code. `npm run check-limits`
 * runs this against a saved response from a real place instead.
 */
export function buildProviderFromWays(
  route: DrivePoint[],
  ways: OverpassWay[]
): SpeedLimitProvider | null {
  const segments = toSegments(ways);
  if (segments.length === 0) return null;

  const matched: (number | null)[] = route.map((point, index) => {
    const previous = route[index - 1];
    const next = route[index + 1];

    const heading =
      (point.speed ?? 0) >= MIN_SPEED_FOR_HEADING && (previous || next)
        ? bearingOf(
            (previous ?? point).lat,
            (previous ?? point).lon,
            (next ?? point).lat,
            (next ?? point).lon
          )
        : null;

    return matchSegment(point, heading, segments)?.limit ?? null;
  });

  const limits = new Map<string, number>();
  const smoothed = smooth(matched);

  route.forEach((point, index) => {
    const limit = smoothed[index];
    if (limit !== null) limits.set(keyOf(point.lat, point.lon), limit);
  });

  if (limits.size === 0) return null;

  return (point) => limits.get(keyOf(point.lat, point.lon)) ?? absoluteLimit();
}

