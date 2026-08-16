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
import type { DriveClip, DriveClipReason } from '@/types/drive';

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
    })
    .select('id')
    .single<{ id: string }>();

  if (error) throw new Error(error.message);

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
    } catch (caught) {
      // One bad segment should not lose the rest of the clip. A clip with a gap
      // is still worth having; a failed upload that discards everything is not.
      console.warn(
        `Could not upload clip part ${index}:`,
        caught instanceof Error ? caught.message : caught
      );
    }
  }

  return clip.id;
}

type ClipRow = {
  id: string;
  reason: DriveClipReason;
  recorded_at: string;
  duration_seconds: number;
};

type PartRow = {
  clip_id: string;
  part_index: number;
  storage_path: string;
  duration_seconds: number;
  bytes: number;
};

/**
 * Clips for a drive, newest first, with playable URLs.
 *
 * Signing happens in one batch rather than per part, because a drive with a
 * handful of clips would otherwise be a dozen round trips before anything could
 * play.
 */
export async function listClips(driveId: string): Promise<DriveClip[]> {
  const supabase = requireSupabase();

  const { data: clipRows, error } = await supabase
    .from('drive_clips')
    .select('id, reason, recorded_at, duration_seconds')
    .eq('drive_id', driveId)
    .order('recorded_at', { ascending: false });

  if (error) throw new Error(error.message);

  const clips = (clipRows ?? []) as ClipRow[];
  if (clips.length === 0) return [];

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
