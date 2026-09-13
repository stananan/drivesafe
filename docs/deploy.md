# Deploying the dashboard

`npm run build:web` produces a static site in `dist/` — one `index.html`, a
hashed JS bundle and some CSS. Any static host serves it. `vercel.json` is
already configured for Vercel: build command, output directory, the SPA rewrite,
and a cache header for the hashed assets.

## The one thing that will bite you

**Set the environment variables before the first build.** The Supabase URL and
anon key are not read at runtime — Babel inlines them into the bundle while it
builds. A build without them produces a site that loads, shows the landing page,
and then says "Supabase is not configured" the moment anyone tries to sign in.
Setting them afterwards changes nothing until you build again.

Both values are in `.env.local`. They are public by design — row-level security
is what protects the data, not the key. Never add the service-role key.

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

## Vercel, from the dashboard

1. **vercel.com/new** → Import Git Repository → `stananan/drivesafe`. If the repo
   is not listed, GitHub is not connected to the Vercel account yet; the import
   page offers to install it.
2. Leave the build settings alone. `vercel.json` sets them.
3. Add the two variables above under **Environment Variables**, for all
   environments.
4. Deploy.

Pushes to the production branch deploy automatically after that, and every other
branch gets its own preview URL.

## Vercel, from the terminal

```
npx vercel login
npx vercel --cwd .          # preview
npx vercel --prod --cwd .   # production
```

The CLI prompts for the environment variables on the first run, or pulls them
with `npx vercel env pull`.

## Which branch goes live

Vercel's production branch defaults to the repository's default branch. The web
build — the dashboard, the maps, the landing page — is on `dashcam` until that
is merged. Either merge it first, or change the production branch under
**Settings → Git** so the live site is not the pre-web version of the app.

## After it is live

- **Check a deep link.** Open `/clips` directly and refresh. A 404 means the
  rewrite is not being applied.
- **Check sign-in.** If it says Supabase is not configured, the build ran without
  the environment variables. Add them and redeploy.
- **Remember the database.** A free Supabase project suspends after 7 days of
  inactivity, and the deployed site goes down with it.
