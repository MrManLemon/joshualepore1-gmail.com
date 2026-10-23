// Run with:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { roundBarbell, plateBreakdown, roundLoad } from '../js/plates.js';
import { e1rm, repsToBeat } from '../js/util.js';
import {
  newState, prescribe, buildSession, finishSession, nextDay, findExercise,
  allExercises, needsTrial,
} from '../js/program.js';
import { generateSample } from '../js/sample.js';

const plates = [
  { w: 45, pairs: 4 }, { w: 35, pairs: 1 }, { w: 25, pairs: 2 },
  { w: 10, pairs: 2 }, { w: 5, pairs: 2 }, { w: 2.5, pairs: 2 },
];

// Log every set exactly as prescribed (optionally tweaking reps).
function doSession(state, dayId, tweak = () => {}) {
  state.active = buildSession(state, dayId);
  for (const ex of state.active.exercises) {
    ex.sets.forEach((s, i) => { tweak(ex, s, i); s.done = true; });
  }
  return finishSession(state);
}

test('barbell rounding goes to nearest loadable weight', () => {
  assert.equal(roundBarbell(186, 45, plates), 185);
  assert.equal(roundBarbell(187.6, 45, plates), 190);
  assert.equal(roundBarbell(187.5, 45, plates), 185); // tie → lighter
  assert.equal(roundBarbell(30, 45, plates), 45);
  assert.deepEqual(plateBreakdown(225, 45, plates), [45, 45]);
  assert.deepEqual(plateBreakdown(185, 45, plates), [45, 25]);
  assert.equal(roundLoad(52, 'dumbbell', { steps: { dumbbell: 5 } }), 50);
});

test('rounding is limited by plate inventory', () => {
  const few = [{ w: 45, pairs: 1 }];
  assert.equal(roundBarbell(200, 45, few), 135);
});

test('e1rm and repsToBeat agree', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.ok(Math.abs(e1rm(150, 10) - 200) < 1e-9);
  const r = repsToBeat(185, 220);
  assert.ok(e1rm(185, r) > 220);
  assert.ok(e1rm(185, r - 1) <= 220);
});

test('fresh program with no TMs starts with a trial week', () => {
  const s = newState();
  assert.equal(needsTrial(s), true);
  assert.equal(s.position.week, 0);
  const bench = allExercises(s).find((e) => e.name === 'Bench Press');
  assert.equal(prescribe(s, bench).mode, 'trial');
});

test('trial session sets TM from best set and rotation advances', () => {
  const s = newState();
  const upperA = s.program.days[0];
  const sum = doSession(s, upperA.id, (ex, set) => {
    if (ex.kind === 'main') { set.weight = 200; set.reps = 5; }
    else { set.weight = 40; }
  });
  const bench = findExercise(s, upperA.exercises[0].id).ex;
  // e1rm(200,5) = 233.3 → ×0.9 = 210
  assert.equal(bench.tm, 210);
  assert.equal(sum.tmChanges[0].to, 210);
  assert.deepEqual(s.position.done, [upperA.id]);
  assert.equal(nextDay(s).id, s.program.days[1].id);
});

test('main lift prescription = TM × wave%, rounded to plates', () => {
  const s = newState();
  const bench = s.program.days[0].exercises[0];
  bench.tm = 200;
  s.position.week = 1; // 70%
  const p = prescribe(s, bench);
  assert.equal(p.mode, 'main');
  assert.equal(p.sets.length, 4);
  assert.equal(p.sets[0].weight, 140);
  assert.equal(p.sets[0].reps, 6);
});

test('accessory double progression', () => {
  const s = newState();
  allExercises(s).forEach((e) => { if (e.kind === 'main') e.tm = 200; });
  s.position.week = 1;
  const day = s.program.days[0];
  const acc = day.exercises[1]; // 3 × 8–12
  acc.startWeight = 40;

  // Not at the top of the range → same weight, +1 rep per set.
  doSession(s, day.id, (ex, set) => { if (ex.exId === acc.id) set.reps = 10; });
  let p = prescribe(s, acc);
  assert.equal(p.sets[0].weight, 40);
  assert.deepEqual(p.sets.map((x) => x.reps), [11, 11, 11]);
  assert.equal(p.increased, false);

  // All sets at the top → add weight, reset to bottom of range.
  s.position.done = [];
  doSession(s, day.id, (ex, set) => { if (ex.exId === acc.id) set.reps = 12; });
  p = prescribe(s, acc);
  assert.equal(p.sets[0].weight, 45);
  assert.equal(p.sets[0].reps, 8);
  assert.equal(p.increased, true);
});

test('full wave: deload week then TMs bump only for lifts that hit reps', () => {
  const s = newState();
  allExercises(s).forEach((e) => { if (e.kind === 'main') e.tm = 200; e.startWeight ??= 50; });
  s.position.week = 1;
  const squatId = s.program.days[1].exercises[0].id;
  const benchId = s.program.days[0].exercises[0].id;

  for (let week = 1; week <= 4; week++) {
    assert.equal(s.position.week, week);
    for (let d = 0; d < 4; d++) {
      // Miss a rep on squat in week 3.
      doSession(s, nextDay(s).id, (ex, set, i) => {
        if (week === 3 && ex.exId === squatId && i === 3) set.reps -= 1;
      });
    }
  }
  assert.equal(s.position.wave, 2);
  assert.equal(s.position.week, 1);
  assert.equal(findExercise(s, benchId).ex.tm, 205);   // +5 upper
  assert.equal(findExercise(s, squatId).ex.tm, 200);   // held
  assert.equal(findExercise(s, s.program.days[3].exercises[0].id).ex.tm, 210); // +10 lower
});

test('deload week halves accessory sets and skips progression', () => {
  const s = newState();
  allExercises(s).forEach((e) => { if (e.kind === 'main') e.tm = 200; e.startWeight ??= 50; });
  s.position.week = 1;
  const day = s.program.days[0];
  doSession(s, day.id, (ex, set) => { if (ex.kind === 'accessory') set.reps = ex.repMax; });
  s.position.week = 4;
  s.position.done = [];
  const p = prescribe(s, day.exercises[1]);
  assert.equal(p.sets.length, 2);
  assert.equal(p.sets[0].weight, 50);
});

test('sample data generates two weeks and lands on week 3', () => {
  const s = newState();
  generateSample(s, new Date('2026-10-23T12:00:00'));
  assert.equal(s.sessions.length, 8);
  assert.ok(s.sessions.every((x) => x.sample));
  assert.equal(s.position.week, 3);
  assert.equal(s.hasSample, true);
  assert.ok(new Date(s.sessions.at(-1).date) < new Date('2026-10-23T00:00:00'));
});
