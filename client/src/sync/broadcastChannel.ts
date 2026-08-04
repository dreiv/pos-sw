export type PosBroadcastMessage =
  | { type: "cart-changed" }
  | { type: "outbox-changed" }
  | { type: "connectivity-changed"; isOnline: boolean; isSyncing: boolean };

const CHANNEL_NAME = "pos-state";

// Created lazily — BroadcastChannel can be missing in some test/SSR
// environments, and this file is imported by both the stores and the
// sync engine.
let channel: BroadcastChannel | undefined;

function getChannel(): BroadcastChannel {
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/**
 * Tell other tabs: "something changed, re-read it from IndexedDB /
 * re-check your state." We don't send the actual data — sending the
 * cart/outbox contents in the message would create two sources of
 * truth that can diverge (a dropped message, wrong ordering, a tab
 * that was on a different page). IndexedDB stays the single source of
 * truth; the broadcast is just a doorbell. Note: BroadcastChannel does
 * NOT deliver a message back to the tab that sent it (per spec), so
 * there's no need to filter yourself out.
 */
export function notifyStateChanged(message: PosBroadcastMessage): void {
  getChannel().postMessage(message);
}

export function onStateChanged(handler: (message: PosBroadcastMessage) => void): () => void {
  const ch = getChannel();
  const listener = (event: MessageEvent<PosBroadcastMessage>) => handler(event.data);
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}