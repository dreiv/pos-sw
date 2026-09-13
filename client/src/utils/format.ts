/**
 * Shared price formatting so every view renders amounts the same way.
 */
export function formatPrice(amountInBani: number): string {
  return `${baniToLei(amountInBani).toFixed(2)} lei`;
}

export function leiToBani(amountInLei: number): number {
  return Math.round(amountInLei * 100);
}

export function baniToLei(amountInBani: number): number {
  return amountInBani / 100;
}
