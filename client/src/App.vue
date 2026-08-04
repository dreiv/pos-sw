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

// registerType: "prompt" (vite.config.ts) înseamnă că o versiune nouă
// de SW stă în "waiting" în loc să preia automat controlul — noi
// decidem exact când se activează, apelând updateServiceWorker() mai
// jos, ca să nu schimbăm app shell-ul de sub picioarele unei
// tranzacții în curs.
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

.update-banner {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 1000;
  display: flex;
  gap: 12px;
  align-items: center;
}
</style>
