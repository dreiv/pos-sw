import { fileURLToPath } from "node:url";
import path from "node:path";
import { createJsonStore } from "./jsonStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "transactions.json");

export interface TransactionItem {
  productId: string;
  name: string;
  priceAtAdd: number;
  quantity: number;
}

export interface Transaction {
  id: string; // client-generated idempotency key (UUID)
  items: TransactionItem[];
  total: number;
  receivedAt: string;
}

const { readAll, writeAll } = createJsonStore<Transaction>(DATA_FILE);

export async function findById(id: string): Promise<Transaction | undefined> {
  const all = await readAll();
  return all.find((t) => t.id === id);
}

export async function persist(tx: Transaction): Promise<void> {
  const all = await readAll();
  all.push(tx);
  await writeAll(all);
}

/**
 * Simulates flaky connectivity by failing ~30% of incoming requests with a 503.
 * Evaluated on new transaction attempts after idempotency checks pass.
 */
export function shouldSimulateFailure(): boolean {
  return Math.random() < 0.3;
}
