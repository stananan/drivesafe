/**
 * Live location sharing between family members.
 *
 * Only the most recent fix per person is stored — DriveSafe keeps no location
 * history outside the drives a driver deliberately records. Row-level security
 * means a query returns your family and nobody else, so there is no family
 * filter in here to get wrong.
 */

import { requireSupabase } from '@/lib/supabase';
import type { Role } from '@/types/drive';

export type FamilyLocation = {
  id: string;
  username: string;
  role: Role;
  lat: number;
  lon: number;
  /** Unix epoch milliseconds of the fix. */
  at: number;
  /** False when this person has switched sharing off. */
  isSharing: boolean;
};

type LocationRow = {
  id: string;
  username: string;
  role: Role;
  last_lat: number | null;
  last_lon: number | null;
  last_location_at: string | null;
  location_sharing: boolean;
};

/**
 * Everyone in the family who currently has a position to show.
 *
 * People who have never shared, or who have sharing switched off, are left out
 * rather than pinned at a stale place — a wrong dot on a map is worse than no
 * dot.
 */
export async function listFamilyLocations(): Promise<FamilyLocation[]> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, role, last_lat, last_lon, last_location_at, location_sharing');

  if (error) throw new Error(error.message);

  return ((data ?? []) as LocationRow[])
    .filter(
      (row) =>
        row.location_sharing &&
        row.last_lat !== null &&
        row.last_lon !== null &&
        row.last_location_at !== null
    )
    .map((row) => ({
      id: row.id,
      username: row.username,
      role: row.role,
      lat: row.last_lat!,
      lon: row.last_lon!,
      at: new Date(row.last_location_at!).getTime(),
      isSharing: row.location_sharing,
    }));
}

/** Publishes the caller's current position. */
export async function publishLocation(input: {
  userId: string;
  lat: number;
  lon: number;
}): Promise<void> {
  const supabase = requireSupabase();

  const { error } = await supabase
    .from('profiles')
    .update({
      last_lat: input.lat,
      last_lon: input.lon,
      last_location_at: new Date().toISOString(),
    })
    .eq('id', input.userId);

  if (error) throw new Error(error.message);
}

/** Turns broadcasting on or off without leaving the family. */
export async function setLocationSharing(userId: string, enabled: boolean): Promise<void> {
  const supabase = requireSupabase();

  const { error } = await supabase
    .from('profiles')
    .update({ location_sharing: enabled })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}

/** Whether the caller is currently broadcasting. */
export async function getLocationSharing(userId: string): Promise<boolean> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('profiles')
    .select('location_sharing')
    .eq('id', userId)
    .maybeSingle<{ location_sharing: boolean }>();

  if (error) throw new Error(error.message);

  return data?.location_sharing ?? true;
}
