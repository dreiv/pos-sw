<script setup lang="ts">
import { onMounted } from "vue";
import { useOutboxStore } from "@/stores/outbox";
import { useConnectivityStore } from "@/stores/connectivity";
import { useRegisterSW } from "virtual:pwa-register/vue";

// Started here, not in CheckoutView, so any outbox items left over from
// a previous session (e.g. the tab was closed mid-sync) keep retrying
// as soon as the app loads — not only once the user revisits checkout.
const outboxStore = useOutboxStore();
const connectivityStore = useConnectivityStore();

// registerType: "prompt" (see vite.config.ts) means a new SW version
// sits in "waiting" instead of taking control automatically — we
// decide exactly when it activates, by calling updateServiceWorker()
// below, so we don't swap the app shell out from under an
// in-progress transaction.
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