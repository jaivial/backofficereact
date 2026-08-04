/** Splits a total in cents into `guests` shares; the remainder is spread one cent per share. */
export function splitShares(totalCents: number, guests: number): number[] {
  if (guests <= 0) return [];
  const base = Math.floor(totalCents / guests);
  const remainder = totalCents - base * guests;
  return Array.from({ length: guests }, (_, index) => base + (index < remainder ? 1 : 0));
}
