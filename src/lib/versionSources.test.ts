import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

/**
 * The app's version is written in TWO places, and they must agree.
 *
 * `app.json` -> what `Constants.expoConfig.version` returns at runtime, which
 *               is the number the force-update gate compares against the floor.
 * `android/app/build.gradle` -> `versionName`, which is the number Google Play
 *               shows and which EAS actually builds with.
 *
 * This project has a committed `android/` directory, so EAS says plainly:
 *
 *     Specified value ... in app.config.js or app.json is ignored because an
 *     android directory was detected in the project. EAS Build will use the
 *     value found in the native code.
 *
 * Bumping app.json alone therefore changes what the GATE sees while leaving
 * the store on the old number. That happened on 8 October: app.json said
 * 1.0.1, the build shipped as 1.0.0, and the two numbers meant different
 * things for the same binary. With a version gate in the app that is not a
 * cosmetic mismatch — it is how you set a floor that blocks the wrong builds,
 * or fails to block the right ones.
 *
 * One number, asserted here, so the next bump cannot drift.
 *
 * Numbering (user decision, 29 Oct 2026):
 *   version = MAJOR.MINOR.PATCH - phase . big changes . bug fixes (1.1.1)
 *   build   = yyyymmddNN - the release date plus a two-digit counter for that
 *             day (2026102901 = first build of 29 Oct 2026). It goes in
 *             build.gradle versionCode, app.json android.versionCode and
 *             app.json ios.buildNumber (a local Mac/Xcode build reads that).
 *             yyyymmddNN stays under Play's 2,100,000,000 versionCode cap
 *             until 2100 and only ever grows. Every release raises BOTH.
 *   EAS cloud builds use appVersionSource "remote" + autoIncrement, so they
 *   take EAS's own counter, not these files.
 */

const appJson = JSON.parse(readFileSync("app.json", "utf8")) as {
  expo: { version?: string; ios?: { buildNumber?: string }; android?: { versionCode?: number } };
};
const gradle = readFileSync("android/app/build.gradle", "utf8");

describe("the app has exactly one version number", () => {
  test("app.json declares a plain semver", () => {
    const v = appJson.expo.version;
    assert.ok(v, "app.json has no expo.version");
    assert.match(v, /^\d+\.\d+\.\d+$/, `"${v}" is not a plain x.y.z version`);
  });

  test("build.gradle versionName matches app.json", () => {
    const m = gradle.match(/versionName\s+"([^"]+)"/);
    assert.ok(m, "no versionName in android/app/build.gradle");
    assert.equal(
      m[1],
      appJson.expo.version,
      "The store would ship one version while the update gate compares another. " +
        "Bump BOTH: app.json expo.version and android/app/build.gradle versionName.",
    );
  });

  test("one build number, yyyymmddNN, in build.gradle and both app.json slots", () => {
    const m = gradle.match(/versionCode\s+(\d+)/);
    assert.ok(m, "no versionCode in android/app/build.gradle");
    const code = m[1];
    assert.match(code, /^20\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{2}$/, `versionCode ${code} is not yyyymmddNN`);
    assert.ok(Number(code) <= 2_100_000_000, "versionCode is above Google Play's cap");
    assert.equal(String(appJson.expo.android?.versionCode), code, "app.json android.versionCode must equal build.gradle versionCode");
    assert.equal(appJson.expo.ios?.buildNumber, code, "app.json ios.buildNumber must equal build.gradle versionCode");
  });
});
