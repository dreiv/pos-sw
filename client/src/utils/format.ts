/**
 * Shared price formatting so every view renders amounts the same way.
 */
export function formatPrice(amount: number): string {
  return `${amount.toFixed(2)} lei`;
}
