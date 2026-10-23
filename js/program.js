// =============================================================================
// program.js — the training brain. Pure logic: takes the app state object and
// returns / updates data. No DOM code here, so it can be unit-tested in Node.
//
// Key ideas
//   position = { wave, week, done[] }
//     wave  — which 4-week wave you're on (1, 2, 3 …)
//     week  — 1..N within the wave, or 0 for the one-off trial week
//     done  — ids of the days already finished this week (rotation: you can
//             do them in any order; the week advances when all are done)
//   Main lifts:  weight = TM × wave% for this week, rounded to loadable plates.
//   Accessories: double progression off your last non-deload session.
// =============================================================================

import { TRAINING_DEFAULTS } from './config.js';
import { uid, clone, e1rm, repsToBeat } from './util.js';
import { roundLoad } from './plates.js';

export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Seed template — placeholder exercises you're expected to replace.
// ---------------------------------------------------------------------------

function mainLift(name, equipment, side) {
  return {
    id: uid(), name, kind: 'main', equipment,
    tm: null, tmIncrement: TRAINING_DEFAULTS.tmIncrement[side], customWave: null,
  };
}

function accessory(name, equipment, overrides = {}) {
  return {
    id: uid(), name, kind: 'accessory', equipment,
    ...TRAINING_DEFAULTS.accessory, startWeight: null, ...overrides,
  };
}

export function seedProgram() {
  return {
    days: [
      {
        id: uid(), name: 'Upper A', focus: 'Push', side: 'upper',
        exercises: [
          mainLift('Bench Press', 'barbell', 'upper'),
          accessory('Overhead Press (DB)', 'dumbbell'),
          accessory('Incline Press (DB)', 'dumbbell'),
          accessory('Triceps Pushdown', 'cable', { repMin: 10, repMax: 15 }),
        ],
      },
      {
        id: uid(), name: 'Lower A', focus: 'Quad', side: 'lower',
        exercises: [
          mainLift('Back Squat', 'barbell', 'lower'),
          accessory('Leg Press', 'machine', { repMin: 10, repMax: 15, increment: 10 }),
          accessory('Split Squat (DB)', 'dumbbell'),
          accessory('Leg Extension', 'machine', { repMin: 10, repMax: 15 }),
        ],
      },
      {
        id: uid(), name: 'Upper B', focus: 'Pull', side: 'upper',
        exercises: [
          mainLift('Barbell Row', 'barbell', 'upper'),
          accessory('Lat Pulldown', 'cable'),
          accessory('Face Pull', 'cable', { repMin: 12, repMax: 20 }),
          accessory('Curl (DB)', 'dumbbell'),
        ],
      },
      {
        id: uid(), name: 'Lower B', focus: 'Posterior chain', side: 'lower',
        exercises: [
          mainLift('Deadlift', 'barbell', 'lower'),
          accessory('Romanian Deadlift', 'barbell', { sets: 3, repMin: 6, repMax: 10, increment: 10 }),
          accessory('Hamstring Curl', 'machine', { repMin: 10, repMax: 15 }),
          accessory('Back Extension', 'bodyweight', { repMin: 10, repMax: 15 }),
        ],
      },
    ],
  };
}

export function defaultSettings() {
  const { tmIncrement, accessory: _a, ...rest } = clone(TRAINING_DEFAULTS);
  return rest;
}

