import { useEffect, useRef, useState } from "react";

import { isUpdateRequired } from "@/lib/appVersion";
import { currentAppVersion } from "@/lib/buildInfo";
import { fetchPlatformGate, type PlatformGate } from "@/services/api/appConfig";

export interface VersionGate {
  /** True only when this build is definitively below the configured floor. */
  blocked: boolean;
  /** Server-supplied reason, shown on the blocking screen. */
  message?: string;
  storeUrl?: string;
}

const ALLOWED: VersionGate = { blocked: false };

/**
 * Decides, once per launch, whether this build may run.
 *
 * Returns `{ blocked: false }` immediately and flips to blocked only if the
 * server says so. The app therefore renders NOTHING extra while the check is
 * in flight — no spinner, no delayed splash. A gate that adds a visible pause
 * to every cold start would cost every healthy user something real to catch a
 * rare broken one.
 *
 * Checked once, at mount. Not on every foreground: a user who is mid-task when
 * a floor is raised should finish, and the next cold start will catch them.
 */
export function useVersionGate(): VersionGate {
  const [gate, setGate] = useState<VersionGate>(ALLOWED);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    let alive = true;

    void (async () => {
      let cfg: PlatformGate | null = null;
      try {
        cfg = await fetchPlatformGate();
      } catch {
        // fetchPlatformGate does not throw, but a future edit might. Staying
        // silent here keeps "something went wrong" meaning "let them in".
        return;
      }
      if (!alive || !cfg) return;

      if (isUpdateRequired(currentAppVersion(), cfg.minimumVersion)) {
        setGate({ blocked: true, message: cfg.message, storeUrl: cfg.storeUrl });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return gate;
}
