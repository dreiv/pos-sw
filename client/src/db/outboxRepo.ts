import { getDb } from "./client";
import type { CartItemRecord, OutboxRecord } from "./schema";

export async function getAllOutbox(): Promise<OutboxRecord[]> {
  const db = await getDb();
  return db.getAll("outbox");
}

// Written BEFORE any network request so the transaction is durable
// the moment the customer confirms.
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
