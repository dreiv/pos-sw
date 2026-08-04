import { notifyStateChanged, onStateChanged } from "./broadcastChannel";
import { HEALTH_URL } from "../config";

export type ConnectivityStatus = "online" | "offline" | "syncing";

const PROBE_BASE_MS = 5_000;
const PROBE_MAX_MS = 30_000;

let isOnline = navigator.onLine;
let isSyncing = false;
// Set by syncEngine when the tab wins (or loses) the leadership lock.
// Only the leader runs the recovery probe, and only the leader
// broadcasts state to the other tabs — non-leaders just listen.
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
 * Passive connectivity signal: any real request to the server
 * (product refresh, an outbox sync attempt) reports its result here.
 * We never make a request just to find out the status — that's the
 * difference from a classic heartbeat. At thousands of clients, under
 * normal (online) conditions the cost is zero: we're recycling
 * traffic that already exists.
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

// Physical signal — free, event-driven, not polling. Not sufficient
// on its own (wifi connected ≠ server reachable), but catches "cable
// unplugged / wifi turned off" instantly.
window.addEventListener("online", () => setOnline(true));
window.addEventListener("offline", () => setOnline(false));

// Non-leader tabs don't make real requests to the server (only the
// leader runs syncEngine), so they learn the status via broadcast
// instead of from their own traffic.
onStateChanged((message) => {
  if (message.type === "connectivity-changed") {
    isOnline = message.isOnline;
    isSyncing = message.isSyncing;
    emit();
  }
});

// --- recovery probe: runs ONLY while we think we're offline, and
// ONLY in the leader tab ---
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
  // Jitter so thousands of clients don't probe in the exact same
  // second after a widespread network outage (thundering herd on
  // recovery).
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