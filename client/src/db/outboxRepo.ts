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
 * Write a checkout attempt to the outbox. This is called BEFORE any
 * network request — the whole point of the outbox pattern is that the
 * transaction is durable the moment the customer confirms, regardless
 * of whether we're online right now.
 */
export async function enqueueCheckout(
  id: string,
  items: CartItemRecord[],
  total: number
): Promise<OutboxRecord> {
  const db = await getDb();
  const record: OutboxRecord = {
    id,
    items,
    total,
    status: "pending",
    createdAt: Date.now(),
    attempts: 0,
    nextRetryAt: Date.now(), // eligible immediately
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
 * Record a failed send attempt and schedule the next retry with
 * exponential backoff, capped so we don't end up waiting minutes
 * between tries in a short demo/interview session.
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
