# DriveSafe

Teen drivers and their parents, on the same page about every trip.

DriveSafe records a drive's route, speed and safety events on the driver's
phone, and gives their parent a live view plus a reviewable history. One app,
two interfaces — and the driver sees everything the parent sees.

Built by **Stanley Ho** and **Nico Zametto** for the **Congressional App
Challenge**, California District 2.

| | |
| --- | --- |
| **Drivers** | iOS and Android, through Expo Go |
| **Parents** | the same app, or the web dashboard in a browser |
| **Backend** | Supabase — Postgres, auth, storage, realtime |

---

## Run it

```bash
npm install
npx expo start
```

Install **Expo Go**, then scan the QR code with the Camera app. Press `w` in the
same terminal to open the parent dashboard in a browser.

> **The project targets Expo SDK 57.** Expo Go supports exactly one SDK at a
> time, so *"the project is incompatible with this version of Expo Go"* means the
> two have drifted. Check the version on Expo Go's home screen, match `"expo"` in
> `package.json`, then run `npx expo install --fix`.

Phone and computer have to be on the same Wi-Fi. If they are not, use
`npx expo start --tunnel`.

The iOS Simulator has no real GPS — **Features → Location → Freeway Drive**
makes the speedometer move.

## Supabase

Accounts, families, drives and clips all live there.

```bash
cp .env.example .env.local
# fill in the two values from Supabase → Project Settings → API
```

Paste `supabase/schema.sql` into the dashboard SQL Editor and run it. It is safe
to run repeatedly, so re-run the whole file after editing rather than patching
tables by hand. `supabase/reset.sql` wipes every account when you want to start
over.

`.env.local` is git-ignored. Only the anon key belongs in it — it ships inside
the bundle, which is exactly why row-level security, not secrecy, is what
protects the data. The service-role key must never go near this repo.

## How accounts fit together

```
parent signs up ──▶ creates a family ──▶ gets a 6-character code
                                              │
                                              ▼
                          driver signs up ──▶ joins with that code
                                              │
                                              ▼
                    driver records drives ──▶ parent sees them
```

A driver can use a code but cannot browse families, and nobody outside a family
can read a single row belonging to it. That is enforced by row-level security in
the database, not by the app.

---

## Layout

```
src/
  app/                      expo-router routes (file path = URL)
    index.tsx               role gate — sends each account where it belongs
    index.web.tsx           the same gate, but strangers get the landing page
    (auth)/                 sign in, sign up
    family-setup.tsx        create a family, or join one with a code
    (child)/                driver: Drive, Map, Clips, History, Profile
    (parent)/               parent: Live, Drives, Clips, Settings
    drive/[id].tsx          a finished trip, shared by both roles
    live/[id].tsx           a trip in progress, for the parent
  components/
    landing/                the web landing page
    maps/                   route and pin maps, with .web.tsx twins
    ui/                     Screen, Card, Stat, Button, ScoreBadge…
  lib/
    use-drive-tracker.ts    live GPS recording — the heart of the app
    use-dashcam.ts          the rolling camera buffer
    use-audio-monitor.ts    the cabin loudness meter
    scoring.ts              the safety score
    speed-limits.ts         real limits, from OpenStreetMap
    session.tsx             who is signed in and what they are allowed to see
  types/drive.ts            domain types, mirroring the SQL schema
```

Files ending `.web.tsx` replace their neighbour in a browser. That is how one
codebase runs a phone app and a dashboard without either one compromising for
the other — see [docs/web-dashboard.md](./docs/web-dashboard.md).

## Decisions worth knowing

**One app, not two.** A single binary with a role gate. Two apps would double the
review surface and make the demo twice as long.

**The driver sees everything the parent sees.** Not a feature — a constraint. It
is what separates this from spyware, and it is why the microphone is a loudness
meter rather than a recorder.

**SI units stored, imperial displayed.** Everything persists in metres and
metres per second; `lib/format.ts` converts at the edge, so the data stays
portable and the conversions live in one place.

**Safety colours are reserved.** Green, amber and red mean a safety judgement
and nothing else. Nothing decorative may use them.

## Things that will catch you

**iOS reports `speed: -1`** when it cannot resolve a speed. The tracker maps that
to `null`; anything reading `speed` has to handle null rather than treat it as
zero.

**GPS drift while parked** accumulates phantom distance. The tracker ignores
movement under 4 m and fixes with accuracy worse than 40 m.

**Recording is foreground-only.** A drive stops collecting when the app leaves
the screen, so backgrounding ends it. Making it survive a locked phone needs
`expo-task-manager` and a development build.

**Push notifications do not work in Expo Go** — that was removed in SDK 53. The
parent's live dashboard is the path that demonstrates today.

## Checks

```bash
npm run typecheck       # tsc --noEmit
npm run lint            # expo lint
npm run simulate        # drive the scoring engine down synthetic roads
npm run check-limits    # speed-limit matching, against real OSM data
npm run build:web       # the dashboard, as it deploys
```

## The rest of the documentation

| | |
| --- | --- |
| [SCORING.md](./SCORING.md) | how a drive is scored, and what was deliberately removed |
| [TODO.md](./TODO.md) | what is outstanding, roughly in the order it will bite |
| [docs/web-dashboard.md](./docs/web-dashboard.md) | why the browser build diverges from the phone |
| [docs/deploy.md](./docs/deploy.md) | shipping the dashboard |
| [docs/privacy-policy.md](./docs/privacy-policy.md) | the policy, written for hosting |
