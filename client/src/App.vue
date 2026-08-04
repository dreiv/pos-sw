<script setup lang="ts">
import { onMounted } from "vue";
import { useOutboxStore } from "@/stores/outbox";
import { useConnectivityStore } from "@/stores/connectivity";
import { useRegisterSW } from "virtual:pwa-register/vue";

const outboxStore = useOutboxStore();
const connectivityStore = useConnectivityStore();

const { needRefresh, updateServiceWorker } = useRegisterSW();

onMounted(() => {
  outboxStore.initialize();
  connectivityStore.initialize();
});
</script>

<template>
  <div class="connectivity-badge" :class="connectivityStore.status">
    {{ connectivityStore.status }}
  </div>

  <div v-if="needRefresh" class="update-banner">
    O versiune nouă a aplicației e disponibilă.
    <button type="button" @click="updateServiceWorker()">Actualizează</button>
  </div>

  <RouterView />
</template>

<style scoped>
.connectivity-badge {
  position: fixed;
  top: 8px;
  right: 8px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  z-index: 1000;
}

.connectivity-badge.online {
  background: var(--color-success-bg);
  color: var(--color-success-text);
}

.connectivity-badge.offline {
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
}

.connectivity-badge.syncing {
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
