// Hilfsfunktionen für den Spielzustand (JSON-serialisierbar, deterministischer Zufall).
export class GameError extends Error {}

/** mulberry32 – gibt Zahl in [0,1) und schreibt den neuen Seed in den Zustand zurück. */
export function rand(s) {
  s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const log = (s, text, kind = 'info') => { s.log.push({ day: s.day, kind, text }); };
export const need = (cond, msg) => { if (!cond) throw new GameError(msg); };
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const round2 = x => Math.round(x * 100) / 100;

export function spend(s, amount, what) {
  if (s.mode === 'sandbox') return;
  need(s.cash >= amount - 1e-9, `Zu wenig Geld für ${what} (${round2(amount)} € nötig, ${round2(s.cash)} € vorhanden).`);
  s.cash = round2(s.cash - amount);
}
