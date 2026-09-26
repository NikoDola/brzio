/* Endless progression: each Sun pair completes the active level and starts
   the next one on the same board. Lifetime wins are history, never a gate.
   level-config.js defines the opening stages and all later multipliers. */
import { SHAPES, BALANCE } from "./config.js";
import { round } from "./state.js";
import { planetIconHTML, applyLegendMode } from "./planet-icons.js";
import { playPerk } from "./audio.js";

import { MODES, levelFor, dropRatesFor, createDropPicker, firstDropFor } from "./level-config.js";
export { MODES };

let mode = 1;
export const getLevel = () => mode;
export const curLevel = () => levelFor(mode);
export const modeScoreMult = () => curLevel().scoreMult ?? 1;
// Shakes raise the rainbow shield unless the mode turns it off. No current
// mode uses autoShake; the earthquake machinery in shakes.js stays dormant
// until a future mode flips it on.
export const rainbowEnabled = () => curLevel().rainbow !== false;
export const autoShakeEnabled = () => curLevel().autoShake === true;

export let droppableLvls = [];
let pickWeighted;

function rebuildDropTable() {
  droppableLvls = curLevel().drops.slice();
  pickWeighted = createDropPicker(mode);
}
rebuildDropTable();

// Dev panel "Drop" selector: 'weighted' (default), 'random' (uniform across
// all 12), or a specific level index that always drops that planet.
let dropMode = "weighted";
export function setDropMode(m) {
  dropMode = m;
}

export function pickLvl() {
  if (dropMode === "weighted") {
    return pickWeighted();
  }
  if (dropMode === "random") return Math.floor(Math.random() * SHAPES.length);
  return dropMode;
}

// First drop of each game opens with one of the two smallest planets in the
// current roster, so the player isn't handed a big planet from cold.
export function firstDrop() {
  if (dropMode !== "weighted") return pickLvl();
  return firstDropFor(mode);
}

// New games start at 1; Continue and dev tools can restore any level.
export function setMode(n) {
  mode = levelFor(n).num;
  rebuildDropTable();
  applyLegendMode(droppableLvls);
  updateLevelHud();
}
// Every fresh endless run begins at Level 1.
export function resetLevel() {
  setMode(1);
}
export function restoreLevel(savedMode) {
  setMode(savedMode || 1);
}

// Keep existing completion history compatible with earlier saves.
const WINS_KEY = "pm_mode_wins";

function loadWins() {
  try {
    const arr = JSON.parse(localStorage.getItem(WINS_KEY) || "[]");
    return new Set(Array.isArray(arr) ? arr.filter((n) => Number.isInteger(n)) : []);
  } catch {
    return new Set();
  }
}
let wonModes = loadWins();

function saveWins() {
  try {
    localStorage.setItem(WINS_KEY, JSON.stringify([...wonModes]));
  } catch {}
}

export const isModeWon = (n) => wonModes.has(n);
/** Record a completed level once for lifetime history and analytics. */
export function markModeWon(n) {
  if (round.testing) return false;
  if (wonModes.has(n)) return false;
  wonModes.add(n);
  saveWins();
  return true;
}

/** Each Sun pair advances this run, even when the level was beaten before. */
export function advanceLevel() {
  const completedLevel = mode;
  const firstWin = markModeWon(completedLevel);
  setMode(completedLevel + 1);
  if (!round.testing) showWinToast(completedLevel);
  return { completedLevel, firstWin };
}

// Dev helpers: mark the opening stages complete / wipe completion history.
export function unlockAllModes() {
  MODES.forEach((m) => wonModes.add(m.num));
  saveWins();
  updateLevelHud();
}
export function clearModeWins() {
  wonModes.clear();
  try {
    localStorage.removeItem(WINS_KEY);
  } catch {}
  updateLevelHud();
}

/* ── WIN BANNER ──────────────────────────────────────────────────────────
   Reuses the .level-toast styling from the old level-up banner: slides in
   from the top for ~2.6s, never pauses the game. */
