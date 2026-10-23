// Program editor: the 4 training days and their exercises. Every field saves
// as soon as you leave it ('change' event) — there's no Save button.

import { getState, update } from '../store.js';
import { findDay, findExercise, prescribe } from '../program.js';
import { TRAINING_DEFAULTS } from '../config.js';
import { esc, fmtW, fmtSets, uid, clone } from '../util.js';
import { go, toast, num, icons } from '../ui.js';

const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'];

function exSummary(ex) {
  if (ex.kind === 'main') {
    return ex.tm > 0
      ? `Main · TM ${fmtW(ex.tm)} · +${fmtW(ex.tmIncrement)}/wave${ex.customWave ? ' · custom wave' : ''}`
      : 'Main · no TM yet → trial';
  }
  return `${ex.sets} × ${ex.repMin}–${ex.repMax} · +${fmtW(ex.increment)}${ex.startWeight != null ? ` · start ${fmtW(ex.startWeight)}` : ''}`;
}

function renderProgram(state) {
  return `
    <div class="row between">
      <h1>Program</h1>
      <a class="icon-btn" href="#/settings" aria-label="Settings">${icons.gear}</a>
    </div>
    <p class="muted small">Rotation: days run in this order. Tap an exercise to edit it.
      Changes apply from your next session.</p>
    ${state.program.days.map((day) => `
      <section class="card" style="margin-top:12px">
        <div class="grid2">
          <input class="input inline" value="${esc(day.name)}" data-change="dayField" data-day="${day.id}" data-f="name" aria-label="Day name">
          <input class="input inline" value="${esc(day.focus)}" data-change="dayField" data-day="${day.id}" data-f="focus" aria-label="Focus" placeholder="Focus">
        </div>
        <div style="margin-top:8px">
          ${day.exercises.map((ex, i) => `
            <div class="ex-row">
              <a href="#/program/ex/${ex.id}">
                <b>${esc(ex.name)}</b><br><span class="small muted">${esc(exSummary(ex))}</span>
              </a>
              <button class="icon-btn" data-action="move" data-day="${day.id}" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icons.up}</button>
              <button class="icon-btn" data-action="move" data-day="${day.id}" data-i="${i}" data-d="1" ${i === day.exercises.length - 1 ? 'disabled' : ''} aria-label="Move down">${icons.down}</button>
            </div>`).join('')}
        </div>
        <button class="btn small" style="margin-top:8px" data-action="addEx" data-day="${day.id}">+ Add exercise</button>
      </section>`).join('')}
  `;
}

function field(label, attrs, value, type = 'number') {
  return `<label class="field"><span>${label}</span>
    <input class="input" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(value ?? '')}" ${attrs}></label>`;
}

