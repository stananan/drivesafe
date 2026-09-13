/**
 * Refuses to build without the Supabase keys.
 *
 * `EXPO_PUBLIC_*` values are inlined by Babel while the bundle is built, not
 * read when it runs. A build with them missing therefore succeeds, deploys, and
 * serves a site that loads perfectly and then says "Supabase is not configured"
 * to the first person who tries to sign in — and adding the variables afterwards
 * changes nothing until someone rebuilds.
 *
 * That is a bad failure: silent at the moment it happens, confusing later, and
 * the fix is not where the symptom is. So the build stops here instead, which
 * turns it into a red deployment with a message that says what to do.
 */

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const REQUIRED = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

/**
 * Read `.env.local` the way the Expo CLI would.
 *
 * Expo loads that file itself when it builds, so the variables exist for the
 * bundler but not for a plain node process run beforehand. Without this the
 * guard would reject every local build — failing on exactly the machines where
 * the configuration is fine.
 *
 * Vercel has no `.env.local`; there the real environment is the only source,
 * which is what this is checking for.
 */
function fromEnvFile(name) {
  const file = join(__dirname, '..', '.env.local');
  if (!existsSync(file)) return undefined;

  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (match && match[1] === name) return match[2].trim().replace(/^["']|["']$/g, '');
  }

  return undefined;
}

const resolved = Object.fromEntries(
  REQUIRED.map((name) => [name, process.env[name] || fromEnvFile(name)])
);

const missing = REQUIRED.filter((name) => !resolved[name]);

if (missing.length > 0) {
  console.error('\n  Cannot build: missing environment variables\n');
  for (const name of missing) console.error(`    ${name}`);
  console.error(
    [
      '',
      '  These are read at build time, not at runtime, so a build without them',
      '  produces a site that cannot reach the database no matter what is set',
      '  afterwards.',
      '',
      '  Locally:  copy .env.local from the main checkout.',
      '  Vercel:   Settings -> Environment Variables, then redeploy.',
      '',
      '  Both values are safe to expose — row-level security is what protects',
      '  the data. Never add the service-role key.',
      '',
    ].join('\n')
  );

  process.exit(1);
}

// A URL that is present but wrong is the other way this goes quietly wrong.
if (!/^https:\/\/.+\.supabase\.co/.test(resolved.EXPO_PUBLIC_SUPABASE_URL)) {
  console.error(
    `\n  EXPO_PUBLIC_SUPABASE_URL does not look like a Supabase URL:\n    ${resolved.EXPO_PUBLIC_SUPABASE_URL}\n`
  );
  process.exit(1);
}

console.log('Supabase environment variables present.');
