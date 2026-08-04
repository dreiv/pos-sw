import type { DBSchema } from "idb";

export const DB_NAME = "pos-db";
export const DB_VERSION = 1;

export interface ProductRecord {
  id: string;
  name: string;
  price: number;
  barcode: string;
  stock: number;
}

// priceAtAdd is a snapshot, not a live lookup — checkout compares it
// against the current catalog price to detect server-side price drift.
export interface CartItemRecord {
  productId: string;
  name: string;
  priceAtAdd: number;
  quantity: number;
}

export type OutboxStatus = "pending" | "synced";

// A checkout attempt, written BEFORE any network request so it's
// durable the moment the customer confirms. `id` is the client-
// generated idempotency key the server dedupes on. No retry counters
// here — that's the Service Worker's Background Sync queue's job now.
export interface OutboxRecord {
  id: string;
  items: CartItemRecord[];
  total: number;
  status: OutboxStatus;
  createdAt: number;
}

export interface PosDBSchema extends DBSchema {
  products: {
    key: string;
    value: ProductRecord;
    indexes: { "by-barcode": string };
  };
  cart: {
    key: string;
    value: CartItemRecord;
  };
  outbox: {
    key: string;
    value: OutboxRecord;
  };
}
