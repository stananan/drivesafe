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

## What `vercel.json` does

Four things, and two of them matter:

**The rewrite.** The app is a single page — expo-router handles paths in the
browser — so every URL has to reach `index.html` or refreshing `/clips` is a
404. Vercel serves real files before applying rewrites, so the catch-all cannot
shadow the bundle or the assets.

**The build command runs `scripts/check-env.js` first**, which is what turns a
missing key into a failed build rather than a broken site.

**The install command skips dev dependencies.** Not an optimisation — npm writes
a lock entry for `@unrs/resolver-binding-openharmony-arm64` with no version
field at all, and a Linux npm resolving it fails the whole install with
`Invalid Version:`. It arrives under the eslint tooling, which a build does not
need, so `--omit=dev` never reaches it. Regenerating the lock does not help: npm
writes the same broken entry every time. Deleting the entry by hand does not
help either — the lock then fails `npm ci` for being out of sync.

The other two set the output directory and cache the hashed bundle forever.

Do not add `comment` fields to entries in this file. Vercel validates it against
a schema where `headers[]` and `rewrites[]` both set
`additionalProperties: false`, and an unknown key fails the deployment before it
builds.

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
