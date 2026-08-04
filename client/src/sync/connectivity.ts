import { notifyStateChanged, onStateChanged } from "./broadcastChannel";

export type ConnectivityStatus = "online" | "offline" | "syncing";

const HEALTH_URL = "http://localhost:3000/health";
const PROBE_BASE_MS = 5_000;
const PROBE_MAX_MS = 30_000;

let isOnline = navigator.onLine;
let isSyncing = false;
// Setat de syncEngine când tab-ul câștigă (sau pierde) lock-ul de
// leadership. Doar liderul face proba de recuperare și doar liderul
// difuzează starea către celelalte tab-uri — non-liderii doar ascultă.
let isLeaderTab = false;

type Listener = (status: ConnectivityStatus) => void;
const listeners = new Set<Listener>();

function computeStatus(): ConnectivityStatus {
  if (isSyncing) return "syncing";
  return isOnline ? "online" : "offline";
}

function emit(): void {
  const status = computeStatus();
  for (const l of listeners) l(status);
}

export function getStatus(): ConnectivityStatus {
  return computeStatus();
}

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener);
  listener(computeStatus());
  return () => listeners.delete(listener);
}

export function setIsLeaderTab(value: boolean): void {
  isLeaderTab = value;
  if (value && !isOnline) startRecoveryProbe();
  if (!value) stopRecoveryProbe();
}

export function setSyncing(value: boolean): void {
  if (isSyncing === value) return;
  isSyncing = value;
  emit();
  if (isLeaderTab) broadcastConnectivity();
}

/**
 * Semnal pasiv de conectivitate: orice request real către server
 * (refresh produse, încercare de sync din outbox) raportează aici
 * rezultatul. Nu facem NICIUN request doar ca să aflăm starea — asta
 * e diferența față de un heartbeat clasic. La mii de clienți, în
 * regim normal (online), costul e zero: reciclăm trafic care oricum
 * există.
 */
export function reportNetworkResult(success: boolean): void {
  setOnline(success);
}

function setOnline(value: boolean): void {
  if (isOnline === value) return;
  isOnline = value;
  emit();
  if (isLeaderTab) broadcastConnectivity();
  if (!isOnline) startRecoveryProbe();
  else stopRecoveryProbe();
}

function broadcastConnectivity(): void {
  notifyStateChanged({ type: "connectivity-changed", isOnline, isSyncing });
}

// Semnal fizic — gratuit, event-driven, nu polling. Insuficient singur
// (wifi conectat ≠ server accesibil), dar prinde instant "s-a scos
// cablul / s-a oprit wifi-ul".
window.addEventListener("online", () => setOnline(true));
window.addEventListener("offline", () => setOnline(false));

// Tab-urile non-lider nu fac request-uri reale către server (doar
// liderul rulează syncEngine), deci află starea prin broadcast, nu
// direct din propriul trafic.
onStateChanged((message) => {
  if (message.type === "connectivity-changed") {
    isOnline = message.isOnline;
    isSyncing = message.isSyncing;
    emit();
  }
});

// --- probă de recuperare: rulează DOAR cât timp crezi că ești offline,
// și DOAR în tab-ul lider ---
let probeAttempt = 0;
let probeTimeout: ReturnType<typeof setTimeout> | undefined;

function startRecoveryProbe(): void {
  if (probeTimeout || !isLeaderTab) return;
  scheduleProbe();
}

function stopRecoveryProbe(): void {
  probeAttempt = 0;
  if (probeTimeout) {
    clearTimeout(probeTimeout);
    probeTimeout = undefined;
  }
}

function scheduleProbe(): void {
  const backoff = Math.min(PROBE_MAX_MS, PROBE_BASE_MS * 2 ** probeAttempt);
  // Jitter ca să nu sondeze mii de clienți exact în aceeași secundă
  // după o pană de rețea generalizată (thundering herd la recuperare).
  const jitter = Math.random() * 0.3 * backoff;
  probeTimeout = setTimeout(async () => {
    try {
      const res = await fetch(HEALTH_URL);
      reportNetworkResult(res.ok);
    } catch {
      reportNetworkResult(false);
    }
    probeAttempt++;
    if (!isOnline) scheduleProbe();
  }, backoff + jitter);
}
