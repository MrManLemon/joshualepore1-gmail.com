# LiftQuest 🏋️

A gamified strength-training tracker that runs as an installable phone app (a
**PWA**, Progressive Web App). It's plain HTML/CSS/JavaScript: no build step, no
server. Your data stays on your phone.

## Status: Phase 1 — Program editor + workout log

| Phase | What | Status |
|---|---|---|
| 1 | Program template editor, workout logger, load prescription, export/import, sample data | ✅ this build |
| 2 | XP, levels, boss sessions, streaks, achievements, Calendar (climb days) | next |
| 3 | Progress graphs (e1RM + volume per lift) | later |

## Put it on your phone (GitHub Pages)

1. On github.com, open this repo → **Settings → Pages**.
2. Under *Build and deployment*, set **Source: Deploy from a branch**. Pick the
   branch `claude/strength-tracker-pwa-u2pot0` (or `main` once merged) and the
   folder **/ (root)**, then save.
   *(Pages on a **private** repo needs a paid GitHub plan. On the free plan,
   make the repo public. There are no secrets in it.)*
3. After about a minute the site is live at
   `https://mrmanlemon.github.io/joshualepore1-gmail.com/`.
4. Open that URL on your phone:
   - **Android / Chrome:** ⋮ menu → *Add to Home screen* / *Install app*.
   - **iPhone / Safari:** Share → *Add to Home Screen*.
5. Launch it from the home-screen icon. It opens full-screen and works offline.

**Updating:** after a new version is pushed, open the app once with signal and
close it. It picks up the new files on the next launch.

## Run it on your Windows PC

From the repo folder (any of these, whichever you have installed):

```powershell
py -m http.server 8000        # Python
npx serve .                   # Node
```

Then open <http://localhost:8000>. Use Chrome DevTools (F12 → device toolbar,
Ctrl+Shift+M) to preview it at phone size. Opening `index.html` by
double-clicking **won't work**: browsers block JavaScript modules from `file://`.

Logic tests (needs Node 18+): `npm test`

## What to test at the gym (Phase 1)

1. First launch shows **sample data** (two weeks of fake history) so the screens
   aren't empty. Poke around, then tap **Clear** on the Today banner.
2. **Program** tab: rename exercises to your own, set types (Main lift vs.
   Accessory), sets and rep ranges. For main lifts, enter a Training Max or a
   known 1RM, or leave it blank to run a **trial week**.
3. ⚙ **Settings**: check your bar weight and plates (*pairs per side*), and the
   wave percentages.
4. **Today** → *Start session*. Each exercise shows last time's numbers, a 🎯
   "beat it" target, and the plates to load per side. Nudge with −/+, tap the
   round number button when a set is done (the rest timer starts).
5. *Finish session* shows sets, volume, PRs, and any training-max changes.
6. **Export backup** now and then (Settings → Data).

## How the program logic works

- **Rotation:** Upper A → Lower A → Upper B → Lower B. *Today* offers the next
  one, but you can do any remaining day of the week. The week advances once all
  four are done, so a missed day never skips a workout.
- **Main lifts:** weight = **Training Max (TM) × week %**, rounded to the nearest
  weight your plates can actually make. TM = 90% of estimated 1RM (editable).
- **Wave:** 3 build weeks + 1 deload (all editable). After the deload, each main
  lift's TM goes up (+5 upper / +10 lower by default), **but only if** you hit
  every prescribed rep in the heaviest week. Otherwise the TM holds.
- **Trial week:** any main lift without a TM is in trial mode. You pick the
  weights, and your best set (via the Epley formula, `w × (1 + reps/30)`) sets
  the TM automatically.
- **Accessories (double progression):** same weight until every set reaches the
  top of the rep range, then add the increment and drop back to the bottom.
  Deload week halves accessory sets with no progression.
- **Beat it:** main lifts show the reps needed at today's weight to beat last
  time's best estimated 1RM. Accessories aim for +1 rep per set.

## Tuning numbers

All tunable numbers are in **`js/config.js`**:
- `TRAINING_DEFAULTS`: starting wave, plates, TM %, increments. These seed a
  *fresh* install. After that, edit them in the app's Settings.
- `GAME`: XP, level curve, milestones (used from Phase 2). Edit and reload.

## Code map

```
index.html            app shell (one page)
manifest.webmanifest  name/icon/colors for "Add to Home Screen"
sw.js                 service worker = offline cache (bump VERSION on deploy)
css/app.css           all styles; colors are variables at the top
js/config.js          ← all tunable numbers
js/program.js         training logic (prescriptions, rotation, TM bumps)
js/plates.js          plate rounding + per-side breakdown
js/store.js           save/load (localStorage), export/import, sample data
js/sample.js          sample history generator
js/app.js             router + event dispatch
js/views/*.js         one file per screen
tests/                Node unit tests for the logic
```

### New concepts, briefly (for a C/C++ person)

- **ES modules** (`import`/`export`): like `#include` plus a header, but each
  file has its own scope and only exported names are visible.
- **localStorage**: a per-site key→string store in the browser. We serialize the
  whole state struct to JSON (a text format) under one key. It's a bit like
  writing a struct to flash, except it's text and the browser manages the space.
- **Service worker**: a script the browser runs *beside* the page that can
  intercept network requests, roughly an ISR for fetches. We use it to serve
  the app from a local cache when you're offline.
- **Hash routing**: `#/program` in the URL picks the screen without reloading.
- **Event delegation**: one click listener on the whole page reads the tapped
  element's `data-action="..."` and calls that function on the current screen,
  like a dispatch table of function pointers.
- **Rendering**: each screen is a function `state → HTML string`. After any
  change we re-run it and replace the screen, like redrawing a full frame
  buffer instead of patching pixels.
