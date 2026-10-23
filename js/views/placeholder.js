// Stand-in for screens that arrive in later phases.
import { esc } from '../util.js';

export function placeholder(title, blurb, phase) {
  return {
    render: () => `
      <h1>${esc(title)}</h1>
      <div class="empty">
        <div class="big">🚧</div>
        <p>${esc(blurb)}</p>
        <p class="small">Coming in Phase ${phase}.</p>
      </div>`,
  };
}
