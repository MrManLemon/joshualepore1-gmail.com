// Settings: the global wave, equipment, schedule, your place in the program,
// and data (export / import / sample / reset).

import {
  getState, update, exportJSON, importJSON, loadSample, clearSample, resetAll,
} from '../store.js';
import { weekLabel } from '../program.js';
import { esc, fmtW, localDateKey } from '../util.js';
import { toast, num, icons } from '../ui.js';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function dayPicker(list, key, cls = '') {
  return `<div class="days ${cls}">${WEEKDAYS.map((d, i) =>
    `<button data-action="toggleDay" data-list="${key}" data-v="${i}" aria-pressed="${list.includes(i)}">${d}</button>`,
  ).join('')}</div>`;
}

function setting(label, key, value, extra = '') {
  return `<label class="field"><span>${label}</span>
    <input class="input" type="number" inputmode="decimal" step="any" value="${value}" data-change="setting" data-f="${key}" ${extra}></label>`;
}

export function render() {
  const state = getState();
  const st = state.settings;
  const pos = state.position;

  return `
    <a class="btn ghost small" href="#/program">${icons.back} Program</a>
    <h1 style="margin-top:8px">Settings</h1>

    <h3>Wave (main lifts)</h3>
    <section class="card">
      <p class="small muted" style="margin-top:0">Weight = Training Max × %, rounded to plates you own. Tick the deload week.</p>
      <table class="tbl">
        <tr><th>Name</th><th>% TM</th><th>Sets</th><th>Reps</th><th>Deload</th></tr>
        ${st.wave.map((r, i) => `<tr>
          <td><input class="input" value="${esc(r.label)}" data-change="waveField" data-i="${i}" data-f="label"></td>
          <td><input class="input" type="number" inputmode="decimal" value="${Math.round(r.pct * 1000) / 10}" data-change="waveField" data-i="${i}" data-f="pct"></td>
          <td><input class="input" type="number" inputmode="numeric" value="${r.sets}" data-change="waveField" data-i="${i}" data-f="sets"></td>
          <td><input class="input" type="number" inputmode="numeric" value="${r.reps}" data-change="waveField" data-i="${i}" data-f="reps"></td>
          <td style="text-align:center"><input type="checkbox" ${r.deload ? 'checked' : ''} data-change="waveDeload" data-i="${i}"></td>
        </tr>`).join('')}
      </table>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn small" data-action="addWeek">+ Week</button>
        ${st.wave.length > 1 ? '<button class="btn small" data-action="removeWeek">− Week</button>' : ''}
      </div>
      ${setting('Training max = % of estimated 1RM', 'tmPercent', Math.round(st.tmPercent * 100), 'data-t="pct"')}
    </section>

    <h3>Equipment</h3>
    <section class="card">
      <div class="grid2">
        ${setting('Bar weight (lb)', 'barWeight', st.barWeight)}
        ${setting('Dumbbell step (lb)', 'steps.dumbbell', st.steps.dumbbell)}
        ${setting('Machine step (lb)', 'steps.machine', st.steps.machine)}
        ${setting('Cable step (lb)', 'steps.cable', st.steps.cable)}
      </div>
      <p class="small muted" style="margin-bottom:4px">Plates — how many of each you can load <b>per side</b>:</p>
      <table class="tbl">
        <tr><th>Plate (lb)</th><th>Per side</th><th></th></tr>
        ${st.plates.map((p, i) => `<tr>
          <td><input class="input" type="number" inputmode="decimal" value="${fmtW(p.w)}" data-change="plateField" data-i="${i}" data-f="w"></td>
          <td><input class="input" type="number" inputmode="numeric" value="${p.pairs}" data-change="plateField" data-i="${i}" data-f="pairs"></td>
          <td><button class="icon-btn" data-action="removePlate" data-i="${i}" aria-label="Remove plate">${icons.trash}</button></td>
        </tr>`).join('')}
      </table>
      <button class="btn small" style="margin-top:8px" data-action="addPlate">+ Plate</button>
    </section>

    <h3>Schedule</h3>
    <section class="card">
      <div class="field"><span>Usual lifting days</span>${dayPicker(st.liftDays, 'liftDays')}</div>
      <div class="field"><span>Climbing days</span>${dayPicker(st.climbDays, 'climbDays', 'climb')}</div>
      <p class="small muted">Used by the Calendar and streaks (Phase 2). Sessions are a rotation, so a missed day never skips a workout.</p>
    </section>

    <h3>Where you are</h3>
    <section class="card">
      <div class="grid2">
        <label class="field"><span>Wave #</span>
          <input class="input" type="number" inputmode="numeric" value="${pos.wave}" data-change="setWave"></label>
        <label class="field"><span>Week</span>
          <select class="input" data-change="setWeek">
            <option value="0" ${pos.week === 0 ? 'selected' : ''}>Trial week</option>
            ${st.wave.map((r, i) => `<option value="${i + 1}" ${pos.week === i + 1 ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
          </select></label>
      </div>
      <p class="small muted">Now: ${esc(weekLabel(state))} · ${pos.done.length} of ${state.program.days.length} sessions done this week.</p>
      <button class="btn small" data-action="resetWeek">Restart this week</button>
    </section>

    <h3>Data</h3>
    <section class="card stack">
      <p class="small muted" style="margin:0">Everything is stored on this device only. Export regularly so you never lose history.</p>
      <button class="btn block primary" data-action="export">Export backup (JSON)</button>
      <label class="btn block">Import backup…
        <input type="file" accept="application/json,.json" data-change="importFile" hidden></label>
      ${state.hasSample
        ? '<button class="btn block" data-action="clearSample">Clear sample data</button>'
        : '<button class="btn block" data-action="loadSample">Load sample data (replaces everything)</button>'}
      <button class="btn block danger" data-action="resetAll">Reset everything</button>
    </section>
    <p class="small muted" style="text-align:center;margin-top:16px">LiftQuest · Phase 1</p>
  `;
}

async function download(text, filename) {
  const file = new File([text], filename, { type: 'application/json' });
  // On phones, the share sheet lets you save to Drive/Files/email directly.
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'LiftQuest backup' }); return; } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const actions = {
  waveField(el) {
    const f = el.dataset.f;
    update((s) => {
      const row = s.settings.wave[Number(el.dataset.i)];
      if (f === 'label') { row.label = el.value.trim() || row.label; return; }
      const v = num(el);
      if (v == null) return;
      row[f] = f === 'pct' ? Math.max(0, v) / 100 : Math.max(1, Math.round(v));
    });
  },
  waveDeload(el) {
    update((s) => { s.settings.wave[Number(el.dataset.i)].deload = el.checked; });
  },
  addWeek() {
    update((s) => {
      const w = s.settings.wave;
      const prev = w.filter((r) => !r.deload).at(-1) ?? w.at(-1);
      const insertAt = w.at(-1)?.deload ? w.length - 1 : w.length; // keep deload last
      w.splice(insertAt, 0, { ...prev, label: `Week ${insertAt + 1}`, deload: false });
    });
  },
  removeWeek() {
    if (!confirm('Remove the last week of the wave?')) return false;
    update((s) => {
      s.settings.wave.pop();
      s.position.week = Math.min(s.position.week, s.settings.wave.length);
    });
  },
  setting(el) {
    const v = num(el);
    if (v == null || v < 0) return;
    update((s) => {
      const keys = el.dataset.f.split('.');
      let obj = s.settings;
      while (keys.length > 1) obj = obj[keys.shift()];
      obj[keys[0]] = el.dataset.t === 'pct' ? Math.min(100, Math.max(50, v)) / 100 : v;
    });
  },
  plateField(el) {
    const v = num(el);
    if (v == null || v < 0) return;
    update((s) => {
      const p = s.settings.plates[Number(el.dataset.i)];
      p[el.dataset.f] = el.dataset.f === 'pairs' ? Math.min(10, Math.round(v)) : v;
    });
  },
  addPlate() {
    update((s) => { s.settings.plates.push({ w: 1.25, pairs: 1 }); });
  },
  removePlate(el) {
    update((s) => { s.settings.plates.splice(Number(el.dataset.i), 1); });
  },
  toggleDay(el) {
    const v = Number(el.dataset.v);
    update((s) => {
      const list = s.settings[el.dataset.list];
      const i = list.indexOf(v);
      if (i >= 0) list.splice(i, 1); else list.push(v);
      list.sort();
      // A day can't be both a lift day and a climb day.
      const other = el.dataset.list === 'liftDays' ? 'climbDays' : 'liftDays';
      if (i < 0) s.settings[other] = s.settings[other].filter((d) => d !== v);
    });
  },
  setWave(el) {
    const v = num(el);
    if (!v || v < 1) return;
    update((s) => { s.position.wave = Math.round(v); });
  },
  setWeek(el) {
    update((s) => { s.position.week = Number(el.value); s.position.done = []; });
    toast('Week changed');
  },
  resetWeek() {
    update((s) => { s.position.done = []; });
    toast('This week restarted');
  },
  export() {
    download(exportJSON(), `liftquest-${localDateKey()}.json`);
    return false;
  },
  importFile(el) {
    const file = el.files?.[0];
    el.value = ''; // allow picking the same file again
    if (!file) return false;
    file.text().then((text) => {
      if (!confirm('Replace ALL data on this device with this backup?')) return;
      try {
        importJSON(text);
        toast('Backup imported');
        location.hash = '#/today';
      } catch (e) {
        alert(`Import failed: ${e.message}`);
      }
    });
    return false;
  },
  loadSample() {
    if (!confirm('Replace everything on this device with sample data?')) return false;
    loadSample();
    toast('Sample data loaded');
  },
  clearSample() {
    if (!confirm('Delete sample sessions and sample training maxes? Your program edits are kept.')) return false;
    clearSample();
    toast('Sample data cleared');
  },
  resetAll() {
    if (!confirm('Erase ALL data and start from the blank template? Export first if unsure.')) return false;
    resetAll();
    toast('Everything reset');
  },
};
