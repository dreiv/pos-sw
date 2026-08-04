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

// Network-first, cache-fallback: keep whatever's in IndexedDB if the
// fetch fails, so the app still works offline with the last-synced
// catalog. Returns true if the refresh succeeded, false if it fell
// back to cache.
export async function refreshProductsFromServer(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/products`);
    // Any HTTP status still proves the network path works.
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
    console.warn("[products] refresh from server failed, using cache:", err);
    return false;
  }
}