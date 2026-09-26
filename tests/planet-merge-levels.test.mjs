import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { levelFor, dropRatesFor, createDropPicker, firstDropFor } from '../public/games/planet-merge/level-config.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
function element() {
  const classes = new Set();
  return {
    textContent: '', innerHTML: '', style: {}, attributes: {},
    classList: {
      add: name => classes.add(name), remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener() {}, remove() {},
  };
}
const elements = new Map();
const el = id => {
  if (id === 'planet-legend') return null;
  if (!elements.has(id)) elements.set(id, element());
  return elements.get(id);
};
const toasts = [];
globalThis.document = { getElementById: el, createElement: element,
  body: { appendChild: toast => toasts.push(toast) } };
globalThis.window = { innerWidth: 1000, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.Audio = class { play() { return Promise.resolve(); } pause() {} };
globalThis.requestAnimationFrame = fn => fn();
const levels = await import('../public/games/planet-merge/levels.js');
const stats = await import('../public/games/planet-merge/stats.js');
const { round } = await import('../public/games/planet-merge/state.js');

test('level odds favor a gentler opening and stay steady after Level 2', () => {
  assert.deepEqual(dropRatesFor(1), [0, 10, 10, 10, 30, 40, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(dropRatesFor(2), [10, 15, 15, 10, 25, 25, 0, 0, 0, 0, 0, 0]);
  for (const level of [3, 4, 17, 100]) assert.deepEqual(dropRatesFor(level), dropRatesFor(2));
  let sample = 0;
  const pick = createDropPicker(1, () => sample);
  assert.deepEqual([0, .0999, .1, .2, .3, .5999, .6, .9999].map(value => {
    sample = value;
    return pick();
  }), [1, 1, 2, 3, 4, 4, 5, 5]);
  // Explicit simulator overrides may disable an otherwise droppable planet.
  assert.equal(createDropPicker(2, () => 0, [0, 0, 0, 0, 0, 1])(), 5);
});

test('live weighted drops rebuild on level changes and restore, and keep dev overrides', t => {
  let randomValue = 0;
  t.mock.method(Math, 'random', () => randomValue);
  levels.setDropMode('weighted');
  for (const level of [1, 2, 3, 17, 1]) {
    levels.restoreLevel(level);
    const counts = Array(12).fill(0);
    for (let i = 0; i < 100; i++) {
      randomValue = (i + .5) / 100;
      counts[levels.pickLvl()]++;
    }
    assert.deepEqual(counts, dropRatesFor(level));
  }
  levels.setDropMode(5);
  assert.equal(levels.pickLvl(), 5);
  assert.equal(levels.firstDrop(), 5);
  levels.setDropMode('random');
  randomValue = .9999;
  assert.equal(levels.pickLvl(), 11);
  levels.setDropMode('weighted');
  // Rebuild with the original random function once the mock is restored.
  t.mock.restoreAll();
  levels.resetLevel();
});

test('opening drop remains a fair choice between the two smallest roster planets', () => {
  assert.equal(firstDropFor(1, () => .4999), 1);
  assert.equal(firstDropFor(1, () => .5), 2);
  assert.equal(firstDropFor(2, () => .4999), 0);
  assert.equal(firstDropFor(2, () => .5), 1);
});

test('endless levels preserve the opening rules and continue beyond the last definition', () => {
  assert.deepEqual(levelFor(1).drops, [1, 2, 3, 4, 5]);
  assert.deepEqual(levelFor(2).drops, [0, 1, 2, 3, 4, 5]);
  assert.equal(levelFor(2).rainbow, true);
  assert.equal(levelFor(3).rainbow, false);
  assert.deepEqual([1, 2, 3, 4, 5, 17].map(n => levelFor(n).scoreMult), [1.2, 1.4, 1.5, 1.6, 1.7, 2.9]);
  assert.equal(levelFor(100).name, 'Level 100');
  assert.deepEqual(levelFor(100).drops, levelFor(3).drops);
  assert.equal(levelFor(100).autoShake, undefined);
  for (const n of [undefined, NaN, Infinity, -1, 0]) assert.equal(levelFor(n).num, 1);
});

test('every Sun pair advances, including previously completed stages, and refreshes an open rules card', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  round.testing = false;
  levels.clearModeWins();
  levels.resetLevel();
  levels.openModeInfo();
  assert.match(el('level-body').innerHTML, /Mars 30%, Venus 40%/);
  assert.deepEqual(levels.advanceLevel(), { completedLevel: 1, firstWin: true });
  assert.equal(levels.getLevel(), 2);
  assert.equal(levels.droppableLvls.includes(0), true);
  assert.equal(el('level-title').textContent, 'Level 2');
  assert.match(el('level-body').innerHTML, /reach Level 3/);
  assert.match(el('level-body').innerHTML, /Stars 10%, Moon 15%, Pluto 15%, Mercury 10%, Mars 25%, Venus 25%/);
  assert.match(toasts.at(-1).innerHTML, /Stars join the drops/);
  assert.deepEqual(JSON.parse(storage.get('pm_mode_wins')), [1]);

  levels.resetLevel();
  assert.equal(levels.getLevel(), 1);
  const before = toasts.length;
  assert.deepEqual(levels.advanceLevel(), { completedLevel: 1, firstWin: false });
  assert.equal(levels.getLevel(), 2);
  assert.equal(toasts.length, before + 1);
  levels.advanceLevel();
  assert.equal(levels.getLevel(), 3);
  assert.equal(levels.rainbowEnabled(), false);
  assert.match(toasts.at(-1).innerHTML, /Rainbow shield is now off/);
  levels.advanceLevel();
  assert.equal(levels.modeScoreMult(), 1.6);
  assert.match(el('level-panel').attributes['aria-label'], /Level 4.*Level 5/);
});

test('later saved levels restore without a cap; new runs reset to 1', () => {
  levels.restoreLevel(17);
  assert.equal(levels.getLevel(), 17);
  assert.equal(levels.modeScoreMult(), 2.9);
  assert.deepEqual(levels.droppableLvls, [0, 1, 2, 3, 4, 5]);
  levels.resetLevel();
  assert.equal(levels.getLevel(), 1);
  assert.deepEqual(levels.droppableLvls, [1, 2, 3, 4, 5]);
});

test('bot progression stays endless without persisting player wins, best level, or banners', () => {
  levels.clearModeWins();
  stats.clearStats();
  round.testing = true;
  levels.setMode(3);
  const before = toasts.length;
  levels.advanceLevel();
  stats.recordLevelReached(4);
  assert.equal(levels.getLevel(), 4);
  assert.equal(storage.has('pm_mode_wins'), false);
  assert.equal(storage.has('pm_best_level'), false);
  assert.equal(toasts.length, before);
  round.testing = false;
});

test('highest level persists across new runs and mirrors into both stats panels', () => {
  stats.clearStats();
  stats.recordLevelReached(5);
  stats.recordLevelReached(1);
  stats.updateStatsUI();
  assert.equal(storage.get('pm_best_level'), '5');
  assert.equal(el('stat-best-level').textContent, '5');
  assert.equal(el('set-stat-level').textContent, '5');
  stats.clearStats();
  assert.equal(storage.has('pm_best_level'), false);
});

test('Sun-pair refill is immediately usable, capped at 100%, and preserves an active shield',
  { skip: !process.env.MATTER_JS_PATH }, async () => {
    globalThis.Matter = createRequire(import.meta.url)(process.env.MATTER_JS_PATH);
    const shakes = await import('../public/games/planet-merge/shakes.js');
    round.playing = true;
    round.gameOver = false;
    levels.resetLevel();
    shakes.resetShake();
    shakes.rewardLevelShake();
    assert.equal(el('shakes-fill').style.height, '25%');
    assert.equal(el('shakes-panel').classList.contains('armed'), true);
    shakes.tryShake();
    shakes.tickShield();
    assert.equal(el('shakes-fill').style.height, '15%');
    assert.equal(shakes.isProtected(), true);
    levels.setMode(3);
    shakes.rewardLevelShake();
    shakes.tickShield();
    assert.equal(shakes.isProtected(), true);
    assert.equal(el('shakes-fill').style.height, '40%');
    for (let i = 0; i < 4; i++) shakes.rewardLevelShake();
    assert.equal(el('shakes-fill').style.height, '100%');
    shakes.resetShake();
    assert.equal(shakes.isProtected(), false);
    assert.equal(el('shakes-panel').classList.contains('armed'), false);
    round.playing = false;
  });
