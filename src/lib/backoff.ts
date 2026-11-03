/** How long to wait before reconnecting after `failures` failed attempts in a row: 1 s, 2 s, 4 s ... capped at 30 s. */
export function backoffMs(failures: number): number {
  const n = Math.max(0, Math.floor(failures));
  return Math.min(30_000, 1000 * 2 ** n);
}
