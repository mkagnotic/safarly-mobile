/**
 * Request deadline primitives for the API client (src/services/api/client.ts).
 * Same module as the web app's src/services/api/deadline.ts — keep them in step.
 *
 * Kept free of app imports so the node test runner can exercise them directly
 * (deadline.test.ts); client.ts supplies the error a timeout turns into.
 */

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

/**
 * Stop waiting on a promise that ignores AbortSignals (supabase-js's
 * getSession / refreshSession, `response.json()`). The work itself carries on
 * in the background; only our wait ends.
 */
export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort);
    work.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
      (error) => { signal.removeEventListener("abort", onAbort); reject(error); },
    );
  });
}

/**
 * Run `run` with one signal that aborts at the deadline OR when the caller's own
 * signal aborts. Our deadline becomes `onTimeout()`; a caller's cancel stays an
 * AbortError, which screens already swallow via `isAbortError`.
 *
 * Never retries: a timeout already cost the user the whole deadline, so they get
 * the error and a Retry button they control.
 */
export async function withDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
  callerSignal: AbortSignal | undefined,
  onTimeout: () => Error,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  const onCallerAbort = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener("abort", onCallerAbort);
  try {
    return await run(controller.signal);
  } catch (error) {
    if (timedOut) throw onTimeout();
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}
