# The parent dashboard

DriveSafe runs in a browser as well as on a phone. It is the same app, the same
code and the same Supabase project — not a second one to keep in step.

**Parents get the browser. Drivers get the phone.** Recording a drive needs GPS,
a microphone and a camera held in the foreground with the screen awake; a browser
offers a worse version of the first and none of the rest. So a driver who signs
in on the web is told to open their phone instead. Everything a parent does —
the live map, watching a drive, clips, drives, settings — is maps, lists and
video playback, which is what a browser is good at.

The parent's phone app still works exactly as before. This is an addition, not a
migration.

## Running it

```
npm run web          # dev server, opens in a browser
npm run build:web    # static build into dist/
```

`.env.local` is read the same way as for the phone, so a browser build needs the
same two `EXPO_PUBLIC_SUPABASE_*` values.

## Deploying it

`npm run build:web` produces a plain static site in `dist/`. Any static host
takes it — Netlify, Vercel, Cloudflare Pages, GitHub Pages.

Two things to get right:

**Serve it as a single-page app.** `app.json` sets `web.output` to `single`, so
there is one `index.html` and the router handles paths in the browser. The host
must rewrite unknown paths to `index.html`, or a refresh on `/live/abc` will
404. Most hosts call this "SPA mode" or "rewrite all to index.html".

**Nothing secret ships.** The build contains the Supabase URL and the anon key,
which are public by design — row-level security is what protects the data, not
the key. Never put a service-role key in `.env.local`.

## How the maps work

`react-native-maps` is native-only: it imports React Native internals that do
not exist in a browser, and it alone kept the app from building for web at all.

Rather than fork the screens, the two maps live in `src/components/maps/` and
each has a `.web.tsx` twin drawing the same thing with Leaflet and OpenStreetMap
tiles. Screens import one name and get whichever is right for where they run.

- `route-map` — a drive's path, finished or in progress
- `pins-map` — people on a map, with focus and framing

Anything added to those has to be expressible on both platforms. That constraint
is why they describe *what to show* rather than handing back a map to command:
the two libraries have nothing in common imperatively.

## Known rough edges

- **Prerendering is off.** `web.output` is `single` rather than `static`, because
  Leaflet touches `window` when it loads and static output renders in Node,
  where there is no window. An authenticated dashboard gains nothing from
  prerendering anyway.
- **The bundle is around 3 MB.** Everything the phone app imports is in it,
  including the camera and audio code a parent will never reach. Splitting that
  out would be worth doing before this is ever more than a family tool.
- **It has been built, not driven.** The web build compiles and the maps have
  browser implementations, but no parent has yet sat in front of it while a real
  drive happened. That is the next thing to check.
