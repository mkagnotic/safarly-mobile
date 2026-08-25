import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mirrors web's `src/lib/presenceRegistry.ts` verbatim, so the two platforms
 * cannot drift.
 *
 * ONE Realtime channel per presence topic, per client — shared and ref-counted.
 *
 * ⚠️ The hazard this exists for. `supabase.channel(topic)` hands back a BRAND NEW
 * channel every call, and a Phoenix socket refuses a second join of a topic it has
 * already joined. `removeChannel()` is asynchronous, so a React effect that tears
 * down and re-subscribes in the same tick — switching conversations, a participant
 * id arriving after the first render, a remount — leaves the old channel's leave
 * in flight while the new one tries to join. The new join is rejected, `sync` never
 * fires, and the watcher sits at its initial `false` forever: the chat header reads
 * "offline" for someone who is demonstrably online, and stays wrong until reload.
 *
 * Ref-counting removes the race instead of papering over it. Subscribers on a topic
 * share one channel; it is torn down only when the last one leaves; and a subscriber
 * arriving while a teardown is in flight WAITS for it rather than racing it.
 *
 * ⚠️ `subscribe()` is called EXACTLY ONCE per channel — supabase-js throws
 * "tried to subscribe multiple times" otherwise — so the single subscribe callback
 * fans out to everyone who cares, which is also what re-arms `track()` after a
 * reconnect (presence does not survive the socket dropping).
 */

/** Called with the presence keys currently tracked on the topic. */
type Sub = (onlineKeys: string[]) => void;

interface Entry {
  channel: RealtimeChannel;
  subs: Set<Sub>;
  /** Last keys seen, so a late subscriber is not blind until the next sync. */
  lastKeys: string[];
  /** Set while this entry is being removed; a new subscriber chains onto it. */
  closing: Promise<void> | null;
  /** How many broadcasters want this client announced on the topic. */
  trackers: number;
  /** True once the join has landed, so `track()` is safe to send. */
  subscribed: boolean;
}

const entries = new Map<string, Entry>();

const payload = () => ({ online_at: new Date().toISOString() });

function emit(entry: Entry) {
  entry.lastKeys = Object.keys(entry.channel.presenceState());
  for (const sub of entry.subs) sub(entry.lastKeys);
}

function create(topic: string, selfKey: string): Entry {
  const channel = supabase.channel(topic, { config: { presence: { key: selfKey } } });
  const entry: Entry = {
    channel, subs: new Set(), lastKeys: [], closing: null, trackers: 0, subscribed: false,
  };
  entries.set(topic, entry);
  // Bindings are registered BEFORE subscribe(): supabase-js delivers the initial
  // presence state as part of the join, so a listener added afterwards misses it
  // and only recovers on the next join/leave.
  channel
    .on("presence", { event: "sync" }, () => emit(entry))
    .on("presence", { event: "join" }, () => emit(entry))
    .on("presence", { event: "leave" }, () => emit(entry))
    .subscribe((status) => {
      if (status !== "SUBSCRIBED") {
        entry.subscribed = false;
        return;
      }
      entry.subscribed = true;
      // Re-announce on every (re)subscribe — this is the reconnect path.
      if (entry.trackers > 0) void Promise.resolve(channel.track(payload())).catch(() => {});
    });
  return entry;
}

/** Run `fn` against the topic's entry, waiting out a teardown already in flight. */
function withEntry(topic: string, selfKey: string, fn: (entry: Entry) => void): void {
  const existing = entries.get(topic);
  if (existing && !existing.closing) {
    fn(existing);
  } else if (existing?.closing) {
    // Joining now would be the exact race described above, so queue behind it.
    void existing.closing.then(() => {
      const live = entries.get(topic);
      fn(live && !live.closing ? live : create(topic, selfKey));
    });
  } else {
    fn(create(topic, selfKey));
  }
}

function releaseRef(topic: string, entry: Entry) {
  if (entry.subs.size > 0 || entry.trackers > 0) return; // still needed
  const done = () => {
    // Only clear the slot if it is still ours — a queued create() may already
    // have installed a replacement.
    if (entries.get(topic) === entry) entries.delete(topic);
  };
  entry.closing = Promise.resolve(supabase.removeChannel(entry.channel)).then(done, done);
}

/**
 * Observe who is present on `topic`. Returns an unsubscribe function.
 *
 * `selfKey` is the CURRENT user's id — never the id being watched. A presence key
 * identifies the client that is tracking, so keying a watcher by its subject
 * conflates "who am I" with "who am I looking at".
 */
export function watchPresence(topic: string, selfKey: string, sub: Sub): () => void {
  let cancelled = false;
  let bound: Entry | null = null;

  withEntry(topic, selfKey, (entry) => {
    if (cancelled) return;
    bound = entry;
    entry.subs.add(sub);
    sub(entry.lastKeys); // hand over what is already known
  });

  return () => {
    cancelled = true;
    if (!bound) return;
    bound.subs.delete(sub);
    releaseRef(topic, bound);
  };
}

/**
 * Announce the current user on `topic`, and keep announcing across reconnects.
 *
 * Shares the same ref-counted channel as `watchPresence`, so mounting the
 * broadcaster twice can never open a second channel on an already-joined topic.
 */
export function trackPresence(topic: string, selfKey: string): () => void {
  let cancelled = false;
  let bound: Entry | null = null;

  withEntry(topic, selfKey, (entry) => {
    if (cancelled) return;
    bound = entry;
    entry.trackers += 1;
    // If the join already landed, announce now; otherwise the subscribe callback
    // above does it the moment it does.
    if (entry.subscribed) void Promise.resolve(entry.channel.track(payload())).catch(() => {});
  });

  return () => {
    cancelled = true;
    if (!bound) return;
    bound.trackers -= 1;
    if (bound.trackers <= 0) void Promise.resolve(bound.channel.untrack()).catch(() => {});
    releaseRef(topic, bound);
  };
}

/** Re-announce now — call when the tab/app returns to the foreground. */
export function refreshPresence(topic: string): void {
  const entry = entries.get(topic);
  if (entry?.subscribed && entry.trackers > 0) {
    void Promise.resolve(entry.channel.track(payload())).catch(() => {});
  }
}

/** Test seam: drop all state. Tests only — never call this from the app. */
export function __resetPresenceRegistry(): void {
  for (const entry of entries.values()) {
    try { void supabase.removeChannel(entry.channel); } catch { /* nothing to undo */ }
  }
  entries.clear();
}

/** Test seam: how many live presence channels this client is holding. */
export function presenceChannelCount(): number {
  return entries.size;
}
