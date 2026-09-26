import { summarizeSimulations } from './simulation-results.js';
import { formatBotTime } from './bot-results.js';

const STORAGE_KEY = 'pm_dev_simulation_v1';
export function createDevSimulator(hooks) {
  if (!document.documentElement.classList.contains('dev-mode')) return null;
  const el = id => document.getElementById(id);
  let worker = null, requestId = 0, report = null, active = false, botStartWasDisabled = false;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 1 && [1, 2, 3].includes(saved.config?.level) &&
        [1, 10, 25, 100].includes(saved.config.runs) && ['quick', 'smart'].includes(saved.config.strategy) &&
        typeof saved.config.seed === 'string' && Number.isFinite(saved.config.maxGameMs) &&
        Array.isArray(saved.results) && saved.results.every(result => result &&
          ['win', 'loss', 'timeout'].includes(result.outcome) && Number.isFinite(result.elapsedMs) &&
          Number.isFinite(result.computeMs) && Number.isFinite(result.drops))) {
      report = saved;
      if (report.status === 'running') {
        report.status = 'stopped'; report.message = 'Interrupted. The unfinished run is excluded.';
      }
    }
  } catch { /* Live results work without local storage. */ }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(report)); } catch { /* Export remains available. */ }
  }
  const range = stats => stats.min === null ? '-' : `${formatBotTime(stats.min)} to ${formatBotTime(stats.max)}`;
  function render() {
    const summary = summarizeSimulations(report?.results || []);
    for (const id of ['sim-level', 'sim-runs', 'sim-seed', 'sim-strategy', 'sim-limit', 'sim-start']) el(id).disabled = active;
    el('sim-stop').disabled = !active; el('sim-export').disabled = !report;
    el('sim-record').textContent = `${summary.wins} wins / ${summary.losses} losses / ${summary.timeouts} at limit`;
    el('sim-rate').textContent = summary.winRate === null ? '-' : `${(summary.winRate * 100).toFixed(1)}% (${summary.wins}/${summary.completed})`;
    el('sim-win-time').textContent = formatBotTime(summary.winTime.mean);
    el('sim-loss-time').textContent = formatBotTime(summary.lossTime.mean);
    el('sim-win-range').textContent = range(summary.winTime);
    el('sim-loss-range').textContent = range(summary.lossTime);
    el('sim-compute-time').textContent = formatBotTime(report?.computeMs);
    el('sim-game-time').textContent = formatBotTime(summary.simulatedMs);
    const current = report?.current;
    el('sim-progress').textContent = active && current
      ? `Run ${current.number}/${report.config.runs}: ${current.drops} drops, ${formatBotTime(current.elapsedMs)} game time`
      : report ? `${summary.completed}/${report.config.runs} runs completed` : 'Ready';
    el('sim-status').textContent = active ? 'Calculating in background...' : report?.message || (report ? 'Previous results' : 'No test yet');
    el('sim-context').textContent = report
      ? `Results: Level ${report.config.level}, ${report.config.strategy}, seed ${report.config.seed}, ${report.config.maxGameMs / 60000} minute limit.` : '';
    const rows = report?.results || [];
    el('sim-results').replaceChildren(...rows.map(result => {
      const row = document.createElement('tr');
      for (const value of [result.number, result.outcome === 'timeout' ? 'At limit' : result.outcome,
        formatBotTime(result.elapsedMs), result.drops, result.seed]) {
        const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
      }
      return row;
    }));
  }
  function finish(status, message) {
    if (!active) return;
    active = false; requestId++; worker?.terminate(); worker = null;
    el('bot-start').disabled = botStartWasDisabled;
    report.status = status; report.message = message; report.finishedAt = Date.now();
    report.computeMs = report.finishedAt - report.startedAt;
    persist(); render();
  }
  el('sim-start').addEventListener('click', () => {
    if (active || hooks.isBusy()) return;
    const seed = el('sim-seed').value.trim() || 'planet-merge-1';
    el('sim-seed').value = seed;
    const limit = Math.max(1, Math.min(60, Number(el('sim-limit').value) || 15));
    el('sim-limit').value = limit;
    report = { version: 1, startedAt: Date.now(), status: 'running', current: null, computeMs: 0, results: [],
      config: { ...hooks.settings(), seed, level: Number(el('sim-level').value), runs: Number(el('sim-runs').value),
        strategy: el('sim-strategy').value, maxGameMs: limit * 60000, maxDrops: 1000 } };
    active = true; const id = ++requestId;
    botStartWasDisabled = el('bot-start').disabled; el('bot-start').disabled = true;
    persist(); render();
    try {
      worker = new Worker(new URL('./simulation-worker.js', import.meta.url));
      worker.onerror = () => finish('error', 'Could not run the simulator. Check your connection and retry.');
      worker.onmessage = ({ data }) => {
        if (!active || data.id !== requestId) return;
        report.computeMs = Date.now() - report.startedAt;
        if (data.type === 'progress') report.current = data;
        if (data.type === 'result') { report.results.push(data.result); report.current = null; persist(); }
        if (data.type === 'error') { console.error('[simulator]', data.message); finish('error', 'Simulation error. Completed results were kept.'); return; }
        if (data.type === 'done') { finish('complete', 'Finished'); return; }
        render();
      };
      worker.postMessage({ id, config: report.config });
    } catch (error) { console.error('[simulator]', error); finish('error', 'This browser could not start the simulator.'); }
  });
  el('sim-stop').addEventListener('click', () => finish('stopped', 'Stopped. The unfinished run is excluded.'));
  el('sim-export').addEventListener('click', () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify({ ...report, summary: summarizeSimulations(report.results) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `planet-merge-simulation-level-${report.config.level}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
  return { get active() { return active; } };
}
