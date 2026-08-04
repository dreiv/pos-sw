<script setup lang="ts">
import { onMounted } from "vue";
import { useOutboxStore } from "@/stores/outbox";

// Started here, not in CheckoutView, so any outbox items left over from
// a previous session (e.g. the tab was closed mid-sync) keep retrying
// as soon as the app loads — not only once the user revisits checkout.
const outboxStore = useOutboxStore();

onMounted(() => {
  outboxStore.initialize();
});
</script>

<template>
  <RouterView />
</template>
