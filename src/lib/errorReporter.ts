import { Platform } from "react-native";

import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_ANON_KEY, SUPABASE_FUNCTIONS_URL } from "@/integrations/supabase/env";
import { currentAppVersion } from "@/lib/buildInfo";
import { navigationRef } from "@/navigation/navigationRef";

import { buildPayload, createThrottle, isReportable, type ErrorReport } from "./errorReportCore";

/**
 * Sends crashes and unhandled errors to Admin → Errors (POST
 * /error-handler/report). Sources: the AppErrorBoundary (render crashes), the
 * React Native global handler (ErrorUtils) and, in release builds, unhandled
 * promise rejections.
 *
 * Never throws, never retries, throttled (see errorReportCore.ts). The existing
 * global handler always runs afterwards, so the app behaves exactly as before
 * a crash - this only adds the report.
 */

const allow = createThrottle();

function currentScreen(): string | null {
  try {
    return navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name ?? null : null;
  } catch {
    return null;
  }
}

export function reportError(report: ErrorReport): void {
  try {
    const message = String(report.message ?? "");
    if (!isReportable(message) || !allow(message)) return;
    const platform = Platform.OS === "ios" ? "ios" : "android";
    const payload = buildPayload({ ...report, screen: report.screen ?? currentScreen() }, platform, currentAppVersion());
    void send(payload);
  } catch {
    /* reporting must never throw */
  }
}

async function send(payload: Record<string, unknown>): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    const token = data.session?.access_token ?? SUPABASE_ANON_KEY;
    await fetch(`${SUPABASE_FUNCTIONS_URL}/error-handler/report`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* offline or similar: drop it */
  }
}

type GlobalHandler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsShape = { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (h: GlobalHandler) => void };
type HermesShape = {
  enablePromiseRejectionTracker?: (opts: { allRejections: boolean; onUnhandled: (id: number, rejection: unknown) => void }) => void;
};

let installed = false;

/** Hooks the global JS error handler (and release-build promise rejections). Idempotent. */
export function installGlobalErrorReporting(): void {
  if (installed) return;
  installed = true;

  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      reportError({
        // user-facing-ok: sent to error monitoring (Admin → Errors), never rendered.
        message: `${isFatal ? "[fatal] " : ""}${error?.message ?? String(error)}`,
        stack: error?.stack ?? null,
      });
      previous(error, isFatal);
    });
  }

  // Debug builds keep React Native's own rejection warnings untouched.
  const hermes = (globalThis as { HermesInternal?: HermesShape }).HermesInternal;
  if (!__DEV__ && hermes?.enablePromiseRejectionTracker) {
    hermes.enablePromiseRejectionTracker({
      allRejections: true,
      onUnhandled: (_id, rejection) => {
        const r = rejection as { message?: string; stack?: string } | string | undefined;
        reportError(typeof r === "string" ? { message: r } : { message: r?.message ?? "Unhandled promise rejection", stack: r?.stack ?? null });
      },
    });
  }
}
