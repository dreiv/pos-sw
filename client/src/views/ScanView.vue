<script setup lang="ts">
import { useProductsStore } from "@/stores/products";
import { useCartStore } from "@/stores/cart";
import { formatPrice } from "@/utils/format";

const productsStore = useProductsStore();
const cartStore = useCartStore();
</script>

<template>
  <main>
    <h1>Catalog produse</h1>
    <p v-if="productsStore.loading">Se încarcă...</p>
    <p v-else-if="productsStore.lastSyncSucceeded === false">
      ⚠️ Nu am putut contacta serverul — arăt catalogul din cache (IndexedDB).
    </p>
    <ul>
      <li v-for="p in productsStore.products" :key="p.id">
        {{ p.name }} — {{ formatPrice(p.price) }} ({{ p.stock }} în stoc)
        <button type="button" @click="cartStore.add(p)">Adaugă în coș</button>
      </li>
    </ul>
    <RouterLink to="/cart">Vezi coșul ({{ cartStore.itemCount }})</RouterLink>
  </main>
</template>
