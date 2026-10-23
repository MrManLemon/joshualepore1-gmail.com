// Workout: the live logging screen. Everything is pre-filled with today's
// target; you nudge numbers with +/- and tap the round button when a set is done.

import { getState, update, save } from '../store.js';
import { finishSession } from '../program.js';
import { plateBreakdown, weightStep } from '../plates.js';
import { esc, fmtW, fmtSets, fmtDate } from '../util.js';
import { go, toast, buzz, num, icons } from '../ui.js';
import { setSummary } from './summary.js';

const MODE_TAG = {
  main: '<span class="tag">Main</span>',
  trial: '<span class="tag warn">Trial</span>',
  accessory: '',
  'accessory-new': '<span class="tag">New</span>',
};

function platesLine(state, x) {
  if (x.equipment !== 'barbell') return '';
  const next = x.sets.find((s) => !s.done) ?? x.sets[x.sets.length - 1];
  if (!next) return '';
  const { barWeight, plates } = state.settings;
  const per = plateBreakdown(next.weight, barWeight, plates);
  const text = per == null ? `Can't load ${fmtW(next.weight)} with your plates`
    : per.length === 0 ? 'Empty bar' : `${per.map(fmtW).join(' + ')} per side`;
  return `<div class="plates">🏋 ${fmtW(next.weight)}: ${text}</div>`;
}

function stepper(xi, si, field, value, unit) {
  const d = `data-x="${xi}" data-s="${si}" data-f="${field}"`;
  return `
    <div class="stepper">
      <button data-action="nudge" ${d} data-d="-1" aria-label="Decrease ${field}">−</button>
      <label><span class="unit">${unit}</span>
        <input type="number" inputmode="decimal" step="any" min="0" value="${fmtW(value)}"
          data-change="setVal" ${d} aria-label="${field}">
      </label>
      <button data-action="nudge" ${d} data-d="1" aria-label="Increase ${field}">+</button>
    </div>`;
}

function exerciseCard(state, x, xi) {
  const allDone = x.sets.length > 0 && x.sets.every((s) => s.done);
  return `
    <section class="card ${allDone ? 'done' : ''}">
      <div class="ex-head">
        <div class="grow">
          <h2>${esc(x.name)} ${MODE_TAG[x.mode] ?? ''} ${x.increased ? '<span class="tag good">▲ Weight up</span>' : ''}</h2>
          <div class="ex-meta">${esc(x.note ?? '')}</div>
        </div>
      </div>
      ${x.lastSets ? `<div class="last">Last (${fmtDate(x.lastDate)}): ${esc(fmtSets(x.lastSets))}</div>` : ''}
      ${x.beat ? `<div class="beat">🎯 ${esc(x.beat)}</div>` : ''}
      ${platesLine(state, x)}
      <div class="sets">
        ${x.sets.map((s, si) => {
          const t = x.targetSets[si];
          const changed = t && (t.weight !== s.weight || t.reps !== s.reps);
          return `
            <div class="set ${s.done ? 'is-done' : ''}">
              ${stepper(xi, si, 'weight', s.weight, 'lb')}
              ${stepper(xi, si, 'reps', s.reps, 'reps')}
              <button class="check" data-action="toggle" data-x="${xi}" data-s="${si}"
                aria-label="Set ${si + 1} ${s.done ? 'done' : 'not done'}">${s.done ? '✓' : si + 1}</button>
              ${changed ? `<div class="set-target">target ${fmtW(t.weight)} × ${t.reps}</div>` : ''}
            </div>`;
        }).join('')}
      </div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn small ghost" data-action="addSet" data-x="${xi}">+ Set</button>
        ${x.sets.length ? `<button class="btn small ghost" data-action="removeSet" data-x="${xi}">− Set</button>` : ''}
      </div>
    </section>`;
}

function restText(active) {
  if (!active.lastSetAt) return '<span class="muted">Rest timer</span>0:00';
  const sec = Math.max(0, Math.floor((Date.now() - active.lastSetAt) / 1000));
  const m = Math.floor(sec / 60);
  return `<span class="muted">Rest</span>${m}:${String(sec % 60).padStart(2, '0')}`;
}

