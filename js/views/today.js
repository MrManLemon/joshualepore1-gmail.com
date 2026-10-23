// Today: what's next in the rotation, a preview of the targets, and history.

import { getState, update, clearSample } from '../store.js';
import { prescribe, remainingDays, nextDay, buildSession, weekLabel, isDeloadWeek } from '../program.js';
import { esc, fmtSets, fmtDate } from '../util.js';
import { go, toast } from '../ui.js';

function previewLine(state, ex) {
  const p = prescribe(state, ex);
  if (p.mode === 'trial') return `<span class="tag warn">Trial</span> find your working weight`;
  if (p.mode === 'accessory-new' && !p.sets[0].weight) return `${p.sets.length}×${p.sets[0].reps} · pick a weight`;
  const up = p.increased ? ' <span class="up">▲</span>' : '';
  return esc(fmtSets(p.sets)) + up;
}

function sessionCard(state, day, primary) {
  if (!primary) {
    return `<button class="btn block" data-action="start" data-day="${day.id}">
      Do ${esc(day.name)} <span class="muted">· ${esc(day.focus)}</span> instead</button>`;
  }
  return `
    <section class="card">
      <div class="eyebrow">Next up</div>
      <h1>${esc(day.name)}</h1>
      <p class="muted">${esc(day.focus)}</p>
      <ul class="list" style="margin:10px 0 14px">
        ${day.exercises.map((ex) => `
          <li class="row between">
            <span class="grow">${esc(ex.name)}${ex.kind === 'main' ? ' <span class="tag">Main</span>' : ''}</span>
            <span class="small" style="text-align:right">${previewLine(state, ex)}</span>
          </li>`).join('') || '<li class="muted">No exercises yet — add some in Program.</li>'}
      </ul>
      <button class="btn primary big" data-action="start" data-day="${day.id}">Start session</button>
    </section>`;
}

function historyItem(s) {
  const sets = s.exercises.reduce((n, x) => n + x.sets.length, 0);
  const vol = s.exercises.reduce((v, x) => v + x.sets.reduce((a, t) => a + t.weight * t.reps, 0), 0);
  return `
    <details class="card">
      <summary class="row between">
        <span class="grow"><b>${esc(s.dayName)}</b>
          <span class="muted small">· ${fmtDate(s.date)}</span><br>
          <span class="small muted">W${s.wave} ${esc(s.weekLabel)} · ${sets} sets · ${Math.round(vol).toLocaleString()} lb</span>
        </span>
        ${s.sample ? '<span class="tag">Sample</span>' : ''}
      </summary>
      <ul class="list small" style="margin-top:8px">
        ${s.exercises.filter((x) => x.sets.length).map((x) => `
          <li><b>${esc(x.name)}</b><br><span class="muted">${esc(fmtSets(x.sets))}</span></li>`).join('')}
      </ul>
      <button class="btn small danger" data-action="deleteSession" data-id="${s.id}" style="margin-top:8px">Delete session</button>
    </details>`;
}

export function render() {
  const state = getState();
  if (state.active) return { redirect: '#/workout' };

  const next = nextDay(state);
  const others = remainingDays(state).filter((d) => d.id !== next?.id);
  const pos = state.position;
  const recent = state.sessions.slice(-10).reverse();

  return `
    ${state.hasSample ? `
      <div class="banner">
        <span class="grow">You're looking at <b>sample data</b>. Clear it when you're ready to log your own.</span>
        <button class="btn small" data-action="clearSample">Clear</button>
      </div>` : ''}
    <div class="row between">
      <div>
        <div class="muted small">Wave ${pos.wave}</div>
        <h2>${esc(weekLabel(state))} ${isDeloadWeek(state) ? '<span class="tag accent">Deload</span>' : ''}${pos.week === 0 ? '<span class="tag warn">Finding your maxes</span>' : ''}</h2>
      </div>
      <div class="small muted">${pos.done.length}/${state.program.days.length} done</div>
    </div>
    <div style="margin-top:12px" class="stack">
      ${next ? sessionCard(state, next, true) : '<div class="empty">No training days in your program.</div>'}
      ${others.map((d) => sessionCard(state, d, false)).join('')}
    </div>

    <h3>Recent sessions</h3>
    ${recent.length ? recent.map(historyItem).join('') : '<p class="muted">Nothing logged yet.</p>'}
  `;
}

export const actions = {
  start(el) {
    update((s) => { s.active = buildSession(s, el.dataset.day); });
    go('#/workout');
    return false;
  },
  clearSample() {
    if (!confirm('Delete all sample sessions and the sample training maxes? Your program edits are kept.')) return false;
    clearSample();
    toast('Sample data cleared');
  },
  deleteSession(el) {
    if (!confirm('Delete this session? (This does not move your place in the program.)')) return false;
    update((s) => { s.sessions = s.sessions.filter((x) => x.id !== el.dataset.id); });
    toast('Session deleted');
  },
};

