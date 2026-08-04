<script setup lang="ts">
import { watch } from "vue";
import { useRoute } from "vue-router";
import { useConnectivityStore } from "@/stores/connectivity";
import { useProductsStore } from "@/stores/products";
import { useRegisterSW } from "virtual:pwa-register/vue";

const connectivityStore = useConnectivityStore();
const productsStore = useProductsStore();
const route = useRoute();

const { needRefresh, updateServiceWorker } = useRegisterSW();
const PRODUCT_SENSITIVE_ROUTES = new Set(["scan", "cart"]);

watch(
  () => route.name,
  async (name) => {
    if (typeof name === "string" && PRODUCT_SENSITIVE_ROUTES.has(name) && productsStore.isDirty) {
      await productsStore.refresh();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="connectivity-bar" :class="connectivityStore.status">
    {{ connectivityStore.status }}
  </div>

  <div v-if="needRefresh" class="update-banner">
    O versiune nouă a aplicației e disponibilă.
    <button type="button" @click="updateServiceWorker()">Actualizează</button>
  </div>

  <RouterView />
</template>

<style scoped>
.connectivity-bar {
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
  padding: 4px 10px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.connectivity-bar.online {
  background: var(--color-success-bg);
  color: var(--color-success-text);
}

.connectivity-bar.offline {
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
}

.connectivity-bar.syncing {
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
}

.update-banner {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-overlay-bg);
  color: var(--color-overlay-text);
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  z-index: 1000;
  display: flex;
  gap: 12px;
  align-items: center;
}
</style>
