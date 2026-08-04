import { getDb } from "./client";
import type { CartItemRecord, OutboxRecord } from "./schema";

export async function getAllOutbox(): Promise<OutboxRecord[]> {
  const db = await getDb();
  return db.getAll("outbox");
}

export async function getPendingOutbox(): Promise<OutboxRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex("outbox", "by-status", "pending");
}

/**
 * Write a checkout attempt to the outbox — called BEFORE any network
 * request so the transaction is durable the moment the customer confirms.
 */
export async function enqueueCheckout(
  id: string,
  items: CartItemRecord[],
  total: number,
): Promise<OutboxRecord> {
  const db = await getDb();
  const record: OutboxRecord = {
    id,
    items,
    total,
    status: "pending",
    createdAt: Date.now(),
    attempts: 0,
    nextRetryAt: Date.now(),
  };
  await db.put("outbox", record);
  return record;
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDb();
  const record = await db.get("outbox", id);
  if (!record) return;
  await db.put("outbox", { ...record, status: "synced" });
}

/**
 * Record a failed send attempt and schedule the next retry using
 * exponential backoff, capped at 30 seconds to maintain responsive
 * retry cycles for active clients.
 */
export async function scheduleRetry(id: string): Promise<void> {
  const db = await getDb();
  const record = await db.get("outbox", id);
  if (!record) return;
  const attempts = record.attempts + 1;
  const backoffMs = Math.min(30_000, 1_000 * 2 ** attempts);
  await db.put("outbox", {
    ...record,
    attempts,
    nextRetryAt: Date.now() + backoffMs,
  });
}
