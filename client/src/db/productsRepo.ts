import { getDb } from "./client";
import { reportNetworkResult } from "../sync/connectivity";
import { API_BASE } from "../config";
import type { ProductRecord } from "./schema";

export async function getAllProducts(): Promise<ProductRecord[]> {
  const db = await getDb();
  return db.getAll("products");
}

export async function getProductById(id: string): Promise<ProductRecord | undefined> {
  const db = await getDb();
  return db.get("products", id);
}

export async function getProductByBarcode(barcode: string): Promise<ProductRecord | undefined> {
  const db = await getDb();
  return db.getFromIndex("products", "by-barcode", barcode);
}

/**
 * Refresh the local product catalog from the server.
 *
 * Network-first, cache-fallback: if the fetch fails (offline, server
 * down), we just keep whatever's already in IndexedDB — the catalog
 * from the last successful sync. We never throw here, because a failed
 * refresh should never block the app from working offline with
 * whatever it already has cached.
 *
 * Returns true if the refresh succeeded, false if it fell back to cache.
 */
export async function refreshProductsFromServer(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/products`);
    // Real connectivity signal — report before checking res.ok (a 4xx/5xx
    // is still proof the network path works).
    reportNetworkResult(true);
    if (!res.ok) throw new Error(`Server responded ${res.status}`);

    const products = (await res.json()) as ProductRecord[];

    const db = await getDb();
    const tx = db.transaction("products", "readwrite");
    await tx.store.clear();
    await Promise.all(products.map((p) => tx.store.put(p)));
    await tx.done;

    return true;
  } catch (err) {
    // Catch network/DNS failures or thrown non-2xx errors. If fetch itself
    // fails, report offline status; non-2xx responses have already reported
    // reachability as true above.
    console.warn("[products] refresh from server failed, using cache:", err);
    return false;
  }
}
