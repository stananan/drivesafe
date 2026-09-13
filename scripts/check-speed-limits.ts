/**
 * Checks the speed-limit matcher against real OpenStreetMap data.
 *
 * The fixture is a genuine Overpass response for central Marin — 166 ways, of
 * which 41 carry a `maxspeed` and 122 residential streets carry nothing. Drives
 * are synthesised along roads that actually exist in it, and the matcher has to
 * return the limit those roads really have.
 *
 * It reads from disk rather than the network on purpose. Public Overpass
 * instances refused three times out of four while this was being written, and a
 * check that fails because a donated server is busy tells you nothing about the
 * code. Refresh the fixture with `npm run check-limits -- --refresh` when the
 * matching rules change enough to want new ground truth.
 *
 * Run with: npm run check-limits
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { absoluteLimit } from '../src/lib/scoring';
import {
  buildProviderFromWays,
  inferFromClass,
  parseMaxspeed,
  type OverpassWay,
} from '../src/lib/speed-limits';
import type { DrivePoint } from '../src/types/drive';

const MPH = 2.236936;
const FIXTURE = join(import.meta.dirname, 'fixtures', 'marin-roads.json');

/** Central Marin: motorway, secondary roads, and a lot of untagged residential. */
const BBOX = { south: 38.07, west: -122.56, north: 38.085, east: -122.54 };

let failures = 0;

function report(name: string, pass: boolean, detail: string) {
  if (!pass) failures++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`        ${detail}`);
}

