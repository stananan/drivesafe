-- DriveSafe database schema
--
-- Safe to run more than once: every object is created with IF NOT EXISTS or
-- dropped first, so re-running after an edit will not error.
--
-- Apply with: Supabase dashboard -> SQL Editor -> paste -> Run.
--
-- Model in one sentence: a parent creates a family and shares its code, a child
-- joins with that code, and everyone in a family can see that family's drives.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('parent', 'child');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'drive_event_type') then
    create type public.drive_event_type as enum (
      'speeding',
      'hard_brake',
      'rapid_accel',
      'phone_distraction'
    );
  end if;
end $$;

-- Added after the first release, so it cannot go in the create above without
-- breaking every project that already ran this file.
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'drive_event_type' and e.enumlabel = 'loud_audio'
  ) then
    alter type public.drive_event_type add value 'loud_audio';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 60),
  -- Six characters, no ambiguous glyphs. See generate_family_code() below.
  code       text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (length(trim(username)) between 2 and 24),
  role       public.user_role not null,
  -- Null until the user creates or joins a family.
  family_id  uuid references public.families (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_family_idx on public.profiles (family_id);

-- Live location, so family members can see each other on the map. Only ever the
-- most recent fix — DriveSafe does not keep a location history outside of the
-- drives a driver chooses to record.
alter table public.profiles
  add column if not exists last_lat double precision,
  add column if not exists last_lon double precision,
  add column if not exists last_location_at timestamptz,
  -- Anyone can stop broadcasting without leaving the family.
  add column if not exists location_sharing boolean not null default true,
  -- Expo push token, so a driver's phone can notify their parents directly.
  -- Null until the device registers, and cleared when they decline the prompt.
  add column if not exists push_token text,
  -- Whether this driver wants audio distraction alerts. A preference rather than
  -- a per-drive choice, so it survives between trips and lives with the rest of
  -- the driver's settings.
  add column if not exists audio_alerts_enabled boolean not null default false,
  -- Whether the dashcam records while this driver is on a drive.
  add column if not exists dashcam_enabled boolean not null default false;

-- DriveSafe briefly had a "let a parent listen in" consent flag. It was dropped:
-- the app only ever measures loudness and never captures audio, so there was
-- nothing for a driver to consent to.
alter table public.profiles drop column if exists listen_in_enabled;

create table if not exists public.drives (
  id              uuid primary key default gen_random_uuid(),
  driver_id       uuid not null references public.profiles (id) on delete cascade,
  -- Denormalized so a drive stays attached to its family even if the driver
  -- later leaves, and so parents can filter without joining through profiles.
  family_id       uuid references public.families (id) on delete set null,
  started_at      timestamptz not null,
  -- Null while the drive is in progress; this is how "currently driving" is derived.
  ended_at        timestamptz,
  distance_meters double precision not null default 0 check (distance_meters >= 0),
  top_speed       double precision not null default 0 check (top_speed >= 0),
  avg_speed       double precision not null default 0 check (avg_speed >= 0),
  safety_score    smallint not null default 100 check (safety_score between 0 and 100),
  created_at      timestamptz not null default now()
);

-- Live-drive columns. A drive row is now written when the drive *starts*, so a
-- parent has something to watch; these carry the state that only matters while
-- ended_at is still null.
alter table public.drives
  -- Whether the driver had audio distraction alerts switched on for this drive.
  -- Kept per drive rather than per profile so history stays truthful about what
  -- was actually being monitored at the time.
  add column if not exists audio_monitoring boolean not null default false,
  -- Most recent speed sample, metres per second. Only meaningful mid-drive.
  add column if not exists current_speed double precision not null default 0;

create index if not exists drives_driver_started_idx
  on public.drives (driver_id, started_at desc);
create index if not exists drives_family_started_idx
  on public.drives (family_id, started_at desc);
create index if not exists drives_active_idx
  on public.drives (driver_id) where ended_at is null;

-- The GPS trace. High row count, so keep this table narrow.
create table if not exists public.drive_points (
  id          bigserial primary key,
  drive_id    uuid not null references public.drives (id) on delete cascade,
  recorded_at timestamptz not null,
  lat         double precision not null,
  lon         double precision not null,
  -- Null when the OS could not resolve a speed (iOS reports -1).
  speed       double precision,
  accuracy    double precision
);

create index if not exists drive_points_drive_idx
  on public.drive_points (drive_id, recorded_at);

create table if not exists public.drive_events (
  id          uuid primary key default gen_random_uuid(),
  drive_id    uuid not null references public.drives (id) on delete cascade,
  type        public.drive_event_type not null,
  occurred_at timestamptz not null,
  detail      text not null,
  lat         double precision,
  lon         double precision
);

create index if not exists drive_events_drive_idx on public.drive_events (drive_id);

-- Cabin loudness over the course of a drive, sampled every few seconds while
-- audio alerts are on.
--
-- Stored rather than streamed because a parent who opens a live drive ten
-- minutes in should see the ten minutes they missed, and because a finished
-- drive is worth looking at as a whole. Only the reading is kept — there is no
-- audio in this table, in this database, or anywhere off the driver's phone.
create table if not exists public.drive_audio_levels (
  id          bigserial primary key,
  drive_id    uuid not null references public.drives (id) on delete cascade,
  recorded_at timestamptz not null,
  -- dBFS. 0 is the loudest the microphone can encode; a quiet car sits near -60.
  level       double precision not null
);

create index if not exists drive_audio_levels_drive_idx
  on public.drive_audio_levels (drive_id, recorded_at);

-- Dashcam clips.
--
-- Clips carry sound, like any other dashcam. `has_audio` records whether a
-- particular clip actually got it: the camera and the loudness monitor both
-- want the microphone, and where a phone refuses to give it to both the app
-- falls back to video only rather than losing the dashcam entirely.
create table if not exists public.drive_clips (
  id               uuid primary key default gen_random_uuid(),
  drive_id         uuid not null references public.drives (id) on delete cascade,
  -- What caused this clip to be kept rather than discarded.
  reason           text not null check (reason in ('manual', 'loud_audio')),
  -- Start of the earliest part.
  recorded_at      timestamptz not null,
  duration_seconds double precision not null default 0,
  -- False when the phone would not record sound alongside loudness monitoring.
  has_audio        boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists drive_clips_drive_idx
  on public.drive_clips (drive_id, recorded_at desc);

-- One clip is several files.
--
-- Phones cannot ring-buffer video, so the dashcam records fixed-length segments
-- and keeps the trailing few. Saving a clip keeps whichever segments were on
-- disk at that moment. Nothing available to an Expo app can stitch them into a
-- single file, so the parts stay separate and the player runs them in order.
create table if not exists public.drive_clip_parts (
  id               uuid primary key default gen_random_uuid(),
  clip_id          uuid not null references public.drive_clips (id) on delete cascade,
  part_index       integer not null,
  -- Path within the `drive-clips` bucket: drives/<drive_id>/<clip_id>/<n>.mp4
  storage_path     text not null,
  duration_seconds double precision not null default 0,
  bytes            bigint not null default 0,
  unique (clip_id, part_index)
);

create index if not exists drive_clip_parts_clip_idx
  on public.drive_clip_parts (clip_id, part_index);

-- ---------------------------------------------------------------------------
-- Helpers
--
-- These are SECURITY DEFINER so they bypass row-level security. That is what
-- keeps the profiles policy from recursing into itself: a policy that selects
-- from profiles to decide access to profiles would loop forever.
-- ---------------------------------------------------------------------------

create or replace function public.my_family_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from public.profiles where id = auth.uid();
$$;

create or replace function public.my_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Six characters from an alphabet with no 0/O, 1/I/L, so a code read aloud or
-- typed by a teenager cannot be mistyped into someone else's family.
create or replace function public.generate_family_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from public.families where code = candidate);
  end loop;

  return candidate;
end $$;

-- ---------------------------------------------------------------------------
-- Auth trigger: every auth user gets a profile row automatically.
--
-- Doing this in a trigger rather than a second client call means there is never
-- a window where a signed-in user has no profile.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_username text;
  desired_role public.user_role;
begin
  desired_username := trim(coalesce(new.raw_user_meta_data ->> 'username', ''));

  if desired_username = '' then
    desired_username := split_part(new.email, '@', 1);
  end if;

  begin
    desired_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'child');
  exception
    when invalid_text_representation then
      desired_role := 'child';
  end;

  insert into public.profiles (id, username, role)
  values (new.id, desired_username, desired_role);

  return new;
