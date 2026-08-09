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

## Optional: connect Supabase

The app runs on demo data without any credentials. To point it at a real
database:

```bash
cp .env.example .env.local
# fill in the two values from Supabase → Project Settings → API
```

Then apply `supabase/schema.sql` to your project. `.env.local` is git-ignored —
never commit real keys. Only the anon/publishable key belongs in this file; it
ships inside the app bundle.

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
