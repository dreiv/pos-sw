<script setup lang="ts">
import { computed, ref } from "vue";
import { useCartStore } from "@/stores/cart";
import { useOutboxStore } from "@/stores/outbox";
import { formatPrice } from "@/utils/format";

const cartStore = useCartStore();
const outboxStore = useOutboxStore();

const lastCheckoutId = ref<string | null>(null);

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
            {{ item.name }} × {{ item.quantity }} — {{ formatPrice(item.priceAtAdd) }}
          </li>
        </ul>
        <p><strong>Total: {{ formatPrice(cartStore.total) }}</strong></p>

        <div v-if="cartStore.priceConflicts.length > 0" class="notice">
          ⚠️ Prețul s-a schimbat pentru unele produse de când le-ai adăugat în coș:
          <ul>
            <li v-for="c in cartStore.priceConflicts" :key="c.name">
              {{ c.name }}: {{ formatPrice(c.oldPrice) }} → {{ formatPrice(c.newPrice) }}
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

<style scoped>
.notice {
  margin: var(--space-md) 0;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
}
</style>
