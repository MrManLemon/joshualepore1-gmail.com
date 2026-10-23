// =============================================================================
// store.js — saving/loading the whole app state.
//
// localStorage is a tiny key→string database built into every browser, scoped
// to this site. We keep ONE key holding the entire state as JSON. It survives
// closing the app, but it lives only on this device/browser — hence Export.
// =============================================================================

import { newState, resetPosition, SCHEMA_VERSION, allExercises } from './program.js';
import { generateSample } from './sample.js';

const KEY = 'liftquest.state.v1';

let state = null;
const listeners = new Set();

export function getState() {
  return state;
}

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (raw) {
    try {
      state = migrate(JSON.parse(raw));
      return state;
    } catch (err) {
      console.error('Saved data unreadable, starting fresh', err);
      // Keep the bad copy so it can be recovered by hand if needed.
      try { localStorage.setItem(KEY + '.corrupt', raw); } catch { /* ignore */ }
    }
  }
  // First launch: seed template + sample history so every screen has data.
  state = newState();
  generateSample(state);
  save();
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Save failed', err);
    alert('Could not save to device storage. Export your data to be safe.');
  }
  for (const fn of listeners) fn(state);
}

// Run a change and save it in one step: update(s => { s.foo = 1 })
export function update(fn) {
  fn(state);
  save();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Future schema changes get upgraded here so old exports still import.
function migrate(data) {
  if (!data || typeof data !== 'object' || !data.program || !Array.isArray(data.sessions)) {
    throw new Error('Not a LiftQuest save file');
  }
  if ((data.schemaVersion ?? 1) > SCHEMA_VERSION) {
    throw new Error('This file is from a newer version of the app');
  }
  data.schemaVersion = SCHEMA_VERSION;
  data.active ??= null;
  data.position ??= { wave: 1, week: 1, done: [] };
  data.position.done ??= [];
  return data;
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

export function exportJSON() {
  return JSON.stringify({ app: 'liftquest', exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  delete data.app;
  delete data.exportedAt;
  state = migrate(data);
  save();
}

// ---------------------------------------------------------------------------
// Sample data / reset
// ---------------------------------------------------------------------------

export function loadSample() {
  state = newState();
  generateSample(state);
  save();
}

// Remove sample sessions and the sample-provided starting numbers, but keep
// your edits to the program template.
export function clearSample() {
  state.sessions = state.sessions.filter((s) => !s.sample);
  if (state.active?.sample) state.active = null;
  for (const ex of allExercises(state)) {
    // Numbers the sample filled in aren't yours. Anything you typed in the
    // editor has its source changed to 'user', so it's kept.
    if (ex.tmSource === 'sample') {
      ex.tm = null;
      delete ex.tmSource;
    }
    if (ex.startWeightSource === 'sample') {
      ex.startWeight = null;
      delete ex.startWeightSource;
    }
  }
  state.hasSample = false;
  if (!state.sessions.length) resetPosition(state);
  save();
}

export function resetAll() {
  state = newState();
  save();
}