export function newState() {
  const state = {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    program: seedProgram(),
    position: { wave: 1, week: 1, done: [] },
    sessions: [],
    active: null,
    hasSample: false,
  };
  resetPosition(state);
  return state;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function allExercises(state) {
  return state.program.days.flatMap((d) => d.exercises);
}

export function findDay(state, dayId) {
  return state.program.days.find((d) => d.id === dayId) ?? null;
}

export function findExercise(state, exId) {
  for (const day of state.program.days) {
    const ex = day.exercises.find((e) => e.id === exId);
    if (ex) return { day, ex };
  }
  return null;
}

export function needsTrial(state) {
  return allExercises(state).some((e) => e.kind === 'main' && !(e.tm > 0));
}

export function resetPosition(state, wave = 1) {
  state.position = { wave, week: needsTrial(state) ? 0 : 1, done: [] };
}

// The global wave row for the current week (trial week uses week 1's row).
export function weekRow(state, week = state.position.week) {
  const wave = state.settings.wave;
  const i = Math.min(Math.max(week, 1), wave.length) - 1;
  return wave[i];
}

export function isDeloadWeek(state) {
  return state.position.week > 0 && !!weekRow(state).deload;
}

export function weekLabel(state) {
  return state.position.week === 0 ? 'Trial week' : weekRow(state).label;
}

// Row of the wave to use for a specific main lift (custom wave wins).
function liftRow(state, ex) {
  const wave = ex.customWave?.length ? ex.customWave : state.settings.wave;
  const week = Math.max(state.position.week, 1);
  return wave[Math.min(week, wave.length) - 1];
}

// Days not yet done this week, in program order. First one = "next up".
export function remainingDays(state) {
  const done = new Set(state.position.done);
  return state.program.days.filter((d) => !done.has(d.id));
}

export function nextDay(state) {
  return remainingDays(state)[0] ?? state.program.days[0] ?? null;
}

// Most recent logged entry for an exercise (sessions are stored oldest→newest).
export function lastEntry(state, exId, { skipDeload = true, beforeId = null } = {}) {
  let i = state.sessions.length - 1;
  if (beforeId) {
    const idx = state.sessions.findIndex((s) => s.id === beforeId);
    if (idx >= 0) i = idx - 1;
  }
  for (; i >= 0; i--) {
    const s = state.sessions[i];
    if (skipDeload && s.deload) continue;
    const entry = s.exercises.find((x) => x.exId === exId && x.sets.length > 0);
    if (entry) return { session: s, entry };
  }
  return null;
}

export function entryBestE1rm(entry, maxReps = TRAINING_DEFAULTS.e1rmMaxReps) {
  let best = 0;
  for (const s of entry.sets) {
    if (s.reps > maxReps) continue;
    best = Math.max(best, e1rm(s.weight, s.reps));
  }
  return best;
}

export function bestE1rmEver(state, exId, excludeSessionId = null) {
  let best = 0;
  for (const s of state.sessions) {
    if (s.id === excludeSessionId) continue;
    for (const entry of s.exercises) {
      if (entry.exId === exId) {
        best = Math.max(best, entryBestE1rm(entry, state.settings.e1rmMaxReps));
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Prescription — what the app tells you to lift today.
// Returns { mode, sets:[{weight,reps}], note, beat, last, increased }
// ---------------------------------------------------------------------------

export function prescribe(state, ex) {
  return ex.kind === 'main' ? prescribeMain(state, ex) : prescribeAccessory(state, ex);
}

function prescribeMain(state, ex) {
  const row = liftRow(state, ex);
  const last = lastEntry(state, ex.id);

  if (!(ex.tm > 0)) {
    // Trial: you choose the weight; we estimate your 1RM from the best set.
    const start = last ? Math.max(...last.entry.sets.map((s) => s.weight))
      : (ex.equipment === 'barbell' ? state.settings.barWeight : 0);
    return {
      mode: 'trial',
      sets: Array.from({ length: row.sets }, () => ({ weight: start, reps: row.reps })),
      note: `Trial: pick weights that leave ~2 reps in the tank. Go heavier set by set if it feels easy. Your best set sets your training max.`,
      beat: null,
      last,
      increased: false,
    };
  }

  const weight = roundLoad(ex.tm * row.pct, ex.equipment, state.settings);
  const sets = Array.from({ length: row.sets }, () => ({ weight, reps: row.reps }));
  let beat = null;
  if (last) {
    const lastBest = entryBestE1rm(last.entry, state.settings.e1rmMaxReps);
    const need = repsToBeat(weight, lastBest);
    if (need != null && need <= row.reps) {
      beat = { e1rm: lastBest, reps: row.reps, text: `Hit ${row.reps} reps and you beat last time` };
    } else if (need != null && need <= 15) {
      beat = { e1rm: lastBest, reps: need, text: `Beat it: ${weight} × ${need} on your last set` };
    }
  }
  const lastTop = last ? Math.max(...last.entry.targetSets.map((s) => s.weight)) : null;
  return {
    mode: 'main',
    sets,
    note: `${Math.round(row.pct * 100)}% of TM ${ex.tm}`,
    beat,
    last,
    increased: lastTop != null && weight > lastTop,
  };
}

function prescribeAccessory(state, ex) {
  const deload = isDeloadWeek(state);
  const last = lastEntry(state, ex.id);
  const nSets = deload
    ? Math.max(1, Math.ceil(ex.sets * state.settings.deloadAccessorySetFactor))
    : ex.sets;

  if (!last) {
    const w = ex.startWeight ?? 0;
    return {
      mode: 'accessory-new',
      sets: Array.from({ length: nSets }, () => ({ weight: w, reps: ex.repMin })),
      note: `${ex.sets} × ${ex.repMin}–${ex.repMax}. First time: pick a weight you can do for ${ex.repMin}+ clean reps.`,
      beat: null,
      last: null,
      increased: false,
    };
  }

  // Double progression: base = the lightest weight you used for working sets.
  const done = last.entry.sets;
  const base = Math.min(...done.map((s) => s.weight));
  const hitTop = done.length >= ex.sets && done.every((s) => s.reps >= ex.repMax);

  if (deload) {
    return {
      mode: 'accessory',
      sets: Array.from({ length: nSets }, () => ({ weight: base, reps: ex.repMin })),
      note: `Deload: ${nSets} easy sets — no progression this week.`,
      beat: null, last, increased: false,
    };
  }

  if (hitTop) {
    const weight = base + ex.increment;
    return {
      mode: 'accessory',
      sets: Array.from({ length: nSets }, () => ({ weight, reps: ex.repMin })),
      note: `You hit ${ex.repMax} on every set last time → +${ex.increment}. Aim for ${ex.repMin}+ reps.`,
      beat: { text: `New weight! ${ex.repMin}+ reps on every set beats it` },
      last, increased: true,
    };
  }

  // Same weight: beat last time by adding one rep per set (capped at the top).
  const sets = Array.from({ length: nSets }, (_, i) => {
    const prev = done[i]?.reps ?? ex.repMin;
    return { weight: base, reps: Math.min(ex.repMax, Math.max(ex.repMin, prev + 1)) };
  });
  return {
    mode: 'accessory',
    sets,
    note: `${ex.sets} × ${ex.repMin}–${ex.repMax}. Hit ${ex.repMax} on all sets to move up.`,
    beat: { text: `Beat it: ${sets.map((s) => s.reps).join(' / ')} reps` },
    last, increased: false,
  };
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

export function buildSession(state, dayId, now = new Date()) {
  const day = findDay(state, dayId);
  if (!day) throw new Error('Unknown day');
  return {
    id: uid(),
    date: now.toISOString(),
    dayId: day.id,
    dayName: day.name,
    focus: day.focus,
    wave: state.position.wave,
    week: state.position.week,
    weekLabel: weekLabel(state),
    deload: isDeloadWeek(state),
    trial: state.position.week === 0,
    sample: false,
    exercises: day.exercises.map((ex) => {
      const p = prescribe(state, ex);
      return {
        exId: ex.id,
        name: ex.name,
        kind: ex.kind,
        equipment: ex.equipment,
        mode: p.mode,
        repMin: ex.repMin ?? null,
        repMax: ex.repMax ?? null,
        increased: p.increased,
        note: p.note,
        beat: p.beat?.text ?? null,
        lastSets: p.last ? p.last.entry.sets.map((s) => ({ ...s })) : null,
        lastDate: p.last?.session.date ?? null,
        targetSets: p.sets.map((s) => ({ ...s })),
        sets: p.sets.map((s) => ({ weight: s.weight, reps: s.reps, done: false })),
      };
    }),
  };
}

// Finish the active session: save it, update TMs, advance the rotation.
// Returns a summary object for the "session complete" screen.
export function finishSession(state, now = new Date()) {
  const s = state.active;
  if (!s) throw new Error('No active session');

  const saved = {
    ...s,
    finishedAt: now.toISOString(),
    exercises: s.exercises.map((x) => ({
      ...x,
      sets: x.sets.filter((set) => set.done).map(({ weight, reps }) => ({ weight, reps })),
    })),
  };

  const summary = { session: saved, setsDone: 0, volume: 0, prs: [], tmChanges: [] };

  for (const entry of saved.exercises) {
    summary.setsDone += entry.sets.length;
    for (const set of entry.sets) summary.volume += set.weight * set.reps;
    if (!entry.sets.length) continue;

    const best = entryBestE1rm(entry, state.settings.e1rmMaxReps);
    const prev = bestE1rmEver(state, entry.exId);
    if (prev > 0 && best > prev + 0.01) {
      summary.prs.push({ name: entry.name, e1rm: best, prev });
    }

    // Trial → set the training max from the best set.
    const found = findExercise(state, entry.exId);
    if (found && found.ex.kind === 'main' && !(found.ex.tm > 0) && best > 0) {
      const tm = Math.round(best * state.settings.tmPercent);
      found.ex.tm = tm;
      found.ex.tmSource = 'trial';
      summary.tmChanges.push({ name: found.ex.name, from: null, to: tm, reason: `Estimated 1RM ${Math.round(best)}` });
    }
  }

  state.sessions.push(saved);
  state.active = null;

  // Rotation: mark this day done; when every day is done, advance the week.
  const pos = state.position;
  if (!pos.done.includes(saved.dayId)) pos.done.push(saved.dayId);
  const dayIds = state.program.days.map((d) => d.id);
  if (dayIds.every((id) => pos.done.includes(id))) {
    summary.weekAdvanced = true;
    summary.tmChanges.push(...advanceWeek(state));
  }
  return summary;
}

// Move to the next week; after the last week, start a new wave and bump TMs.
export function advanceWeek(state) {
  const pos = state.position;
  pos.done = [];
  const changes = [];
  if (pos.week === 0) {
    pos.week = 1;
  } else if (pos.week < state.settings.wave.length) {
    pos.week += 1;
  } else {
    changes.push(...bumpTrainingMaxes(state, pos.wave));
    pos.wave += 1;
    pos.week = 1;
  }
  return changes;
}

// End of a wave: raise each main lift's TM if you hit every prescribed rep in
// the heaviest (last non-deload) week. Missed reps → hold the TM.
export function bumpTrainingMaxes(state, wave) {
  const rows = state.settings.wave;
  let keyWeek = rows.length;
  while (keyWeek > 1 && rows[keyWeek - 1].deload) keyWeek--;

  const changes = [];
  for (const ex of allExercises(state)) {
    if (ex.kind !== 'main' || !(ex.tm > 0)) continue;
    const session = [...state.sessions].reverse().find(
      (s) => s.wave === wave && s.week === keyWeek && s.exercises.some((x) => x.exId === ex.id),
    );
    const entry = session?.exercises.find((x) => x.exId === ex.id);
    const hit = entry && entry.sets.length >= entry.targetSets.length &&
      entry.targetSets.every((t, i) => entry.sets[i] && entry.sets[i].reps >= t.reps);
    if (hit) {
      const from = ex.tm;
      ex.tm = from + (ex.tmIncrement ?? 5);
      ex.tmSource = 'auto';
      changes.push({ name: ex.name, from, to: ex.tm, reason: 'Wave complete' });
    } else {
      changes.push({
        name: ex.name, from: ex.tm, to: ex.tm,
        reason: entry ? `Missed reps in ${rows[keyWeek - 1].label} — holding` : `Not logged in ${rows[keyWeek - 1].label} — holding`,
      });
    }
  }
  return changes;
}
