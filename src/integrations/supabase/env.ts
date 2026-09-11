/**
 * Supabase project credentials.
 *
 * Read from the environment ONLY. Expo inlines `EXPO_PUBLIC_*` into the JS
 * bundle at build time, so an anon key here is fine and a service-role key
 * never is.
 *
 * There used to be a hardcoded production URL and anon key as a fallback, so a
 * fresh checkout would boot against production without any setup. That is
 * exactly the convenience worth removing: it meant a developer, or a QA run,
 * could be pointed at live customer data while believing they were on staging,
 * with nothing on screen to say otherwise. The web client has always thrown on
 * missing config; mobile now matches it.
 *
 *   .env          -> production
 *   .env.staging  -> Safarly Staging
 *
 * Select with `npm run start:staging` (or `npm start` for production config).
 */
function required(name: string, value: string | undefined): string {
  if (value && value.trim().length > 0) return value.trim();
  throw new Error(
    `Missing ${name}. Copy .env.example to .env (production) or use ` +
      `\`npm run start:staging\` for the staging project. ` +
      `Never hardcode a project URL or key here.`,
  );
}

export const SUPABASE_URL = required(
  "EXPO_PUBLIC_SUPABASE_URL",
  process.env.EXPO_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_ANON_KEY = required(
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;

/**
 * Which project this build is talking to, for the QA banner and for logs.
 * Derived from the URL rather than a separate flag, so it cannot disagree with
 * the client that is actually being constructed.
 */
export const SUPABASE_PROJECT_REF =
  SUPABASE_URL.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "unknown";

/** True when this build is pointed at the staging project. */
export const IS_STAGING = process.env.EXPO_PUBLIC_ENV === "staging";
