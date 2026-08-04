import type { DBSchema } from "idb";

export const DB_NAME = "pos-db";
// Bump this whenever the store shape changes — idb's upgrade callback
// runs migrations keyed off this number.
export const DB_VERSION = 2;

export interface ProductRecord {
  id: string;
  name: string;
  price: number;
  barcode: string;
  stock: number;
}

/**
 * A line in the in-progress cart.
 *
 * priceAtAdd is a deliberate snapshot, not a live lookup: at checkout
 * we compare it against the product's current price to detect a
 * server-side price change while the item sat in the cart, and surface
 * that as a notice instead of silently charging the new price.
 */
export interface CartItemRecord {
  productId: string; // also the key — one line per product
  name: string;
  priceAtAdd: number;
  quantity: number;
}

export interface PosDBSchema extends DBSchema {
  products: {
    key: string; // product id
    value: ProductRecord;
    indexes: { "by-barcode": string };
  };
  cart: {
    key: string; // productId
    value: CartItemRecord;
  };
  // outbox store lands here in the sync-engine step.
}
