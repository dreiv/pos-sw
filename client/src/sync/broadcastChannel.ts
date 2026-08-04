export type PosBroadcastMessage = { type: "cart-changed" } | { type: "outbox-changed" };

const CHANNEL_NAME = "pos-state";

// Creat lazy — BroadcastChannel poate lipsi din unele medii de test/SSR,
// și fișierul e importat atât de store-uri cât și de sync engine.
let channel: BroadcastChannel | undefined;

function getChannel(): BroadcastChannel {
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/**
 * Anunță celelalte tab-uri: "ceva s-a schimbat în IndexedDB, re-citește".
 * NU trimitem datele efective — vezi comentariul de mai sus. Notă
 * importantă: BroadcastChannel NU livrează mesajul propriu-zis tab-ului
 * care l-a trimis (per spec), deci nu ai nevoie să te filtrezi singur.
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
