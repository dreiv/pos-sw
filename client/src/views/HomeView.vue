<script setup lang="ts">
import { onMounted } from "vue";
import { useProductsStore } from "@/stores/products";

const productsStore = useProductsStore();

onMounted(() => {
  productsStore.initialize();
});
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
        {{ p.name }} — {{ p.price.toFixed(2) }} lei ({{ p.stock }} în stoc)
      </li>
    </ul>
  </main>
</template>
