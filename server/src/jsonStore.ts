import { readFile, writeFile } from "node:fs/promises";

/**
 * Generic read/write for a JSON file holding an array of `T`.
 * Both productsRepo and transactionsRepo wrap this for domain queries.
 *
 * Note: Performs full un-locked file reads and overwrites. Suitable
 * for local development mock state, but vulnerable to race conditions
 * under concurrent writes.
 */
export function createJsonStore<T>(filePath: string) {
  async function readAll(): Promise<T[]> {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T[];
  }

  async function writeAll(items: T[]): Promise<void> {
    await writeFile(filePath, JSON.stringify(items, null, 2), "utf-8");
  }

  return { readAll, writeAll };
}