<script setup lang="ts">
import { onMounted } from "vue";
import { useOutboxStore } from "@/stores/outbox";
import { useConnectivityStore } from "@/stores/connectivity";

// Started here, not in CheckoutView, so any outbox items left over from
// a previous session (e.g. the tab was closed mid-sync) keep retrying
// as soon as the app loads — not only once the user revisits checkout.
const outboxStore = useOutboxStore();
const connectivityStore = useConnectivityStore();

onMounted(() => {
  outboxStore.initialize();
  connectivityStore.initialize();
});
</script>

<template>
  <div class="connectivity-badge" :class="connectivityStore.status">
    {{ connectivityStore.status }}
  </div>
  <RouterView />
</template>

<style scoped>
.connectivity-badge {
  position: fixed;
  top: 8px;
  right: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  z-index: 1000;
}

.connectivity-badge.online {
  background: #d1fae5;
  color: #065f46;
}

.connectivity-badge.offline {
  background: #fee2e2;
  color: #991b1b;
}

.connectivity-badge.syncing {
  background: #fef3c7;
  color: #92400e;
}
</style>
