import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBotResults, recordBotWin } from '../public/games/planet-merge/bot-results.js';
import { createDevBot } from '../public/games/planet-merge/dev-bot.js';
import { LAYOUT, SHAPES } from '../public/games/planet-merge/config.js';

test('first win is recorded once; later loss and aborted attempts do not inflate the denominator', () => {
  const win = { outcome: 'running', firstWinMs: null };
  assert.equal(recordBotWin(win, 120000, 130000), true);
  assert.equal(recordBotWin(win, 180000, 190000), false);
  win.outcome = 'loss';
  const result = summarizeBotResults([win, { outcome: 'loss', firstWinMs: null },
    { outcome: 'aborted', firstWinMs: null }, { outcome: 'timeout', firstWinMs: null }]);
  assert.deepEqual(result, { completed: 3, wins: 1, losses: 1, timeouts: 1,
    winRate: 1 / 3, averageWinMs: 120000, bestWinMs: 120000 });
});

test('pacing keeps floor and width, removes 10% of depth, and gives Mars and Venus the requested odds', () => {
  assert.equal(LAYOUT.H - LAYOUT.WALL, 1140);
  assert.equal(LAYOUT.W - 2 * LAYOUT.WALL_X, 720);
  assert.ok(Math.abs((1140 - LAYOUT.WALL_TOP) / (1140 - 108) - .90) < .001);
  for (const roster of [[1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5]]) {
    const total = roster.reduce((sum, lvl) => sum + SHAPES[lvl].dropRate, 0);
    const mars = SHAPES[4].dropRate / total;
    const venus = SHAPES[5].dropRate / total;
    assert.ok(mars >= .25 && mars <= .35);
    assert.ok(venus >= .20 && venus <= .30);
  }
});

function harness(runs = 10) {
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', disabled: false, value: '',
      handlers: {}, addEventListener(name, handler) { this.handlers[name] = handler; } });
    return elements.get(id);
  };
  el('bot-level').value = '1'; el('bot-runs').value = String(runs);
  globalThis.document = { hidden: false, documentElement: { classList: { contains: () => true } },
    getElementById: el, querySelectorAll: () => [] };
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  const workers = [];
  let starts = 0, stops = 0, drops = 0;
  globalThis.Worker = class {
    constructor() { workers.push(this); }
    terminate() { this.terminated = true; }
    postMessage(message) { this.message = message; }
  };
  let state = { simMs: 0, score: 0, gameOver: false, ready: true, curLvl: 1, maxSpeed: 0 };
  const bot = createDevBot({ settings: () => ({}), onStart() {}, onStop() { stops++; },
    startRound() { starts++; state = { ...state, simMs: 0, gameOver: false }; },
    state: () => state, snapshot: () => ({}), shake: () => false, destroy: () => false,
    drop: () => { drops++; return true; } });
  return { bot, el, start: () => el('bot-start').handlers.click(), state: patch => Object.assign(state, patch),
    get worker() { return workers.at(-1); }, get starts() { return starts; }, get stops() { return stops; }, get drops() { return drops; },
    report: () => JSON.parse(storage.get('pm_dev_bot_report_v1')) };
}

test('single run continues on win, retains first time, and excludes cancelled worker replies', () => {
  const h = harness(1); h.start(); h.bot.tick();
  assert.equal(h.bot.thinking, true);
  const id = h.worker.message.id;
  h.worker.onmessage({ data: { id, move: { type: 'drop', lvl: 1, x: 200, evaluated: 22 } } });
  assert.equal(h.bot.thinking, false);
  h.bot.tick(); assert.equal(h.drops, 1);
  h.state({ simMs: 60000 }); h.bot.win(60000);
  assert.equal(h.bot.active, true); assert.equal(h.starts, 1);
  h.bot.win(90000);
  assert.equal(h.report().attempts[0].firstWinMs, 60000);
  h.state({ simMs: 100000, gameOver: true }); h.bot.loss(100000, 'planet-out');
  assert.equal(h.bot.active, false); assert.equal(h.report().attempts[0].outcome, 'win');
  h.worker.onmessage({ data: { id, move: { type: 'drop', lvl: 1, x: 300 } } });
  h.bot.tick(); assert.equal(h.drops, 1);
  h.bot.stop(); assert.equal(h.stops, 1);
});

test('batch restarts after each outcome and stops after its requested count', () => {
  const h = harness(10); h.start();
  for (let i = 0; i < 10; i++) {
    h.state({ simMs: 50000 + i * 1000 });
    if (i % 2 === 0) h.bot.win(50000 + i * 1000);
    else h.bot.loss(50000 + i * 1000, 'planet-out');
    if (i < 9) { assert.equal(h.bot.betweenRounds, true); h.bot.tick(); }
  }
  assert.equal(h.starts, 10); assert.equal(h.stops, 1); assert.equal(h.bot.active, false);
  const summary = summarizeBotResults(h.report().attempts);
  assert.equal(summary.wins, 5); assert.equal(summary.losses, 5); assert.equal(summary.winRate, .5);
});

test('unwon runs time out and manual stop counts as aborted', () => {
  const h = harness(1); h.start(); h.state({ simMs: 900000 }); h.bot.tick();
  assert.equal(h.report().attempts[0].outcome, 'timeout');
  const cancelled = harness(1); cancelled.start(); cancelled.bot.stop();
  assert.equal(cancelled.report().attempts[0].outcome, 'aborted');
  assert.equal(summarizeBotResults(cancelled.report().attempts).completed, 0);
});

test('test rounds cannot write player stats or points; normal rounds still can', async () => {
  const h = harness();
  const { round } = await import('../public/games/planet-merge/state.js');
  const stats = await import('../public/games/planet-merge/stats.js');
  round.testing = true;
  stats.recordGamePlayed(); stats.recordHigh(999); stats.recordBestChain(20); stats.addPoints(999);
  stats.startPlayClock(); stats.bankPlayTime(); stats.updateStatsUI();
  assert.equal(h.el('stat-games-played').textContent, '0');
  assert.equal(h.el('stat-best-score').textContent, '0');
  assert.equal(h.el('stat-best-chain').textContent, '0');
  assert.equal(stats.getPoints(), 0);
  assert.equal(localStorage.getItem('pm_play_time_ms'), null);
  round.testing = false;
  stats.recordGamePlayed(); stats.addPoints(100); stats.updateStatsUI();
  assert.equal(h.el('stat-games-played').textContent, '1');
  assert.equal(stats.getPoints(), 100);
});

test('planner takes a clear matching merge without mutating the live snapshot', { skip: !process.env.MATTER_JS_PATH }, async () => {
  const { pathToFileURL } = await import('node:url');
  globalThis.Matter = (await import(pathToFileURL(process.env.MATTER_JS_PATH))).default;
  const { planMove, forecast, legalDrop } = await import('../public/games/planet-merge/bot-planner.js');
  const bodies = [{ lvl: 1, x: 300, y: 1140 - SHAPES[1].size / 100 * LAYOUT.BASE_R, sleeping: true }];
  const original = structuredClone(bodies);
  const move = planMove({ bodies, curLvl: 1, nxtLvl: 4, settings: {}, droppableLvls: [1, 2, 3, 4, 5] });
  assert.equal(move.type, 'drop'); assert.ok(legalDrop(bodies, 1, move.x));
  assert.ok(forecast(bodies, move).merges >= 1); assert.deepEqual(bodies, original);
  const suns = [{ lvl: 11, x: 420, y: 930 }, { lvl: 11, x: 420, y: 524 }];
  assert.equal(forecast(suns, { type: 'wait' }).won, true);
});
