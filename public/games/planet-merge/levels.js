/* ════════════════════════════════════════════════════════════════════════
   levels.js: the selectable game MODES (shown to players as "Level N"),
   win/unlock tracking, the win banner, and the level info card
   ════════════════════════════════════════════════════════════════════════

   The old single endless run that ramped through score thresholds is gone.
   A player now picks a mode from the New Game chooser, and that mode's rules
   hold for the WHOLE run (like the old easy/normal/hard). Each MODES entry:
     num       → 1-based mode number ("Level 1" in the UI)
     iconLvl   → SHAPES index drawn as the mode's face in the chooser + HUD
     drops     → droppable planet levels for the entire run
     eliminate → can chains grant the Eliminate (destroy) power
     choose    → can chains grant the Choose-your-next-planet power
     rainbow   → do shakes raise the rainbow shield? false = shaking is risky
     autoShake → earthquakes fire on their own (reserved for future modes)
     scoreMult → every point earned in this mode is multiplied by this
     blurb     → one-liner for the info card

   WINNING: make two Suns touch (they vanish for the bonus). The run does NOT
   end; the win is recorded (localStorage) and the next mode unlocks. Twelve
   modes are planned; three exist. `getLevel()` stays the analytics label. */
import { SHAPES } from "./config.js";
import { planetIconHTML, applyLegendMode } from "./planet-icons.js";
import { playPerk } from "./audio.js";

export const MODES = [
  {
    num: 1,
    name: "Level 1",
    iconLvl: 0, // the Star icon fronts the no-Stars mode; deliberate for now
    drops: [1, 2, 3, 4, 5], // Moon, Pluto, Mercury, Mars, Venus
    eliminate: true,
    choose: true,
    rainbow: true,
    scoreMult: 1.2,
    blurb: "The opening run. Moon through Venus drop, no Stars yet, and the rainbow shield keeps your shakes safe.",
  },
  {
    num: 2,
    name: "Level 2",
    iconLvl: 1, // Moon
    drops: [0, 1, 2, 3, 4, 5], // Stars join the pool
    eliminate: true,
    choose: true,
    rainbow: true,
    scoreMult: 1.4,
    blurb: "Stars join the drop pool and crowd the board faster. The rainbow shield still protects your shakes.",
  },
  {
    num: 3,
    name: "Level 3",
    iconLvl: 2, // Pluto
    drops: [0, 1, 2, 3, 4, 5],
    eliminate: true,
    choose: true,
    rainbow: false, // shaking can now throw a planet out and end the run
    scoreMult: 1.5,
    blurb: "No rainbow shield. A careless shake can throw a planet over the rim and end the run.",
  },
];

let mode = 1;
export const getLevel = () => mode;
export const curLevel = () => MODES[mode - 1];
export const modeScoreMult = () => curLevel().scoreMult ?? 1;
// Shakes raise the rainbow shield unless the mode turns it off. No current
// mode uses autoShake; the earthquake machinery in shakes.js stays dormant
// until a future mode flips it on.
export const rainbowEnabled = () => curLevel().rainbow !== false;
export const autoShakeEnabled = () => curLevel().autoShake === true;

export let droppableLvls = [];
let dropTable = [];
let dropTotal = 0;

function rebuildDropTable() {
  dropTable.length = 0;
  dropTotal = 0;
  droppableLvls = curLevel().drops.slice();
  for (const lvl of droppableLvls) {
    const w = SHAPES[lvl].dropRate || 1;
    dropTable.push({ lvl, w });
    dropTotal += w;
  }
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
    let rand = Math.random() * dropTotal;
    for (const e of dropTable) {
      rand -= e.w;
      if (rand <= 0) return e.lvl;
    }
    return dropTable[dropTable.length - 1].lvl;
  }
  if (dropMode === "random") return Math.floor(Math.random() * SHAPES.length);
  return dropMode;
}

// First drop of each game opens with one of the two smallest planets in the
// current roster, so the player isn't handed a big planet from cold.
export function firstDrop() {
  if (dropMode !== "weighted") return pickLvl();
  const small = droppableLvls.slice().sort((a, b) => a - b);
  return Math.random() < 0.5 ? small[0] : small[Math.min(1, small.length - 1)];
}

