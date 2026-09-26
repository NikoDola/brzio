// Deterministic random streams keep planet sequences independent of physics.
export function seededRandom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    let x = state += 0x6D2B79F5;
    x = Math.imul(x ^ x >>> 15, x | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

function times(values) {
  if (!values.length) return { mean: null, median: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return { mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    min: sorted[0], max: sorted.at(-1) };
}

export function summarizeSimulations(results) {
  const finished = results.filter(r => ['win', 'loss', 'timeout'].includes(r.outcome));
  const wins = finished.filter(r => r.outcome === 'win');
  const losses = finished.filter(r => r.outcome === 'loss');
  return { completed: finished.length, wins: wins.length, losses: losses.length,
    timeouts: finished.length - wins.length - losses.length,
    winRate: finished.length ? wins.length / finished.length : null,
    winTime: times(wins.map(r => r.elapsedMs)), lossTime: times(losses.map(r => r.elapsedMs)),
    simulatedMs: finished.reduce((sum, r) => sum + r.elapsedMs, 0),
    computeMs: finished.reduce((sum, r) => sum + r.computeMs, 0) };
}
