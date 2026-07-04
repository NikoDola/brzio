/* ════════════════════════════════════════════════════════════════════════
   stats.js  —  persistent play stats (shown in the Game Statistic overlay)
   ════════════════════════════════════════════════════════════════════════ */
const HIGH_KEY = "pm_high_score";
const GAMES_KEY = "pm_games_played";
const TIME_KEY = "pm_play_time_ms";
const CHAIN_KEY = "pm_best_chain";

// Shared localStorage helpers (also used by settings.js for the parent-limit
// minutes value) so every numeric setting reads/writes the same safe way.
export function loadNum(key) {
  try {
    const n = parseInt(localStorage.getItem(key) || "0", 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
export function saveNum(key, n) {
  try {
    localStorage.setItem(key, String(n));
  } catch {}
}

let highScore = loadNum(HIGH_KEY);
let gamesPlayed = loadNum(GAMES_KEY);
let totalPlayMs = loadNum(TIME_KEY);
let bestChain = loadNum(CHAIN_KEY);

export function recordHigh(score) {
  if (score > highScore) {
    highScore = score;
    saveNum(HIGH_KEY, highScore);
  }
}
export function recordBestChain(c) {
  if (c > bestChain) {
    bestChain = c;
    saveNum(CHAIN_KEY, bestChain);
  }
}
export function recordGamePlayed() {
  gamesPlayed += 1;
  saveNum(GAMES_KEY, gamesPlayed);
}

// Today's play time (resets at midnight) for the parent-control daily limit.
const TODAY_KEY = "pm_play_today";
function todayStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
export function loadTodayMs() {
  try {
    const d = JSON.parse(localStorage.getItem(TODAY_KEY) || "{}");
    return d.date === todayStamp() ? Number(d.ms) || 0 : 0;
  } catch {
    return 0;
  }
}
function addTodayMs(ms) {
  const todayPlayMs = loadTodayMs() + ms; // reload so a date rollover resets cleanly
  try {
    localStorage.setItem(TODAY_KEY, JSON.stringify({ date: todayStamp(), ms: todayPlayMs }));
  } catch {}
}

// Play-time clock: counts wall-clock time only while a round is active. Banked
// on game end and on leaving (visibilitychange), resumed when the tab returns.
let playClockStart = 0;
export function startPlayClock() {
  playClockStart = Date.now();
}
export function bankPlayTime() {
  if (!playClockStart) return;
  const elapsed = Date.now() - playClockStart;
  totalPlayMs += elapsed;
  playClockStart = 0;
  saveNum(TIME_KEY, totalPlayMs);
  addTodayMs(elapsed);
}

function fmtPlayTime(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

const statGamesPlayedEl = document.getElementById("stat-games-played");
const statBestScoreEl = document.getElementById("stat-best-score");
const statTimePlayedEl = document.getElementById("stat-time-played");
const statBestChainEl = document.getElementById("stat-best-chain");

export function updateStatsUI() {
  const games = String(gamesPlayed);
  const best = String(highScore);
  const time = fmtPlayTime(totalPlayMs);
  const chain = String(bestChain);
  if (statGamesPlayedEl) statGamesPlayedEl.textContent = games;
  if (statBestScoreEl) statBestScoreEl.textContent = best;
  if (statTimePlayedEl) statTimePlayedEl.textContent = time;
  if (statBestChainEl) statBestChainEl.textContent = chain;
  // Mirror into the Settings > Statistic section (same numbers).
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("set-stat-games", games);
  set("set-stat-best", best);
  set("set-stat-time", time);
  set("set-stat-chain", chain);
}

// Dev "Local Storage CLEAR": wipe every persistent stat back to zero.
export function clearStats() {
  try {
    localStorage.removeItem(HIGH_KEY);
    localStorage.removeItem(GAMES_KEY);
    localStorage.removeItem(TIME_KEY);
    localStorage.removeItem(CHAIN_KEY);
  } catch {}
  highScore = 0;
  gamesPlayed = 0;
  totalPlayMs = 0;
  bestChain = 0;
  playClockStart = 0;
  updateStatsUI();
}
