-- DriveSafe: wipe every account and everything attached to one.
--
-- DESTRUCTIVE AND IRREVERSIBLE. This is a development convenience for starting
-- from nothing, not something to keep around once real families use the app.
-- There is no undo and Supabase takes no snapshot first.
--
-- Run it in the Supabase dashboard -> SQL Editor.
--
-- What it removes:
--   * every dashcam clip file in storage
--   * every auth user, which cascades to profiles, drives, points, events,
--     audio levels, clips and clip parts
--   * every family
--
-- What it leaves alone: the schema itself. Tables, policies, functions, the
-- bucket and its policies all survive, so the app works immediately afterwards
-- and the first sign-up starts a clean family. There is no need to re-run
-- schema.sql after this.

begin;

-- Storage first. Deleting the rows would orphan these files: nothing in the
-- database cascade reaches into a bucket, so they would sit there counting
-- against the storage quota with nothing left pointing at them.
delete from storage.objects where bucket_id = 'drive-clips';

-- Everything else hangs off auth.users by ON DELETE CASCADE.
delete from auth.users;

-- Families are attached to their creator, but a family whose creator was
-- already gone would survive that cascade. Nothing should outlive this script.
delete from public.families;

commit;

-- Should return 0, 0, 0, 0.
select
  (select count(*) from auth.users)                                as users,
  (select count(*) from public.profiles)                           as profiles,
  (select count(*) from public.drives)                             as drives,
  (select count(*) from storage.objects where bucket_id = 'drive-clips') as clip_files;
