import { getPendingOutbox, markSynced, scheduleRetry } from "../db/outboxRepo";
import type { OutboxRecord } from "../db/schema";

const API_BASE = "http://localhost:3000";

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
  for (const record of due) {
    await trySend(record);
  }
}

let intervalHandle: ReturnType<typeof setInterval> | undefined;

/**
 * Start the background sync loop. NOTE: this does not yet do leader
 * election (Navigator Locks) — if the app is open in multiple tabs,
 * each tab currently runs its own loop independently. That's the next
 * step; for now every tab syncing is harmless (idempotent), just
 * wasteful.
 */
export function startSyncEngine(intervalMs = 3000): () => void {
  if (intervalHandle) return () => {};
  intervalHandle = setInterval(runSyncCycle, intervalMs);
  return () => {
    if (intervalHandle) clearInterval(intervalHandle);
    intervalHandle = undefined;
  };
}
