import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, type PosDBSchema } from "./schema";

let dbPromise: Promise<IDBPDatabase<PosDBSchema>> | undefined;

export function getDb(): Promise<IDBPDatabase<PosDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PosDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const products = db.createObjectStore("products", { keyPath: "id" });
        products.createIndex("by-barcode", "barcode", { unique: false });

        db.createObjectStore("cart", { keyPath: "productId" });

        // No "by-status" index — retry scheduling moved to the
        // Service Worker's Background Sync queue.
        db.createObjectStore("outbox", { keyPath: "id" });
      },
      blocking() {
        dbPromise?.then((db) => db.close());
        dbPromise = undefined;
      },
      blocked() {
        console.warn(
          "[db] upgrade blocked by another open tab — close other tabs of this app and reload",
        );
      },
    });
  }
  return dbPromise;
}
