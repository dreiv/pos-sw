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
        if (oldVersion < 3) {
          const outbox = db.createObjectStore("outbox", { keyPath: "id" });
          outbox.createIndex("by-status", "status", { unique: false });
        }
        // Future migrations: `if (oldVersion < 4) { ... }` — additive,
        // never destructive, so users mid-transaction don't lose data.
      },
      // Fires on THIS connection when a newer version (e.g. another
      // tab after a code change bumped DB_VERSION) wants to open and
      // is waiting on us. Without this, we'd sit open forever and the
      // other tab's upgrade would hang — which is exactly the bug that
      // was happening here.
      blocking() {
        db.close();
        dbPromise = undefined;
      },
      // Fires on the NEW connection if some other (stale) connection
      // didn't close. We can't do much but at least this makes the
      // hang visible instead of silent.
      blocked() {
        console.warn(
          "[db] upgrade blocked by another open tab — close other tabs of this app and reload",
        );
      },
    });
  }
  return dbPromise;
}
