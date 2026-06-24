/* ════════════════════════════════════════════════════════════════════════
   game.js  —  game loop, state, merge/vanish logic, input, restart
   Entry point: loaded as <script type="module"> in play.html
   ════════════════════════════════════════════════════════════════════════ */

import { LAYOUT, SHAPES, r } from "./config.js";
import {
  engine,
  world,
  bodyLvl,
  bodyBorn,
  active,
  spawn,
  despawn,
  loadOutlines,
  wakeAllShapes,
  separateOverlapping,
  applyTuningToBodies,
  getOutlineSets,
} from "./physics.js";
import { TUNING } from "./tuning.js";
import {
  drawProcedural,
  drawBody,
  drawNext,
  drawPreview,
  drawFlashes,
  drawPopups,
  drawUnlockGlows,
  onAssetLoad,
  setDebugColliders,
} from "./renderer.js";
import {
  initAnalytics,
  reportOpen,
  reportGameStart,
  reportGameEnd,
} from "./analytics.js";

const { Engine, Body, World, Events, Composite, Sleeping, Query } = Matter; // CDN global
const { W, H, WALL, DROP_Y, DANGER_Y } = LAYOUT;

/* Background galaxy. Drawn on a single full-viewport canvas (#bg-starfield)
   behind the whole game, NOT as DOM elements. One canvas with ~100 cheap
   arcs costs far less than 100 blurred, individually-composited <span>s, and
   it lets us add a baked nebula + soft star halos for a real galaxy look.
   Still driven by `bodyStarConfig` so the dev "Body Stars" editor keeps
   working: groups map to twinkle periods, plus size/colors. */
let bodyStarConfig = {
  baseBlinkMs: 2600,
  groups: [
    { label: "1 blink", blinks: 1, count: 30 },
    { label: "2 blinks", blinks: 2, count: 30 },
    { label: "3 blinks", blinks: 3, count: 30 },
    { label: "5 blinks", blinks: 5, count: 10 },
  ],
  starSize: { min: 2, max: 4 },
  colors: ["#ffffff", "#7ddfff", "#feca57"],
};

/* ── BACKGROUND GALAXY CANVAS ─────────────────────────────────────────── */
const bgCanvas = document.getElementById("bg-starfield");
const bgCtx = bgCanvas ? bgCanvas.getContext("2d") : null;
let bgW = 0;
let bgH = 0;
let bgNebula = null; // baked offscreen: nebula glow, redrawn only on resize
let bgStars = []; // { xf, yf, size, color, period, phase, glow }

// Soft round glow sprites, one per colour, pre-rendered once. drawImage of a
// cached sprite is cheap; building a radial gradient per star per frame is not.
const glowSpriteCache = new Map();
function glowSprite(color) {
  if (glowSpriteCache.has(color)) return glowSpriteCache.get(color);
  const s = 48;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, "transparent");
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  glowSpriteCache.set(color, c);
  return c;
}

// Bake the nebula (a few big soft colour blobs) once per size. Drawn each
// frame as a single drawImage, so it costs nothing to keep on screen.
function buildBgNebula() {
  if (!bgCtx) return;
  const c = document.createElement("canvas");
  c.width = bgW;
  c.height = bgH;
  const g = c.getContext("2d");
  const span = Math.max(bgW, bgH);
  const blobs = [
    { x: bgW * 0.24, y: bgH * 0.28, r: span * 0.55, color: "rgba(86,46,150,0.20)" },
    { x: bgW * 0.78, y: bgH * 0.62, r: span * 0.60, color: "rgba(32,84,168,0.18)" },
    { x: bgW * 0.55, y: bgH * 0.12, r: span * 0.42, color: "rgba(170,64,128,0.12)" },
  ];
  for (const b of blobs) {
    const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    grad.addColorStop(0, b.color);
    grad.addColorStop(1, "transparent");
    g.fillStyle = grad;
    g.fillRect(0, 0, bgW, bgH);
  }
  bgNebula = c;
}

function resizeBgStarfield() {
  if (!bgCtx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  bgW = window.innerWidth;
  bgH = window.innerHeight;
  bgCanvas.width = Math.round(bgW * dpr);
  bgCanvas.height = Math.round(bgH * dpr);
  bgCanvas.style.width = `${bgW}px`;
  bgCanvas.style.height = `${bgH}px`;
  bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildBgNebula();
}

// Rebuild the star list from the current config. Positions are fractions of
// the viewport so a resize never needs a rebuild, only a re-bake of nebula.
function buildBgStars() {
  bgStars = [];
  let index = 0;
  for (const group of bodyStarConfig.groups) {
    const period = bodyStarConfig.baseBlinkMs * group.blinks;
    for (let i = 0; i < group.count; i += 1) {
      const color = bodyStarConfig.colors[index % bodyStarConfig.colors.length];
      bgStars.push({
        xf: Math.random(),
        yf: Math.random(),
        size: pickBodyStarSize(),
        color,
        period,
        phase: Math.random() * Math.PI * 2,
        glow: Math.random() < 0.22, // ~1 in 5 gets a soft halo
      });
      index += 1;
    }
  }
}

function drawBgStarfield(t) {
  if (!bgCtx) return;
  bgCtx.clearRect(0, 0, bgW, bgH);
  if (bgNebula) bgCtx.drawImage(bgNebula, 0, 0, bgW, bgH);
  for (const s of bgStars) {
    // Twinkle: alpha breathes between 0.2 and 1 over the star's period.
    const tw = 0.2 + 0.8 * (Math.sin((t / s.period) * Math.PI * 2 + s.phase) * 0.5 + 0.5);
    const x = s.xf * bgW;
    const y = s.yf * bgH;
    if (s.glow) {
      const sprite = glowSprite(s.color);
      const d = s.size * 9;
      bgCtx.globalAlpha = tw * 0.5;
      bgCtx.drawImage(sprite, x - d / 2, y - d / 2, d, d);
    }
    bgCtx.globalAlpha = tw;
    bgCtx.fillStyle = s.color;
    bgCtx.beginPath();
    bgCtx.arc(x, y, s.size, 0, Math.PI * 2);
    bgCtx.fill();
  }
  bgCtx.globalAlpha = 1;
  requestAnimationFrame(drawBgStarfield);
}

function pickBodyStarSize() {
  const { min, max } = bodyStarConfig.starSize;
  return Math.round(min + Math.random() * (max - min));
}

// Rebuild the star field from config (re-randomises positions).
function initBodyStarfield() {
  buildBgStars();
}

// Boot the background galaxy: size the canvas, build stars, start its own
// lightweight render loop, and re-bake on resize (positions are fractional).
if (bgCtx) {
  resizeBgStarfield();
  initBodyStarfield();
  window.addEventListener("resize", resizeBgStarfield);
  requestAnimationFrame(drawBgStarfield);
} else {
  initBodyStarfield();
}

/* ── CANVAS ──────────────────────────────────────────────────────────── */
const canvas = document.getElementById("game-canvas");
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext("2d");

const nxtCanvas = document.getElementById("next-canvas");
const nxtCtx = nxtCanvas.getContext("2d");

// Cached playfield background gradient. Same radial palette as the
// difficulty picker (style.css #difficulty-overlay) so the canvas reads as
// the same space as the picker, just with the planets dropped in.
const playfieldGradient = ctx.createRadialGradient(
  W / 2,
  H * 0.35,
  0,
  W / 2,
  H * 0.35,
  Math.max(W, H),
);
playfieldGradient.addColorStop(0, "#3a5680");
playfieldGradient.addColorStop(0.65, "#1a2540");
playfieldGradient.addColorStop(1, "#0a1020");

// Pre-generated starfield drawn behind everything. Each star has its own
// position, peak brightness, twinkle speed and phase, so the field reads
// as a parallax sky rather than a synchronised flicker. Generated once;
// stars don't move, only their alpha breathes.
const STAR_COUNT = 70;
const stars = Array.from({ length: STAR_COUNT }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  size: 0.6 + Math.random() * 1.4,
  baseAlpha: 0.25 + Math.random() * 0.55,
  speed: 0.0008 + Math.random() * 0.0035,
  phase: Math.random() * Math.PI * 2,
}));

/* ── AUDIO ───────────────────────────────────────────────────────────────
   Small pool of Audio clones for the pop so cascading merges can overlap
   without each new pop cutting off the previous one (single Audio.play()
   restarts mid-clip). Laser and target-lock fire one at a time, so a
   single Audio instance each is enough. */
const SOUNDS_DIR = "assets/sounds";

/* Global mute, toggled in Settings (persisted). Checked by every play path. */
const SOUND_KEY = "pm_sound";
let soundOn = (() => {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
})();

function makePool(file, size, volume) {
  const pool = Array.from({ length: size }, () => {
    const a = new Audio(`${SOUNDS_DIR}/${file}`);
    a.preload = "auto";
    a.volume = volume;
    return a;
  });
  let idx = 0;
  return () => {
    if (!soundOn) return;
    const a = pool[idx];
    idx = (idx + 1) % size;
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  };
}
const playPop = makePool("pop-effect.mp3", 6, 0.55);
const playGroundHit = makePool("ground-hit.mp3", 3, 0.45);
const playPlanetHit = makePool("planet-hit.mp3", 4, 0.35);

function makeSfx(file, volume) {
  const a = new Audio(`${SOUNDS_DIR}/${file}`);
  a.preload = "auto";
  a.volume = volume;
  return a;
}
const laserSfx = makeSfx("laser.mp3", 0.55);
const targetLockSfx = makeSfx("target-lock.mp3", 0.6);
const selectSfx = makeSfx("select-sound.mp3", 0.6);
const perkSfx = makeSfx("peark.mp3", 0.7);
function playOnce(sfx) {
  if (!soundOn) return;
  try {
    sfx.currentTime = 0;
    sfx.play().catch(() => {});
  } catch {}
}
const playLaser = () => playOnce(laserSfx);
const playTargetLock = () => playOnce(targetLockSfx);
const playSelect = () => playOnce(selectSfx);
const playPerk = () => playOnce(perkSfx);

/* ── GAME STATE ──────────────────────────────────────────────────────── */
const mergeQ = []; // { a, b, level } — bodies queued to merge
const vanishQ = []; // { a, b }        — max-level bodies queued to vanish
const mergeSeen = new Set(); // bodyIds already in a queue (prevents duplicates)

const flashes = []; // visual fx: { x, y, t, big }
const popups = []; // score fx:  { x, y, t, text, big }
const unlockGlows = []; // light-blue edge glow on first-creation: { bodyId, t }
const seenLevels = new Set(); // planet levels already created this run (unlock detection)

/* Drop mode for dev panel:
 *   'weighted'  → weighted random across the current difficulty's droppables
 *   'random'    → uniform random across ALL 12 planets
 *   <number>    → specific level index, always drops that planet
 */
let dropMode = "weighted";

/* ── DIFFICULTY ──────────────────────────────────────────────────────────
   Three modes picked from a startup overlay:
     - easy:   Stars excluded, Venus added to the drop pool.
     - normal: default mix from config.js.
     - hard:   default mix, but the chain-based superpowers never grant.
   `difficulty === null` keeps physics paused so nothing happens behind the
   picker. */
let difficulty = null;
let droppableLvls = [];
let dropTable = [];
let dropTotal = 0;

