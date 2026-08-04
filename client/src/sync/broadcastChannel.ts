export type PosBroadcastMessage =
  | { type: "cart-changed" }
  | { type: "outbox-changed" }
  | { type: "connectivity-changed"; isOnline: boolean; isSyncing: boolean };

const CHANNEL_NAME = "pos-state";

// Creat lazy — BroadcastChannel poate lipsi din unele medii de test/SSR,
// și fișierul e importat atât de store-uri cât și de sync engine.
let channel: BroadcastChannel | undefined;

function getChannel(): BroadcastChannel {
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/**
 * Anunță celelalte tab-uri: "ceva s-a schimbat, re-citește din
 * IndexedDB / re-verifică starea". NU trimitem datele efective — dacă
 * ai trimite cart-ul/outbox-ul prin mesaj, ai avea două surse de adevăr
 * care pot diverge (mesaj pierdut, ordine greșită, tab care era pe altă
 * pagină). IndexedDB rămâne singura sursă de adevăr; broadcast-ul e
 * doar o sonerie. Notă: BroadcastChannel NU livrează mesajul propriu
 * tab-ului care l-a trimis (per spec), deci nu ai nevoie să te filtrezi.
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
