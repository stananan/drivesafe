-- DriveSafe: wipe every account and everything attached to one.
--
-- DESTRUCTIVE AND IRREVERSIBLE. This is a development convenience for starting
-- from nothing, not something to keep around once real families use the app.
-- There is no undo and Supabase takes no snapshot first.
--
-- Run it in the Supabase dashboard -> SQL Editor.
--
-- What it removes: every auth user, which cascades to profiles, drives, points,
-- events, audio levels, clips and clip parts; then any family left behind.
--
-- What it leaves alone: the schema itself. Tables, policies, functions, the
-- bucket and its policies all survive, so the app works immediately afterwards
-- and the first sign-up starts a clean family. No need to re-run schema.sql.
--
-- What it CANNOT remove: the dashcam clip files. Supabase blocks deletes against
-- storage tables from SQL — `storage.protect_delete()` raises
-- "Direct deletion from storage tables is not allowed" — because a row deleted
-- out from under the Storage API leaves a file nothing can reach. Clearing those
-- is a separate step, described at the bottom.

begin;

-- Everything hangs off auth.users by ON DELETE CASCADE.
delete from auth.users;

-- Families are attached to their creator, so one whose creator was already gone
-- would survive that cascade. Nothing should outlive this script.
delete from public.families;

commit;

-- Should return 0, 0, 0. The fourth number is the clip files still in storage,
-- which the section below deals with.
select
  (select count(*) from auth.users)      as users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.drives)   as drives,
  (select count(*) from storage.objects where bucket_id = 'drive-clips') as clip_files_remaining;

-- ---------------------------------------------------------------------------
-- Clip files
--
-- Once the rows above are gone nothing points at these files, but they still
-- count against the storage quota — which on the free plan is 1 GB, and clips
-- are the only thing in this app big enough to matter. Clear them one of two
-- ways:
--
--   1. Dashboard -> Storage -> drive-clips -> select the `drives` folder ->
--      Delete. Fastest, and the bucket and its policies stay as they are.
--
--   2. Dashboard -> Storage -> delete the whole drive-clips bucket, then re-run
--      schema.sql to recreate it with its policies. Use this if the bucket
--      itself is in a bad state rather than merely full.
--
-- Either way the app needs no code change; the bucket name is the only thing
-- it depends on.
-- ---------------------------------------------------------------------------