function renderExercise(state, exId) {
  const found = findExercise(state, exId);
  if (!found) return { redirect: '#/program' };
  const { day, ex } = found;
  const f = (name, t) => `data-change="exField" data-f="${name}" data-t="${t}"`;
  const p = prescribe(state, ex);
  const preview = p.mode === 'trial' ? 'Trial — you pick the weight' : fmtSets(p.sets);

  const mainFields = `
    <div class="grid2">
      ${field('Training max (lb)', f('tm', 'numOrNull') + ' placeholder="blank = trial"', ex.tm)}
      ${field('Know your 1RM?', `data-change="from1rm" placeholder="sets TM to ${Math.round(state.settings.tmPercent * 100)}%"`, '')}
    </div>
    ${field('TM increase per wave (lb)', f('tmIncrement', 'num'), ex.tmIncrement)}
    <div class="row between" style="margin-top:14px">
      <span><b>Custom wave</b><br><span class="small muted">Override the global % / sets / reps for this lift</span></span>
      <button class="btn small" data-action="toggleCustomWave">${ex.customWave ? 'Use global' : 'Customize'}</button>
    </div>
    ${ex.customWave ? `
      <table class="tbl" style="margin-top:8px">
        <tr><th>Week</th><th>% TM</th><th>Sets</th><th>Reps</th></tr>
        ${ex.customWave.map((r, i) => `<tr>
          <td class="small">${esc(state.settings.wave[i]?.label ?? `Week ${i + 1}`)}</td>
          <td><input class="input" type="number" inputmode="decimal" value="${Math.round(r.pct * 1000) / 10}" data-change="cwField" data-i="${i}" data-f="pct"></td>
          <td><input class="input" type="number" inputmode="numeric" value="${r.sets}" data-change="cwField" data-i="${i}" data-f="sets"></td>
          <td><input class="input" type="number" inputmode="numeric" value="${r.reps}" data-change="cwField" data-i="${i}" data-f="reps"></td>
        </tr>`).join('')}
      </table>` : ''}`;

  const accFields = `
    <div class="grid3">
      ${field('Sets', f('sets', 'int'), ex.sets)}
      ${field('Rep min', f('repMin', 'int'), ex.repMin)}
      ${field('Rep max', f('repMax', 'int'), ex.repMax)}
    </div>
    <div class="grid2">
      ${field('Add when top hit (lb)', f('increment', 'num'), ex.increment)}
      ${field('Starting weight', f('startWeight', 'numOrNull') + ' placeholder="optional"', ex.startWeight)}
    </div>
    <p class="small muted">Double progression: same weight until every set reaches ${ex.repMax} reps, then +${fmtW(ex.increment)} and back to ${ex.repMin}.</p>`;

  return `
    <a class="btn ghost small" href="#/program">${icons.back} Program</a>
    <h1 style="margin-top:8px">${esc(ex.name)}</h1>
    <p class="muted small">${esc(day.name)} · this week: <b>${esc(preview)}</b></p>

    <section class="card" style="margin-top:12px">
      ${field('Name', f('name', 'str'), ex.name, 'text')}
      <div class="field"><span>Type</span>
        <div class="seg">
          <button data-action="setKind" data-v="main" aria-pressed="${ex.kind === 'main'}">Main lift (% of TM)</button>
          <button data-action="setKind" data-v="accessory" aria-pressed="${ex.kind === 'accessory'}">Accessory</button>
        </div>
      </div>
      <div class="grid2">
        <label class="field"><span>Equipment</span>
          <select class="input" data-change="exField" data-f="equipment" data-t="str">
            ${EQUIPMENT.map((e) => `<option ${e === ex.equipment ? 'selected' : ''}>${e}</option>`).join('')}
          </select></label>
        <label class="field"><span>Day</span>
          <select class="input" data-change="moveDay">
            ${state.program.days.map((d) => `<option value="${d.id}" ${d.id === day.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
          </select></label>
      </div>
      ${ex.kind === 'main' ? mainFields : accFields}
    </section>

    <button class="btn danger block" style="margin-top:16px" data-action="deleteEx">${icons.trash} Delete exercise</button>`;
}

export function render(params) {
  const state = getState();
  return params.exId ? renderExercise(state, params.exId) : renderProgram(state);
}

function parse(el) {
  const t = el.dataset.t;
  if (t === 'str') return el.value.trim();
  const v = num(el);
  if (t === 'numOrNull') return v == null ? null : Math.max(0, v);
  if (v == null) return undefined;
  return t === 'int' ? Math.max(1, Math.round(v)) : Math.max(0, v);
}

export const actions = {
  dayField(el) {
    update((s) => {
      const day = findDay(s, el.dataset.day);
      day[el.dataset.f] = el.value.trim() || day[el.dataset.f];
    });
  },
  move(el) {
    update((s) => {
      const list = findDay(s, el.dataset.day).exercises;
      const i = Number(el.dataset.i);
      const j = i + Number(el.dataset.d);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    });
  },
  addEx(el) {
    const id = uid();
    update((s) => {
      findDay(s, el.dataset.day).exercises.push({
        id, name: 'New exercise', kind: 'accessory', equipment: 'dumbbell',
        ...TRAINING_DEFAULTS.accessory, startWeight: null,
      });
    });
    go(`#/program/ex/${id}`);
    return false;
  },
  exField(el, params) {
    const v = parse(el);
    if (v === undefined || v === '') return; // invalid → re-render restores old value
    update((s) => {
      const { ex } = findExercise(s, params.exId);
      const key = el.dataset.f;
      ex[key] = v;
      if (key === 'tm') ex.tmSource = 'user';
      if (key === 'startWeight') ex.startWeightSource = 'user';
      if (key === 'repMin' && ex.repMax < v) ex.repMax = v;
      if (key === 'repMax' && ex.repMin > v) ex.repMin = v;
    });
  },
  from1rm(el, params) {
    const v = num(el);
    if (!v) return;
    update((s) => {
      const { ex } = findExercise(s, params.exId);
      ex.tm = Math.round(v * s.settings.tmPercent);
      ex.tmSource = 'user';
    });
    toast('Training max set');
  },
  setKind(el, params) {
    update((s) => {
      const { day, ex } = findExercise(s, params.exId);
      ex.kind = el.dataset.v;
      if (ex.kind === 'main') {
        ex.tm ??= null;
        ex.tmIncrement ??= TRAINING_DEFAULTS.tmIncrement[day.side ?? 'upper'] ?? 5;
        ex.customWave ??= null;
      } else {
        for (const [k, val] of Object.entries(TRAINING_DEFAULTS.accessory)) ex[k] ??= val;
        ex.startWeight ??= null;
      }
    });
  },
  toggleCustomWave(el, params) {
    update((s) => {
      const { ex } = findExercise(s, params.exId);
      ex.customWave = ex.customWave
        ? null
        : clone(s.settings.wave).map(({ pct, sets, reps }) => ({ pct, sets, reps }));
    });
  },
  cwField(el, params) {
    const v = num(el);
    if (v == null) return;
    update((s) => {
      const { ex } = findExercise(s, params.exId);
      const row = ex.customWave[Number(el.dataset.i)];
      const f = el.dataset.f;
      row[f] = f === 'pct' ? Math.max(0, v) / 100 : Math.max(1, Math.round(v));
    });
  },
  moveDay(el, params) {
    update((s) => {
      const { day, ex } = findExercise(s, params.exId);
      day.exercises = day.exercises.filter((e) => e.id !== ex.id);
      findDay(s, el.value).exercises.push(ex);
    });
    toast('Moved');
  },
  deleteEx(el, params) {
    if (!confirm('Delete this exercise from the program? Logged history is kept.')) return false;
    update((s) => {
      const { day } = findExercise(s, params.exId);
      day.exercises = day.exercises.filter((e) => e.id !== params.exId);
    });
    go('#/program');
    return false;
  },
};
