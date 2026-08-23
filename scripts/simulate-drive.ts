/**
 * Drives the scoring engine down synthetic roads.
 *
 * The whole app has been built in a bedroom. Everything downstream of the GPS
 * trace — distance, speed limits, cornering, braking, the score itself — has
 * therefore only ever seen a stationary phone. This generates traces that look
 * like real journeys and runs the real `scoreDrive` over them, so the numbers
 * can be sanity-checked before anyone straps a phone to a windscreen.
 *
 * It is not a substitute for a road test. Synthetic GPS is far cleaner than the
 * real thing: no multipath off buildings, no tunnels, no dropped fixes. What it
 * does catch is the class of problem where the maths is wrong in the direction
 * of "every drive scores 100" or "every turn is reckless", which is exactly the
 * kind of thing a first road test would otherwise waste an afternoon on.
 *
 * Run with: npm run simulate
 */

import { scoreDrive } from '../src/lib/scoring';
import type { DrivePoint } from '../src/types/drive';

const MPH = 2.236936;
const METRES_PER_DEGREE_LAT = 111_320;

/** Marin County, so the coordinates look like somewhere DriveSafe would be used. */
const ORIGIN = { lat: 38.0834, lon: -122.7633 };

type Cursor = {
  lat: number;
  lon: number;
  /** Degrees, 0 = north. */
  heading: number;
  t: number;
};

function advance(cursor: Cursor, metres: number) {
  const rad = (cursor.heading * Math.PI) / 180;
  const dNorth = Math.cos(rad) * metres;
  const dEast = Math.sin(rad) * metres;

  cursor.lat += dNorth / METRES_PER_DEGREE_LAT;
  cursor.lon +=
    dEast / (METRES_PER_DEGREE_LAT * Math.cos((cursor.lat * Math.PI) / 180));
}

/** A stretch of straight road held at one speed. */
function straight(cursor: Cursor, mph: number, seconds: number): DrivePoint[] {
  const speed = mph / MPH;
  const points: DrivePoint[] = [];

  for (let i = 0; i < seconds; i++) {
    advance(cursor, speed);
    cursor.t += 1000;
    points.push({ t: cursor.t, lat: cursor.lat, lon: cursor.lon, speed, accuracy: 5 });
  }

  return points;
}

/** A constant-speed change of direction, of a given radius. */
function bend(
  cursor: Cursor,
  mph: number,
  radiusMetres: number,
  totalDegrees: number
): DrivePoint[] {
  const speed = mph / MPH;
  const arcLength = (Math.abs(totalDegrees) / 360) * 2 * Math.PI * radiusMetres;
  const seconds = Math.max(1, Math.round(arcLength / speed));
  const degreesPerStep = totalDegrees / seconds;

  const points: DrivePoint[] = [];

  for (let i = 0; i < seconds; i++) {
    cursor.heading += degreesPerStep;
    advance(cursor, speed);
    cursor.t += 1000;
    points.push({ t: cursor.t, lat: cursor.lat, lon: cursor.lon, speed, accuracy: 5 });
  }

  return points;
}

/** Speeding up or slowing down at a constant rate, in m/s². */
function ramp(cursor: Cursor, fromMph: number, toMph: number, rate: number): DrivePoint[] {
  const from = fromMph / MPH;
  const to = toMph / MPH;
  const seconds = Math.max(1, Math.round(Math.abs(to - from) / rate));

  const points: DrivePoint[] = [];

  for (let i = 1; i <= seconds; i++) {
    const speed = from + ((to - from) * i) / seconds;
    advance(cursor, Math.max(0, speed));
    cursor.t += 1000;
    points.push({
      t: cursor.t,
      lat: cursor.lat,
      lon: cursor.lon,
      speed: Math.max(0, speed),
      accuracy: 5,
    });
  }

  return points;
}

function newCursor(): Cursor {
  // A fixed start time keeps runs comparable between invocations.
  return { ...ORIGIN, heading: 0, t: 1_700_000_000_000 };
}

type Scenario = {
  name: string;
  expectation: string;
  build: () => DrivePoint[];
  /** Noise flags the microphone would have raised on this drive. */
  loudFlags?: number;
};

