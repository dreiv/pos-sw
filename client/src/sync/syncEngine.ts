import { getPendingOutbox, markSynced, scheduleRetry } from "../db/outboxRepo";
import { notifyStateChanged } from "./broadcastChannel";
import { reportNetworkResult, setIsLeaderTab, setSyncing } from "./connectivity";
import { API_BASE } from "../config";
import type { OutboxRecord } from "../db/schema";

const SYNC_LOCK_NAME = "pos-sync-leader";

/**
 * Send one outbox record. Idempotent by construction: `id` is sent as
 * the request body's idempotency key, so a retry of an already-synced
 * transaction is a safe no-op on the server, not a double charge.
 */
async function trySend(record: OutboxRecord): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: record.id,
        items: record.items,
        total: record.total,
      }),
    });

    // We got a response from the server at all — that's a real network
    // connectivity signal, independent of whether the request itself
    // succeeded (our simulated 503 is a business-logic failure, not a
    // network failure). Report it here so we never need a separate
    // heartbeat just to know we're reachable.
    reportNetworkResult(true);

    // 2xx (including the idempotent-replay 200) means the server has
    // this transaction durably recorded — safe to mark synced.
    if (res.ok) {
      await markSynced(record.id);
      return;
    }

    // Anything else (including our simulated 503) is treated the same
    // as a network failure: back off and retry later.
    await scheduleRetry(record.id);
  } catch {
    // fetch() itself threw — offline, DNS failure, server down, etc.
    // Same handling: this is exactly the case the outbox exists for.
    reportNetworkResult(false);
    await scheduleRetry(record.id);
  }
}

/**
 * One pass over the outbox: send every pending item whose backoff
 * window has elapsed. Sequential on purpose — this is a practice
 * project with a handful of items, not a high-throughput queue, and
 * sequential sends are much easier to reason about (and to explain).
 */
export async function runSyncCycle(): Promise<void> {
  const pending = await getPendingOutbox();
  const due = pending.filter((r) => r.nextRetryAt <= Date.now());
  if (due.length === 0) return;

  setSyncing(true);
  for (const record of due) {
    await trySend(record);
  }
  setSyncing(false);

  // Statuses changed (synced, or a new backoff window) — tell other
  // tabs to re-read the outbox from IndexedDB rather than pushing the
  // records themselves; see broadcastChannel.ts for why.
  notifyStateChanged({ type: "outbox-changed" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start the background sync loop, with leader election via Navigator
 * Locks.
 *
 * navigator.locks.request(name, callback) queues every caller for the
 * named lock FIFO, and holds the lock for the entire lifetime of the
 * async callback. So instead of "elect a leader, then have every tab
 * check 'am I the leader?' before syncing", gating comes almost for
 * free: the inner while-loop only ever runs in the tab that currently
 * holds the lock. A non-leader tab's call to startSyncEngine() just
 * sits queued on that request — it never calls runSyncCycle at all —
 * until the current leader's tab closes (the browser releases the
 * lock automatically) or its own cancel() is called.
 *
 * This function is safe to call from every tab identically; there's no
 * separate "am I leader" branch anywhere in the app — the lock itself
 * is the branch.
 */
export function startSyncEngine(intervalMs = 3000): () => void {
  let cancelled = false;

  (async () => {
    while (!cancelled) {
      await navigator.locks.request(SYNC_LOCK_NAME, async () => {
        setIsLeaderTab(true);
        while (!cancelled) {
          await runSyncCycle();
          await sleep(intervalMs);
        }
        setIsLeaderTab(false);
      });
      // The callback returned (i.e. we exited the while loop because
      // we were cancelled) => the outer loop stops too.
    }
  })();

  return () => {
    cancelled = true;
  };
}