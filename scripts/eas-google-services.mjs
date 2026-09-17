#!/usr/bin/env node
/**
 * EAS build hook: provide android/app/google-services.json on cloud builders.
 *
 * The file is gitignored, and EAS uploads only what git tracks, so without this
 * every EAS Android build would compile without Firebase — the Gradle build
 * skips the google-services plugin when the file is absent, and push would
 * silently never register.
 *
 * Store the file once as an EAS environment variable of type "file" named
 * GOOGLE_SERVICES_JSON (expo.dev -> project -> Environment variables). On the
 * builder its value is the path to that file; this copies it into place.
 * Locally the variable is unset and the developer's own copy is left alone.
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.GOOGLE_SERVICES_JSON;
const target = join(root, "android", "app", "google-services.json");

if (!source) {
  console.log(
    existsSync(target)
      ? "[google-services] GOOGLE_SERVICES_JSON not set; using the existing android/app/google-services.json."
      : "[google-services] GOOGLE_SERVICES_JSON not set and no local file; this build will have no FCM push.",
  );
  process.exit(0);
}
if (!existsSync(source)) {
  console.error(`[google-services] GOOGLE_SERVICES_JSON points to a missing file: ${source}`);
  process.exit(1);
}
copyFileSync(source, target);
console.log("[google-services] Copied GOOGLE_SERVICES_JSON into android/app/google-services.json.");
