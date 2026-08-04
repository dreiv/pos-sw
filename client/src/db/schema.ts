import type { DBSchema } from "idb";

export const DB_NAME = "pos-db";
// Bump this whenever the store shape changes — idb's upgrade callback
// runs migrations keyed off this number.
export const DB_VERSION = 1;

export interface ProductRecord {
  id: string;
  name: string;
  price: number;
  barcode: string;
  stock: number;
}

// cart / outbox stores land here in the next step (sync engine work);
// declaring the schema interface now so later additions are additive,
// not a rewrite.
export interface PosDBSchema extends DBSchema {
  products: {
    key: string; // product id
    value: ProductRecord;
    indexes: { "by-barcode": string };
  };
}
