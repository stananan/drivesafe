# DriveSafe

A dashcam and safety score for new drivers, built for teenagers and their parents.

A teen records their drive on their phone. Their parent sees the route, the speed,
and anything worth talking about, either on their own phone or in a browser. The
teen sees exactly the same thing. Nothing is hidden from the person being recorded.

Built by **Stanley Ho** and **Nico Zametto** for the Congressional App Challenge,
California District 2.

## What it does

* Records the route, speed and distance of every drive.
* Scores the drive against the real speed limit of each road, using OpenStreetMap
  data rather than a guess.
* Lets a parent watch a drive while it is happening.
* Keeps a rolling dashcam buffer, saved when the driver asks for it or when the
  car gets loud enough to be a distraction.
* Warns the driver when the cabin gets noisy, because a loud car is one where you
  miss a siren.

The microphone measures how loud it is and nothing else. It does not record or
transcribe what anyone says. Full detail is in the
[privacy policy](./docs/privacy-policy.md).

## Trying it out

You need [Node.js](https://nodejs.org) and the **Expo Go** app from the App Store
or Play Store.

```bash
npm install
npx expo start
```

Scan the QR code in your terminal with your phone's camera. Press `w` in the same
terminal to open the parent dashboard in a browser.

Your phone and computer need to be on the same Wi-Fi. If they are not, run
`npx expo start --tunnel` instead.

Two things that trip people up:

**"Incompatible with this version of Expo Go."** Expo Go only supports one SDK at
a time, and this project targets SDK 57. Check the version on Expo Go's home
screen against `"expo"` in `package.json`, then run `npx expo install --fix`.

**The iOS Simulator has no GPS,** so the speedometer sits at zero. Turn on
**Features → Location → Freeway Drive** and it will start moving.

## Running your own copy

Accounts, drives and saved clips live in [Supabase](https://supabase.com), which
has a free tier that is plenty for this.

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in the two values from
   **Project Settings → API**.
3. Open the SQL Editor, paste in `supabase/schema.sql`, and run it.

The schema file is safe to run more than once, so if you change it, re-run the
whole thing rather than patching tables by hand. `supabase/reset.sql` wipes every
account if you want to start clean.

Only the anon key belongs in `.env.local`. It ships inside the app bundle, which
is why the data is protected by database row-level security rather than by keeping
the key secret. The service-role key should never go anywhere near this repo.

## How accounts work

A parent signs up and creates a family, which gives them a six-character code. A
driver signs up and joins with that code. From then on the parent sees that
driver's drives.

A driver can use a code but cannot browse families, and nobody outside a family
can read a single row belonging to it. That rule lives in the database, not in the
app, so it holds even if the app has a bug.

## For developers

```
src/
  app/          screens, routed by file path
  components/   shared UI, plus .web.tsx versions for the browser
  lib/          drive tracking, dashcam, scoring, speed limits, session
  types/        domain types, mirroring the SQL schema
```

Files ending in `.web.tsx` replace their neighbour when the app runs in a browser.
That is how one codebase serves both a phone app and a dashboard. See
[docs/web-dashboard.md](./docs/web-dashboard.md).

A few decisions worth knowing before changing things:

* **One app, two interfaces.** A role gate at startup decides which one you get.
* **The driver sees everything the parent sees.** This is a constraint, not a
  feature, and it is why the microphone is a meter rather than a recorder.
* **Distances are stored in metres and shown in miles.** Conversion happens in
  `lib/format.ts`, at the edge.
* **Green, amber and red mean a safety judgement.** Nothing decorative uses them.

Some behaviour that will surprise you:

* iOS reports `speed: -1` when it cannot work out a speed. The tracker turns that
  into `null`, so do not treat it as zero.
* GPS drifts while parked, which adds distance that never happened. The tracker
  ignores movement under 4 m and fixes less accurate than 40 m.
* Recording only runs while the app is on screen. Backgrounding the app ends the
  drive.
* Push notifications do not work in Expo Go at all. The parent's live dashboard is
  what to demonstrate.

```bash
npm run typecheck      # types
npm run lint           # linting
npm run simulate       # run the scoring engine down synthetic roads
npm run check-limits   # speed-limit matching, against real map data
npm run build:web      # build the dashboard the way it deploys
```

## More documentation

| | |
| --- | --- |
| [SCORING.md](./SCORING.md) | how a drive is scored, and what was left out on purpose |
| [docs/web-dashboard.md](./docs/web-dashboard.md) | why the browser build differs from the phone |
| [docs/deploy.md](./docs/deploy.md) | deploying the dashboard |
| [docs/privacy-policy.md](./docs/privacy-policy.md) | what is collected, and what is not |
