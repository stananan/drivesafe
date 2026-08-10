# DriveSafe — Roadmap

Working reference for the build. Update it as phases land; the "Decisions" and
"Known constraints" sections are the parts most worth re-reading before starting
new work.

**Team:** Stanley Ho, Nico Zametto
**Submission:** Congressional App Challenge — California District 2

---

## What DriveSafe is

One app, two interfaces. A teen driver records their drives; their parent sees
where they are and how the driving went. The point is not surveillance for its
own sake — it is giving a family a shared, factual basis for the conversation
about driving, during the highest-risk two years of a driver's life.

---

## Interface split

The two roles are not the same app with rows hidden. They answer different
questions, so they get different information architectures.

### Teen (the driver)

Owns the recording. Everything that touches the phone's sensors lives here.

| Screen | Status | Purpose |
| --- | --- | --- |
| **Drive** (`(teen)/index.tsx`) | Live GPS working | Start/end a drive. Big speedometer, distance, elapsed time, top speed. |
| **History** (`(teen)/history.tsx`) | Demo data | Their own drives and safety scores — they see exactly what their parent sees. |
| **Profile** (`(teen)/profile.tsx`) | Scaffolded | Name, linked parent, location-permission state, data transparency, role switch. |

### Parent

Read-only over their teen's data. Never records anything itself.

| Screen | Status | Purpose |
| --- | --- | --- |
| **Live** (`(parent)/index.tsx`) | Demo data | Is my driver on the road right now, and where? Plus their most recent trip. |
| **Drives** (`(parent)/drives.tsx`) | Demo data | Every completed trip, newest first, with weekly rollups. |
| **Settings** (`(parent)/settings.tsx`) | Scaffolded | Linked drivers, alert preferences, role switch. |

**Shared:** `drive/[id].tsx` — the trip detail screen. Deliberately identical for
both roles. A teen should never wonder what their parent is being shown.

---

## Phases

### Phase 0 — Project skeleton ✅ *done*

- Expo SDK 54 / React Native 0.81 / expo-router 6, TypeScript strict.
- Role gate persisted to AsyncStorage, with both tab interfaces behind it.
- Real GPS recording via `expo-location` (`src/lib/use-drive-tracker.ts`).
- Supabase client wired lazily; demo data behind the same function signatures
  the real queries will use.
- Verified: `tsc` clean, `expo lint` clean, `expo-doctor` 20/20, iOS and Android
  bundles export.

### Phase 1 — Auth, families, persistence ✅ *done*

- `supabase/schema.sql` applied to the live project. It is idempotent — re-run
  it after any edit rather than hand-patching the database.
- Email/password auth. Username and role travel in the signup metadata and the
  `on_auth_user_created` trigger turns them into a `profiles` row, so there is
  never a signed-in user without a profile.
- Families: a parent calls `create_family` and gets a six-character code; a
  child calls `join_family` with it. Both are `SECURITY DEFINER` RPCs because a
  child must be able to *use* a code without being able to *browse* families.
- Finished drives and their full GPS traces persist to `drives` /
  `drive_points`. Points insert in chunks of 500.
- `demo-data.ts` is gone. Every screen reads `src/lib/drives.ts`.
- Row-level security on all five tables, verified by an outsider account that
  can see zero drives, zero families, and only its own profile.

### Phase 2 — Maps and safety scoring ✅ *done*

- **`react-native-maps` runs inside Expo Go.** The earlier note that maps needed
  a development build was about `expo-maps`; `react-native-maps` is bundled in
  the Expo Go client, so live maps needed no build step at all. Verified on an
  iPhone 17 Pro with real Apple Maps tiles.
- Live mutual location: both roles publish their position while the relevant
  screen is focused, and everyone in a family sees everyone else. Only the most
  recent fix is stored — there is no location history table by design.
- Parent **Live** tab is now the map: avatar pins, a driver list underneath, and
  tapping a driver slides the camera to them. The family code lives here as an
  onboarding card and disappears the moment a driver joins.
- Real safety scores. See `SCORING.md` for the equation and its derivation.
  Curvature is computed from the GPS trace geometry, so "too fast for this bend"
  works with no road database at all.

### Phase 2.5 — Real speed limits (next)

The scoring equation is complete, but the speeding term still uses
`inferSpeedLimit()`, a conservative stand-in derived from observed speed. The
cornering term carries most of the signal until this lands.

`scoreDrive(route, limitFor?)` already takes a `SpeedLimitProvider` — wiring
OpenStreetMap Overpass means writing that one function. `SCORING.md` documents
the segment-snapping, the fallback ladder for missing `maxspeed` tags, and the
caching strategy.

