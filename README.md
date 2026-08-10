# DriveSafe

Teen drivers and their parents, on the same page about every trip.

DriveSafe records a drive's route, speed, and safety events on the driver's
phone, and gives their parent a live view plus a reviewable history. One app,
two interfaces — the teen sees exactly what the parent sees.

Built by **Stanley Ho** and **Nico Zametto** for the **Congressional App
Challenge**, California District 2.

---

## Run it on your phone

```bash
npm install
npx expo start
```

Install **Expo Go** from the App Store, then scan the QR code in the terminal
with the Camera app. The app opens on your phone — no Xcode, no build step.

> **This project targets Expo SDK 54**, because that is what the App Store's
> Expo Go gives us. Expo Go supports exactly one SDK version at a time, so if
> you ever see *"the project is incompatible with this version of Expo Go"*,
> the project SDK and the installed Expo Go have drifted apart. Check your Expo
> Go version on its home screen and match `"expo"` in `package.json` to it,
> then run `npx expo install --fix`.

The phone and the computer have to be on the same Wi-Fi. If they are not, or the
network blocks device-to-device traffic, use a tunnel:

```bash
npx expo start --tunnel
```

Press `i` in the terminal for the iOS Simulator or `a` for an Android emulator.
The simulator has no real GPS — use **Features → Location → Freeway Drive** in
the iOS Simulator to make the speedometer move.

---

## Supabase

The app needs Supabase — accounts, families, and drive history all live there.

```bash
cp .env.example .env.local
# fill in the two values from Supabase → Project Settings → API
```

If you are pointing at a fresh project, paste `supabase/schema.sql` into the
dashboard SQL Editor and run it. It is safe to run repeatedly, so re-run the
whole file after editing rather than hand-patching tables.

`.env.local` is git-ignored — never commit real keys. Only the anon/publishable
key belongs in it; it ships inside the app bundle, which is exactly why row-level
security, not secrecy, is what protects the data.

### Test accounts

| Role | Email | Password |
| --- | --- | --- |
| Parent | `parent@drivesafe.example.com` | `DriveSafe2026!` |
| Driver | `driver@drivesafe.example.com` | `DriveSafe2026!` |

Both are in **The Ho Family**, whose code is **`WV7BYX`**. Sign in as the parent
to see the family code and the driver's history, or as the driver to record a
drive. Making a new account of your own works too: pick Parent to create a
family, or Driver to join one with a code.

## How accounts fit together

```
parent signs up ──▶ creates a family ──▶ gets a 6-character code
                                              │
                                              ▼
                          child signs up ──▶ joins with that code
                                              │
                                              ▼
                    child records drives ──▶ parent sees them
```

A child can use a code but cannot browse families, and nobody outside a family
can read a single row belonging to it — that is enforced by row-level security
in the database, not by the app.

---

## Layout

```
src/
  app/                     expo-router routes (file path = URL)
    index.tsx              role gate — picks parent or teen, once
    (teen)/                driver interface: Drive, History, Profile
    (parent)/              parent interface: Live, Drives, Settings
    drive/[id].tsx         trip detail, shared by both roles
  components/              shared UI (Screen, Card, Stat, Button, ScoreBadge…)
  lib/
    session.tsx            which role is holding the phone
    use-drive-tracker.ts   live GPS recording — the heart of the app
    supabase.ts            lazily-created client
    demo-data.ts           stand-in data behind the real query signatures
    format.ts              SI → miles/mph conversion, haversine
  types/drive.ts           domain types, mirrors the SQL schema
```

## Checks

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
npx expo-doctor      # dependency + config health
```

See [ROADMAP.md](./ROADMAP.md) for what is built, what is next, and why the
current phase avoids native maps.
