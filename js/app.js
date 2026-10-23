// =============================================================================
// app.js — entry point: loads data, draws the current screen, routes taps.
//
// Routing: the part of the URL after '#' picks the screen (#/today,
// #/program/ex/abc…). Changing it doesn't reload the page; we just redraw.
//
// Events: instead of attaching a handler to every button, ONE listener on the
// page catches all taps and looks at the tapped element's data-action
// attribute, then calls that function on the current view. Think of it as a
// dispatch table of function pointers keyed by name.
// =============================================================================

import { load } from './store.js';
import { icons } from './ui.js';
import * as today from './views/today.js';
import * as workout from './views/workout.js';
import * as summary from './views/summary.js';
import * as editor from './views/editor.js';
import * as settings from './views/settings.js';
import { placeholder } from './views/placeholder.js';

const routes = [
  { re: /^#\/today$/, view: today, tab: 'today' },
  { re: /^#\/workout$/, view: workout, tab: 'today' },
  { re: /^#\/summary$/, view: summary, tab: 'today' },
  { re: /^#\/calendar$/, view: placeholder('Calendar', 'Sessions, climb days and boss fights on a calendar.', 2), tab: 'calendar' },
  { re: /^#\/progress$/, view: placeholder('Progress', 'Estimated 1RM and volume graphs per lift.', 3), tab: 'progress' },
  { re: /^#\/awards$/, view: placeholder('Achievements', 'XP, levels, streaks and achievements.', 2), tab: 'awards' },
  { re: /^#\/program$/, view: editor, tab: 'program' },
  { re: /^#\/program\/ex\/([\w-]+)$/, view: editor, tab: 'program', param: 'exId' },
  { re: /^#\/settings$/, view: settings, tab: 'program' },
];

const TABS = [
  ['today', 'Today'], ['calendar', 'Calendar'], ['progress', 'Progress'],
  ['awards', 'Awards'], ['program', 'Program'],
];

const viewEl = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
let current = null; // { view, params, tab }

function resolve() {
  const hash = location.hash || '#/today';
  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) return { view: r.view, tab: r.tab, params: r.param ? { [r.param]: m[1] } : {} };
  }
  return { view: today, tab: 'today', params: {} };
}

export function render() {
  const { view, params } = current;
  const out = view.render(params);
  // A view can ask to be somewhere else (e.g. Today → Workout when active).
  if (out && out.redirect) { location.replace(out.redirect); return; }
  viewEl.className = 'view' + (view.hasBar?.(params) ? ' has-bar' : '');
  viewEl.innerHTML = out;
  tabsEl.innerHTML = TABS.map(([id, label]) =>
    `<a href="#/${id}" ${id === current.tab ? 'aria-current="page"' : ''}>${icons[id]}<span>${label}</span></a>`,
  ).join('');
}

function onRoute() {
  current = resolve();
  render();
  window.scrollTo(0, 0);
}

function dispatch(ev, attr) {
  const el = ev.target.closest(`[${attr}]`);
  if (!el || !current) return;
  const fn = current.view.actions?.[el.getAttribute(attr)];
  if (!fn) return;
  if (attr === 'data-action') ev.preventDefault();
  const result = fn(el, current.params, ev);
  if (result !== false) render();
}

document.addEventListener('click', (ev) => dispatch(ev, 'data-action'));
document.addEventListener('change', (ev) => dispatch(ev, 'data-change'));
window.addEventListener('hashchange', onRoute);

// Once a second, let the current view update live bits (the rest timer).
setInterval(() => current?.view.tick?.(), 1000);

load();
onRoute();

// Register the service worker (offline support). Only works over https or
// on localhost, so it's skipped silently when opened as a plain file.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
}
// Ask the browser not to auto-delete our storage when the phone is low on space.
navigator.storage?.persist?.().catch(() => {});
