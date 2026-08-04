import { getPendingOutbox, markSynced, scheduleRetry } from "../db/outboxRepo";
import { notifyStateChanged } from "./broadcastChannel";
import type { OutboxRecord } from "../db/schema";

const API_BASE = "http://localhost:3000";
const SYNC_LOCK_NAME = "pos-sync-leader";

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
    if (res.ok) {
      await markSynced(record.id);
      return;
    }
    await scheduleRetry(record.id);
  } catch {
    await scheduleRetry(record.id);
  }
}

export async function runSyncCycle(): Promise<void> {
  const pending = await getPendingOutbox();
  const due = pending.filter((r) => r.nextRetryAt <= Date.now());
  if (due.length === 0) return;

  for (const record of due) {
    await trySend(record);
  }

  // Statusurile s-au schimbat (synced sau backoff nou) — anunță
  // celelalte tab-uri să re-citească outbox-ul din IndexedDB, nu
  // trimitem stare prin mesaj.
  notifyStateChanged({ type: "outbox-changed" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Leader election via Navigator Locks. `navigator.locks.request()` pune
 * fiecare tab la coadă pentru lock-ul numit SYNC_LOCK_NAME și ține
 * lock-ul cât timp rulează callback-ul async dat. Deci în loc de
 * "alege un lider, apoi fiecare tab verifică 'sunt eu liderul?' înainte
 * să sincronizeze", gating-ul vine aproape gratis: bucla while de mai
 * jos rulează DOAR în tab-ul care ține lock-ul chiar acum. Un tab
 * non-lider care apelează startSyncEngine() stă pur și simplu blocat
 * pe acel request — nu apelează niciodată runSyncCycle — până când
 * liderul actual se închide (browserul eliberează automat lock-ul) sau
 * până când propriul lui cancel() e apelat.
 */
export function startSyncEngine(intervalMs = 3000): () => void {
  let cancelled = false;

  (async () => {
    while (!cancelled) {
      await navigator.locks.request(SYNC_LOCK_NAME, async () => {
        while (!cancelled) {
          await runSyncCycle();
          await sleep(intervalMs);
        }
      });
      // callback-ul a returnat (adică am ieșit din while pentru că am
      // fost cancelled) => bucla exterioară se oprește și ea.
    }
  })();

  return () => {
    cancelled = true;
  };
}
