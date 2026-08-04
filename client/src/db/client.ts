import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, type PosDBSchema } from "./schema";

let dbPromise: Promise<IDBPDatabase<PosDBSchema>> | undefined;

// Singleton connection — idb handles concurrent opens fine, but we only
// want one upgrade transaction and one place that knows the DB name/version.
export function getDb(): Promise<IDBPDatabase<PosDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PosDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore("products", { keyPath: "id" });
          store.createIndex("by-barcode", "barcode", { unique: false });
        }
        if (oldVersion < 2) {
          db.createObjectStore("cart", { keyPath: "productId" });
        }
        // Future migrations: `if (oldVersion < 3) { ... }` — additive,
        // never destructive, so users mid-transaction don't lose data.
      },
    });
  }
  return dbPromise;
}
