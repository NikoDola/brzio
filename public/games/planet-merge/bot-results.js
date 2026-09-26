// Pure result bookkeeping so first-win timing is independent of saved mode
// unlocks. A later loss after a win must not count the same attempt twice.
export function summarizeBotResults(attempts) {
  const wins = attempts.filter(a => a.firstWinMs !== null);
  const losses = attempts.filter(a => a.firstWinMs === null && a.outcome === 'loss');
  const timeouts = attempts.filter(a => a.firstWinMs === null && a.outcome === 'timeout');
  const completed = wins.length + losses.length + timeouts.length;
  return { completed, wins: wins.length, losses: losses.length, timeouts: timeouts.length,
    winRate: completed ? wins.length / completed : null,
    averageWinMs: wins.length ? wins.reduce((sum, a) => sum + a.firstWinMs, 0) / wins.length : null,
    bestWinMs: wins.length ? Math.min(...wins.map(a => a.firstWinMs)) : null };
}

export function recordBotWin(attempt, simMs, wallMs) {
  if (!attempt || attempt.firstWinMs !== null || attempt.outcome !== 'running') return false;
  attempt.firstWinMs = simMs;
  attempt.firstWinWallMs = wallMs;
  return true;
}

export function formatBotTime(ms) {
  if (ms === null || ms === undefined) return '-';
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