export const hasBar = () => true;

export function render() {
  const state = getState();
  const a = state.active;
  if (!a) return { redirect: '#/today' };
  const done = a.exercises.reduce((n, x) => n + x.sets.filter((s) => s.done).length, 0);
  const total = a.exercises.reduce((n, x) => n + x.sets.length, 0);

  return `
    <div class="row between">
      <div>
        <div class="eyebrow">Wave ${a.wave} · ${esc(a.weekLabel)}${a.deload ? ' · Deload' : ''}</div>
        <h1>${esc(a.dayName)}</h1>
        <div class="muted small">${esc(a.focus)} · ${done}/${total} sets</div>
      </div>
      <button class="icon-btn" data-action="discard" aria-label="Discard session">${icons.trash}</button>
    </div>
    <div style="margin-top:14px">
      ${a.exercises.map((x, i) => exerciseCard(state, x, i)).join('')}
    </div>
    <div class="bar"><div class="bar-inner">
      <div class="rest" id="rest">${restText(a)}</div>
      <button class="btn primary big grow" data-action="finish">Finish session</button>
    </div></div>`;
}

// Live rest timer: only touch the timer element, not the whole screen.
export function tick() {
  const a = getState().active;
  const el = document.getElementById('rest');
  if (a && el) el.innerHTML = restText(a);
}

function target(el) {
  const a = getState().active;
  const x = a.exercises[Number(el.dataset.x)];
  return { a, x, si: Number(el.dataset.s), field: el.dataset.f };
}

// Change a value. Changing a weight also carries over to later, not-yet-done
// sets that had the same weight — so fixing set 1 fixes the rest too.
function setValue(x, si, field, value) {
  const set = x.sets[si];
  const old = set[field];
  set[field] = Math.max(0, value);
  if (field === 'weight') {
    for (let i = si + 1; i < x.sets.length; i++) {
      if (!x.sets[i].done && x.sets[i].weight === old) x.sets[i].weight = set.weight;
    }
  }
}

export const actions = {
  nudge(el) {
    const { x, si, field } = target(el);
    const step = field === 'weight' ? weightStep(x.equipment, getState().settings) : 1;
    setValue(x, si, field, x.sets[si][field] + step * Number(el.dataset.d));
    buzz(5);
    save();
  },
  setVal(el) {
    const { x, si, field } = target(el);
    const v = num(el);
    if (v == null) return; // re-render restores the old value
    setValue(x, si, field, field === 'reps' ? Math.round(v) : v);
    save();
  },
  toggle(el) {
    const { a, x, si } = target(el);
    const set = x.sets[si];
    set.done = !set.done;
    if (set.done) { a.lastSetAt = Date.now(); buzz(20); }
    save();
  },
  addSet(el) {
    const { x } = target(el);
    const last = x.sets[x.sets.length - 1] ?? x.targetSets[0] ?? { weight: 0, reps: 5 };
    x.sets.push({ weight: last.weight, reps: last.reps, done: false });
    save();
  },
  removeSet(el) {
    const { x } = target(el);
    const last = x.sets[x.sets.length - 1];
    if (last?.done && !confirm('Remove a completed set?')) return false;
    x.sets.pop();
    save();
  },
  finish() {
    const state = getState();
    const undone = state.active.exercises.reduce((n, x) => n + x.sets.filter((s) => !s.done).length, 0);
    if (undone && !confirm(`${undone} set${undone > 1 ? 's are' : ' is'} not ticked — only ticked sets are saved. Finish anyway?`)) return false;
    let summary;
    update((s) => { summary = finishSession(s); });
    setSummary(summary);
    go('#/summary');
    return false;
  },
  discard() {
    if (!confirm('Discard this session? Nothing from it will be saved.')) return false;
    update((s) => { s.active = null; });
    toast('Session discarded');
    go('#/today');
    return false;
  },
};
