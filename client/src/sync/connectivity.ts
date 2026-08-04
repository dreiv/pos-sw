import { useNetwork } from "@vueuse/core";
import { ref, watch } from "vue";
import { HEALTH_URL } from "../config";

// Reactive "do we actually have a working network path" signal.
// Retries are the Service Worker's Background Sync queue's job now,
// so there's no leader-election/recovery-probe loop here anymore —
// just navigator.onLine / online-offline events, upgraded by any real
// API call via reportNetworkResult (a 4xx/5xx still proves the
// network path works — see productsRepo.ts).
export const isOnline = ref(navigator.onLine);

export function reportNetworkResult(success: boolean): void {
  isOnline.value = success;
}

const { isOnline: browserIsOnline } = useNetwork();
watch(browserIsOnline, (value) => {
  isOnline.value = !!value;
});

// navigator.onLine only reflects "is a network interface up," not
// "can we reach the server." One request at startup gets an accurate
// initial reading; passive signals are enough after that.
export function probeOnce(): void {
  fetch(HEALTH_URL)
    .then((res) => reportNetworkResult(res.ok))
    .catch(() => reportNetworkResult(false));
}