async function refreshFixture() {
  const query = `[out:json][timeout:25];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});out tags geom;`;

  for (const endpoint of [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]) {
    try {
      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`);
      if (!response.ok) continue;

      const body = (await response.json()) as { elements?: OverpassWay[] };
      if (!body.elements?.length) continue;

      writeFileSync(FIXTURE, JSON.stringify({ elements: body.elements }));
      console.log(`Refreshed fixture from ${endpoint}: ${body.elements.length} ways\n`);
      return;
    } catch {
      // Next mirror.
    }
  }

  console.log('Could not refresh — every mirror refused. Keeping the existing fixture.\n');
}

/** Walks a real way's geometry, one fix a second, as if driving along it. */
function driveAlong(way: OverpassWay, speedMph: number): DrivePoint[] {
  const geometry = way.geometry ?? [];
  const speed = speedMph / MPH;
  const points: DrivePoint[] = [];

  let t = 1_700_000_000_000;

  for (let i = 0; i < geometry.length - 1; i++) {
    const a = geometry[i];
    const b = geometry[i + 1];

    for (const fraction of [0, 0.5]) {
      points.push({
        t: (t += 1000),
        lat: a.lat + (b.lat - a.lat) * fraction,
        lon: a.lon + (b.lon - a.lon) * fraction,
        speed,
        accuracy: 5,
      });
    }
  }

  return points;
}

function shareMatching(
  route: DrivePoint[],
  ways: OverpassWay[],
  expected: number
): { share: number; count: number } {
  const provider = buildProviderFromWays(route, ways);
  const readings = route.map((point) => provider?.(point) ?? absoluteLimit());
  const correct = readings.filter((value) => Math.abs(value - expected) < 0.01).length;

  return { share: correct / readings.length, count: readings.length };
}

async function main() {
  if (process.argv.includes('--refresh')) await refreshFixture();

  console.log('Speed-limit matching, against a real OpenStreetMap response\n');

  console.log('Tag parsing');
  const parseCases: [string, number | null][] = [
    ['35 mph', 35 / MPH],
    ['65 mph', 65 / MPH],
    ['50', 50 / 3.6],
    ['none', null],
    ['signals', null],
    ['RU:urban', null],
    ['walk', 5 / MPH],
  ];

  for (const [raw, expected] of parseCases) {
    const actual = parseMaxspeed(raw);
    const pass =
      expected === null ? actual === null : actual !== null && Math.abs(actual - expected) < 0.01;

    report(
      `"${raw}"`,
      pass,
      actual === null ? 'no number — falls back to the road class' : `${(actual * MPH).toFixed(0)} mph`
    );
  }

  console.log('\nClass fallback (California prima facie, plus the safe-direction margin)');
  for (const highway of ['motorway', 'residential', 'secondary', 'footway']) {
    const limit = inferFromClass(highway);
    report(
      highway,
      highway === 'footway' ? limit === null : limit !== null,
      limit === null ? 'not a road we rate' : `${(limit * MPH).toFixed(0)} mph`
    );
  }

  const ways = (JSON.parse(readFileSync(FIXTURE, 'utf8')) as { elements: OverpassWay[] }).elements;
  const tagged = ways.filter((way) => way.tags?.maxspeed);

  console.log(
    `\nFixture: ${ways.length} real ways, ${tagged.length} tagged (${Math.round(
      (100 * tagged.length) / ways.length
    )}%)\n`
  );

  console.log('Driving along real roads');

  const motorway = ways.find(
    (way) =>
      way.tags?.highway === 'motorway' && way.tags?.maxspeed && (way.geometry?.length ?? 0) > 6
  );

  if (motorway) {
    const expected = parseMaxspeed(motorway.tags!.maxspeed!)!;
    const { share, count } = shareMatching(driveAlong(motorway, 60), ways, expected);

    report(
      `tagged motorway, ${motorway.tags!.maxspeed}`,
      share > 0.9,
      `${Math.round(share * 100)}% of ${count} fixes read ${(expected * MPH).toFixed(0)} mph`
    );
  }

  const residential = ways.find(
    (way) =>
      way.tags?.highway === 'residential' && !way.tags?.maxspeed && (way.geometry?.length ?? 0) > 6
  );

  if (residential) {
    const expected = inferFromClass('residential')!;
    const route = driveAlong(residential, 25);
    const { share, count } = shareMatching(route, ways, expected);

    report(
      `untagged residential "${residential.tags?.name ?? 'unnamed'}"`,
      share > 0.8,
      `${Math.round(share * 100)}% of ${count} fixes fell back to ${(expected * MPH).toFixed(0)} mph`
    );

    // The failure mode this whole design exists to avoid: one fix snapping to a
    // cross street and inventing a different limit halfway down a road.
    const provider = buildProviderFromWays(route, ways);
    const distinct = new Set(route.map((point) => provider?.(point) ?? 0));

    report(
      'one street reads as one limit',
      distinct.size <= 2,
      `${distinct.size} distinct limit${distinct.size === 1 ? '' : 's'} along its length`
    );
  }

  const secondary = ways.find(
    (way) =>
      way.tags?.highway === 'secondary' && way.tags?.maxspeed && (way.geometry?.length ?? 0) > 6
  );

  if (secondary) {
    const expected = parseMaxspeed(secondary.tags!.maxspeed!)!;
    const { share, count } = shareMatching(driveAlong(secondary, 35), ways, expected);

    report(
      `tagged secondary "${secondary.tags?.name ?? 'unnamed'}", ${secondary.tags!.maxspeed}`,
      share > 0.85,
      `${Math.round(share * 100)}% of ${count} fixes read ${(expected * MPH).toFixed(0)} mph`
    );
  }

  // A drive nowhere near any of these roads must not be handed a limit at all.
  const elsewhere: DrivePoint[] = Array.from({ length: 10 }, (_, i) => ({
    t: 1_700_000_000_000 + i * 1000,
    lat: 39.5 + i * 0.0001,
    lon: -121.0,
    speed: 20,
    accuracy: 5,
  }));

  const strayProvider = buildProviderFromWays(elsewhere, ways);
  const strayReadings = elsewhere.map((point) => strayProvider?.(point) ?? absoluteLimit());

  report(
    'a drive off the map gets no invented limit',
    strayReadings.every((value) => Math.abs(value - absoluteLimit()) < 0.01),
    `all ${strayReadings.length} fixes fell back to the ${Math.round(
      absoluteLimit() * MPH
    )} mph absolute`
  );

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
  if (failures > 0) process.exitCode = 1;
}

void main();
