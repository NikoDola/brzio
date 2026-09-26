import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { seededRandom, summarizeSimulations } from '../public/games/planet-merge/simulation-results.js';
import { LAYOUT, r } from '../public/games/planet-merge/config.js';

test('seeded streams repeat and different sequences vary', () => {
  const sample = seed => { const random = seededRandom(seed); return Array.from({ length: 20 }, () => random()); };
  assert.deepEqual(sample('same'), sample('same'));
  assert.notDeepEqual(sample('same'), sample('other'));
});

test('time limits are counted separately from losses and have no fake finish time', () => {
  const summary = summarizeSimulations([
    { outcome: 'win', elapsedMs: 10000, computeMs: 100 },
    { outcome: 'win', elapsedMs: 20000, computeMs: 200 },
    { outcome: 'loss', elapsedMs: 8000, computeMs: 80 },
    { outcome: 'timeout', elapsedMs: 30000, computeMs: 300 },
    { outcome: 'aborted', elapsedMs: 4000, computeMs: 40 },
  ]);
  assert.equal(summary.completed, 4); assert.equal(summary.winRate, .5);
  assert.equal(summary.losses, 1); assert.equal(summary.timeouts, 1);
  assert.deepEqual(summary.winTime, { mean: 15000, median: 15000, min: 10000, max: 20000 });
  assert.equal(summary.lossTime.mean, 8000);
  assert.equal(summarizeSimulations([]).winRate, null);
});

const hasMatter = Boolean(process.env.MATTER_JS_PATH);
let core;
if (hasMatter) {
  globalThis.Matter = (await import(pathToFileURL(process.env.MATTER_JS_PATH))).default;
  core = await import('../public/games/planet-merge/simulation-core.js');
}
const base = { level: 1, seed: 'test-sequence', strategy: 'quick' };

test('two Suns produce a real physics win and the first win time', { skip: !hasMatter }, () => {
  const floor = LAYOUT.H - LAYOUT.WALL - r(11);
  const result = core.runSimulation({ ...base, initialBodies: [{ lvl: 11, x: 420, y: floor }, { lvl: 11, x: 420, y: floor - 2 * r(11) + 4 }] });
  assert.equal(result.outcome, 'win'); assert.equal(result.elapsedMs, 8);
  assert.equal(result.highestLvl, 11); assert.ok(result.score > 4000);
});

test('a planet that passed the rim and fell off the canvas loses', { skip: !hasMatter }, () => {
  const sim = core.createSimulation({ ...base, initialBodies: [{ lvl: 1, x: 10, y: 1210, escaped: true, born: -5000 }] });
  sim.step(); assert.equal(sim.state().outcome, 'loss'); assert.equal(sim.state().reason, 'planet-out'); sim.dispose();
});

test('a blocked Venus drop persists through the real no-room grace before losing', { skip: !hasMatter }, () => {
  const sim = core.createSimulation({ ...base, initialBodies: [
    { lvl: 7, x: 200, y: 260, sleeping: true, born: -5000 },
    { lvl: 10, x: 550, y: 260, sleeping: true, born: -5000 },
  ] });
  for (let i = 0; i < 100; i++) sim.step();
  assert.equal(sim.state().outcome, null);
  for (let i = 0; i < 50; i++) sim.step();
  assert.equal(sim.state().reason, 'no-room'); sim.dispose();
});

test('a fixed seed repeats physics, decisions and outcome; a limit is not a loss', { skip: !hasMatter }, () => {
  const config = { ...base, maxGameMs: 20000 };
  const first = core.runSimulation(config), second = core.runSimulation(config);
  delete first.computeMs; delete second.computeMs;
  assert.deepEqual(first, second);
  assert.equal(first.outcome, 'timeout'); assert.equal(first.elapsedMs, 20000);
  assert.ok(first.drops > 1); assert.equal(first.sequence.length, first.drops + 2);
});

test('unearned powers are refused, and Smart search also runs without a DOM', { skip: !hasMatter }, () => {
  const sim = core.createSimulation(base);
  assert.equal(sim.shake(), false); assert.equal(sim.eliminate(1), false); sim.dispose();
  const result = core.runSimulation({ ...base, strategy: 'smart', maxDrops: 1 });
  assert.equal(result.drops, 1); assert.equal(result.outcome, 'timeout');
});

test('both planners find a narrow legal opening between sampled columns', { skip: !hasMatter }, async () => {
  const { planMove, planQuickMove, legalDrop } = await import('../public/games/planet-merge/bot-planner.js');
  const lvl = 5, gapX = 391, reach = r(11) + r(lvl) - 2;
  const y = LAYOUT.PLAYER_CONTAINER_Y + LAYOUT.PLAYER_MARKER_H / 2 + LAYOUT.DROP_GAP + r(lvl);
  const bodies = [{ lvl: 11, x: gapX - 1 - reach, y }, { lvl: 11, x: gapX + 1 + reach, y }];
  for (const planner of [planQuickMove, planMove]) {
    const move = planner({ bodies, curLvl: lvl, nxtLvl: 4, settings: {}, droppableLvls: [1, 2, 3, 4, 5] });
    assert.equal(move.type, 'drop'); assert.ok(legalDrop(bodies, lvl, move.x));
    assert.ok(Math.abs(move.x - gapX) < 1);
  }
});
