<script setup lang="ts">
import { ref, computed } from "vue";
import { useProductsStore } from "@/stores/products";
import { useCartStore } from "@/stores/cart";
import { formatPrice } from "@/utils/format";

const productsStore = useProductsStore();
const cartStore = useCartStore();

const query = ref("");

const filteredProducts = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return productsStore.products;
  return productsStore.products.filter(
    (p) => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
  );
});
</script>

<template>
  <main class="page page--wide">
    <div class="page-header">
      <h1>Catalog produse</h1>
      <RouterLink class="btn--pill" to="/cart"> 🛒 Coș ({{ cartStore.itemCount }}) </RouterLink>
    </div>

    <p v-if="productsStore.loading" class="text-muted">Se încarcă...</p>
    <p v-else-if="productsStore.lastSyncSucceeded === false" class="notice notice--warning">
      ⚠️ Nu am putut contacta serverul — arăt catalogul din cache (IndexedDB).
    </p>

    <input v-model="query" type="search" class="input search-input" placeholder="Caută după nume sau cod de bare..." />

    <p v-if="!productsStore.loading && filteredProducts.length === 0" class="text-muted">
      Niciun produs găsit.
    </p>

    <ul v-else class="product-grid">
      <li
        v-for="p in filteredProducts"
        :key="p.id"
        class="product-card"
        :class="{ 'out-of-stock': productsStore.availableStock(p.id) === 0 }"
      >
        <div class="product-info">
          <span class="product-name">{{ p.name }}</span>
          <span class="text-muted text-sm">{{ p.barcode }}</span>
        </div>

        <div class="product-meta">
          <span class="product-price">{{ formatPrice(p.price) }}</span>
          <span class="badge" :class="{ 'badge--danger': productsStore.availableStock(p.id) === 0 }">
            {{ productsStore.availableStock(p.id) === 0 ? "Stoc epuizat" : `${productsStore.availableStock(p.id)} în stoc` }}
          </span>
        </div>

        <button
          type="button"
          class="btn btn--primary"
          :disabled="productsStore.availableStock(p.id) === 0"
          @click="cartStore.add(p)"
        >
          {{ productsStore.availableStock(p.id) === 0 ? "Indisponibil" : "Adaugă în coș" }}
        </button>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.search-input {
  width: 100%;
  margin-bottom: var(--space-lg);
  font-size: 1rem;
}

.product-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md);
}

.product-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.product-card.out-of-stock {
  opacity: 0.65;
}

.product-info {
  display: flex;
  flex-direction: column;
}

.product-name {
  font-weight: 600;
}

.product-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.product-price {
  font-weight: 600;
}
</style>
