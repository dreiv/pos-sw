import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

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

async function readAll(): Promise<Transaction[]> {
  const raw = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as Transaction[];
}

async function writeAll(transactions: Transaction[]): Promise<void> {
  await writeFile(DATA_FILE, JSON.stringify(transactions, null, 2), "utf-8");
}

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
