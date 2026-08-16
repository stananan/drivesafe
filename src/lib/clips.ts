/**
 * Dashcam clips: getting them off the phone, and getting them back.
 *
 * A clip is several files rather than one. The dashcam records fixed-length
 * segments and keeps the trailing few, so saving a clip means keeping whichever
 * segments happened to be on disk. Nothing available to an Expo app can stitch
 * them together, so they are uploaded as ordered parts and played in sequence.
 *
 * Files live in a private bucket and come back as short-lived signed URLs. The
 * bucket policies in `supabase/schema.sql` decide access from the path, so the
 * layout `drives/<drive_id>/<clip_id>/<n>.mp4` is load-bearing — changing it
 * means changing those policies in the same commit.
 */

import { File } from 'expo-file-system';

import { requireSupabase } from '@/lib/supabase';
import type { DriveClip, DriveClipReason, FamilyClip } from '@/types/drive';

const BUCKET = 'drive-clips';

/** Long enough for a parent to watch a clip through without it expiring. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type PendingClipPart = {
  /** Local file uri produced by the camera. */
  uri: string;
  durationSeconds: number;
};

/**
 * Uploads the segments of one clip and records it against the drive.
 *
 * The database row is written first so the storage policies have a drive to
 * resolve the path against, and so a part that fails to upload leaves a clip
 * that is short rather than a set of orphaned files nothing points at.
 */
export async function saveClip(input: {
  driveId: string;
  reason: DriveClipReason;
  recordedAt: number;
  hasAudio: boolean;
  parts: PendingClipPart[];
}): Promise<string | null> {
  if (input.parts.length === 0) return null;

  const supabase = requireSupabase();

  const duration = input.parts.reduce((sum, part) => sum + part.durationSeconds, 0);

  const { data: clip, error } = await supabase
    .from('drive_clips')
    .insert({
      drive_id: input.driveId,
      reason: input.reason,
      recorded_at: new Date(input.recordedAt).toISOString(),
      duration_seconds: duration,
      has_audio: input.hasAudio,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) throw new Error(error.message);

  let uploaded = 0;
  let firstFailure: string | null = null;

  for (const [index, part] of input.parts.entries()) {
    const path = `drives/${input.driveId}/${clip.id}/${index}.mp4`;

    try {
      const file = new File(part.uri);
      if (!file.exists) continue;

      const bytes = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: 'video/mp4', upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { error: partError } = await supabase.from('drive_clip_parts').insert({
        clip_id: clip.id,
        part_index: index,
        storage_path: path,
        duration_seconds: part.durationSeconds,
        bytes: bytes.byteLength,
      });

      if (partError) throw new Error(partError.message);

      uploaded += 1;
    } catch (caught) {
      // One bad segment should not lose the rest of the clip. A clip with a gap
      // is still worth having; a failed upload that discards everything is not.
      const message = caught instanceof Error ? caught.message : String(caught);
      firstFailure ??= message;
      console.warn(`Could not upload clip part ${index}:`, message);
    }
  }

  // Nothing uploaded means the bucket is unreachable or its policies reject
  // this driver. Leaving the row behind would put an unplayable clip in the
  // list and make a broken bucket look like a broken player, so it goes, and
  // the driver hears about it.
  if (uploaded === 0) {
    await supabase.from('drive_clips').delete().eq('id', clip.id);
    throw new Error(firstFailure ?? 'No part of the clip could be uploaded.');
  }

  return clip.id;
}

type ClipRow = {
  id: string;
  reason: DriveClipReason;
  recorded_at: string;
  duration_seconds: number;
  has_audio: boolean;
};

type PartRow = {
  clip_id: string;
  part_index: number;
  storage_path: string;
  duration_seconds: number;
  bytes: number;
};

/**
 * Attaches parts and playable URLs to a set of clip rows.
 *
 * Signing happens in one batch rather than per part, because a handful of clips
 * would otherwise be a dozen round trips before anything could play.
 */
async function withParts(clips: ClipRow[]): Promise<DriveClip[]> {
  if (clips.length === 0) return [];

  const supabase = requireSupabase();

  const { data: partRows } = await supabase
    .from('drive_clip_parts')
    .select('clip_id, part_index, storage_path, duration_seconds, bytes')
    .in(
      'clip_id',
      clips.map((clip) => clip.id)
    )
    .order('part_index', { ascending: true });

  const parts = (partRows ?? []) as PartRow[];

  const signedByPath = new Map<string, string>();

  if (parts.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(
        parts.map((part) => part.storage_path),
        SIGNED_URL_TTL_SECONDS
      );

    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl);
    }
  }

  return clips.map((clip) => ({
    id: clip.id,
    reason: clip.reason,
    recordedAt: new Date(clip.recorded_at).getTime(),
    durationSeconds: clip.duration_seconds,
    hasAudio: clip.has_audio,
    parts: parts
      .filter((part) => part.clip_id === clip.id)
      .map((part) => ({
        index: part.part_index,
        // Null when signing failed — the UI shows the clip as unavailable
        // rather than handing the player a broken source.
        url: signedByPath.get(part.storage_path) ?? null,
        durationSeconds: part.duration_seconds,
        bytes: part.bytes,
      })),
  }));
}

/** Clips for one drive, newest first, with playable URLs. */
export async function listClips(driveId: string): Promise<DriveClip[]> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('drive_clips')
    .select('id, reason, recorded_at, duration_seconds, has_audio')
    .eq('drive_id', driveId)
    .order('recorded_at', { ascending: false });

  if (error) throw new Error(error.message);

  return withParts((data ?? []) as ClipRow[]);
}

/**
 * Every clip the caller can see, newest first, for the Clips tab.
 *
 * Row-level security scopes this to the family, so a driver gets their own and
 * a parent gets everyone's without either query saying so.
 */
export async function listRecentClips(limit = 60): Promise<FamilyClip[]> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('drive_clips')
    .select('id, drive_id, reason, recorded_at, duration_seconds, has_audio')
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as (ClipRow & { drive_id: string })[];
  if (rows.length === 0) return [];

  // The drive and its driver come from a second query rather than a nested
  // embed. A relationship hint one level down is easy to get subtly wrong and
  // fails as an opaque PostgREST error; two plain lookups either work or say
  // exactly which one did not.
  const { data: driveRows } = await supabase
    .from('drives')
    .select('id, started_at, profiles!drives_driver_id_fkey(username)')
    .in('id', [...new Set(rows.map((row) => row.drive_id))]);

  const drives = new Map(
    ((driveRows ?? []) as unknown as {
      id: string;
      started_at: string;
      profiles: { username: string } | null;
    }[]).map((drive) => [drive.id, drive])
  );

  const withMedia = await withParts(rows);

  return withMedia.map((clip, index) => {
    const drive = drives.get(rows[index].drive_id);

    return {
      ...clip,
      driveId: rows[index].drive_id,
      driverName: drive?.profiles?.username ?? 'Driver',
      driveStartedAt: drive ? new Date(drive.started_at).getTime() : clip.recordedAt,
    };
  });
}

/**
 * Removes a clip and its files.
 *
 * Storage is emptied first: a deleted row with files left behind is invisible
 * and counts against the storage quota forever, which is the worse of the two
 * ways this can half-fail.
 */
export async function deleteClip(clip: {
  id: string;
  driveId: string;
  parts: { index: number }[];
}): Promise<void> {
  const supabase = requireSupabase();

  const paths = clip.parts.map(
    (part) => `drives/${clip.driveId}/${clip.id}/${part.index}.mp4`
  );

  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase.from('drive_clips').delete().eq('id', clip.id);
  if (error) throw new Error(error.message);
}
