// =============================================================================
// config.js — every tunable number in the app lives here.
//
// TRAINING_DEFAULTS are the *starting* values for a fresh install. Most of them
// can also be changed later in the app (Program → Settings) and are then saved
// on the device; editing them here only affects new installs / "Reset all".
//
// GAME is read live every time, so editing it here and reloading takes effect
// immediately. (XP, levels, bosses etc. arrive in Phase 2 — the numbers are
// already here so there is exactly one place to tune them.)
// =============================================================================

export const TRAINING_DEFAULTS = {
  units: 'lb',

  // Main lifts are prescribed as % of a Training Max (TM), not your true 1RM.
  // TM = estimated 1RM × tmPercent. Training a bit below your max keeps bar
  // speed up and leaves room to progress for longer.
  tmPercent: 0.90,

  // Barbell + the plates you can actually load. `pairs` = how many of that
  // plate you can put on EACH side of the bar.
  barWeight: 45,
  plates: [
    { w: 45, pairs: 4 },
    { w: 35, pairs: 1 },
    { w: 25, pairs: 2 },
    { w: 10, pairs: 2 },
    { w: 5, pairs: 2 },
    { w: 2.5, pairs: 2 },
  ],

  // Non-barbell equipment rounds to these steps (e.g. dumbbells come in 5s).
  steps: { dumbbell: 5, machine: 5, cable: 5, bodyweight: 5, other: 2.5 },

  // The wave. One row per week; the program cycles through them in order.
  // pct = fraction of TM, sets × reps = the main-lift prescription that week.
  // A row with deload:true is a deload week (accessories get lighter too).
  wave: [
    { label: 'Week 1', pct: 0.70, sets: 4, reps: 6, deload: false },
    { label: 'Week 2', pct: 0.75, sets: 4, reps: 5, deload: false },
    { label: 'Week 3', pct: 0.80, sets: 4, reps: 4, deload: false },
    { label: 'Deload', pct: 0.60, sets: 3, reps: 5, deload: true },
  ],

  // How much a main lift's TM goes up after each completed wave, by day kind.
  tmIncrement: { upper: 5, lower: 10 },

  // Accessory defaults (double progression).
  accessory: { sets: 3, repMin: 8, repMax: 12, increment: 5 },

  // During a deload week accessories do this fraction of their sets (rounded
  // up), at the same weight, at the bottom of the rep range.
  deloadAccessorySetFactor: 0.5,

  // Sets with more reps than this are ignored when estimating a 1RM — the
  // formula gets unreliable at high reps.
  e1rmMaxReps: 12,

  // Weekdays: 0 = Sunday … 6 = Saturday. Used by the Calendar (Phase 2).
  liftDays: [1, 2, 4, 5],
  climbDays: [3, 6],
};

export const GAME = {
  // --- XP (Phase 2) ---
  xpPerSet: 10,
  xpBeatLastWeek: 25,      // per exercise where you beat last week's numbers
  xpPR: 50,                // per new estimated-1RM PR
  xpBossDefeated: 250,     // beat every target in a boss session
  xpSessionComplete: 50,

  // --- Levels (Phase 2) ---
  // XP needed to go from level n to n+1 = levelBase × levelGrowth^(n-1)
  levelBase: 300,
  levelGrowth: 1.15,

  // --- Achievements (Phase 2) ---
  plateMilestones: [135, 185, 225, 275, 315, 365, 405, 495],
};
