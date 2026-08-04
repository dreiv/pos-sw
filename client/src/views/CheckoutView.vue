<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useCartStore } from "@/stores/cart";
import { useProductsStore } from "@/stores/products";
import { useOutboxStore } from "@/stores/outbox";

const cartStore = useCartStore();
const productsStore = useProductsStore();
const outboxStore = useOutboxStore();

const lastCheckoutId = ref<string | null>(null);

onMounted(() => {
  cartStore.initialize();
  productsStore.initialize();
  outboxStore.initialize();
});

// Price-conflict check: compare what the cart snapshotted at add-time
// against the product's current price. We don't silently recompute
// the total to match — we surface it, per the spec's "clear, non-scary
// notice" requirement, and let the customer see exactly what changed.
const priceConflicts = computed(() => {
  return cartStore.items
    .map((item) => {
      const current = productsStore.products.find((p) => p.id === item.productId);
      if (!current || current.price === item.priceAtAdd) return null;
      return { name: item.name, oldPrice: item.priceAtAdd, newPrice: current.price };
    })
    .filter((c): c is { name: string; oldPrice: number; newPrice: number } => c !== null);
});

const lastCheckoutRecord = computed(() =>
  outboxStore.items.find((o) => o.id === lastCheckoutId.value)
);

async function confirmCheckout() {
  const id = await outboxStore.checkout(cartStore.items, cartStore.total);
  lastCheckoutId.value = id;
  await cartStore.clear();
}
</script>

<template>
  <main>
    <h1>Checkout</h1>

    <div v-if="!lastCheckoutId">
      <p v-if="cartStore.items.length === 0">Coșul e gol.</p>
      <template v-else>
        <ul>
          <li v-for="item in cartStore.items" :key="item.productId">
            {{ item.name }} × {{ item.quantity }} — {{ item.priceAtAdd.toFixed(2) }} lei
          </li>
        </ul>
        <p><strong>Total: {{ cartStore.total.toFixed(2) }} lei</strong></p>

        <div v-if="priceConflicts.length > 0" class="notice">
          ⚠️ Prețul s-a schimbat pentru unele produse de când le-ai adăugat în coș:
          <ul>
            <li v-for="c in priceConflicts" :key="c.name">
              {{ c.name }}: {{ c.oldPrice.toFixed(2) }} lei → {{ c.newPrice.toFixed(2) }} lei
            </li>
          </ul>
          Totalul de mai sus folosește prețul din momentul adăugării în coș.
        </div>

        <button type="button" @click="confirmCheckout">Confirmă checkout</button>
      </template>
    </div>

    <div v-else>
      <p v-if="lastCheckoutRecord?.status === 'synced'">
        ✅ Tranzacție confirmată de server (id: {{ lastCheckoutId }}).
      </p>
      <p v-else>
        ⏳ Tranzacția e salvată local și în curs de sincronizare (id: {{ lastCheckoutId }}).
        Va fi retrimisă automat până reușește — nu se pierde, chiar dacă închizi tab-ul.
      </p>
    </div>

    <RouterLink to="/cart">Înapoi la coș</RouterLink>
  </main>
</template>