### Phase 2 — Live tracking

- `expo-task-manager` + `startLocationUpdatesAsync` so a drive survives the app
  being backgrounded or the phone locking. Needs a development build.
- Supabase Realtime channel per active drive; parent's Live tab subscribes.
- Push notifications for drive start/end via `expo-notifications`.

### Phase 3 — Maps

Deferred deliberately — see "Known constraints".

- Move to a development build, add `expo-maps`.
- Replace `src/components/route-preview.tsx` with real tiles: route polyline,
  event pins, live driver marker. The component boundary already exists so this
  swaps cleanly.

### Phase 4 — Safety scoring

- Derive real events from the GPS trace: speeding (needs a speed-limit source —
  OpenStreetMap Overpass is free and workable), hard braking and rapid
  acceleration from `expo-sensors` accelerometer deltas.
- Score = 100 minus severity-weighted penalties, normalized per mile so a long
  drive is not punished for being long.

### Phase 5 — Audio distraction detection

- `expo-audio` recording permission, on-device analysis only.
- Detects sustained loud cabin noise / phone-call audio during motion.
- **Non-negotiable:** raw audio never leaves the phone and is never written to
  disk. Only a derived event ("distraction detected at 4:12 PM") syncs. Say this
  in the UI too — it is on the teen's Profile screen already.

### Phase 6 — Dashcam

- `expo-camera` with a rolling in-memory buffer, keeping the trailing 60 seconds
  and discarding the rest.
- On a hard-braking event or a voice trigger, flush the buffer to a clip.
- Voice trigger ("DriveSafe, save that") via on-device keyword spotting.
- Clips upload to Supabase Storage, parent reviews them from the drive detail.
- This phase is the most storage- and battery-expensive; do it last.

---

## Decisions

**One app, not two.** A single binary with a role gate. Two apps would double
the review surface and make the demo video twice as long.

**SI units stored, imperial displayed.** Everything persists in metres and m/s;
`src/lib/format.ts` converts at the edge. Keeps the data portable and the
conversions in exactly one place.

**Demo data behind real function signatures.** `listDrives()`, `getDrive(id)`,
`listLinkedDrivers()`, `weeklyScore()` — screens never touch the array directly,
so Phase 1 replaces bodies, not call sites.

**Safety colors are reserved.** Green/amber/red mean a safety judgment and
nothing else. Nothing decorative may use them.

**The teen sees everything the parent sees.** Not a feature request — a design
constraint. It is what separates this from spyware.

---

## Known constraints

**The project is pinned to SDK 54 on purpose.** Newer SDKs exist (57 is current),
but the App Store served both of our phones Expo Go **54.x**, and a modern Expo
Go client supports exactly one SDK — a project on 57 reports "incompatible with
this version of Expo Go" and refuses to open. Matching the client is what makes
the QR-code demo work on our actual hardware.

Only raise the SDK after confirming the Expo Go on the demo phones has moved
too (check the version in the Expo Go app, or `npx expo-doctor` after bumping).
Upgrading blind will break the demo. `npx expo install --fix` realigns every
dependency after an SDK change; the API differences that bit us going 57 → 54
were `ThemeProvider` living in `@react-navigation/native`, `NativeTabs` exposing
`Icon`/`Label` as standalone exports rather than `NativeTabs.Trigger.*`, and
`useColorScheme` returning `null` instead of `'unspecified'`.

**Expo Go vs. development build.** This phase runs in Expo Go so it opens from a
QR code on any phone with no build step. Maps turned out *not* to need a build —
`react-native-maps` ships inside Expo Go, even though `expo-maps` does not. What
still requires leaving Expo Go:

- background location via `expo-task-manager`, so a drive keeps recording with
  the phone locked
- `expo-camera` recording for the dashcam
- push notifications

Those need `npx expo run:ios` or an EAS development build, which costs the "scan
a QR code" convenience. Worth choosing deliberately rather than stumbling into.

**iOS reports `speed: -1`** when it cannot resolve a speed. The tracker maps
that to `null` rather than treating it as zero; anything reading `speed` must
handle null.

**GPS drift while parked** accumulates phantom distance. The tracker ignores
movement under 4 m and fixes with accuracy worse than 40 m. Revisit those
constants if real drives look wrong.

---

## Verify before committing

```bash
npm run typecheck                  # tsc --noEmit
npm run lint                       # expo lint
npx expo-doctor                    # dependency + config health
npx expo export --platform ios     # proves it actually bundles
```
