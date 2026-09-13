import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useCartStore } from "../cart";
import type { CartItemRecord } from "../../db/schema";

describe("cart store total (integer bani)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("sums exactly instead of accumulating float error", () => {
    const cartStore = useCartStore();
    const items: CartItemRecord[] = [
      { productId: "p002", name: "Paine alba", priceAtAdd: 480, quantity: 1 },
      { productId: "p003", name: "Oua 10buc", priceAtAdd: 1082, quantity: 1 },
      { productId: "p004", name: "Unt 200g", priceAtAdd: 504, quantity: 1 },
    ];
    cartStore.items = items;

    expect(cartStore.total).toBe(2066);
    expect(Number.isInteger(cartStore.total)).toBe(true);
  });

  it("scales exactly with quantity across multiple lines", () => {
    const cartStore = useCartStore();
    const items: CartItemRecord[] = [
      { productId: "p001", name: "Lapte 1L", priceAtAdd: 165, quantity: 1 },
      { productId: "p002", name: "Paine alba", priceAtAdd: 480, quantity: 3 },
      { productId: "p004", name: "Unt 200g", priceAtAdd: 504, quantity: 1 },
    ];
    cartStore.items = items;

    expect(cartStore.total).toBe(2109);
  });
});
