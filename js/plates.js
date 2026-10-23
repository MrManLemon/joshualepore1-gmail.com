// Plate math: turn "I want 187.3 lb" into a weight you can actually load.

// Every per-side plate combination you can build from your inventory, keyed by
// per-side weight, keeping the combo that uses the fewest plates.
// With a normal home/gym inventory this is a few hundred combos — trivial.
function sideCombos(plates) {
  const sorted = [...plates].filter((p) => p.w > 0 && p.pairs > 0)
    .sort((a, b) => b.w - a.w);
  const best = new Map(); // sideWeight -> array of plates (heaviest first)

  function walk(i, sum, used) {
    if (i === sorted.length) {
      const key = Math.round(sum * 100) / 100;
      const prev = best.get(key);
      if (!prev || used.length < prev.length) best.set(key, used.slice());
      return;
    }
    const { w, pairs } = sorted[i];
    for (let n = 0; n <= pairs; n++) {
      for (let k = 0; k < n; k++) used.push(w);
      walk(i + 1, sum + n * w, used);
      for (let k = 0; k < n; k++) used.pop();
    }
  }
  walk(0, 0, []);
  return best;
}

// Cache so we don't rebuild the table on every render.
let cacheKey = '';
let cacheVal = null;
function combosFor(plates) {
  const key = JSON.stringify(plates);
  if (key !== cacheKey) {
    cacheKey = key;
    cacheVal = sideCombos(plates);
  }
  return cacheVal;
}

// Nearest loadable barbell weight to `target`. Ties go to the lighter option.
export function roundBarbell(target, barWeight, plates) {
  if (!(target > barWeight)) return barWeight;
  let bestTotal = barWeight;
  let bestDiff = Infinity;
  for (const side of combosFor(plates).keys()) {
    const total = barWeight + 2 * side;
    const diff = Math.abs(total - target);
    if (diff < bestDiff - 1e-9 || (Math.abs(diff - bestDiff) < 1e-9 && total < bestTotal)) {
      bestDiff = diff;
      bestTotal = total;
    }
  }
  return bestTotal;
}

// Plates to put on EACH side for a given total, or null if not loadable.
export function plateBreakdown(total, barWeight, plates) {
  const side = Math.round(((total - barWeight) / 2) * 100) / 100;
  if (side < 0) return null;
  if (side === 0) return [];
  return combosFor(plates).get(side) ?? null;
}

export function roundToStep(target, step) {
  if (!step) return target;
  return Math.max(0, Math.round(target / step) * step);
}

// Round a target weight for a given equipment type using the user's settings.
export function roundLoad(target, equipment, settings) {
  if (equipment === 'barbell') {
    return roundBarbell(target, settings.barWeight, settings.plates);
  }
  const step = settings.steps?.[equipment] ?? settings.steps?.other ?? 2.5;
  return roundToStep(target, step);
}

// How much the +/- buttons change the weight for this equipment.
export function weightStep(equipment, settings) {
  if (equipment === 'barbell') {
    const smallest = Math.min(...settings.plates.filter((p) => p.pairs > 0).map((p) => p.w));
    return Number.isFinite(smallest) ? smallest * 2 : 5;
  }
  return settings.steps?.[equipment] ?? settings.steps?.other ?? 2.5;
}
