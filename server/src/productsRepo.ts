import { fileURLToPath } from "node:url";
import path from "node:path";
import { createJsonStore } from "./jsonStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_FILE = path.join(__dirname, "..", "products.json");

export interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string;
  stock: number;
}

const { readAll, writeAll } = createJsonStore<Product>(DATA_FILE);

export async function getAll(): Promise<Product[]> {
  return readAll();
}

export async function getById(id: string): Promise<Product | undefined> {
  const products = await readAll();
  return products.find((p) => p.id === id);
}

export async function create(input: Omit<Product, "id">): Promise<Product> {
  const products = await readAll();
  const id = `p${String(products.length + 1).padStart(3, "0")}`;
  const product: Product = { id, ...input };
  products.push(product);
  await writeAll(products);
  return product;
}

export async function update(
  id: string,
  patch: Partial<Omit<Product, "id">>,
): Promise<Product | undefined> {
  const products = await readAll();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return undefined;
  products[index] = { ...products[index], ...patch };
  await writeAll(products);
  return products[index];
}

export async function remove(id: string): Promise<boolean> {
  const products = await readAll();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return false;
  products.splice(index, 1);
  await writeAll(products);
  return true;
}
