import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BACK_ONLINE_MS,
  RECONNECT_GRACE_MS,
  bannerVariant,
  degradationWasVisible,
  resolveConnectionStatus,
  stepBackOnline,
  type BackOnlineState,
  type ConnectionStatus,
} from "./connectionStatus.ts";

// Mobile port of web's connectionStatus.test.ts + ConnectionBanner rules.
const base = { isConnected: true, isInternetReachable: true, realtimeOpen: true, hasConnected: true };

describe("resolveConnectionStatus", () => {
  test("app start: NetInfo unknown (null) and socket not yet open is ONLINE - no flash", () => {
    assert.equal(
      resolveConnectionStatus({ isConnected: null, isInternetReachable: null, realtimeOpen: false, hasConnected: false }),
      "online",
    );
  });

  test("no network is offline, even while the socket still claims open", () => {
    assert.equal(resolveConnectionStatus({ ...base, isConnected: false }), "offline");
  });

  test("connected but the internet is unreachable is offline", () => {
    assert.equal(resolveConnectionStatus({ ...base, isInternetReachable: false }), "offline");
  });

  test("reachability still unknown on a connected network is not offline", () => {
    assert.equal(resolveConnectionStatus({ ...base, isInternetReachable: null }), "online");
  });

  test("a socket that was open and dropped is reconnecting; the first connect is silent", () => {
    assert.equal(resolveConnectionStatus({ ...base, realtimeOpen: false }), "reconnecting");
    assert.equal(resolveConnectionStatus({ ...base, realtimeOpen: false, hasConnected: false }), "online");
  });

  test("everything up is online", () => {
    assert.equal(resolveConnectionStatus(base), "online");
  });
});

describe("bannerVariant (same words, roles and priority as web)", () => {
  test("offline: red alert, at once", () => {
    assert.deepEqual(bannerVariant({ status: "offline", reconnectingVisible: false, showBackOnline: false }), {
      label: "You're offline",
      tone: "danger",
      role: "alert",
    });
  });

  test("reconnecting: hidden inside the grace, amber status after it", () => {
    assert.equal(bannerVariant({ status: "reconnecting", reconnectingVisible: false, showBackOnline: false }), null);
    assert.deepEqual(bannerVariant({ status: "reconnecting", reconnectingVisible: true, showBackOnline: false }), {
      label: "Reconnecting…",
      tone: "warning",
      role: "status",
    });
  });

  test("back online: green status; nothing when healthy", () => {
    assert.deepEqual(bannerVariant({ status: "online", reconnectingVisible: false, showBackOnline: true }), {
      label: "Back online",
      tone: "safe",
      role: "status",
    });
    assert.equal(bannerVariant({ status: "online", reconnectingVisible: false, showBackOnline: false }), null);
  });

  test("only a degradation the user SAW earns a 'Back online'", () => {
    assert.equal(degradationWasVisible("offline", false), true);
    assert.equal(degradationWasVisible("reconnecting", true), true);
    assert.equal(degradationWasVisible("reconnecting", false), false);
    assert.equal(degradationWasVisible("online", false), false);
  });

  test("timings match web (1 s grace, 1.5 s back-online)", () => {
    assert.equal(RECONNECT_GRACE_MS, 1000);
    assert.equal(BACK_ONLINE_MS, 1500);
  });
});

/**
 * Drives stepBackOnline the way ConnectionBanner does: one call per render, the
 * hide timer owned outside the step and cleared only on `hide`. A fake clock.
 */
function makeBanner() {
  let state: BackOnlineState = { wasDegraded: false };
  let showBackOnline = false;
  let hideAt: number | null = null;
  let now = 0;
  return {
    render(status: ConnectionStatus, reconnectingVisible: boolean) {
      const step = stepBackOnline(state, status, reconnectingVisible);
      state = step.next;
      if (step.hide) {
        hideAt = null;
        showBackOnline = false;
      }
      if (step.show) {
        showBackOnline = true;
        hideAt = now + BACK_ONLINE_MS;
      }
      return bannerVariant({ status, reconnectingVisible, showBackOnline })?.label ?? null;
    },
    advance(ms: number) {
      now += ms;
      if (hideAt !== null && now >= hideAt) {
        hideAt = null;
        showBackOnline = false;
      }
    },
    get pill() {
      return showBackOnline;
    },
  };
}

describe("stepBackOnline - 'Back online' always clears 1.5 s after it appears", () => {
  test("offline -> reconnecting (visible) -> online, incl. the stale reconnectingVisible render", () => {
    const b = makeBanner();
    assert.equal(b.render("online", false), null);
    assert.equal(b.render("offline", false), "You're offline");
    assert.equal(b.render("reconnecting", false), null); // inside the 1 s grace
    b.advance(RECONNECT_GRACE_MS);
    assert.equal(b.render("reconnecting", true), "Reconnecting…");
    // Status turns online while reconnectingVisible is still true (same commit) ...
    assert.equal(b.render("online", true), "Back online");
    // ... then reconnectingVisible flips false: the timer must survive this re-run.
    assert.equal(b.render("online", false), "Back online");
    b.advance(BACK_ONLINE_MS - 1);
    assert.equal(b.pill, true);
    b.advance(1);
    assert.equal(b.pill, false);
    assert.equal(b.render("online", false), null);
  });

  test("offline -> online shows the pill once and it hides on time", () => {
    const b = makeBanner();
    b.render("offline", false);
    assert.equal(b.render("online", false), "Back online");
    b.advance(BACK_ONLINE_MS);
    assert.equal(b.render("online", false), null);
  });

  test("a hidden first-connect reconnect never earns 'Back online'", () => {
    const b = makeBanner();
    b.render("reconnecting", false);
    assert.equal(b.render("online", false), null);
  });

  test("a new drop while 'Back online' is up hides it; recovery restarts the full 1.5 s", () => {
    const b = makeBanner();
    b.render("offline", false);
    b.render("online", false);
    b.advance(1000);
    assert.equal(b.render("offline", false), "You're offline");
    assert.equal(b.pill, false);
    assert.equal(b.render("online", false), "Back online");
    b.advance(1000);
    assert.equal(b.pill, true);
    b.advance(500);
    assert.equal(b.pill, false);
  });
});
