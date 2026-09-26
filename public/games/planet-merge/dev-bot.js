import { SHAPES } from './config.js';
import { summarizeBotResults, recordBotWin, formatBotTime } from './bot-results.js';

const REPORT_KEY = 'pm_dev_bot_report_v1';
const MAX_GAME_MS = 15 * 60 * 1000;
const MAX_DROPS = 1000;

export function createDevBot(hooks) {
  if (!document.documentElement.classList.contains('dev-mode')) return null;
  const el = id => document.getElementById(id);
  const start = el('bot-start'), stop = el('bot-stop'), exportBtn = el('bot-export');
  const modeEl = el('bot-level'), runsEl = el('bot-runs'), status = el('bot-status');
  let active = false, worker = null, requestId = 0, busy = false, move = null;
  let report = null, attempt = null, nextAttempt = false, lastDropMs = -10000, lastShakeMs = -10000;
  let lastUI = 0, requestAt = 0, lastAction = 'Idle', locked = [];
  try {
    const saved = JSON.parse(localStorage.getItem(REPORT_KEY));
    if (saved?.version === 1 && Number.isFinite(saved.config?.runs) && Array.isArray(saved.attempts) &&
        saved.attempts.every(a => a && Number.isFinite(a.elapsedMs) && (a.firstWinMs === null || Number.isFinite(a.firstWinMs)))) {
      report = saved;
      for (const a of report.attempts) if (a.outcome === 'running') a.outcome = a.firstWinMs === null ? 'aborted' : 'win';
      attempt = report.attempts.at(-1) || null;
      status.textContent = 'Last test (stopped)';
    }
  } catch { /* Private browsing can disable storage. Live testing still works. */ }

  const persist = () => {
    try { localStorage.setItem(REPORT_KEY, JSON.stringify(report)); } catch { /* optional */ }
  };
  const wallMs = () => attempt ? Date.now() - attempt.startedAt : 0;
  function render(force = false) {
    if (!force && performance.now() - lastUI < 200) return;
    lastUI = performance.now();
    const summary = summarizeBotResults(report?.attempts || []);
    el('bot-attempt').textContent = attempt ? `${attempt.number} / ${report.config.runs}` : '-';
    el('bot-time').textContent = formatBotTime(attempt?.elapsedMs);
    el('bot-wall-time').textContent = formatBotTime(active ? wallMs() : attempt?.wallMs);
    el('bot-drops').textContent = attempt?.drops ?? 0;
    el('bot-record').textContent = `${summary.wins} W / ${summary.losses} L / ${summary.timeouts} timed out`;
    el('bot-win-rate').textContent = summary.winRate === null ? '-' : `${(100 * summary.winRate).toFixed(0)}% (${summary.wins}/${summary.completed})`;
    el('bot-first-win').textContent = formatBotTime(attempt?.firstWinMs);
    el('bot-average').textContent = formatBotTime(summary.averageWinMs);
    el('bot-best').textContent = formatBotTime(summary.bestWinMs);
    if (active) status.textContent = busy ? 'Thinking ahead...' : lastAction;
    start.disabled = active; stop.disabled = !active; modeEl.disabled = active; runsEl.disabled = active;
    exportBtn.disabled = !report;
  }

  function lockControls(on) {
    if (on) {
      locked = [...document.querySelectorAll('#dev-body button, #dev-body input, #dev-body select, #dev-body textarea')]
        .filter(e => !e.closest('#smart-bot'))
        .map(e => ({ e, disabled: e.disabled }));
      for (const { e } of locked) e.disabled = true;
    } else {
      for (const { e, disabled } of locked) e.disabled = disabled;
      locked = [];
    }
  }

  function stopTest(message = 'Stopped') {
    if (!active) return;
    if (attempt && active) {
      const state = hooks.state();
      attempt.elapsedMs = state.simMs; attempt.score = state.score;
      attempt.wallMs = wallMs();
      if (attempt.outcome === 'running') attempt.outcome = attempt.firstWinMs === null ? 'aborted' : 'win';
    }
    active = false; busy = false; move = null; nextAttempt = false;
    requestId++; worker?.terminate(); worker = null;
    lockControls(false); hooks.onStop?.();
    if (report) { report.finishedAt = Date.now(); persist(); }
    status.textContent = message; render(true);
  }

  function beginAttempt() {
    requestId++; move = null; busy = false; nextAttempt = false;
    attempt = { number: report.attempts.length + 1, startedAt: Date.now(), outcome: 'running',
      elapsedMs: 0, wallMs: 0, drops: 0, firstWinMs: null, firstWinWallMs: null, score: 0 };
    report.attempts.push(attempt);
    lastDropMs = -10000; lastShakeMs = -10000; lastAction = 'Watching the board';
    hooks.startRound(report.config.level);
    persist(); render(true);
  }

  function finish(outcome, reason = '') {
    if (!active || attempt.outcome !== 'running') return;
    const state = hooks.state();
    attempt.elapsedMs = state.simMs; attempt.score = state.score;
    attempt.outcome = attempt.firstWinMs !== null ? 'win' : outcome;
    attempt.reason = reason; attempt.wallMs = wallMs();
    console.info('[smart-bot] ' + JSON.stringify({ ...attempt, level: report.config.level }));
    persist();
    requestId++; busy = false; move = null;
    if (report.attempts.length < report.config.runs) nextAttempt = true;
    else stopTest(`Finished: ${summarizeBotResults(report.attempts).wins}/${report.attempts.length} wins`);
  }

  start.addEventListener('click', () => {
    if (active || hooks.canStart?.() === false) return;
    report = { version: 1, startedAt: Date.now(), config: { ...hooks.settings(), level: Number(modeEl.value), runs: Number(runsEl.value), maxGameMs: MAX_GAME_MS, maxDrops: MAX_DROPS }, attempts: [] };
    active = true;
    try {
      worker = new Worker(new URL('./bot-worker.js', import.meta.url));
      worker.onerror = () => stopTest('Bot could not load. Check your connection and retry.');
      worker.onmessage = ({ data }) => {
        if (!active || data.id !== requestId) return;
        busy = false;
        if (data.error) { console.error('[smart-bot]', data.error); stopTest('Bot error. See console for details.'); return; }
        move = data.move;
      };
      hooks.onStart(); lockControls(true); beginAttempt();
    } catch (error) { console.error('[smart-bot]', error); stopTest('This browser could not start the bot.'); }
  });
  stop.addEventListener('click', () => stopTest());
  exportBtn.addEventListener('click', () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify({ ...report, summary: summarizeBotResults(report.attempts) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `planet-merge-bot-level-${report.config.level}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function tick() {
    if (!active || document.hidden) return;
    if (nextAttempt) { beginAttempt(); return; }
    const state = hooks.state();
    attempt.elapsedMs = state.simMs; attempt.wallMs = wallMs(); attempt.score = state.score;
    if (state.gameOver) { finish('loss', state.reason || 'game-over'); return; }
    if (attempt.firstWinMs === null && (state.simMs >= MAX_GAME_MS || attempt.drops >= MAX_DROPS)) {
      finish('timeout', 'Test limit reached'); return;
    }
    render();
    if (!state.ready) return;
    if (state.needsRescue && state.simMs - lastShakeMs > 8000 && hooks.shake()) {
      lastShakeMs = state.simMs; requestId++; move = null; busy = false;
      lastAction = 'Using an earned shake'; return;
    }
    if (busy) {
      if (performance.now() - requestAt > 30000) stopTest('Bot search timed out. Try again.');
      return;
    }
    if (move) {
      const planned = move;
      if (planned.type === 'drop' && planned.lvl !== state.curLvl) {
        // An earned Choose power cycles the held planet. Wait for the planned
        // choice to return instead of assigning the bot an unavailable planet.
        if (!state.choosing) move = null;
        return;
      }
      move = null;
      if (planned.type === 'destroy' && hooks.destroy(planned.lvl)) {
        lastAction = `Eliminated ${SHAPES[planned.lvl].name}`; lastDropMs = state.simMs; return;
      }
      if (planned.type === 'drop' && hooks.drop(planned.x)) {
        attempt.drops++; lastDropMs = state.simMs;
        lastAction = `${SHAPES[planned.lvl].name}: compared ${planned.evaluated} forecasts`;
        return;
      }
      lastAction = 'Waiting for room';
    }
    if (state.simMs - lastDropMs < 650 || (state.maxSpeed > 1.2 && state.simMs - lastDropMs < 2200)) return;
    busy = true; requestAt = performance.now();
    worker.postMessage({ id: ++requestId, snapshot: hooks.snapshot() });
  }

  render(true);
  return { tick, stop: stopTest, get active() { return active; }, get betweenRounds() { return nextAttempt; },
    get thinking() { return active && busy; },
    win(simMs) {
      if (!active || !recordBotWin(attempt, simMs, wallMs())) return;
      attempt.score = hooks.state().score;
      attempt.elapsedMs = simMs; persist(); render(true);
      if (report.config.runs > 1) finish('win', 'Two Suns merged');
      else lastAction = `Won at ${formatBotTime(simMs)}. Continuing the run`;
    },
    loss(simMs, reason) { if (active) { attempt.elapsedMs = simMs; finish('loss', reason); } },
  };
}
