/**
 * Unit helpers. The app speaks miles and mph everywhere in the UI because the
 * users are California teen drivers, but every value is stored in SI so the
 * data stays portable.
 */

const METERS_PER_MILE = 1609.344;
const MPS_TO_MPH = 2.236936;

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function mpsToMph(mps: number): number {
  return mps * MPS_TO_MPH;
}

export function formatMiles(meters: number): string {
  const miles = metersToMiles(meters);
  return miles < 10 ? miles.toFixed(1) : Math.round(miles).toString();
}

export function formatMph(mps: number): string {
  return Math.round(mpsToMph(mps)).toString();
}

/** `1h 04m` / `12m 30s` / `48s` — whichever unit pair reads best. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  return `${seconds}s`;
}

/** `Today, 4:12 PM` / `Yesterday, 8:03 AM` / `Mar 4, 8:03 AM` */
export function formatWhen(epochMs: number): string {
  const date = new Date(epochMs);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((startOfToday.getTime() - date.getTime()) / 86_400_000);

  if (dayDiff < 0) return `Today, ${time}`;
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

/** `3 min ago`, for the parent's "last seen" line. */
export function formatRelative(epochMs: number): string {
  const seconds = Math.round((Date.now() - epochMs) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** Great-circle distance in metres between two coordinates. */
export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.asin(Math.sqrt(h));
}
