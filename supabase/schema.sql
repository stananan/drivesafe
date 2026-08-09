-- DriveSafe schema.
--
-- Not applied yet — this is the target for Phase 1 in ROADMAP.md. Keep it in
-- sync with src/types/drive.ts; the app types mirror these tables.
--
-- Apply with the Supabase SQL editor, or:
--   supabase db execute --file supabase/schema.sql

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, carrying the role.
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('parent', 'teen');

create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        public.user_role not null,
  display_name text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Links: which parent may see which teen. A teen can have several parents.
-- ---------------------------------------------------------------------------

create table public.driver_links (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid not null references public.profiles (id) on delete cascade,
  teen_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (parent_id, teen_id)
);

create index driver_links_parent_idx on public.driver_links (parent_id);
create index driver_links_teen_idx on public.driver_links (teen_id);

-- ---------------------------------------------------------------------------
-- Drives: one row per trip. Distances in metres, speeds in m/s.
-- ---------------------------------------------------------------------------

create table public.drives (
  id              uuid primary key default gen_random_uuid(),
  driver_id       uuid not null references public.profiles (id) on delete cascade,
  started_at      timestamptz not null,
  -- Null while the drive is still in progress; this is how "active" is derived.
  ended_at        timestamptz,
  distance_meters double precision not null default 0,
  top_speed       double precision not null default 0,
  avg_speed       double precision not null default 0,
  safety_score    smallint not null default 100
                    check (safety_score between 0 and 100),
  created_at      timestamptz not null default now()
);

create index drives_driver_started_idx
  on public.drives (driver_id, started_at desc);

-- Fast lookup of "is this driver on the road right now".
create index drives_active_idx
  on public.drives (driver_id)
  where ended_at is null;

-- ---------------------------------------------------------------------------
-- Drive points: the GPS trace. High row count — keep this table narrow.
-- ---------------------------------------------------------------------------

create table public.drive_points (
  id        bigserial primary key,
  drive_id  uuid not null references public.drives (id) on delete cascade,
  recorded_at timestamptz not null,
  lat       double precision not null,
  lon       double precision not null,
  -- Null when the OS could not resolve a speed (iOS reports -1).
  speed     double precision,
  accuracy  double precision
);

create index drive_points_drive_idx
  on public.drive_points (drive_id, recorded_at);

-- ---------------------------------------------------------------------------
-- Drive events: the things worth telling a parent about.
-- ---------------------------------------------------------------------------

create type public.drive_event_type as enum (
  'speeding',
  'hard_brake',
  'rapid_accel',
  'phone_distraction'
);

create table public.drive_events (
  id          uuid primary key default gen_random_uuid(),
  drive_id    uuid not null references public.drives (id) on delete cascade,
  type        public.drive_event_type not null,
  occurred_at timestamptz not null,
  detail      text not null,
  lat         double precision,
  lon         double precision
);

create index drive_events_drive_idx on public.drive_events (drive_id);

-- ---------------------------------------------------------------------------
-- Row-level security.
--
-- The rule in one sentence: a teen owns their own rows, and a parent may read
-- (never write) the rows of any teen linked to them.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.driver_links enable row level security;
alter table public.drives enable row level security;
alter table public.drive_points enable row level security;
alter table public.drive_events enable row level security;

-- True when the current user is a parent linked to `target_teen`.
create or replace function public.is_linked_parent(target_teen uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.driver_links
    where parent_id = auth.uid()
      and teen_id = target_teen
  );
$$;

create policy "read own profile"
  on public.profiles for select
  using (id = auth.uid() or public.is_linked_parent(id));

create policy "update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "read own links"
  on public.driver_links for select
  using (parent_id = auth.uid() or teen_id = auth.uid());

create policy "read own or linked drives"
  on public.drives for select
  using (driver_id = auth.uid() or public.is_linked_parent(driver_id));

-- Only the driver ever writes drive data.
create policy "teen writes own drives"
  on public.drives for insert
  with check (driver_id = auth.uid());

create policy "teen updates own drives"
  on public.drives for update
  using (driver_id = auth.uid());

create policy "read own or linked points"
  on public.drive_points for select
  using (
    exists (
      select 1 from public.drives d
      where d.id = drive_id
        and (d.driver_id = auth.uid() or public.is_linked_parent(d.driver_id))
    )
  );

create policy "teen writes own points"
  on public.drive_points for insert
  with check (
    exists (
      select 1 from public.drives d
      where d.id = drive_id and d.driver_id = auth.uid()
    )
  );

create policy "read own or linked events"
  on public.drive_events for select
  using (
    exists (
      select 1 from public.drives d
      where d.id = drive_id
        and (d.driver_id = auth.uid() or public.is_linked_parent(d.driver_id))
    )
  );

create policy "teen writes own events"
  on public.drive_events for insert
  with check (
    exists (
      select 1 from public.drives d
      where d.id = drive_id and d.driver_id = auth.uid()
    )
  );
