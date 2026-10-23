/**
 * One request at a time — WITHOUT dropping the requests that arrive meanwhile.
 *
 * ⚠️ The data hooks used to coalesce with `if (inFlight) return inFlight`. That
 * DROPS every refresh asked for while a fetch is running, and realtime events
 * come in bursts: accepting a match writes the request, then the match, then the
 * message. The first event started a fetch that read the database before the
 * match was saved; every later event joined that stale fetch, and nothing ran
 * again. On a slow iPhone the chat sat on "Waiting · Match request sent" over a
 * "MATCH CONFIRMED" message, with the document step hidden behind the stale
 * banner (client, 23 Oct 2026).
 *
 * Here a request that arrives mid-flight queues ONE more run of the LATEST task
 * (latest closure = latest inputs) after the current one, and everyone awaiting
 * gets a promise that settles after that final run — so the last event always
 * wins, and a burst still costs at most two fetches.
 */
export interface SingleFlight {
  run: (task: () => Promise<void>) => Promise<void>;
  /** A fetch is running (or queued to re-run). */
  readonly busy: boolean;
}

export function createSingleFlight(): SingleFlight {
  let running: Promise<void> | null = null;
  let queued: (() => Promise<void>) | null = null;

  const run = (task: () => Promise<void>): Promise<void> => {
    if (running) {
      queued = task;
      return running;
    }
    running = (async () => {
      try {
        let next: (() => Promise<void>) | null = task;
        let lastError: unknown = null;
        while (next) {
          queued = null;
          lastError = null;
          try {
            await next();
          } catch (err) {
            lastError = err;
          }
          next = queued;
        }
        if (lastError) throw lastError;
      } finally {
        running = null;
      }
    })();
    return running;
  };

  return {
    run,
    get busy() {
      return running !== null;
    },
  };
}