/* ── MODE PROGRESSION ─────────────────────────────────────────────────────
   Modes unlock in order: easy is always playable, normal unlocks when easy is
   "cleared" (two Suns vanish into each other), hard unlocks when normal is
   cleared. Unlock state persists in localStorage so it survives reloads. */
const MODE_ORDER = ["easy", "normal", "hard"];
const UNLOCK_KEY = "pm_unlocked_modes";

function loadUnlocks() {
  // easy is always available even if storage is empty or unavailable.
  const set = new Set(["easy"]);
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (raw) JSON.parse(raw).forEach((m) => set.add(m));
  } catch (_) {}
  return set;
}

let unlockedModes = loadUnlocks();

function saveUnlocks() {
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify([...unlockedModes]));
  } catch (_) {}
}

const isUnlocked = (diff) => unlockedModes.has(diff);
const capMode = (diff) => diff.charAt(0).toUpperCase() + diff.slice(1);

function rebuildDropTable() {
  dropTable.length = 0;
  dropTotal = 0;
  if (difficulty === "easy") {
    // Moon, Pluto, Mercury, Mars, Venus. Venus is the new top droppable on
    // easy so chains can build into Earth/Uranus territory without grinding
    // through a Star floor.
    droppableLvls = [1, 2, 3, 4, 5];
    dropTable.push(
      { lvl: 1, w: 4 },
      { lvl: 2, w: 3 },
      { lvl: 3, w: 2 },
      { lvl: 4, w: 3 },
      { lvl: 5, w: 2 },
    );
  } else {
    droppableLvls = SHAPES.map((s, i) => (s.droppable ? i : -1)).filter(
      (i) => i >= 0,
    );
    SHAPES.forEach((s, i) => {
      if (s.droppable && s.dropRate > 0) {
        dropTable.push({ lvl: i, w: s.dropRate });
      }
    });
  }
  for (const e of dropTable) dropTotal += e.w;
}
rebuildDropTable();