function showWinToast(n) {
  const next = levelFor(n + 1);
  const change = next.num === 2 ? "Stars join the drops" : next.num === 3
    ? "Rainbow shield is now off" : "Keep merging to climb higher";
  const toast = document.createElement("div");
  toast.className = "level-toast";
  toast.innerHTML = `
    <div class="level-toast-visual">${planetIconHTML(next.iconLvl)}</div>
    <div class="level-toast-title">${next.name}!</div>
    <div class="level-toast-now">${change}</div>
    <div class="level-toast-next">x${next.scoreMult} points · +${BALANCE.LEVEL_SHAKE_REFILL}% shake</div>`;
  document.body.appendChild(toast);
  playPerk();
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 500);
  }, 2600);
}

// The LEVEL cell opens rules and the next goal for the active level.
const levelPanelEl = document.getElementById("level-panel");
const levelValueEl = document.getElementById("level-value");
const levelIconEl = document.getElementById("level-icon");
const levelOverlayEl = document.getElementById("level-overlay");
const levelTitleEl = document.getElementById("level-title");
const levelBodyEl = document.getElementById("level-body");
const levelCloseEl = document.getElementById("level-close");

export const levelInfoOpen = () => !!levelOverlayEl?.classList.contains("visible");

function updateLevelHud() {
  if (levelValueEl) levelValueEl.textContent = String(mode);
  if (levelIconEl) levelIconEl.innerHTML = planetIconHTML(curLevel().iconLvl);
  levelPanelEl?.setAttribute("aria-label", `Level ${mode}. Merge two Suns to reach Level ${mode + 1}. View level rules`);
  if (levelInfoOpen()) renderLevelCard();
}

/* One card bullet: green check when a mechanic is on, red cross when the
   mode takes it away. */
function ruleHTML(on, onText, offText) {
  return `<li class="level-rule ${on ? "on" : "off"}">
      <span class="level-rule-mark" aria-hidden="true">${on ? "✓" : "✗"}</span>
      <span>${on ? onText : offText}</span>
    </li>`;
}

function renderLevelCard(n = mode) {
  if (!levelBodyEl) return;
  const m = levelFor(n);
  if (levelTitleEl) {
    levelTitleEl.textContent = m.name;
  }
  const icons = m.drops
    .map((l) => `<span class="level-drop-icon" title="${SHAPES[l].name}">${planetIconHTML(l)}</span>`)
    .join("");
  const rates = dropRatesFor(n);
  const total = rates.reduce((sum, rate) => sum + rate, 0);
  const odds = m.drops.map(lvl => `${SHAPES[lvl].name} ${Math.round(rates[lvl] / total * 100)}%`).join(", ");
  levelBodyEl.innerHTML = `
    <p class="level-blurb">${m.blurb}</p>
    <div class="level-drops-label">Dropping in this level</div>
    <div class="level-drops-icons">${icons}</div>
    <p class="level-blurb">Normal drop chances: ${odds}. The opening drop is one of the two smallest planets.</p>
    <ul class="level-rules">
      ${ruleHTML(
        m.choose !== false,
        "Choose power: a 3 merge chain lets you pick your next planet",
        "Choose power: turned off in this level",
      )}
      ${ruleHTML(
        m.eliminate !== false,
        "Eliminate power: a 5 merge chain lets you wipe out one planet type",
        "Eliminate power: turned off in this level",
      )}
      ${ruleHTML(
        m.rainbow !== false,
        "Rainbow shield: shaking is safe, the run can't end mid-shake",
        "Rainbow shield: gone, a careless shake can end the run",
      )}
      <li class="level-rule on">
        <span class="level-rule-mark" aria-hidden="true">★</span>
        <span>Points multiplier: every point counts x${m.scoreMult}</span>
      </li>
    </ul>
    <div class="level-next">Merge two Suns to reach Level ${m.num + 1}. Keep your board and score, and gain ${BALANCE.LEVEL_SHAKE_REFILL}% ready-to-use shake energy.</div>`;
}

/** Open the rules and next goal for an endless level. */
export function openModeInfo(n = mode) {
  renderLevelCard(n);
  levelOverlayEl?.classList.add("visible");
}

levelPanelEl?.addEventListener("click", () => openModeInfo(mode));
levelCloseEl?.addEventListener("click", () =>
  levelOverlayEl?.classList.remove("visible"),
);
updateLevelHud();
