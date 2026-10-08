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
 */

const appJson = JSON.parse(readFileSync("app.json", "utf8")) as {
  expo: { version?: string };
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
});