const SCENARIOS: Scenario[] = [
  {
    name: 'Quiet suburban errand',
    expectation: 'should score high — this is careful driving',
    build: () => {
      // Speed changes are ramped rather than stepped. A car cannot go from a
      // standstill to twelve miles an hour between one GPS fix and the next,
      // and pretending otherwise puts an impossible spike in the trace that the
      // scorer is right to object to.
      const c = newCursor();
      return [
        ...ramp(c, 0, 30, 1.5),
        ...straight(c, 30, 120),
        ...ramp(c, 30, 20, 1.5),
        ...bend(c, 20, 25, 90),
        ...ramp(c, 20, 30, 1.5),
        ...straight(c, 30, 120),
        ...ramp(c, 30, 20, 1.5),
        ...bend(c, 20, 25, -90),
        ...ramp(c, 20, 30, 1.5),
        ...straight(c, 30, 90),
        ...ramp(c, 30, 0, 1.5),
      ];
    },
  },
  {
    name: 'City stop-and-go with junction turns',
    expectation: 'should score high — ordinary town driving, not aggression',
    build: () => {
      const c = newCursor();
      const points: DrivePoint[] = [];

      for (let block = 0; block < 6; block++) {
        points.push(...ramp(c, 0, 25, 1.8));
        points.push(...straight(c, 25, 40));
        points.push(...ramp(c, 25, 0, 2.0));
        points.push(...straight(c, 0, 5));
        // Pull away, turn the corner, and get back up to speed — all ramped.
        points.push(...ramp(c, 0, 12, 1.8));
        points.push(...bend(c, 12, 9, block % 2 === 0 ? 90 : -90));
        points.push(...ramp(c, 12, 25, 1.8));
        points.push(...straight(c, 25, 20));
        points.push(...ramp(c, 25, 0, 2.0));
        points.push(...straight(c, 0, 5));
      }

      return points;
    },
  },
  {
    name: 'Motorway cruise',
    expectation: 'should score high — fast but steady and legal',
    build: () => {
      const c = newCursor();
      return [
        ...ramp(c, 0, 65, 1.5),
        ...straight(c, 65, 600),
        ...bend(c, 65, 400, 30),
        ...straight(c, 65, 300),
        ...ramp(c, 65, 0, 1.5),
      ];
    },
  },
  {
    name: 'Fast bend and hard stops, but never over 80',
    expectation: 'scores 100 — the deliberate cost of dropping cornering and braking',
    build: () => {
      const c = newCursor();
      return [
        ...ramp(c, 0, 55, 3.0),
        ...straight(c, 55, 60),
        // Taken at speed with no braking: 55 mph around a 45 m bend is about
        // 1.3 g, which is the point of this scenario.
        ...bend(c, 55, 45, 90),
        ...straight(c, 55, 30),
        ...ramp(c, 55, 0, 6.5),
        ...straight(c, 0, 10),
        ...ramp(c, 0, 50, 4.5),
        ...straight(c, 50, 40),
        ...ramp(c, 50, 0, 6.0),
      ];
    },
  },
  {
    name: 'Calm drive, but the GPS misbehaves',
    expectation: 'should still score high — glitches are not bad driving',
    build: () => {
      const c = newCursor();
      const clean = [
        ...ramp(c, 0, 30, 1.5),
        ...straight(c, 30, 120),
        ...ramp(c, 30, 20, 1.5),
        ...bend(c, 20, 25, 90),
        ...ramp(c, 20, 30, 1.5),
        ...straight(c, 30, 180),
        ...ramp(c, 30, 0, 1.5),
      ];

      // Three things that happen on every real drive and never in a bedroom:
      // a tunnel or an overpass swallowing a few seconds of fixes, a reflection
      // off a building throwing one fix sideways, and a stretch where the phone
      // reports a position it is not confident about.
      const damaged = clean.filter((_, index) => index < 60 || index > 63);

      const multipath = damaged.map((point, index) =>
        index === 100
          // Reported with high confidence, because that is what multipath does:
          // the phone is not unsure, it is wrong. The accuracy filter cannot
          // save us here — only the plausibility clamps can.
          ? { ...point, lat: point.lat + 0.0004, lon: point.lon - 0.0003, accuracy: 6 }
          : point
      );

      return multipath.map((point, index) =>
        index > 150 && index < 160 ? { ...point, accuracy: 45 } : point
      );
    },
  },
  {
    name: 'Sustained 85 mph',
    expectation: 'should be penalised — this is the one thing speed still catches',
    build: () => {
      const c = newCursor();
      return [...ramp(c, 0, 85, 2.0), ...straight(c, 85, 600), ...ramp(c, 85, 0, 2.0)];
    },
  },
  {
    name: 'Legal speed, but a carful of noise',
    expectation: 'should lose points for the noise alone',
    build: () => {
      const c = newCursor();
      return [...ramp(c, 0, 35, 1.5), ...straight(c, 35, 600), ...ramp(c, 35, 0, 1.5)];
    },
    loudFlags: 4,
  },
  {
    name: 'Brief 95 mph blast',
    expectation: 'short but far over — should hurt',
    build: () => {
      const c = newCursor();
      return [
        ...ramp(c, 0, 60, 2.0),
        ...straight(c, 60, 120),
        ...ramp(c, 60, 95, 2.0),
        ...straight(c, 95, 30),
        ...ramp(c, 95, 60, 2.5),
        ...straight(c, 60, 120),
        ...ramp(c, 60, 0, 2.0),
      ];
    },
  },
];

function summarise(points: DrivePoint[]) {
  const metres = points.reduce((sum, point, index) => {
    if (index === 0) return sum;
    const previous = points[index - 1];
    const dLat = (point.lat - previous.lat) * METRES_PER_DEGREE_LAT;
    const dLon =
      (point.lon - previous.lon) *
      METRES_PER_DEGREE_LAT *
      Math.cos((point.lat * Math.PI) / 180);
    return sum + Math.hypot(dLat, dLon);
  }, 0);

  const top = Math.max(...points.map((point) => point.speed ?? 0));

  return { minutes: points.length / 60, miles: metres / 1609.344, topMph: top * MPH };
}

console.log('DriveSafe scoring, driven down synthetic roads\n');

for (const scenario of SCENARIOS) {
  const points = scenario.build();
  const shape = summarise(points);
  const durationSeconds = points.length;

  // Scored the way finishDrive scores it, minus the noise flags, which come
  // from the microphone rather than the trace.
  const result = scoreDrive(points, {
    durationSeconds,
    loudAudioAlerts: scenario.loudFlags ?? 0,
  });

  console.log(`${scenario.name}`);
  console.log(`  ${scenario.expectation}`);
  console.log(
    `  ${shape.miles.toFixed(1)} mi over ${shape.minutes.toFixed(1)} min, top ${shape.topMph.toFixed(0)} mph`
  );
  console.log(`  SCORE ${result.score}`);
  console.log(
    `  penalties  speeding ${result.breakdown.speeding.toFixed(2)}` +
      `  noise ${result.breakdown.distraction.toFixed(0)}`
  );

  const counts = new Map<string, number>();
  for (const event of result.events) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  }

  console.log(
    `  events     ${
      counts.size === 0
        ? 'none'
        : [...counts].map(([type, count]) => `${type} x${count}`).join(', ')
    }`
  );
  console.log();
}