/* ── MODE SELECTION ──────────────────────────────────────────────────────
   The New Game chooser (game.js) calls setMode(n) before startGame(). Play
   Again keeps the current mode (resetLevel just re-applies it); Continue
   restores the saved one. */
export function setMode(n) {
  mode = Math.min(MODES.length, Math.max(1, n || 1));
  rebuildDropTable();
  applyLegendMode(droppableLvls);
  updateLevelHud();
}
// Re-apply the CURRENT mode (new game / Play Again keeps the player's pick).
export function resetLevel() {
  setMode(mode);
}
export function restoreLevel(savedMode) {
  setMode(savedMode || 1);
}

/* ── WINS + UNLOCKS ──────────────────────────────────────────────────────
   Winning a mode (two Suns touched) unlocks the next one. Wins persist in
   localStorage; the dev panel can wipe or grant them for testing. */
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
export const isModeUnlocked = (n) => n <= 1 || wonModes.has(n - 1);

let onWinsChanged = () => {};
// game.js registers this to refresh the New Game chooser when a win lands.
export function onModeWinsChange(cb) {
  onWinsChanged = cb;
}

/** Record a win (two Suns touched). First time only: persist, banner, and
 *  refresh anything showing lock states. The run keeps going regardless. */
export function markModeWon(n) {
  if (wonModes.has(n)) return;
  wonModes.add(n);
  saveWins();
  showWinToast(n);
  updateLevelHud();
  onWinsChanged();
}

// Dev helpers (dev-panel.js): unlock everything silently / wipe all wins.
export function unlockAllModes() {
  MODES.forEach((m) => wonModes.add(m.num));
  saveWins();
  updateLevelHud();
  onWinsChanged();
}
export function clearModeWins() {
  wonModes.clear();
  try {
    localStorage.removeItem(WINS_KEY);
  } catch {}
  updateLevelHud();
  onWinsChanged();
}

/* ── WIN BANNER ──────────────────────────────────────────────────────────
   Reuses the .level-toast styling from the old level-up banner: slides in
   from the top for ~2.6s, never pauses the game. */
function showWinToast(n) {
  const next = MODES[n]; // undefined when the last mode was won
  const iconLvl = next ? next.iconLvl : MODES[n - 1].iconLvl;
  const toast = document.createElement("div");
  toast.className = "level-toast";
  toast.innerHTML = `
    <div class="level-toast-visual">${planetIconHTML(iconLvl)}</div>
    <div class="level-toast-title">${MODES[n - 1].name} complete!</div>
    <div class="level-toast-now">Two Suns touched. You won!</div>
    ${next ? `<div class="level-toast-next">${next.name} unlocked</div>` : `<div class="level-toast-next">All levels complete!</div>`}`;
  document.body.appendChild(toast);
  playPerk();
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 500);
  }, 2600);
}

/* ── LEVEL HUD CELL + INFO CARD ──────────────────────────────────────────
   The LEVEL cell shows the mode's planet icon + number. Clicking it opens
   #level-overlay with the card for the CURRENT mode. The New Game chooser's
   info buttons open the same card for any mode via openModeInfo(n).
   game.js checks levelInfoOpen() in drop() so the spacebar can't fire a
   planet under the card. */
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
  const m = MODES[n - 1];
  if (!m) return;
  if (levelTitleEl) {
    levelTitleEl.innerHTML = `${m.name}${isModeWon(n) ? ' <span class="mode-won-badge">WON</span>' : ""}`;
  }
  const icons = m.drops
    .map((l) => `<span class="level-drop-icon" title="${SHAPES[l].name}">${planetIconHTML(l)}</span>`)
    .join("");
  levelBodyEl.innerHTML = `
    <p class="level-blurb">${m.blurb}</p>
    <div class="level-drops-label">Dropping in this level</div>
    <div class="level-drops-icons">${icons}</div>
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
    <div class="level-next">Win by making two Suns touch. The run keeps going after, so chase the score.</div>`;
}

/** Open the info card for any mode (used by the New Game chooser's ⓘ buttons
 *  and by the in-run LEVEL cell). */
export function openModeInfo(n = mode) {
  renderLevelCard(n);
  levelOverlayEl?.classList.add("visible");
}

levelPanelEl?.addEventListener("click", () => openModeInfo(mode));
levelCloseEl?.addEventListener("click", () =>
  levelOverlayEl?.classList.remove("visible"),
);
updateLevelHud();