exception
  when unique_violation then
    -- Surfaces to the client as a clean signup failure instead of a 500.
    raise exception 'username_taken' using errcode = '23505';
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Signup runs before the user is authenticated, and RLS hides the profiles
-- table from anonymous callers — so checking a username needs its own function.
-- GoTrue collapses a failing signup trigger into "Database error saving new
-- user", which tells a teenager nothing; this lets the form say what is wrong
-- before submitting.
create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(trim(candidate))
  );
$$;

-- ---------------------------------------------------------------------------
-- Family create / join
--
-- Both are SECURITY DEFINER RPCs. Joining has to look up a family by code, but
-- a child must not be able to browse or read families they are not in — so the
-- lookup happens inside a function instead of through a readable policy.
-- ---------------------------------------------------------------------------

create or replace function public.create_family(family_name text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family public.families;
  caller_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select role into caller_role from public.profiles where id = auth.uid();

  if caller_role is distinct from 'parent' then
    raise exception 'only_parents_can_create_families';
  end if;

  insert into public.families (name, code, created_by)
  values (trim(family_name), public.generate_family_code(), auth.uid())
  returning * into new_family;

  update public.profiles set family_id = new_family.id where id = auth.uid();

  return new_family;
end $$;

create or replace function public.join_family(family_code text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.families;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Codes are case-insensitive for the person typing them.
  select * into target
  from public.families
  where code = upper(trim(family_code));

  if target.id is null then
    raise exception 'family_not_found';
  end if;

  update public.profiles set family_id = target.id where id = auth.uid();

  return target;
end $$;

create or replace function public.leave_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles set family_id = null where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Account deletion
--
-- Required by App Store Review guideline 5.1.1(v): an app that lets you create
-- an account has to let you delete it from inside the app. A client holding the
-- anon key cannot touch auth.users, so this runs SECURITY DEFINER as the table
-- owner instead.
--
-- One delete is enough because the whole graph hangs off auth.users by
-- ON DELETE CASCADE: profiles -> drives -> drive_points and drive_events. A
-- parent's families row cascades too, which drops every member back to
-- family_id null (profiles.family_id is ON DELETE SET NULL) without touching
-- the drives they already recorded.
-- ---------------------------------------------------------------------------

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- The rule in one sentence: you can always see yourself, you can see everyone
-- in your family, only a driver writes their own drive data, and nobody can
-- read anything belonging to a family they are not in.
-- ---------------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.drives enable row level security;
alter table public.drive_points enable row level security;
alter table public.drive_events enable row level security;
alter table public.drive_audio_levels enable row level security;
alter table public.drive_clips enable row level security;
alter table public.drive_clip_parts enable row level security;

drop policy if exists "read own family" on public.families;
create policy "read own family"
  on public.families for select
  using (id = public.my_family_id() or created_by = auth.uid());

drop policy if exists "read self and family members" on public.profiles;
create policy "read self and family members"
  on public.profiles for select
  using (
    id = auth.uid()
    or (family_id is not null and family_id = public.my_family_id())
  );

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "read own or family drives" on public.drives;
create policy "read own or family drives"
  on public.drives for select
  using (
    driver_id = auth.uid()
    or (family_id is not null and family_id = public.my_family_id())
  );

drop policy if exists "driver inserts own drives" on public.drives;
create policy "driver inserts own drives"
  on public.drives for insert
  with check (driver_id = auth.uid());

drop policy if exists "driver updates own drives" on public.drives;
create policy "driver updates own drives"
  on public.drives for update
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

drop policy if exists "driver deletes own drives" on public.drives;
create policy "driver deletes own drives"
  on public.drives for delete
  using (driver_id = auth.uid());

drop policy if exists "read points of visible drives" on public.drive_points;
create policy "read points of visible drives"
  on public.drive_points for select
  using (
    exists (
      select 1 from public.drives d
      where d.id = drive_id
        and (
          d.driver_id = auth.uid()
          or (d.family_id is not null and d.family_id = public.my_family_id())
        )
    )
  );

drop policy if exists "driver inserts own points" on public.drive_points;
create policy "driver inserts own points"
  on public.drive_points for insert
  with check (
    exists (
      select 1 from public.drives d
      where d.id = drive_id and d.driver_id = auth.uid()
    )
  );

drop policy if exists "read events of visible drives" on public.drive_events;
create policy "read events of visible drives"
  on public.drive_events for select
  using (
    exists (
      select 1 from public.drives d
      where d.id = drive_id
        and (
          d.driver_id = auth.uid()
          or (d.family_id is not null and d.family_id = public.my_family_id())
        )
    )
  );

drop policy if exists "driver inserts own events" on public.drive_events;
create policy "driver inserts own events"
  on public.drive_events for insert
  with check (
    exists (
      select 1 from public.drives d
      where d.id = drive_id and d.driver_id = auth.uid()
    )
  );

drop policy if exists "read levels of visible drives" on public.drive_audio_levels;
create policy "read levels of visible drives"
  on public.drive_audio_levels for select
  using (
    exists (
      select 1 from public.drives d
      where d.id = drive_id
        and (
          d.driver_id = auth.uid()
          or (d.family_id is not null and d.family_id = public.my_family_id())
        )
    )
  );

drop policy if exists "driver inserts own levels" on public.drive_audio_levels;
create policy "driver inserts own levels"
  on public.drive_audio_levels for insert
  with check (
    exists (
      select 1 from public.drives d
      where d.id = drive_id and d.driver_id = auth.uid()
    )
  );

drop policy if exists "read clips of visible drives" on public.drive_clips;
create policy "read clips of visible drives"
  on public.drive_clips for select
  using (
    exists (
      select 1 from public.drives d
      where d.id = drive_id
        and (
          d.driver_id = auth.uid()
          or (d.family_id is not null and d.family_id = public.my_family_id())
        )
    )
  );

drop policy if exists "driver inserts own clips" on public.drive_clips;
create policy "driver inserts own clips"
  on public.drive_clips for insert
  with check (
    exists (
      select 1 from public.drives d
      where d.id = drive_id and d.driver_id = auth.uid()
    )
  );

drop policy if exists "driver deletes own clips" on public.drive_clips;
create policy "driver deletes own clips"
  on public.drive_clips for delete
  using (
    exists (
      select 1 from public.drives d
      where d.id = drive_id and d.driver_id = auth.uid()
    )
  );

drop policy if exists "read parts of visible clips" on public.drive_clip_parts;
create policy "read parts of visible clips"
  on public.drive_clip_parts for select
  using (
    exists (
      select 1
      from public.drive_clips c
      join public.drives d on d.id = c.drive_id
      where c.id = clip_id
        and (
          d.driver_id = auth.uid()
          or (d.family_id is not null and d.family_id = public.my_family_id())
        )
    )
  );

drop policy if exists "driver inserts own parts" on public.drive_clip_parts;
create policy "driver inserts own parts"
  on public.drive_clip_parts for insert
  with check (
    exists (
      select 1
      from public.drive_clips c
      join public.drives d on d.id = c.drive_id
      where c.id = clip_id and d.driver_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Keep a drive's family in step with its driver, so parents never lose sight of
-- a drive because the row was written before the child joined the family.
-- ---------------------------------------------------------------------------

create or replace function public.set_drive_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.family_id is null then
    select family_id into new.family_id from public.profiles where id = new.driver_id;
  end if;

  return new;
end $$;

drop trigger if exists drives_set_family on public.drives;
create trigger drives_set_family
  before insert on public.drives
  for each row execute function public.set_drive_family();

-- ---------------------------------------------------------------------------
-- Grants. RLS still governs every row; these just open the door.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.drives to authenticated;
grant select, insert
  on public.drive_points, public.drive_events, public.drive_audio_levels,
     public.drive_clip_parts
  to authenticated;
-- Clips are deletable so a driver can take back footage they did not mean to keep.
grant select, insert, delete on public.drive_clips to authenticated;
grant select on public.families, public.profiles to authenticated;

-- Column-level on purpose. A blanket UPDATE would let a child set their own
-- role to 'parent' or move themselves into another family with a plain PATCH,
-- since the row policy only checks *which* row they touch, not which columns.
-- Role and family changes therefore only happen inside the SECURITY DEFINER
-- RPCs above, which run as the table owner and are unaffected by this grant.
revoke update on public.profiles from authenticated;
grant update (
    last_lat,
    last_lon,
    last_location_at,
    location_sharing,
    push_token,
    audio_alerts_enabled,
    dashcam_enabled
  )
  on public.profiles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Callable before sign-in, so anon needs it too.
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;
grant execute on function public.leave_family() to authenticated;
grant execute on function public.delete_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Dashcam storage
--
-- Private bucket. Clips are served through short-lived signed URLs rather than
-- public links, because a public bucket would make every clip readable by
-- anyone holding the path — which for footage from inside a teenager's car is
-- not a risk worth taking for the convenience.
--
-- Access is decided from the path. Clips live at
--   drives/<drive_id>/<clip_id>/<n>.mp4
-- so `storage.foldername(name)` yields {drives, <drive_id>, <clip_id>} and the
-- policies below resolve element 2 back to a drive to ask the same question the
-- rest of the schema asks: is this yours, or your family's?
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('drive-clips', 'drive-clips', false)
on conflict (id) do nothing;

drop policy if exists "read family clip files" on storage.objects;
create policy "read family clip files"
  on storage.objects for select
  using (
    bucket_id = 'drive-clips'
    and exists (
      select 1 from public.drives d
      where d.id::text = (storage.foldername(name))[2]
        and (
          d.driver_id = auth.uid()
          or (d.family_id is not null and d.family_id = public.my_family_id())
        )
    )
  );

drop policy if exists "driver writes own clip files" on storage.objects;
create policy "driver writes own clip files"
  on storage.objects for insert
  with check (
    bucket_id = 'drive-clips'
    and exists (
      select 1 from public.drives d
      where d.id::text = (storage.foldername(name))[2] and d.driver_id = auth.uid()
    )
  );

drop policy if exists "driver deletes own clip files" on storage.objects;
create policy "driver deletes own clip files"
  on storage.objects for delete
  using (
    bucket_id = 'drive-clips'
    and exists (
      select 1 from public.drives d
      where d.id::text = (storage.foldername(name))[2] and d.driver_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
--
-- The parent's live drive dashboard subscribes to these tables so a loud audio
-- alert, a noise reading, or the end of a drive lands without waiting for the
-- next poll. Realtime still applies the policies above, so a subscription only
-- ever delivers rows the subscriber could have selected anyway — which is what
-- makes this preferable to a broadcast channel for anything private.
-- ---------------------------------------------------------------------------

do $$
declare
  target text;
begin
  foreach target in array array[
    'drives',
    'drive_events',
    'drive_audio_levels',
    'drive_clips'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end $$;
grant execute on function public.my_family_id() to authenticated;
grant execute on function public.my_role() to authenticated;
