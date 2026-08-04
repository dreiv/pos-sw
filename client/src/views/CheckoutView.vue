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
  <main class="page">
    <h1>Checkout</h1>

    <div v-if="!lastCheckoutId">
      <p v-if="cartStore.items.length === 0" class="text-muted">
        Coșul e gol. <RouterLink to="/scan">Vezi catalogul</RouterLink> pentru a adăuga produse.
      </p>

      <template v-else>
        <ul class="summary-list">
          <li v-for="item in cartStore.items" :key="item.productId" class="row-card">
            <div class="summary-item-info">
              <span class="summary-item-name">{{ item.name }}</span>
              <span class="text-muted text-sm">× {{ item.quantity }}</span>
            </div>
            <span class="summary-item-total">
              {{ formatPrice(item.priceAtAdd * item.quantity) }}
            </span>
          </li>
        </ul>

        <div class="totals-row" style="margin-bottom: var(--space-md)">
          <span>Total</span>
          <strong>{{ formatPrice(cartStore.total) }}</strong>
        </div>

        <div v-if="cartStore.priceConflicts.length > 0" class="notice notice--warning">
          ⚠️ Prețul s-a schimbat pentru unele produse de când le-ai adăugat în coș:
          <ul class="conflict-list">
            <li v-for="c in cartStore.priceConflicts" :key="c.name">
              {{ c.name }}: {{ formatPrice(c.oldPrice) }} → {{ formatPrice(c.newPrice) }}
            </li>
          </ul>
          Totalul de mai sus folosește prețul din momentul adăugării în coș.
        </div>

        <button type="button" class="btn btn--primary btn--block" style="margin-bottom: var(--space-lg)"
          @click="confirmCheckout">
          Confirmă checkout
        </button>
      </template>
    </div>

    <div v-else>
      <p v-if="lastCheckoutRecord?.status === 'synced'" class="notice notice--success">
        ✅ Tranzacție confirmată de server (id: {{ lastCheckoutId }}).
      </p>
      <p v-else class="notice notice--warning">
        ⏳ Tranzacția e salvată local și în curs de sincronizare (id: {{ lastCheckoutId }}). Va fi
        retrimisă automat până reușește — nu se pierde, chiar dacă închizi tab-ul.
      </p>
    </div>

    <RouterLink to="/cart">Înapoi la coș</RouterLink>
  </main>
</template>

<style scoped>
.summary-list {
  list-style: none;
  margin: 0 0 var(--space-md);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.summary-item-info {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.summary-item-name,
.summary-item-total {
  font-weight: 600;
}

.conflict-list {
  margin: var(--space-sm) 0;
  padding-left: var(--space-lg);
}
</style>
