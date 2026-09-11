#!/usr/bin/env node
/**
 * Starts Expo against a chosen environment file.
 *
 * Expo only understands `.env`, `.env.local` and NODE_ENV-derived variants, so
 * an arbitrary `--mode staging` does not exist the way it does for Vite. Rather
 * than teach everyone a shell idiom that works on one machine and not another,
 * this loads the right file and hands the variables to Expo.
 *
 *   npm start              -> .env          (production)
 *   npm run start:staging  -> .env.staging  (Safarly Staging)
 *
 * Anything after the target is forwarded to Expo:
 *   npm run start:staging -- --android
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "rbtdkdbmtecungdthujf";

const [, , target = "production", ...rest] = process.argv;
const envFile = target === "staging" ? ".env.staging" : ".env";
const full = path.join(ROOT, envFile);

if (!fs.existsSync(full)) {
  console.error(
    `\n  ${envFile} not found.\n` +
      (target === "staging"
        ? "  Staging config lives in the web repo's .env.staging; copy the\n" +
          "  EXPO_PUBLIC_* values across, or re-run the staging setup.\n"
        : "  Copy .env.example to .env and fill in the production values.\n"),
  );
  process.exit(2);
}

const vars = {};
for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  vars[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const url = vars.EXPO_PUBLIC_SUPABASE_URL ?? "";
if (!url) {
  console.error(`\n  ${envFile} has no EXPO_PUBLIC_SUPABASE_URL.\n`);
  process.exit(2);
}

// A staging file that still names production would reintroduce the exact
// confusion this whole mechanism exists to prevent.
if (target === "staging" && url.includes(PROD_REF)) {
  console.error(`\n  ${envFile} points at PRODUCTION (${PROD_REF}). Refusing to start.\n`);
  process.exit(1);
}

const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "unknown";
console.log(`\n  Expo -> ${target.toUpperCase()}  (${envFile})`);
console.log(`  Supabase project: ${ref}\n`);

const child = spawn("npx", ["expo", "start", ...rest], {
  cwd: ROOT,
  env: { ...process.env, ...vars },
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 1));
