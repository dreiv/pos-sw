import { getDb } from "./client";
import type { CartItemRecord, ProductRecord } from "./schema";

export async function getCart(): Promise<CartItemRecord[]> {
  const db = await getDb();
  return db.getAll("cart");
}

/**
 * Add a product to the cart, or bump its quantity if it's already
 * there. priceAtAdd is only set the first time a line is created —
 * re-adding the same product doesn't refresh the snapshot, since the
 * point of the snapshot is "what did the customer see when they
 * picked it up", not "what's the latest price".
 */
export async function addToCart(
  product: ProductRecord,
  quantity = 1
): Promise<void> {
  const db = await getDb();
  const existing = await db.get("cart", product.id);
  const next: CartItemRecord = existing
    ? { ...existing, quantity: existing.quantity + quantity }
    : {
        productId: product.id,
        name: product.name,
        priceAtAdd: product.price,
        quantity,
      };
  await db.put("cart", next);
}

export async function updateCartQuantity(
  productId: string,
  quantity: number
): Promise<void> {
  const db = await getDb();
  if (quantity <= 0) {
    await db.delete("cart", productId);
    return;
  }
  const existing = await db.get("cart", productId);
  if (!existing) return;
  await db.put("cart", { ...existing, quantity });
}

export async function removeFromCart(productId: string): Promise<void> {
  const db = await getDb();
  await db.delete("cart", productId);
}

export async function clearCart(): Promise<void> {
  const db = await getDb();
  await db.clear("cart");
}