// Session complete screen. XP breakdown gets added here in Phase 2.

import { getState } from '../store.js';
import { weekLabel } from '../program.js';
import { esc, fmtW } from '../util.js';
import { go } from '../ui.js';

let last = null;
export function setSummary(s) { last = s; }

export function render() {
  if (!last) return { redirect: '#/today' };
  const { session, setsDone, volume, prs, tmChanges, weekAdvanced } = last;
  const mins = Math.max(1, Math.round((new Date(session.finishedAt) - new Date(session.date)) / 60000));
  const state = getState();

  return `
    <div class="eyebrow">Session complete</div>
    <h1>${esc(session.dayName)} ✔</h1>
    <p class="muted">Wave ${session.wave} · ${esc(session.weekLabel)}</p>

    <div class="stats" style="margin-top:14px">
      <div class="stat"><b>${setsDone}</b><span>sets</span></div>
      <div class="stat"><b>${Math.round(volume).toLocaleString()}</b><span>lb volume</span></div>
      <div class="stat"><b>${mins}</b><span>minutes</span></div>
    </div>

    ${prs.length ? `
      <h3>New PRs 🏆</h3>
      <div class="card"><ul class="list">
        ${prs.map((p) => `<li class="row between"><b>${esc(p.name)}</b>
          <span>e1RM ${Math.round(p.e1rm)} <span class="muted small">(was ${Math.round(p.prev)})</span></span></li>`).join('')}
      </ul></div>` : ''}

    ${tmChanges.length ? `
      <h3>Training max updates</h3>
      <div class="card"><ul class="list">
        ${tmChanges.map((c) => `<li><div class="row between"><b>${esc(c.name)}</b>
          <span>${c.from == null ? '' : `${fmtW(c.from)} → `}<b>${fmtW(c.to)}</b></span></div>
          <div class="small muted">${esc(c.reason)}</div></li>`).join('')}
      </ul></div>` : ''}

    ${weekAdvanced ? `<div class="banner" style="margin-top:14px">Week finished! Up next: <b>${esc(weekLabel(state))}</b> of wave ${state.position.wave}.</div>` : ''}

    <div class="card" style="margin-top:14px">
      <p class="muted small">XP, levels and boss fights arrive in Phase 2.</p>
    </div>

    <button class="btn primary big" style="margin-top:16px" data-action="done">Done</button>`;
}

export const actions = {
  done() { last = null; go('#/today'); return false; },
};
