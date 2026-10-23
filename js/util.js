// Small helpers shared by logic and UI. No DOM access here.

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Deep copy for plain JSON data (like memcpy of a struct with no pointers).
export const clone = (obj) => JSON.parse(JSON.stringify(obj));

// Epley formula: estimated 1-rep max from a set of `reps` at `weight`.
export function e1rm(weight, reps) {
  if (!weight || !reps || reps < 1) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// Smallest rep count at `weight` whose e1RM is strictly above `target`.
export function repsToBeat(weight, target) {
  if (!weight || weight <= 0) return null;
  if (weight > target) return 1;
  // weight * (1 + r/30) > target  →  r > 30 * (target/weight - 1)
  const r = Math.floor(30 * (target / weight - 1)) + 1;
  return Math.max(2, r);
}

export const round1 = (x) => Math.round(x * 10) / 10;

// Format a weight without trailing ".0" (e.g. 185, 187.5).
export const fmtW = (w) => (w == null || w === '' ? '—' : String(round1(w)));

// Escape user text before putting it into HTML (prevents broken markup if an
// exercise is named something like "<Curl>").
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

// Compact text for a list of sets: "4×6 @ 140", "40 × 11/11/10", or a list.
export function fmtSets(sets) {
  if (!sets?.length) return '—';
  const sameW = sets.every((s) => s.weight === sets[0].weight);
  const sameR = sets.every((s) => s.reps === sets[0].reps);
  if (sameW && sameR) return `${sets.length}×${sets[0].reps} @ ${fmtW(sets[0].weight)}`;
  if (sameW) return `${fmtW(sets[0].weight)} × ${sets.map((s) => s.reps).join('/')}`;
  return sets.map((s) => `${fmtW(s.weight)}×${s.reps}`).join(', ');
}