function pickLvl() {
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

// First drop of each game opens with the two smallest droppables, so the
// player isn't handed a Mercury (or a Mars on easy) from cold.
function firstDrop() {
  if (dropMode !== "weighted") return pickLvl();
  if (difficulty === "easy") return Math.random() < 0.5 ? 1 : 2; // Moon or Pluto
  return Math.random() < 0.5 ? 0 : 1; // Star or Moon
}

let score = 0;
let curLvl = firstDrop(); // shape currently waiting to drop
let nxtLvl = pickLvl(); // shape shown in the NEXT preview
let dropX = W / 2; // x position of the drop crosshair
let canDrop = true;

/* ── PER-DROP CHAIN + SUPER-POWERS ──────────────────────────────────────
   `chainCount` counts merges that come from ONE drop's cascade. It resets
   at the start of every drop — there's no time window, no slow accumulation
   across drops. Big chains are pure skill rewards.
     - CHOOSE_UNLOCK merges in one chain → 1 "pick your next planet" charge
       (consumed on the next drop)
     - DESTROY_UNLOCK merges in one chain → 1 "wipe a planet type" charge
       (consumed when the player clicks a target on the board)
   Earned charges persist across drops until spent. */
const CHOOSE_UNLOCK = 3;
const DESTROY_UNLOCK = 5;

let chainCount = 0;
let powerCharges = 0;
let destroyCharges = 0;

let cooldown = 0; // ms remaining before next drop is allowed
let totalMs = 0; // total elapsed ms (frozen when game is over)
let gameOver = false;
let lastTs = 0;

/* ── WIN / MODE-CLEAR ANIMATION ─────────────────────────────────────────────
   When two Suns vanish into each other the round is "cleared". A white circle
   grows from the merge point until it fills the canvas, holds as a white
   screen, then an "unlocked" popup appears. Timed with wall-clock ms because
   physics (and totalMs) freeze while the animation plays. */
const WIN_GROW_MS = 700; // circle expands from the merge point
const WIN_HOLD_MS = 1500; // full white screen before the popup
let winActive = false;
let winWipeStarted = false; // the white wipe only draws once perk toasts finish
let startWipeAfterPerks = false; // win landed while a perk toast was still playing
let winStartReal = 0;
let winX = 0;
let winY = 0;
let winMaxR = 0;
let winPopupShown = false;
let winMessage = "";

/* ── DEV / AUTO-DROP STATE ──────────────────────────────────────────────── */
let autoDropOn = false;
let autoDropX = 0.5; // 0-1 fraction of playfield width
let simSpeed = 1; // physics time multiplier (1× = normal, 10× = turbo)

// Dev "always armed" toggles. When on, the corresponding power re-arms
// itself after every consumption so the UI stays in its active state and
// can be visually tweaked without grinding chains.
let forceChoose = false;
let forceDestroy = false;

let devDrops = 0;
let devGames = 0;
const devScores = [];

/* ── DOM ─────────────────────────────────────────────────────────────── */
const scoreEl = document.getElementById("score");
const finalEl = document.getElementById("final-score");
const overlayEl = document.getElementById("game-over-overlay");
const restartEl = document.getElementById("restart-btn");
const nextPanel = document.getElementById("next-panel");
const nextLabel = document.getElementById("next-label");
const canvasWrapper = document.getElementById("canvas-wrapper");
const currentPrev = document.getElementById("current-prev");
const currentNext = document.getElementById("current-next");
const destroyOverlay = document.getElementById("destroy-overlay");
const destroyTextEl = document.getElementById("destroy-text");
const destroySkipBtn = document.getElementById("destroy-skip");
const winOverlayEl = document.getElementById("win-overlay");
const winMessageEl = document.getElementById("win-message");
const winContinueEl = document.getElementById("win-continue");
const planetLegendEl = document.getElementById("planet-legend");

/* Build the merge-order legend from SHAPES: smallest → largest, each icon 5%
   bigger than the previous one. Generated (not hardcoded) so it always matches
   the real planet chain. */
/* Casual-face overlay path for a planet that has expressions, or null. Mirrors
   the renderer's filename derivation: drop `.svg` and the `_body` suffix from
   the body asset, then append `_casual.svg`. Used by the static DOM displays
   (legend, perk icons) so they show the same face the canvas draws. */
function casualFaceSrc(lvl) {
  const s = SHAPES[lvl];
  if (!s || !s.expressions || !s.asset) return null;
  const stem = s.asset.replace(/\.svg$/i, "").replace(/_body$/, "");
  return `assets/images/${stem}_casual.svg`;
}

function buildPlanetLegend() {
  if (!planetLegendEl) return;
  const BASE = 22; // px, the smallest planet (first in SHAPES)
  const STEP = 1.05; // each planet 5% larger than the one before it
  SHAPES.forEach((s, i) => {
    const px = Math.round(BASE * Math.pow(STEP, i));
    const item = document.createElement("div");
    item.className = "legend-item";
    item.dataset.lvl = i;

    const icon = document.createElement("div");
    icon.className = "planet-icon";
    icon.style.width = `${px}px`;
    icon.style.height = `${px}px`;

    const img = document.createElement("img");
    img.src = `assets/images/${s.asset}`;
    img.alt = s.name;
    icon.appendChild(img);

    const faceSrc = casualFaceSrc(i);
    if (faceSrc) {
      const face = document.createElement("img");
      face.className = "planet-face";
      face.src = faceSrc;
      face.alt = "";
      icon.appendChild(face);
    }

    item.appendChild(icon);
    planetLegendEl.appendChild(item);
  });
}
buildPlanetLegend();

/* Easy never drops Stars, so its chain effectively starts at the Moon — hide
   the Star from the legend on easy. Other modes show every planet. */
function applyLegendMode(diff) {
  if (!planetLegendEl) return;
  planetLegendEl.querySelectorAll(".legend-item").forEach((item) => {
    const lvl = Number(item.dataset.lvl);
    item.classList.toggle("legend-hidden", diff === "easy" && lvl === 0);
  });
}

// Hidden until a mode is picked (the picker is the first screen).
planetLegendEl?.classList.add("hidden");

/* ── PERKS / ACHIEVEMENTS ────────────────────────────────────────────────
   Collectible goals across three tabs (wins / merges / losing). Earned perks
   persist in localStorage; unlocking one pops a card in the centre that flies
   into the collection card under the merges panel. New perks get added to the
   PERKS list over time. */
const PERK_KEY = "pm_earned_perks";

// Saved in-progress game (board + score + powers). Written by the Save Progress
// button, read by the start screen's Continue button. Separate from unlocks/perks
// so clearing one doesn't touch the other.
const SAVE_KEY = "pm_saved_game";

const PERKS = [
  { id: "win-easy",       tab: "wins",   emoji: "🌙", title: "Easy Cleared",   goal: "Clear Easy mode" },
  { id: "win-normal",     tab: "wins",   emoji: "🔴", title: "Normal Cleared", goal: "Clear Normal mode" },
  { id: "win-hard",       tab: "wins",   emoji: "☀️", title: "Hard Cleared",   goal: "Clear Hard mode" },
  { id: "win-200",        tab: "wins",   emoji: "🏆", title: "Double Century", goal: "Reach 200 merges in one run" },
  { id: "lose-under-100", tab: "losing", emoji: "💥", title: "Quick Exit",     goal: "Lose with under 100 merges" },
  { id: "lose-under-150", tab: "losing", emoji: "⏳", title: "Cut Short",      goal: "Lose with under 150 merges" },
];
// Optional explanation/voice-over clip per planet (file in assets/sounds).
// Earned perks with one show a play/pause button that plays the clip.
const PERK_AUDIO = {
  Moon: "moon-explaing.mp3",
  Venus: "venus-explain.mp3",
  Earth: "earth-explain.mp3",
};

// One "merge up to this planet" perk for every planet that CAN be made by
// merging — i.e. everything except the smallest (Stars), which is the base
// drop. Earned ONLY when the planet is born from a merge (see flushMerges),
// never from dropping one: dropping a Mercury gives nothing, but merging two
// Plutos into a Mercury unlocks it.
SHAPES.forEach((s, i) => {
  if (i === 0) return; // Stars are the base planet; can't be merge-created
  const srcName = SHAPES[i - 1].name;
  const srcPlural = srcName.endsWith("s") ? srcName : `${srcName}s`;
  PERKS.push({
    id: `merge-${i}`,
    tab: "merges",
    img: `assets/images/${s.asset}`,
    title: s.name,
    goal: `Merge two ${srcPlural} into a ${s.name}`,
    audio: PERK_AUDIO[s.name],
    level: i, // drives the merge animation in the unlock toast
  });
});

function loadEarnedPerks() {
  const set = new Set();
  try {
    const raw = localStorage.getItem(PERK_KEY);
    if (raw) JSON.parse(raw).forEach((id) => set.add(id));
  } catch (_) {}
  return set;
}
let earnedPerks = loadEarnedPerks();
function saveEarnedPerks() {
  try {
    localStorage.setItem(PERK_KEY, JSON.stringify([...earnedPerks]));
  } catch (_) {}
}

const perkCardEl = document.getElementById("perk-card");
const perkCountEl = document.getElementById("perk-count");
const perkTotalEl = document.getElementById("perk-total");
const statGamesPlayedEl = document.getElementById("stat-games-played");
const statBestScoreEl = document.getElementById("stat-best-score");
const statTimePlayedEl = document.getElementById("stat-time-played");
const statBestChainEl = document.getElementById("stat-best-chain");
const perksOverlayEl = document.getElementById("perks-overlay");
const perksGridEl = document.getElementById("perks-grid");
const perksCloseEl = document.getElementById("perks-close");
let perksActiveTab = "wins";
let lastEarnedTab = null; // tab of the most recently earned perk; opens the card straight to it

const perksOpen = () => !!perksOverlayEl?.classList.contains("visible");

function perkIconHTML(perk) {
  if (!perk.img) return `<span class="perk-emoji">${perk.emoji || "✦"}</span>`;
  // Merge perks (those with a `level`) are planets, so overlay the casual face
  // on the bare body, same as the legend and the live canvas.
  const faceSrc = Number.isInteger(perk.level) ? casualFaceSrc(perk.level) : null;
  const face = faceSrc ? `<img class="planet-face" src="${faceSrc}" alt="">` : "";
  return `<span class="planet-icon"><img src="${perk.img}" alt="">${face}</span>`;
}

function updatePerkCardUI() {
  if (perkCountEl) perkCountEl.textContent = earnedPerks.size;
  if (perkTotalEl) perkTotalEl.textContent = PERKS.length;
}

/* ── PERSISTENT STATS (shown in the Game Statistic overlay) ──────────────── */
const HIGH_KEY = "pm_high_score";
const GAMES_KEY = "pm_games_played";
const TIME_KEY = "pm_play_time_ms";
const CHAIN_KEY = "pm_best_chain";

function loadNum(key) {
  try {
    const n = parseInt(localStorage.getItem(key) || "0", 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
function saveNum(key, n) {
  try {
    localStorage.setItem(key, String(n));
  } catch {}
}

let highScore = loadNum(HIGH_KEY);
let gamesPlayed = loadNum(GAMES_KEY);
let totalPlayMs = loadNum(TIME_KEY);
let bestChain = loadNum(CHAIN_KEY);

function recordHigh() {
  if (score > highScore) {
    highScore = score;
    saveNum(HIGH_KEY, highScore);
  }
}
function recordBestChain(c) {
  if (c > bestChain) {
    bestChain = c;
    saveNum(CHAIN_KEY, bestChain);
  }
}
function recordGamePlayed() {
  gamesPlayed += 1;
  saveNum(GAMES_KEY, gamesPlayed);
}

// Today's play time (resets at midnight) for the parent-control daily limit.
const TODAY_KEY = "pm_play_today";
function todayStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function loadTodayMs() {
  try {
    const d = JSON.parse(localStorage.getItem(TODAY_KEY) || "{}");
    return d.date === todayStamp() ? Number(d.ms) || 0 : 0;
  } catch {
    return 0;
  }
}
let todayPlayMs = loadTodayMs();
function addTodayMs(ms) {
  todayPlayMs = loadTodayMs() + ms; // reload so a date rollover resets cleanly
  try {
    localStorage.setItem(TODAY_KEY, JSON.stringify({ date: todayStamp(), ms: todayPlayMs }));
  } catch {}
}

// Play-time clock: counts wall-clock time only while a round is active. Banked
// on game end and on leaving (visibilitychange), resumed when the tab returns.
let playClockStart = 0;
function startPlayClock() {
  playClockStart = Date.now();
}
function bankPlayTime() {
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

function updateStatsUI() {
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

/* ── SHAKES meter ─────────────────────────────────────────────────────────
   A bar that fills on merges. +1% per merge; once a per-drop combo reaches 3
   in a row each merge gives +5%, the 5th gives +10%, and every merge after the
   5th gives +5%. It rises like a slow water fill and recolours red → orange →
   yellow → green as it climbs. Resets each new game. */
const shakesFillEl = document.getElementById("shakes-fill");
const shakesValueEl = document.getElementById("shakes-value");
const shakesPanelEl = document.getElementById("shakes-panel");
let shakePct = 0;
let shakeArmed = false; // usable once the meter has filled to 100%
let shakeStreak = 1; // multiplier; clicking again mid-shake ramps it 1.3x
let lastShakeAt = 0;
const SHAKE_WINDOW_MS = 700; // "still shaking" window for the streak
const SHAKE_COST = 5; // % spent per shake-click

function shakeIncrement(chain) {
  if (chain >= 6) return 5;
  if (chain === 5) return 10;
  if (chain >= 3) return 5; // 3 or 4 in a row
  return 1; // 1 or 2
}
function shakeColor(pct) {
  if (pct >= 100) return "#34C77B"; // green, full
  if (pct >= 66) return "#FECA57"; // yellow
  if (pct >= 33) return "#F0883E"; // orange
  return "#E0556B"; // red
}
function updateShakeUI() {
  if (shakesValueEl) shakesValueEl.textContent = `${Math.round(shakePct)}%`;
  if (shakesFillEl) {
    shakesFillEl.style.height = `${shakePct}%`;
    shakesFillEl.style.backgroundColor = shakeColor(shakePct);
  }
  // Arm at full; stay armed until spent to empty, then it must refill.
  if (shakePct >= 100) shakeArmed = true;
  else if (shakePct <= 0) shakeArmed = false;
  if (shakesPanelEl) shakesPanelEl.classList.toggle("armed", shakeArmed);
}
function addShake(amount) {
  if (shakePct >= 100) return;
  shakePct = Math.min(100, shakePct + amount);
  updateShakeUI();
}
function resetShake() {
  shakePct = 0;
  shakeArmed = false;
  shakeStreak = 1;
  updateShakeUI();
}

// Jolt every planet a random direction. The same jolt is divided down by mass
// (shakeMassFalloff), so heavy planets move less. Strength ramps with the streak.
function applyShake(strength) {
  for (const body of Composite.allBodies(world)) {
    if (body.label !== "shape") continue;
    const ang = Math.random() * Math.PI * 2;
    const mag = strength / Math.pow(body.mass || 1, TUNING.shakeMassFalloff);
    Body.setVelocity(body, {
      x: body.velocity.x + Math.cos(ang) * mag,
      y: body.velocity.y + Math.sin(ang) * mag,
    });
    Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.12);
  }
  wakeAllShapes();
}

shakesPanelEl?.addEventListener("click", () => {
  if (!shakeArmed || shakePct < SHAKE_COST) return;
  if (difficulty === null || gameOver || winActive) return;
  const now = performance.now();
  // Click again while it's still shaking → 1.3x stronger; otherwise reset.
  shakeStreak = now - lastShakeAt < SHAKE_WINDOW_MS ? shakeStreak * 1.3 : 1;
  lastShakeAt = now;
  applyShake(TUNING.shakeStrength * shakeStreak);
  shakePct = Math.max(0, shakePct - SHAKE_COST);
  updateShakeUI();
});

updateShakeUI();

// Explanation-clip playback. One clip plays at a time; clicking an audio
// perk (or its button) toggles play/pause.
let perkExplainAudio = null;
let playingPerkId = null;

function stopPerkAudio() {
  if (perkExplainAudio) {
    perkExplainAudio.pause();
    perkExplainAudio = null;
  }
  playingPerkId = null;
}

function togglePerkAudio(perk) {
  if (!perk.audio) return;
  if (playingPerkId === perk.id) {
    stopPerkAudio();
    if (perksOpen()) renderPerksGrid();
    return;
  }
  stopPerkAudio();
  const a = new Audio(`${SOUNDS_DIR}/${perk.audio}`);
  a.volume = 0.9;
  a.addEventListener("ended", () => {
    if (playingPerkId === perk.id) stopPerkAudio();
    if (perksOpen()) renderPerksGrid();
  });
  perkExplainAudio = a;
  playingPerkId = perk.id;
  a.play().catch(() => {});
  if (perksOpen()) renderPerksGrid();
}

function renderPerksGrid() {
  if (!perksGridEl) return;
  perksGridEl.innerHTML = "";
  PERKS.filter((p) => p.tab === perksActiveTab).forEach((perk) => {
    const earned = earnedPerks.has(perk.id);
    const hasAudio = earned && !!perk.audio;
    const tile = document.createElement("div");
    tile.className =
      "perk-tile " + (earned ? "earned" : "locked") + (hasAudio ? " has-audio" : "");
    tile.innerHTML = earned
      ? `<div class="perk-tile-icon">${perkIconHTML(perk)}</div>
         <div class="perk-tile-title">${perk.title}</div>
         <div class="perk-tile-goal">${perk.goal}</div>`
      : `<div class="perk-tile-icon perk-tile-q">?</div>
         <div class="perk-tile-title">???</div>
         <div class="perk-tile-goal">${perk.goal}</div>`;

    if (hasAudio) {
      const playing = playingPerkId === perk.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "perk-audio-btn" + (playing ? " playing" : "");
      btn.setAttribute("aria-label", playing ? "Pause explanation" : "Play explanation");
      btn.textContent = playing ? "⏸" : "▶";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePerkAudio(perk);
      });
      tile.appendChild(btn);
      tile.addEventListener("click", () => togglePerkAudio(perk));
    }

    perksGridEl.appendChild(tile);
  });
}

function setPerksTab(tab) {
  perksActiveTab = tab;
  document
    .querySelectorAll(".perks-tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  renderPerksGrid();
}

// Top-level tab switch in the overlay: "stats" (Game Statistic) vs "perks".
function setMainTab(name) {
  document
    .querySelectorAll(".main-tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.main === name));
  document
    .querySelectorAll(".main-panel")
    .forEach((p) => p.classList.toggle("active", p.dataset.mainPanel === name));
  if (name === "stats") updateStatsUI();
  if (name === "perks") renderPerksGrid();
}

document.querySelectorAll(".main-tab").forEach((t) =>
  t.addEventListener("click", () => setMainTab(t.dataset.main)),
);

/* ── SETTINGS overlay (gear cell in the HUD) ──────────────────────────── */
const settingsBtn = document.getElementById("settings-btn");
const settingsOverlayEl = document.getElementById("settings-overlay");
const settingsCloseEl = document.getElementById("settings-close");

// Sound on/off.
const soundToggle = document.getElementById("sound-toggle");
function renderSoundToggle() {
  if (!soundToggle) return;
  soundToggle.classList.toggle("is-on", soundOn);
  soundToggle.setAttribute("aria-checked", String(soundOn));
}
soundToggle?.addEventListener("click", () => {
  soundOn = !soundOn;
  try {
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  } catch {}
  renderSoundToggle();
  if (soundOn) playSelect(); // tiny confirmation blip
});

// Parent control: a daily play-time limit, protected by an optional 4-digit PIN.
const LIMIT_ON_KEY = "pm_limit_on";
const LIMIT_MIN_KEY = "pm_limit_min";
const PIN_KEY = "pm_parent_pin";
let limitOn = (() => {
  try {
    return localStorage.getItem(LIMIT_ON_KEY) === "1";
  } catch {
    return false;
  }
})();
let limitMin = loadNum(LIMIT_MIN_KEY) || 30;
let parentPin = (() => {
  try {
    return localStorage.getItem(PIN_KEY) || "";
  } catch {
    return "";
  }
})();
let parentUnlocked = !parentPin; // no PIN means the controls are open

const limitToggle = document.getElementById("limit-toggle");
const limitMinutes = document.getElementById("limit-minutes");
const pinStatus = document.getElementById("pin-status");
const pinBtn = document.getElementById("pin-btn");

function renderParentControls() {
  if (limitToggle) {
    limitToggle.classList.toggle("is-on", limitOn);
    limitToggle.setAttribute("aria-checked", String(limitOn));
    limitToggle.disabled = !parentUnlocked;
  }
  if (limitMinutes) {
    limitMinutes.value = String(limitMin);
    limitMinutes.disabled = !parentUnlocked;
  }
  if (pinStatus) pinStatus.textContent = parentPin ? "Parent PIN set" : "No parent PIN set";
  if (pinBtn) pinBtn.textContent = !parentPin ? "Set PIN" : parentUnlocked ? "Lock" : "Unlock";
}

// Demand the PIN before changing anything, if one is set.
function ensureUnlocked() {
  if (parentUnlocked) return true;
  const entry = prompt("Enter the 4-digit parent PIN");
  if (entry === parentPin) {
    parentUnlocked = true;
    renderParentControls();
    return true;
  }
  if (entry !== null) alert("Wrong PIN.");
  return false;
}

limitToggle?.addEventListener("click", () => {
  if (!ensureUnlocked()) return;
  limitOn = !limitOn;
  try {
    localStorage.setItem(LIMIT_ON_KEY, limitOn ? "1" : "0");
  } catch {}
  renderParentControls();
});
limitMinutes?.addEventListener("change", () => {
  if (!parentUnlocked) {
    renderParentControls();
    return;
  }
  limitMin = Math.min(600, Math.max(5, parseInt(limitMinutes.value, 10) || 30));
  saveNum(LIMIT_MIN_KEY, limitMin);
  renderParentControls();
});
pinBtn?.addEventListener("click", () => {
  if (!parentPin) {
    const p = prompt("Set a 4-digit parent PIN");
    if (p && /^\d{4}$/.test(p)) {
      parentPin = p;
      parentUnlocked = true;
      try {
        localStorage.setItem(PIN_KEY, p);
      } catch {}
    } else if (p !== null) {
      alert("PIN must be exactly 4 digits.");
    }
  } else if (parentUnlocked) {
    parentUnlocked = false; // lock again
  } else {
    ensureUnlocked();
  }
  renderParentControls();
});

// Daily-limit enforcement: blocks STARTING a new round once today's play time is
// up (an in-progress round is never cut off). Checked in startGame.
const limitMsgEl = document.getElementById("limit-msg");
function dailyLimitReached() {
  return limitOn && limitMin > 0 && loadTodayMs() >= limitMin * 60000;
}
function showLimitMsg(show) {
  if (limitMsgEl) limitMsgEl.hidden = !show;
}

settingsBtn?.addEventListener("click", () => {
  updateStatsUI();
  renderSoundToggle();
  renderParentControls();
  settingsOverlayEl?.classList.add("visible");
});
settingsCloseEl?.addEventListener("click", () =>
  settingsOverlayEl?.classList.remove("visible"),
);

perkCardEl?.addEventListener("click", () => {
  // The in-game perk card jumps straight to the Perks tab, on the sub-tab of
  // the most recently earned perk so a fresh unlock isn't buried.
  setMainTab("perks");
  setPerksTab(lastEarnedTab || perksActiveTab);
  perksOverlayEl.classList.add("visible");
});
perksCloseEl?.addEventListener("click", () => {
  perksOverlayEl.classList.remove("visible");
  stopPerkAudio(); // don't keep a clip playing once the overlay is closed
});
document.querySelectorAll(".perks-tab").forEach((t) =>
  t.addEventListener("click", () => {
    stopPerkAudio();
    setPerksTab(t.dataset.tab);
  }),
);

/* Earn + the "card flies into the collection" toast (queued so simultaneous
   unlocks play one after another instead of stacking). */
const perkToastQueue = [];
let perkToastPlaying = false;

function earnPerk(id) {
  if (earnedPerks.has(id)) return;
  const perk = PERKS.find((p) => p.id === id);
  if (!perk) return; // ignore ids that aren't real perks (e.g. droppable planets)
  earnedPerks.add(id);
  lastEarnedTab = perk.tab; // so opening the card lands on this perk's tab
  saveEarnedPerks();
  updatePerkCardUI();
  if (perksOpen()) setPerksTab(perk.tab); // already open → jump to the new perk
  playPerk();
  perkToastQueue.push(perk);
  if (!perkToastPlaying) playNextPerkToast();
}

function playNextPerkToast() {
  if (!perkToastQueue.length) {
    perkToastPlaying = false;
    // A win that landed mid-toast waited for the queue: start its wipe now, so
    // the celebration only covers the screen after every achievement has shown.
    if (startWipeAfterPerks) {
      startWipeAfterPerks = false;
      beginWinWipe();
    }
    return;
  }
  perkToastPlaying = true;
  animatePerkEarn(perkToastQueue.shift(), playNextPerkToast);
}

function animatePerkEarn(perk, done) {
  if (!perkCardEl) {
    done();
    return;
  }
  const toast = document.createElement("div");
  // Merge perks (those with a `level`) play a mini "two planets merge → result"
  // clip so a kid sees exactly how the planet was made. ~1s: ~0.5s the two
  // smaller planets fly together and pop, ~0.5s the merged planet rises up.
  const isMerge = Number.isInteger(perk.level) && perk.level > 0;
  if (isMerge) {
    const srcImg = `assets/images/${SHAPES[perk.level - 1].asset}`;
    // Casual faces ride on top of each body, sharing the same animation class
    // so they fly and pop in lock-step with the planet underneath them.
    const srcFace = casualFaceSrc(perk.level - 1);
    const resFace = casualFaceSrc(perk.level);
    const faceImg = (cls, src) =>
      src ? `<img class="${cls}" src="${src}" alt="">` : "";
    toast.className = "perk-toast merge";
    toast.innerHTML = `
      <div class="perk-toast-badge">Perk unlocked!</div>
      <div class="perk-merge-stage">
        <img class="pm-src pm-src-l" src="${srcImg}" alt="">
        ${faceImg("pm-src pm-src-l", srcFace)}
        <img class="pm-src pm-src-r" src="${srcImg}" alt="">
        ${faceImg("pm-src pm-src-r", srcFace)}
        <img class="pm-result" src="${perk.img}" alt="">
        ${faceImg("pm-result", resFace)}
      </div>
      <div class="perk-toast-title">${perk.title}</div>`;
  } else {
    toast.className = "perk-toast";
    toast.innerHTML = `
      <div class="perk-toast-badge">Perk unlocked!</div>
      <div class="perk-toast-icon">${perkIconHTML(perk)}</div>
      <div class="perk-toast-title">${perk.title}</div>`;
  }
  document.body.appendChild(toast);

  // Pop in at centre.
  requestAnimationFrame(() => toast.classList.add("show"));

  // Hold long enough for the merge clip to finish, then fly into the
  // collection card under the merges panel.
  const flyDelay = isMerge ? 1450 : 1050;
  setTimeout(() => {
    const card = perkCardEl.getBoundingClientRect();
    const dx = card.left + card.width / 2 - window.innerWidth / 2;
    const dy = card.top + card.height / 2 - window.innerHeight / 2;
    toast.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.12)`;
    toast.style.opacity = "0";
    toast.classList.add("fly");
  }, flyDelay);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    toast.remove();
    perkCardEl.classList.remove("pulse");
    void perkCardEl.offsetWidth; // restart the pulse animation
    perkCardEl.classList.add("pulse");
    done();
  };
  toast.addEventListener("transitionend", (e) => {
    if (e.propertyName === "transform" && toast.classList.contains("fly")) {
      finish();
    }
  });
  setTimeout(finish, 2400); // safety net if transitionend never fires
}

updatePerkCardUI();

/* dev panel elements */
const devPanelEl = document.getElementById("dev-panel");
const devToggleEl = document.getElementById("dev-toggle");
const devHandleEl = document.getElementById("dev-drag-handle");
const devBodyEl = document.getElementById("dev-body");
const autoDropBtn = document.getElementById("auto-drop-btn");
const autoSpeedEl = document.getElementById("auto-speed");
const autoSpeedVal = document.getElementById("auto-speed-val");
const autoXEl = document.getElementById("auto-x");
const autoXVal = document.getElementById("auto-x-val");
const dropModeEl = document.getElementById("drop-mode");
const colliderBtn = document.getElementById("collider-btn");
const forceChooseBtn = document.getElementById("force-choose-btn");
const forceDestroyBtn = document.getElementById("force-destroy-btn");
const statDropsEl = document.getElementById("stat-drops");
const statGamesEl = document.getElementById("stat-games");
const statAvgEl = document.getElementById("stat-avg");
const massPowerEl = document.getElementById("mass-power");
const massPowerVal = document.getElementById("mass-power-val");
const impactStrengthEl = document.getElementById("impact-strength");
const impactStrengthVal = document.getElementById("impact-strength-val");
const shakeStrengthEl = document.getElementById("shake-strength");
const shakeStrengthVal = document.getElementById("shake-strength-val");
const shakeFalloffEl = document.getElementById("shake-falloff");
const shakeFalloffVal = document.getElementById("shake-falloff-val");
const physicsResetBtn = document.getElementById("physics-reset-btn");
const physicsApplyJsonBtn = document.getElementById("physics-apply-json-btn");
const physicsConfigJsonEl = document.getElementById("physics-config-json");
const clearSaveBtn = document.getElementById("clear-save-btn");
const clearSaveMsg = document.getElementById("clear-save-msg");

/* ── COLLISION → MERGE / VANISH ──────────────────────────────────────── */
/* IMPACT_KICK shoves both bodies a bit harder along the contact normal when
   they collide fast. Game-feel hack: real momentum transfer from a tiny
   Star onto a heavy Mercury is almost zero, so a stack of planets barely
   reacts to drops. Adding a velocity-scaled kick gives the impact "weight"
   and lets the energy propagate down through stacked planets.
   Strength is live-tunable via the dev "Planet Physics" Impact slider
   (TUNING.impactStrength): 1 = shipping, 0 = vanilla physics, 2 = very arcadey. */
const IMPACT_KICK_MIN_SPEED = 4; // px/tick — ignore gentle resting contacts
const IMPACT_KICK_SPEED_CAP = 20; // px/tick — clamp so terminal-velocity drops don't explode the stack

// Velocity thresholds for impact SFX. Resting contacts and tiny jitters
// would otherwise spam noise. Tuned by feel against the existing kick min.
const GROUND_HIT_MIN_SPEED = 5;
const PLANET_HIT_MIN_SPEED = IMPACT_KICK_MIN_SPEED;

Events.on(engine, "collisionStart", ({ pairs }) => {
  // Compound concave planets (Moon, Saturn, Sun) decompose into many convex
  // sub-parts; each sub-part registers its own pair, so the same logical
  // planet-vs-planet collision fires N times in one tick. Track which
  // parent-pairs we've already kicked this event to apply the impulse once.
  const kickedThisTick = new Set();
  // Cap impact SFX at one per kind per physics tick; a destroy-power wipe or
  // a big cascade fires many collisionStart pairs at once and stacking N
  // copies of the same clip is just noise.
  let playedGroundThisTick = false;
  let playedPlanetThisTick = false;

  for (const pair of pairs) {
    // Compound bodies (from Bodies.fromVertices with concave decomp) report
    // their *sub-parts* in collision events. Walk up to the parent so the
    // bodyLvl lookup hits, otherwise concave planets never merge.
    const bodyA = pair.bodyA.parent;
    const bodyB = pair.bodyB.parent;

    /* --- ground hit: planet first-contacting the floor at speed --- */
    if (!playedGroundThisTick) {
      const aIsFloor = bodyA.label === "floor";
      const bIsFloor = bodyB.label === "floor";
      if (aIsFloor !== bIsFloor) {
        const planet = aIsFloor ? bodyB : bodyA;
        if (
          bodyLvl.has(planet.id) &&
          Math.abs(planet.velocity.y) > GROUND_HIT_MIN_SPEED
        ) {
          playGroundHit();
          playedGroundThisTick = true;
        }
      }
    }

    /* --- impact kick (planet-on-planet only, once per parent-pair) --- */
    const pairKey =
      bodyA.id < bodyB.id
        ? `${bodyA.id}|${bodyB.id}`
        : `${bodyB.id}|${bodyA.id}`;
    if (
      !kickedThisTick.has(pairKey) &&
      !bodyA.isStatic &&
      !bodyB.isStatic &&
      bodyLvl.has(bodyA.id) &&
      bodyLvl.has(bodyB.id)
    ) {
      kickedThisTick.add(pairKey);
      const rvx = bodyB.velocity.x - bodyA.velocity.x;
      const rvy = bodyB.velocity.y - bodyA.velocity.y;
      const speed = Math.hypot(rvx, rvy);
      // Face reaction: a planet hit hard by another flinches, then sulks.
      // The renderer reads body.expr.hitAt to time hurt → sad → casual.
      if (speed > PLANET_HIT_MIN_SPEED) {
        if (SHAPES[bodyLvl.get(bodyA.id)]?.expressions) bodyA.expr = { hitAt: totalMs };
        if (SHAPES[bodyLvl.get(bodyB.id)]?.expressions) bodyB.expr = { hitAt: totalMs };
      }
      // Non-merging planet impact: different sizes touching with real speed.
      // Same-size pairs are filtered out because they'll fire the pop instead
      // via flushMerges (or vanish for max level).
      if (
        !playedPlanetThisTick &&
        speed > PLANET_HIT_MIN_SPEED &&
        bodyLvl.get(bodyA.id) !== bodyLvl.get(bodyB.id)
      ) {
        playPlanetHit();
        playedPlanetThisTick = true;
      }
      if (speed > IMPACT_KICK_MIN_SPEED) {
        const n = pair.collision.normal; // points from B → A
        const k = Math.min(speed, IMPACT_KICK_SPEED_CAP) * TUNING.impactStrength;
        // Push A along the normal, B opposite — preserves the
        // direction of the original impact, just amplified.
        // sqrt(mass) instead of mass so heavy targets (Mars, Saturn)
        // still feel a real shove when hit by a light Star, without
        // sending the Star itself off the screen.
        const mA = Math.sqrt(bodyA.mass);
        const mB = Math.sqrt(bodyB.mass);
        Body.setVelocity(bodyA, {
          x: bodyA.velocity.x + (n.x * k) / mA,
          y: bodyA.velocity.y + (n.y * k) / mA,
        });
        Body.setVelocity(bodyB, {
          x: bodyB.velocity.x - (n.x * k) / mB,
          y: bodyB.velocity.y - (n.y * k) / mB,
        });
      }
    }

    const la = bodyLvl.get(bodyA.id);
    const lb = bodyLvl.get(bodyB.id);
    if (la === undefined || lb === undefined || la !== lb) continue;
    if (mergeSeen.has(bodyA.id) || mergeSeen.has(bodyB.id)) continue;

    mergeSeen.add(bodyA.id);
    mergeSeen.add(bodyB.id);

    if (la === SHAPES.length - 1) {
      vanishQ.push({ a: bodyA, b: bodyB }); // max level → vanish
    } else {
      mergeQ.push({ a: bodyA, b: bodyB, level: la }); // otherwise → merge up
    }
  }
});

/* ── ANTI-BALANCE: nudge planets off the top of other planets ───────────
   Two circles in vertical contact are at unstable equilibrium — physically
   the top one should always roll off, but Matter.js's friction + sleeping
   happily lets it sit there forever. On every persistent planet-on-planet
   contact whose normal is nearly vertical and where the top body isn't
   already sliding sideways, push the top body a hair toward whichever side
   it's already leaning. */
Events.on(engine, "collisionActive", ({ pairs }) => {
  for (const pair of pairs) {
    const bA = pair.bodyA.parent;
    const bB = pair.bodyB.parent;
    if (!bodyLvl.has(bA.id) || !bodyLvl.has(bB.id)) continue;

    // Near-vertical contact normal → one body is stacked on the other.
    const n = pair.collision.normal;
    if (Math.abs(n.x) > 0.08) continue;

    const top = bA.position.y < bB.position.y ? bA : bB;
    const bot = top === bA ? bB : bA;

    // Already sliding off — let physics take over.
    if (Math.abs(top.velocity.x) > 0.25) continue;

    const dx = top.position.x - bot.position.x;
    const dir =
      Math.abs(dx) < 0.3
        ? Math.random() < 0.5
          ? -1
          : 1 // dead-centre → random side
        : Math.sign(dx); // off-centre → fall toward that side
    if (top.isSleeping) Sleeping.set(top, false);
    Body.setVelocity(top, {
      x: top.velocity.x + dir * 0.15,
      y: top.velocity.y,
    });
  }
});

/**
 * Register one merge against the current drop's chain. Bumps `chainCount`,
 * pushes a sized number popup, and grants a super-power the first time the
 * chain crosses CHOOSE_UNLOCK / DESTROY_UNLOCK. Counter resets on every drop.
 */
function registerChain(x, y) {
  chainCount++;
  recordBestChain(chainCount);
  addShake(shakeIncrement(chainCount));

  if (chainCount < 2) return;

  // Unlock messages fire exactly when their threshold is crossed; otherwise
  // just show the running chain number scaled up. Hard mode disables powers
  // entirely, so its popups stay as plain chain counts.
  const powersEnabled = difficulty !== "hard";
  let text, fontSize, color;
  if (powersEnabled && chainCount === DESTROY_UNLOCK) {
    text = "Destroy Power Unlocked!";
    fontSize = 30;
    color = "#ff6e6e";
  } else if (powersEnabled && chainCount === CHOOSE_UNLOCK) {
    text = "Choose Planet Unlocked!";
    fontSize = 28;
    color = "#7ddfff";
  } else {
    text = String(chainCount);
    fontSize = Math.min(8 + chainCount * 8, 56);
    color = "#FFFFFF";
  }

  popups.push({
    x,
    y: y - 24,
    t: totalMs,
    text,
    fontSize,
    color,
    shadowColor: "rgba(0, 80, 140, 0.85)",
    big: false,
  });

  if (powersEnabled && chainCount === CHOOSE_UNLOCK) {
    powerCharges = 1;
    updatePowerUI();
    playSelect();
  }
  if (powersEnabled && chainCount === DESTROY_UNLOCK) {
    destroyCharges = 1;
    // Destroy supersedes Choose Planet — having both armed at once is
    // confusing (arrows pulse below the line while the destroy prompt also
    // sits there). Drop any pending choose charge when destroy unlocks.
    if (powerCharges > 0) {
      powerCharges = 0;
      updatePowerUI();
    }
    updateDestroyUI();
    playTargetLock();
  }
}

function resetChain() {
  chainCount = 0;
}

function updatePowerUI() {
  const active = powerCharges > 0;
  canvasWrapper.classList.toggle("power-active", active);
}

// Cycles the planet currently waiting to drop. Drawn by the per-frame
// render loop, so no manual redraw needed here.
function cycleCurrent(dir) {
  if (powerCharges <= 0) return;
  const i = droppableLvls.indexOf(curLvl);
  const j = i < 0 ? 0 : (i + dir + droppableLvls.length) % droppableLvls.length;
  curLvl = droppableLvls[j];
}

currentPrev.addEventListener("click", () => cycleCurrent(-1));
currentNext.addEventListener("click", () => cycleCurrent(+1));

/* ── DESTROY POWER ──────────────────────────────────────────────────────
   Unlocked at DESTROY_UNLOCK merges in a streak. Paints a pulsing red
   target on every planet on the board; the next canvas click picks a
   planet, and every body of that same level is destroyed. */

function updateDestroyUI() {
  canvas.classList.toggle("destroy-armed", destroyCharges > 0);
  if (!destroyOverlay) return;
  // Position is fully CSS-driven (static, just below the danger line) so the
  // prompt stays put while the player moves their cursor over the board.
  destroyOverlay.style.display = destroyCharges > 0 ? "flex" : "none";
}

/** Pulsing red crosshair overlay on every destroyable body. Mirrors the
 *  filter in useDestroyPower so the highlighted set matches what's actually
 *  hittable: untargetable big planets get no crosshair. */
function drawDestroyTargets() {
  const pulse = 0.55 + 0.45 * Math.sin(totalMs * 0.008);
  ctx.save();
  ctx.strokeStyle = `rgba(255, 105, 180, ${pulse})`; // pink
  ctx.lineWidth = 9;
  for (const body of Composite.allBodies(world)) {
    if (body.label !== "shape") continue;
    const lvl = bodyLvl.get(body.id);
    if (lvl === undefined) continue;
    if (!droppableLvls.includes(lvl)) continue;
    const rad = r(lvl);
    const x = body.position.x;
    const y = body.position.y;
    ctx.beginPath();
    ctx.arc(x, y, rad * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - rad * 0.75, y);
    ctx.lineTo(x - rad * 0.25, y);
    ctx.moveTo(x + rad * 0.25, y);
    ctx.lineTo(x + rad * 0.75, y);
    ctx.moveTo(x, y - rad * 0.75);
    ctx.lineTo(x, y - rad * 0.25);
    ctx.moveTo(x, y + rad * 0.25);
    ctx.lineTo(x, y + rad * 0.75);
    ctx.stroke();
  }
  ctx.restore();
}

/** Convert a pointer event to canvas-internal coords. */
function canvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (W / rect.width),
    y: (clientY - rect.top) * (H / rect.height),
  };
}

/**
 * Try to spend a destroy charge by clicking on a planet. Returns true if a
 * planet was hit (and destroyed), false if the click missed — caller can then
 * decide whether to fall through to the normal drop action.
 */
function useDestroyPower(clientX, clientY) {
  if (destroyCharges <= 0) return false;
  const { x, y } = canvasCoords(clientX, clientY);
  // Query.point returns the convex sub-parts of compound bodies, so walk
  // up to the parent before reading bodyLvl.
  const hits = Query.point(world.bodies, { x, y });
  let target = null;
  for (const h of hits) {
    const parent = h.parent || h;
    if (parent.label === "shape" && bodyLvl.has(parent.id)) {
      target = parent;
      break;
    }
  }
  if (!target) return false;

  const lvl = bodyLvl.get(target.id);
  // Destroy only works on the same set the player can drop from the top
  // (Stars through Mars on normal/hard; same plus Venus on easy). Bigger
  // planets are merge-only rewards and shouldn't be wipeable.
  if (!droppableLvls.includes(lvl)) return false;

  // Snapshot the body list because despawn() mutates `active` during the loop.
  const victims = Composite.allBodies(world).filter(
    (b) => b.label === "shape" && bodyLvl.get(b.id) === lvl,
  );
  playLaser();
  for (const b of victims) {
    flashes.push({ x: b.position.x, y: b.position.y, t: totalMs, big: false });
    despawn(b);
  }
  // Wake the whole field so planets stacked above the destroyed ones fall.
  wakeAllShapes();
  destroyCharges = 0;
  updateDestroyUI();
  if (forceDestroy) {
    destroyCharges = 1;
    updateDestroyUI();
  }
  return true;
}

function flushMerges() {
  if (!mergeQ.length) return;
  const batch = mergeQ.splice(0);
  for (const { a, b, level } of batch) {
    if (!active.has(a.id) || !active.has(b.id)) continue;
    const mx = (a.position.x + b.position.x) / 2;
    const my = (a.position.y + b.position.y) / 2;
    mergeSeen.delete(a.id);
    mergeSeen.delete(b.id);
    despawn(a);
    despawn(b);
    const newLvl = level + 1;
    const newR = r(newLvl);
    // Wake the whole field so bodies stacked above the merge — even 3+
    // layers up, beyond any local radius — fall when their support goes.
    wakeAllShapes();
    const sy = Math.max(DANGER_Y + newR + 6, my);
    const merged = spawn(mx, sy, newLvl, totalMs);
    Body.setVelocity(merged, { x: 0, y: -3 });
    // Bigger body at the midpoint may intersect a neighbour — push them apart.
    separateOverlapping(merged);
    // Score is just a merge counter now: +1 per merge, regardless of planet.
    score += 1;
    scoreEl.textContent = score;
    recordHigh();
    earnPerk(`merge-${newLvl}`); // first time this planet is created
    if (score >= 200) earnPerk("win-200");
    // New planet unlocked this run → light-blue glow tracing its edges.
    if (!seenLevels.has(newLvl)) {
      seenLevels.add(newLvl);
      unlockGlows.push({ bodyId: merged.id, t: totalMs });
    }
    playPop();
    flashes.push({ x: mx, y: my, t: totalMs, big: false });
    popups.push({
      x: mx,
      y: my,
      t: totalMs,
      text: "+1",
      big: false,
    });
    registerChain(mx, my);
  }
}

function flushVanishes() {
  if (!vanishQ.length) return;
  const batch = vanishQ.splice(0);
  for (const { a, b } of batch) {
    if (!active.has(a.id) || !active.has(b.id)) continue;
    const mx = (a.position.x + b.position.x) / 2;
    const my = (a.position.y + b.position.y) / 2;
    mergeSeen.delete(a.id);
    mergeSeen.delete(b.id);
    despawn(a);
    despawn(b);
    // Two Suns just disappeared — wake the whole field so any stack
    // above the vanish point collapses into the gap.
    wakeAllShapes();
    // Two Suns merging counts as one merge, same as any other.
    score += 1;
    scoreEl.textContent = score;
    recordHigh();
    flashes.push({ x: mx, y: my, t: totalMs, big: true });
    popups.push({ x: mx, y: my, t: totalMs, text: "+1", big: true });
    registerChain(mx, my);
    // Two Suns just vanished → the mode is cleared. Kick off the win wipe.
    startWinSequence(mx, my);
    return;
  }
}

/* ── WIN SEQUENCE ───────────────────────────────────────────────────────── */
function startWinSequence(x, y) {
  if (winActive) return;
  reportGameEnd("won", score, difficulty);
  clearSavedGame(); // won → no resume
  bankPlayTime();
  earnPerk(`win-${difficulty}`); // Easy/Normal/Hard cleared perk
  // Record the unlock now so the popup can announce it and the picker reflects
  // it the moment the player continues.
  const idx = MODE_ORDER.indexOf(difficulty);
  const next = MODE_ORDER[idx + 1];
  if (next && !isUnlocked(next)) {
    unlockedModes.add(next);
    saveUnlocks();
    winMessage = `You have unlocked ${capMode(next)} mode!`;
  } else if (next) {
    winMessage = `${capMode(difficulty)} mode cleared!`;
  } else {
    winMessage = "You cleared Hard mode. You are a Planet Master!";
  }

  winActive = true; // freeze the board + block input immediately
  winPopupShown = false;
  winX = x;
  winY = y;
  // Farthest corner from the merge point — how big the circle must grow to
  // cover the whole canvas.
  winMaxR = Math.max(
    Math.hypot(x, y),
    Math.hypot(W - x, y),
    Math.hypot(x, H - y),
    Math.hypot(W - x, H - y),
  );
  // Let any achievement toasts (the Sun merge perk, then "Mode Cleared") play
  // out one after another BEFORE the white wipe covers the screen. If a toast
  // is mid-flight, defer the wipe until the queue drains (see playNextPerkToast).
  if (perkToastPlaying) startWipeAfterPerks = true;
  else beginWinWipe();
}

function beginWinWipe() {
  winWipeStarted = true;
  winStartReal = performance.now();
}

function drawWinAnimation() {
  const e = performance.now() - winStartReal;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  if (e < WIN_GROW_MS) {
    const t = e / WIN_GROW_MS;
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    ctx.beginPath();
    ctx.arc(winX, winY, winMaxR * eased, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, W, H);
    if (!winPopupShown && e >= WIN_GROW_MS + WIN_HOLD_MS) {
      winPopupShown = true;
      winMessageEl.textContent = winMessage;
      winOverlayEl.classList.add("visible");
    }
  }
  ctx.restore();
}

/* ── DROP ────────────────────────────────────────────────────────────── */
function drop() {
  if (!canDrop || gameOver || winActive || perksOpen()) return;
  // Every drop starts a fresh chain — powers are earned by chains spawned
  // from ONE drop's cascade, never by accumulation across drops.
  resetChain();
  const rad = r(curLvl);
  const minX = WALL + rad + 2;
  const maxX = W - WALL - rad - 2;
  const sx = Math.max(minX, Math.min(maxX, dropX));
  spawn(sx, DROP_Y, curLvl, totalMs);
  // Note: dropping a planet does NOT earn its perk — only merging UP to it
  // does (handled in flushMerges). So a chosen/dropped Mercury grants nothing.
  curLvl = nxtLvl;
  nxtLvl = pickLvl();
  canDrop = false;
  cooldown = 560;
  if (powerCharges > 0) {
    powerCharges--;
    if (powerCharges === 0) updatePowerUI();
  }
  if (forceChoose && powerCharges === 0) {
    powerCharges = 1;
    updatePowerUI();
  }
  drawNext(nxtCtx, nxtCanvas, nxtLvl);
}

/* ── GAME OVER ───────────────────────────────────────────────────────── */
function checkOver() {
  for (const body of Composite.allBodies(world)) {
    if (body.label !== "shape") continue;
    const id = body.id;
    const lvl = bodyLvl.get(id);
    if (lvl === undefined) continue;
    if (totalMs - (bodyBorn.get(id) || 0) < 1600) continue; // grace period
    if (body.position.y < DANGER_Y) {
      endGame();
      return;
    }
  }
}

function endGame() {
  gameOver = true;
  finalEl.textContent = score;
  reportGameEnd("lost", score, difficulty);
  clearSavedGame(); // a finished game shouldn't offer a resume
  bankPlayTime();
  if (score < 100) earnPerk("lose-under-100"); // play the game in reverse
  if (score < 150) earnPerk("lose-under-150");
  overlayEl.classList.add("visible");

  devGames++;
  devScores.push(score);
  statGamesEl.textContent = devGames;
  statAvgEl.textContent = Math.round(
    devScores.reduce((a, b) => a + b, 0) / devScores.length,
  );
}

/* ── GAME LOOP ───────────────────────────────────────────────────────── */
function frame(ts) {
  const dt = Math.min(ts - lastTs, 32);
  lastTs = ts;

  if (!gameOver && difficulty !== null && !winActive) {
    // 2 physics substeps per game tick (8ms each) instead of 1×16ms.
    // The smaller dt keeps fast-moving small bodies (e.g. a falling Star)
    // from tunneling through concave polygon planets (e.g. the Moon).
    for (let s = 0; s < simSpeed * 2; s++) {
      Engine.update(engine, 8);
      totalMs += 8;
      if (cooldown > 0) {
        cooldown -= 8;
        if (cooldown <= 0) canDrop = true;
      }
      flushMerges();
      flushVanishes();
      checkOver();
      if (gameOver) break;

      if (autoDropOn && canDrop) {
        const minX = WALL + r(curLvl) + 2;
        const maxX = W - WALL - r(curLvl) - 2;
        dropX = minX + autoDropX * (maxX - minX);
        drop();
        devDrops++;
        statDropsEl.textContent = devDrops;
      }
    }
  }

  /* Background */
  ctx.fillStyle = playfieldGradient;
  ctx.fillRect(0, 0, W, H);

  /* Twinkling stars (behind everything else, in front of the gradient) */
  ctx.fillStyle = "#fff6d6";
  for (const s of stars) {
    // sin -> [-1, 1] mapped to a soft [0.25, 1] multiplier so stars never
    // fully disappear; the floor keeps the field feeling steady, not strobe-y.
    const tw = 0.25 + 0.75 * (Math.sin(totalMs * s.speed + s.phase) * 0.5 + 0.5);
    ctx.globalAlpha = s.baseAlpha * tw;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* Walls */
  ctx.fillStyle = "#1a2a4a";
  ctx.fillRect(0, 0, WALL, H);
  ctx.fillRect(W - WALL, 0, WALL, H);
  ctx.fillRect(0, H - WALL, W, WALL);



  /* Danger line */
  ctx.save();
  ctx.strokeStyle = "rgba(255,80,80,0.5)";
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(WALL, DANGER_Y);
  ctx.lineTo(W - WALL, DANGER_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  /* Effects → bodies → score popups (draw order matters) */
  drawFlashes(ctx, flashes, totalMs);
  for (const body of Composite.allBodies(world)) {
    if (body.label === "shape") drawBody(ctx, body, bodyLvl, totalMs);
  }
  drawUnlockGlows(
    ctx,
    unlockGlows,
    (id) => Composite.get(world, id, "body"),
    getOutlineSets,
    bodyLvl,
    totalMs,
  );
  if (destroyCharges > 0) drawDestroyTargets();
  drawPopups(ctx, popups, totalMs);

  /* Drop guide + shape waiting to fall (hidden while aiming the destroy power) */
  if (canDrop && !gameOver && destroyCharges === 0) {
    const rad = r(curLvl);
    const minX = WALL + rad + 2;
    const maxX = W - WALL - rad - 2;
    const sx = Math.max(minX, Math.min(maxX, dropX));

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.11)";
    ctx.setLineDash([4, 7]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, DANGER_Y + 2);
    ctx.lineTo(sx, H - WALL);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.88;
    drawPreview(ctx, curLvl, sx, DROP_Y, 0, rad);
    ctx.restore();
  }

  /* Mode-clear wipe sits on top of everything. Held back until the achievement
     toasts have finished playing (winWipeStarted), so it never covers them. */
  if (winWipeStarted) drawWinAnimation();

  requestAnimationFrame(frame);
}

/* ── INPUT ───────────────────────────────────────────────────────────── */
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  dropX = (e.clientX - rect.left) * (W / rect.width);
});

canvas.addEventListener("click", (e) => {
  if (winActive) return;
  // When destroy power is armed, the click selects a target instead of
  // dropping. A missed click is a no-op (don't burn the charge or drop).
  if (destroyCharges > 0) {
    useDestroyPower(e.clientX, e.clientY);
    return;
  }
  drop();
});

// Snap the drop point to wherever the finger first lands, so a plain tap on
// the right drops on the right without needing to drag the crosshair over.
// touchmove then keeps following if the finger slides. Mouse already does this
// via mousemove tracking the cursor before every click.
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    dropX = (e.touches[0].clientX - rect.left) * (W / rect.width);
  },
  { passive: false },
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    dropX = (e.touches[0].clientX - rect.left) * (W / rect.width);
  },
  { passive: false },
);

canvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    if (destroyCharges > 0) {
      const t = e.changedTouches[0];
      if (t) useDestroyPower(t.clientX, t.clientY);
      return;
    }
    drop();
  },
  { passive: false },
);

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    drop();
  }
});

if (destroySkipBtn) {
  destroySkipBtn.addEventListener("click", () => {
    destroyCharges = 0;
    updateDestroyUI();
    if (forceDestroy) {
      destroyCharges = 1;
      updateDestroyUI();
    }
  });
}

/* ── DIFFICULTY / RESTART ───────────────────────────────────────────────
   `resetGameState` is shared between Play Again (same difficulty) and the
   first start after a difficulty pick. `startGame(diff)` sets difficulty,
   rebuilds the drop table, then resets state. `showDifficultyPicker` wipes
   the board and reopens the overlay so the player can change modes. */
const difficultyOverlayEl = document.getElementById("difficulty-overlay");
const changeDifficultyEl = document.getElementById("change-difficulty-btn");

function resetGameState() {
  Composite.allBodies(world)
    .filter((b) => b.label === "shape")
    .forEach((b) => World.remove(world, b));

  bodyLvl.clear();
  bodyBorn.clear();
  active.clear();
  mergeQ.length = 0;
  vanishQ.length = 0;
  mergeSeen.clear();
  flashes.length = 0;
  popups.length = 0;
  unlockGlows.length = 0;
  seenLevels.clear();

  score = 0;
  scoreEl.textContent = "0";
  resetShake();
  curLvl = firstDrop();
  nxtLvl = pickLvl();
  dropX = W / 2;
  canDrop = true;
  cooldown = 0;
  totalMs = 0;
  gameOver = false;
  devDrops = 0;
  statDropsEl.textContent = "0";
  clearWinState();

  resetChain();
  // Hard disables powers entirely. Other modes honour the dev-panel force-on
  // toggles so testers can keep a charge primed.
  const allowPowers = difficulty !== "hard";
  powerCharges = allowPowers && forceChoose ? 1 : 0;
  destroyCharges = allowPowers && forceDestroy ? 1 : 0;
  updatePowerUI();
  updateDestroyUI();

  overlayEl.classList.remove("visible");
  drawNext(nxtCtx, nxtCanvas, nxtLvl);
}

function clearWinState() {
  winActive = false;
  winWipeStarted = false;
  startWipeAfterPerks = false;
  winPopupShown = false;
  winOverlayEl.classList.remove("visible");
}

/* Reflect unlock state on the picker: locked modes get the `.locked` class
   (greyed + lock icon) and a hint pointing at the mode that gates them. */
function refreshDifficultyLocks() {
  document.querySelectorAll(".diff-btn").forEach((btn) => {
    const diff = btn.dataset.diff;
    const unlocked = isUnlocked(diff);
    btn.classList.toggle("locked", !unlocked);
    btn.disabled = !unlocked;
    const hint = btn.querySelector(".diff-lock-hint");
    if (hint && !unlocked) {
      const prev = MODE_ORDER[MODE_ORDER.indexOf(diff) - 1];
      hint.textContent = prev ? `Finish ${capMode(prev)} to unlock` : "Locked";
    }
  });
}

function startGame(diff) {
  if (!isUnlocked(diff)) return;
  if (dailyLimitReached()) {
    showLimitMsg(true);
    return;
  }
  showLimitMsg(false);
  clearWinState();
  difficulty = diff;
  reportGameStart(diff);
  recordGamePlayed();
  startPlayClock();
  rebuildDropTable();
  resetGameState();
  applyLegendMode(diff);
  planetLegendEl?.classList.remove("hidden");
  difficultyOverlayEl.classList.remove("visible");
}

// Anonymous play analytics (see analytics.js). reportOpen counts loads; the
// visibility handler records the score a player leaves off at if they quit
// mid-round. Reads live game state so the snapshot is always current.
reportOpen();
initAnalytics(() => ({
  active: difficulty !== null && !gameOver,
  score,
  mode: difficulty,
}));

// Lobby "Game Statistic" button opens the overlay on the stats tab.
const gameStatBtn = document.getElementById("game-stat-btn");
gameStatBtn?.addEventListener("click", () => {
  setMainTab("stats");
  perksOverlayEl.classList.add("visible");
});

function showDifficultyPicker() {
  // Wipe the board so nothing animates behind the overlay between rounds.
  Composite.allBodies(world)
    .filter((b) => b.label === "shape")
    .forEach((b) => World.remove(world, b));
  bodyLvl.clear();
  bodyBorn.clear();
  active.clear();
  mergeQ.length = 0;
  vanishQ.length = 0;
  mergeSeen.clear();
  flashes.length = 0;
  popups.length = 0;
  unlockGlows.length = 0;
  seenLevels.clear();

  difficulty = null;
  gameOver = false;
  clearWinState();
  refreshDifficultyLocks();
  checkResume();
  planetLegendEl?.classList.add("hidden");
  overlayEl.classList.remove("visible");
  difficultyOverlayEl.classList.add("visible");
}

restartEl.addEventListener("click", () => {
  if (difficulty === null) {
    // Edge case: clicking Play Again before ever picking a mode just reopens
    // the picker rather than starting an undefined-difficulty round.
    showDifficultyPicker();
    return;
  }
  resetGameState();
});

changeDifficultyEl.addEventListener("click", showDifficultyPicker);

document.querySelectorAll(".diff-btn").forEach((btn) => {
  // Hover plays the planet-hit thud, click plays the merge pop. First hover
  // before any user gesture may be silently blocked by the browser's
  // autoplay policy; subsequent hovers (and the click itself) always play.
  btn.addEventListener("mouseenter", () => {
    if (!btn.classList.contains("locked")) playPlanetHit();
  });
  btn.addEventListener("click", () => {
    const d = btn.dataset.diff;
    if (!isUnlocked(d)) return; // locked modes are inert
    playPop();
    if (d === "easy" || d === "normal" || d === "hard") startGame(d);
  });
});

// Continue from the mode-clear popup → reopen the picker so the player sees
// (and can jump straight into) the freshly unlocked mode.
winContinueEl.addEventListener("click", () => {
  playPop();
  clearWinState();
  showDifficultyPicker();
});

// Reflect any persisted unlocks on the picker that's already on screen at load.
refreshDifficultyLocks();

/* ── SAVE / CONTINUE ─────────────────────────────────────────────────────
   Snapshot the live game (difficulty, score, powers, the current/next planet,
   and every body's level + position + angle + velocity) into localStorage so
   the player can close the tab and resume later. The Save Progress button
   writes; the start screen's Continue button reads. Saving is non-destructive:
   the snapshot stays until the player saves again or clears storage, so they
   can keep playing after a save and still resume that point later. */
const resumeOverlayEl = document.getElementById("resume-overlay");
const resumeContinueBtn = document.getElementById("resume-continue");
const resumeNewBtn = document.getElementById("resume-new");

function snapshotBodies() {
  const out = [];
  for (const body of Composite.allBodies(world)) {
    if (body.label !== "shape") continue;
    const lvl = bodyLvl.get(body.id);
    if (lvl === undefined) continue;
    out.push({
      lvl,
      x: body.position.x,
      y: body.position.y,
      angle: body.angle,
      vx: body.velocity.x,
      vy: body.velocity.y,
      av: body.angularVelocity,
    });
  }
  return out;
}

// Silent auto-save. Called when the player leaves mid-game; there is no manual
// save button. Skips when there's nothing meaningful to save (no mode picked,
// after a loss, or mid win-wipe).
function saveGame() {
  if (difficulty === null || gameOver || winActive) return;
  const data = {
    v: 1,
    difficulty,
    score,
    curLvl,
    nxtLvl,
    powerCharges,
    destroyCharges,
    seenLevels: [...seenLevels],
    bodies: snapshotBodies(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (_) {}
}

function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.bodies) || !d.difficulty) return null;
    return d;
  } catch (_) {
    return null;
  }
}

function clearSavedGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (_) {}
}

// Show the resume popup over the picker when a saved (auto-saved) game exists.
function checkResume() {
  if (!resumeOverlayEl) return;
  const saved = loadSavedGame();
  if (saved && isUnlocked(saved.difficulty)) {
    resumeOverlayEl.classList.add("visible");
  } else {
    resumeOverlayEl.classList.remove("visible");
  }
}

function restoreGame(data) {
  clearWinState();
  difficulty = data.difficulty;
  rebuildDropTable();

  // Wipe the current board + all transient state, same teardown resetGameState
  // does, then rebuild from the snapshot instead of starting fresh.
  Composite.allBodies(world)
    .filter((b) => b.label === "shape")
    .forEach((b) => World.remove(world, b));
  bodyLvl.clear();
  bodyBorn.clear();
  active.clear();
  mergeQ.length = 0;
  vanishQ.length = 0;
  mergeSeen.clear();
  flashes.length = 0;
  popups.length = 0;
  unlockGlows.length = 0;
  seenLevels.clear();

  score = data.score || 0;
  scoreEl.textContent = score;
  resetShake();
  curLvl = data.curLvl ?? firstDrop();
  nxtLvl = data.nxtLvl ?? pickLvl();
  dropX = W / 2;
  canDrop = true;
  cooldown = 0;
  totalMs = 0;
  gameOver = false;
  devDrops = 0;
  statDropsEl.textContent = "0";
  resetChain();
  (data.seenLevels || []).forEach((l) => seenLevels.add(l));

  // Re-create each saved planet with its exact position, facing, and motion.
  // spawn() sets a default angle/velocity, so override both afterwards. Born
  // at totalMs 0 → every restored body gets the normal 1.6s grace before the
  // danger-line check can fire, so resuming never instantly ends the game.
  for (const b of data.bodies) {
    const body = spawn(b.x, b.y, b.lvl, 0);
    Body.setAngle(body, b.angle || 0);
    Body.setVelocity(body, { x: b.vx || 0, y: b.vy || 0 });
    Body.setAngularVelocity(body, b.av || 0);
  }
  wakeAllShapes();

  // Hard mode never grants powers; otherwise restore the saved charges.
  const allowPowers = difficulty !== "hard";
  powerCharges = allowPowers ? data.powerCharges || 0 : 0;
  destroyCharges = allowPowers ? data.destroyCharges || 0 : 0;
  updatePowerUI();
  updateDestroyUI();

  applyLegendMode(difficulty);
  planetLegendEl?.classList.remove("hidden");
  overlayEl.classList.remove("visible");
  difficultyOverlayEl.classList.remove("visible");
  drawNext(nxtCtx, nxtCanvas, nxtLvl);
  startPlayClock();
}

// Auto-save + bank play time when the player leaves mid-game (tab close, app
// switch, screen lock); resume the clock when the tab returns to an active game.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    bankPlayTime();
    saveGame();
  } else if (difficulty !== null && !gameOver && !winActive) {
    startPlayClock();
  }
});

resumeContinueBtn?.addEventListener("click", () => {
  const saved = loadSavedGame();
  resumeOverlayEl?.classList.remove("visible");
  if (!saved) return;
  playPop();
  restoreGame(saved);
  // One-time resume: consume the save so the player can't keep rewinding to the
  // same point. Leaving again mid-game writes a fresh save.
  clearSavedGame();
});

resumeNewBtn?.addEventListener("click", () => {
  // Discard the saved game and reveal the picker that's already behind the popup.
  playPop();
  resumeOverlayEl?.classList.remove("visible");
  clearSavedGame();
});

// Show the resume popup over the picker if a saved game exists at load.
checkResume();

/* ── FULLSCREEN ─────────────────────────────────────────────────────────
   Requests fullscreen on the documentElement so the entire game body goes
   edge-to-edge (canvas + side panels). The host iframe is allowed
   fullscreen via GameEmbed.tsx's `allow="fullscreen"`. The fullscreenchange
   listener keeps the button icon and body class in sync even when the
   user exits via Escape rather than the button. */
const fullscreenBtn = document.getElementById("fullscreen-btn");

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

fullscreenBtn.addEventListener("click", () => {
  if (isFullscreen()) {
    (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.())?.catch?.(
      () => {},
    );
  } else {
    const el = document.documentElement;
    (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())?.catch?.(
      () => {},
    );
  }
});

function syncFullscreenState() {
  const fs = isFullscreen();
  fullscreenBtn.classList.toggle("is-fullscreen", fs);
  document.body.classList.toggle("fullscreen", fs);
}
document.addEventListener("fullscreenchange", syncFullscreenState);
document.addEventListener("webkitfullscreenchange", syncFullscreenState);

/* ── HOW-TO-PLAY POPOUT ─────────────────────────────────────────────────
   Toggle the bottom-right how-to panel. Closes on a click outside the popout
   or on Escape so it never lingers over the playfield. */
const howtoBtn = document.getElementById("howto-btn");
const howtoPanel = document.getElementById("howto-panel");

function setHowtoOpen(open) {
  if (!howtoBtn || !howtoPanel) return;
  howtoPanel.hidden = !open;
  howtoBtn.setAttribute("aria-expanded", String(open));
}

howtoBtn?.addEventListener("click", (e) => {
  e.stopPropagation(); // don't let the document handler immediately re-close it
  setHowtoOpen(howtoPanel.hidden);
});

document.addEventListener("click", (e) => {
  if (howtoPanel && !howtoPanel.hidden && !e.target.closest("#howto-popout")) {
    setHowtoOpen(false);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setHowtoOpen(false);
});

/* ── DEV PANEL CONTROLS ──────────────────────────────────────────────── */
// The ⚙ DEV button only opens/closes. Dragging is on the separate grip
// handle (#dev-drag-handle) so the two actions never fight each other.
devToggleEl.addEventListener("click", () => {
  const open = devBodyEl.classList.toggle("open");
  devToggleEl.classList.toggle("open", open);
});

let devDrag = null;

function clampDevPanelPosition(x, y) {
  const rect = devPanelEl.getBoundingClientRect();
  return {
    x: Math.min(window.innerWidth - rect.width - 8, Math.max(8, x)),
    y: Math.min(window.innerHeight - rect.height - 8, Math.max(8, y)),
  };
}

function setDevPanelPosition(x, y) {
  const pos = clampDevPanelPosition(x, y);
  devPanelEl.style.left = `${pos.x}px`;
  devPanelEl.style.top = `${pos.y}px`;
  devPanelEl.style.right = "auto";
  devPanelEl.style.bottom = "auto";
}

devHandleEl.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const rect = devPanelEl.getBoundingClientRect();
  devDrag = {
    pointerId: e.pointerId,
    dx: e.clientX - rect.left,
    dy: e.clientY - rect.top,
  };
  devHandleEl.setPointerCapture(e.pointerId);
});

devHandleEl.addEventListener("pointermove", (e) => {
  if (!devDrag || devDrag.pointerId !== e.pointerId) return;
  setDevPanelPosition(e.clientX - devDrag.dx, e.clientY - devDrag.dy);
});

devHandleEl.addEventListener("pointerup", (e) => {
  if (!devDrag || devDrag.pointerId !== e.pointerId) return;
  devDrag = null;
});

window.addEventListener("resize", () => {
  const rect = devPanelEl.getBoundingClientRect();
  setDevPanelPosition(rect.left, rect.top);
});

autoDropBtn.addEventListener("click", () => {
  autoDropOn = !autoDropOn;
  autoDropTimer = 0;
  autoDropBtn.textContent = autoDropOn ? "ON" : "OFF";
  autoDropBtn.classList.toggle("active", autoDropOn);
});

autoSpeedEl.addEventListener("input", () => {
  simSpeed = Number(autoSpeedEl.value);
  autoSpeedVal.textContent = simSpeed + "×";
});

autoXEl.addEventListener("input", () => {
  autoDropX = Number(autoXEl.value) / 100;
  const pct = Number(autoXEl.value);
  autoXVal.textContent = pct === 50 ? "center" : pct + "%";
});

/* ── CLEAR SAVE (dev) ────────────────────────────────────────────────────
   Wipe persisted unlocks + earned perks so mode locks, perks, and the
   first-unlock glow can be retested from scratch without hand-clearing
   browser storage. */
clearSaveBtn?.addEventListener("click", () => {
  try {
    localStorage.removeItem(UNLOCK_KEY);
    localStorage.removeItem(PERK_KEY);
    localStorage.removeItem(HIGH_KEY);
    localStorage.removeItem(GAMES_KEY);
    localStorage.removeItem(TIME_KEY);
    localStorage.removeItem(CHAIN_KEY);
  } catch {}
  clearSavedGame();
  unlockedModes = loadUnlocks(); // back to defaults (easy only)
  earnedPerks = new Set();
  highScore = 0;
  gamesPlayed = 0;
  totalPlayMs = 0;
  bestChain = 0;
  playClockStart = 0;
  updatePerkCardUI();
  updateStatsUI();
  if (perksOpen()) renderPerksGrid();
  refreshDifficultyLocks();
  checkResume();
  if (clearSaveMsg) {
    clearSaveMsg.textContent = "cleared!";
    setTimeout(() => {
      clearSaveMsg.textContent = "";
    }, 1500);
  }
});

/* ── PHYSICS EDITOR (mass + impact) ──────────────────────────────────────
   Tune how heavy each planet is and how hard impacts hit, live. Defaults
   reproduce the shipping physics exactly: Mass Power 2 = flat density (mass
   grows with area only), Impact 1. Drag Mass Power up to 3 to get volume
   ("3D") mass where big planets get much heavier and small ones flick off
   them. Per-planet multipliers live in the JSON box for fine tuning. */
function physicsConfigJson() {
  const planetMass = {};
  SHAPES.forEach((s, i) => {
    planetMass[s.name] = TUNING.massMult[i];
  });
  return JSON.stringify(
    {
      massPower: TUNING.massPower,
      impactStrength: TUNING.impactStrength,
      planetMass,
    },
    null,
    2,
  );
}

function syncPhysicsEditor() {
  massPowerEl.value = String(TUNING.massPower);
  massPowerVal.textContent = TUNING.massPower.toFixed(1);
  impactStrengthEl.value = String(TUNING.impactStrength);
  impactStrengthVal.textContent = `${TUNING.impactStrength.toFixed(2)}×`;
  if (shakeStrengthEl) {
    shakeStrengthEl.value = String(TUNING.shakeStrength);
    shakeStrengthVal.textContent = TUNING.shakeStrength.toFixed(1);
  }
  if (shakeFalloffEl) {
    shakeFalloffEl.value = String(TUNING.shakeMassFalloff);
    shakeFalloffVal.textContent = TUNING.shakeMassFalloff.toFixed(2);
  }
  physicsConfigJsonEl.value = physicsConfigJson();
}

// Re-density live bodies (mass changed) and wake them so the change is felt now.
function commitPhysicsMass() {
  applyTuningToBodies();
  wakeAllShapes();
  syncPhysicsEditor();
}

massPowerEl.addEventListener("input", () => {
  TUNING.massPower = Number(massPowerEl.value);
  commitPhysicsMass();
});

impactStrengthEl.addEventListener("input", () => {
  // Impact strength is read live by collisionStart; no body re-density needed.
  TUNING.impactStrength = Number(impactStrengthEl.value);
  syncPhysicsEditor();
});

shakeStrengthEl?.addEventListener("input", () => {
  TUNING.shakeStrength = Number(shakeStrengthEl.value);
  syncPhysicsEditor();
});
shakeFalloffEl?.addEventListener("input", () => {
  TUNING.shakeMassFalloff = Number(shakeFalloffEl.value);
  syncPhysicsEditor();
});

// Dev: instantly fill the SHAKES meter (arms it) so the shake can be tested
// without grinding merges first.
document.getElementById("fill-shakes-btn")?.addEventListener("click", () => {
  shakePct = 100;
  updateShakeUI();
});

physicsApplyJsonBtn.addEventListener("click", () => {
  try {
    const cfg = JSON.parse(physicsConfigJsonEl.value);
    if (typeof cfg.massPower === "number") TUNING.massPower = cfg.massPower;
    if (typeof cfg.impactStrength === "number")
      TUNING.impactStrength = cfg.impactStrength;
    if (cfg.planetMass) {
      SHAPES.forEach((s, i) => {
        const v = cfg.planetMass[s.name];
        if (typeof v === "number" && v > 0) TUNING.massMult[i] = v;
      });
    }
    commitPhysicsMass();
    physicsConfigJsonEl.classList.remove("is-error");
  } catch {
    physicsConfigJsonEl.classList.add("is-error");
  }
});

physicsResetBtn.addEventListener("click", () => {
  TUNING.massPower = 2.7; // restore the shipping default
  TUNING.impactStrength = 1;
  SHAPES.forEach((_, i) => {
    TUNING.massMult[i] = 1;
  });
  commitPhysicsMass();
});

syncPhysicsEditor();

/* Populate Drop selector with all 12 planets */
SHAPES.forEach((s, i) => {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = `${i + 1}. ${s.name}`;
  dropModeEl.appendChild(opt);
});

let debugColliders = false;
colliderBtn.addEventListener("click", () => {
  debugColliders = !debugColliders;
  setDebugColliders(debugColliders);
  colliderBtn.textContent = debugColliders ? "ON" : "OFF";
  colliderBtn.classList.toggle("active", debugColliders);
});

dropModeEl.addEventListener("change", () => {
  const v = dropModeEl.value;
  dropMode = v === "weighted" || v === "random" ? v : Number(v);
  // Specific-planet mode: snap current + next previews immediately
  if (typeof dropMode === "number") {
    curLvl = dropMode;
    nxtLvl = dropMode;
    drawNext(nxtCtx, nxtCanvas, nxtLvl);
  }
});

/* ── BOOT ────────────────────────────────────────────────────────────── */
drawNext(nxtCtx, nxtCanvas, nxtLvl);
// Re-draw NEXT once the currently-pending asset actually loads (SVGs are async)
onAssetLoad((lvl) => {
  if (lvl === nxtLvl) drawNext(nxtCtx, nxtCanvas, nxtLvl);
});

// Wait for any SVG-outline collision shapes to load before starting the loop,
// so the first dropped Moon already has its polygon body.
loadOutlines().then(() => {
  requestAnimationFrame((ts) => {
    lastTs = ts;
    requestAnimationFrame(frame);
  });
});
