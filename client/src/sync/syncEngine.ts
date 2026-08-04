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

    // Real network signal — report regardless of response status.
    reportNetworkResult(true);

    if (res.ok) {
      await markSynced(record.id);
      return;
    }

    // Non-2xx: back off and retry.
    await scheduleRetry(record.id);
  } catch {
    // fetch threw — offline/DNS/server down. Exactly what the outbox is for.
    reportNetworkResult(false);
    await scheduleRetry(record.id);
  }
}

/**
 * One pass over the outbox: send every pending item whose backoff
 * window has elapsed. Sequential processing ensures strictly ordered
 * delivery and simplifies transaction state management.
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

  // Notify other tabs to re-read outbox records from IndexedDB after
  // status updates or backoff rescheduling.
  notifyStateChanged({ type: "outbox-changed" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start the background sync loop with leader election via Navigator Locks.
 *
 * Gating runs via Web Locks: only the tab holding the lock executes
 * runSyncCycle(). On lock acquisition, the tab marks itself as the leader
 * to coordinate secondary tasks (such as background network probes).
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
