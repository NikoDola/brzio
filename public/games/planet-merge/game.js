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
} from "./physics.js";
import {
  drawProcedural,
  drawBody,
  drawNext,
  drawPreview,
  drawFlashes,
  drawPopups,
  onAssetLoad,
  setDebugColliders,
} from "./renderer.js";

const { Engine, Body, World, Events, Composite, Sleeping, Query } = Matter; // CDN global
const { W, H, WALL, DROP_Y, DANGER_Y } = LAYOUT;

/* Body star objects live outside the canvas. Four timing groups make the
   surrounding page keep repopulating instead of blinking in one fixed place:
   30 stars refresh every blink, 30 every two, 30 every three, and 10 every
   five. */
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

function placeBodyStar(el) {
  el.style.setProperty("--star-x", `${Math.round(Math.random() * 10000) / 100}vw`);
  el.style.setProperty("--star-y", `${Math.round(Math.random() * 10000) / 100}vh`);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeBodyStarConfig(config) {
  const current = bodyStarConfig;
  const incomingGroups = Array.isArray(config?.groups) ? config.groups : [];
  const groups = [1, 2, 3, 5].map((blinks, i) => {
    const match = incomingGroups.find((g) => Number(g?.blinks) === blinks) || incomingGroups[i] || {};
    return {
      label: `${blinks} ${blinks === 1 ? "blink" : "blinks"}`,
      blinks,
      count: Math.round(clampNumber(match.count, 0, 180, current.groups[i]?.count ?? 0)),
    };
  });
  const min = Math.round(clampNumber(config?.starSize?.min, 1, 12, current.starSize.min));
  const max = Math.round(clampNumber(config?.starSize?.max, 1, 12, current.starSize.max));
  const colors = Array.isArray(config?.colors) && config.colors.length
    ? config.colors.slice(0, 3)
    : current.colors;

  return {
    baseBlinkMs: Math.round(clampNumber(config?.baseBlinkMs, 1000, 8000, current.baseBlinkMs)),
    groups,
    starSize: { min: Math.min(min, max), max: Math.max(min, max) },
    colors,
  };
}

function pickBodyStarSize() {
  const { min, max } = bodyStarConfig.starSize;
  return Math.round(min + Math.random() * (max - min));
}

function bodyStarConfigJson() {
  return JSON.stringify(bodyStarConfig, null, 2);
}

function initBodyStarfield() {
  const host = document.getElementById("body-starfield");
  if (!host) return;
  host.replaceChildren();

  let index = 0;
  for (const group of bodyStarConfig.groups) {
    for (let i = 0; i < group.count; i += 1) {
      const star = document.createElement("span");
      const size = pickBodyStarSize();
      const color = bodyStarConfig.colors[index % bodyStarConfig.colors.length];

      star.className = "body-star";
      star.style.setProperty("--star-size", `${size}px`);
      star.style.setProperty("--star-color", color);
      star.style.setProperty("--star-speed", `${(bodyStarConfig.baseBlinkMs * group.blinks) / 1000}s`);
      star.style.setProperty(
        "--star-delay",
        `${-Math.random() * (bodyStarConfig.baseBlinkMs * group.blinks) / 1000}s`,
      );
      placeBodyStar(star);
      star.addEventListener("animationiteration", () => placeBodyStar(star));
      host.appendChild(star);
      index += 1;
    }
  }
}

function applyBodyStarConfig(config) {
  bodyStarConfig = normalizeBodyStarConfig(config);
  initBodyStarfield();
}

initBodyStarfield();

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

function makePool(file, size, volume) {
  const pool = Array.from({ length: size }, () => {
    const a = new Audio(`${SOUNDS_DIR}/${file}`);
    a.preload = "auto";
    a.volume = volume;
    return a;
  });
  let idx = 0;
  return () => {
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
function playOnce(sfx) {
  try {
    sfx.currentTime = 0;
    sfx.play().catch(() => {});
  } catch {}
}
const playLaser = () => playOnce(laserSfx);
const playTargetLock = () => playOnce(targetLockSfx);
const playSelect = () => playOnce(selectSfx);

/* ── GAME STATE ──────────────────────────────────────────────────────── */
const mergeQ = []; // { a, b, level } — bodies queued to merge
const vanishQ = []; // { a, b }        — max-level bodies queued to vanish
const mergeSeen = new Set(); // bodyIds already in a queue (prevents duplicates)

const flashes = []; // visual fx: { x, y, t, big }
const popups = []; // score fx:  { x, y, t, text, big }

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
function buildPlanetLegend() {
  if (!planetLegendEl) return;
  const BASE = 22; // px, the smallest planet (first in SHAPES)
  const STEP = 1.05; // each planet 5% larger than the one before it
  SHAPES.forEach((s, i) => {
    const px = Math.round(BASE * Math.pow(STEP, i));
    const item = document.createElement("div");
    item.className = "legend-item";
    item.dataset.lvl = i;

    const img = document.createElement("img");
    img.src = `assets/images/${s.asset}`;
    img.alt = s.name;
    img.width = px;
    img.height = px;

    item.appendChild(img);
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

/* dev panel elements */
const devPanelEl = document.getElementById("dev-panel");
const devToggleEl = document.getElementById("dev-toggle");
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
const starBaseSpeedEl = document.getElementById("star-base-speed");
const starBaseSpeedVal = document.getElementById("star-base-speed-val");
const starCount1El = document.getElementById("star-count-1");
const starCount2El = document.getElementById("star-count-2");
const starCount3El = document.getElementById("star-count-3");
const starCount5El = document.getElementById("star-count-5");
const starMinSizeEl = document.getElementById("star-min-size");
const starMaxSizeEl = document.getElementById("star-max-size");
const starColor1El = document.getElementById("star-color-1");
const starColor2El = document.getElementById("star-color-2");
const starColor3El = document.getElementById("star-color-3");
const starRandomizeBtn = document.getElementById("star-randomize-btn");
const starApplyJsonBtn = document.getElementById("star-apply-json-btn");
const starConfigJsonEl = document.getElementById("star-config-json");

/* ── COLLISION → MERGE / VANISH ──────────────────────────────────────── */
/* IMPACT_KICK shoves both bodies a bit harder along the contact normal when
   they collide fast. Game-feel hack: real momentum transfer from a tiny
   Star onto a heavy Mercury is almost zero, so a stack of planets barely
   reacts to drops. Adding a velocity-scaled kick gives the impact "weight"
   and lets the energy propagate down through stacked planets. */
const IMPACT_KICK_STRENGTH = 1; // 0 = vanilla physics, 1.0 = very arcadey
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
        const k = Math.min(speed, IMPACT_KICK_SPEED_CAP) * IMPACT_KICK_STRENGTH;
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
      x: top.velocity.x + dir * 0.35,
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

  winActive = true;
  winPopupShown = false;
  winStartReal = performance.now();
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
  if (!canDrop || gameOver || winActive) return;
  // Every drop starts a fresh chain — powers are earned by chains spawned
  // from ONE drop's cascade, never by accumulation across drops.
  resetChain();
  const rad = r(curLvl);
  const minX = WALL + rad + 2;
  const maxX = W - WALL - rad - 2;
  const sx = Math.max(minX, Math.min(maxX, dropX));
  spawn(sx, DROP_Y, curLvl, totalMs);
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
    if (body.label === "shape") drawBody(ctx, body, bodyLvl);
  }
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

  /* Mode-clear wipe sits on top of everything. */
  if (winActive) drawWinAnimation();

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

  score = 0;
  scoreEl.textContent = "0";
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
  clearWinState();
  difficulty = diff;
  rebuildDropTable();
  resetGameState();
  applyLegendMode(diff);
  planetLegendEl?.classList.remove("hidden");
  difficultyOverlayEl.classList.remove("visible");
}

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

  difficulty = null;
  gameOver = false;
  clearWinState();
  refreshDifficultyLocks();
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

/* ── DEV PANEL CONTROLS ──────────────────────────────────────────────── */
let suppressDevToggleClick = false;

devToggleEl.addEventListener("click", (e) => {
  if (suppressDevToggleClick) {
    e.preventDefault();
    suppressDevToggleClick = false;
    return;
  }
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

devToggleEl.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const rect = devPanelEl.getBoundingClientRect();
  devDrag = {
    pointerId: e.pointerId,
    dx: e.clientX - rect.left,
    dy: e.clientY - rect.top,
    moved: false,
  };
  devToggleEl.setPointerCapture(e.pointerId);
});

devToggleEl.addEventListener("pointermove", (e) => {
  if (!devDrag || devDrag.pointerId !== e.pointerId) return;
  devDrag.moved = true;
  setDevPanelPosition(e.clientX - devDrag.dx, e.clientY - devDrag.dy);
});

devToggleEl.addEventListener("pointerup", (e) => {
  if (!devDrag || devDrag.pointerId !== e.pointerId) return;
  if (devDrag.moved) {
    e.preventDefault();
    suppressDevToggleClick = true;
  }
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

function readStarEditorConfig() {
  return {
    baseBlinkMs: Number(starBaseSpeedEl.value),
    groups: [
      { label: "1 blink", blinks: 1, count: Number(starCount1El.value) },
      { label: "2 blinks", blinks: 2, count: Number(starCount2El.value) },
      { label: "3 blinks", blinks: 3, count: Number(starCount3El.value) },
      { label: "5 blinks", blinks: 5, count: Number(starCount5El.value) },
    ],
    starSize: {
      min: Number(starMinSizeEl.value),
      max: Number(starMaxSizeEl.value),
    },
    colors: [starColor1El.value, starColor2El.value, starColor3El.value],
  };
}

function syncStarEditor() {
  const groupsByBlink = new Map(bodyStarConfig.groups.map((g) => [g.blinks, g]));
  starBaseSpeedEl.value = String(bodyStarConfig.baseBlinkMs);
  starBaseSpeedVal.textContent = `${(bodyStarConfig.baseBlinkMs / 1000).toFixed(1)}s`;
  starCount1El.value = String(groupsByBlink.get(1)?.count ?? 0);
  starCount2El.value = String(groupsByBlink.get(2)?.count ?? 0);
  starCount3El.value = String(groupsByBlink.get(3)?.count ?? 0);
  starCount5El.value = String(groupsByBlink.get(5)?.count ?? 0);
  starMinSizeEl.value = String(bodyStarConfig.starSize.min);
  starMaxSizeEl.value = String(bodyStarConfig.starSize.max);
  starColor1El.value = bodyStarConfig.colors[0] || "#ffffff";
  starColor2El.value = bodyStarConfig.colors[1] || "#7ddfff";
  starColor3El.value = bodyStarConfig.colors[2] || "#feca57";
  starConfigJsonEl.value = bodyStarConfigJson();
}

function applyStarEditor() {
  applyBodyStarConfig(readStarEditorConfig());
  syncStarEditor();
}

[
  starBaseSpeedEl,
  starCount1El,
  starCount2El,
  starCount3El,
  starCount5El,
  starMinSizeEl,
  starMaxSizeEl,
  starColor1El,
  starColor2El,
  starColor3El,
].forEach((el) => el.addEventListener("input", applyStarEditor));

starRandomizeBtn.addEventListener("click", () => {
  initBodyStarfield();
  starConfigJsonEl.value = bodyStarConfigJson();
});

starApplyJsonBtn.addEventListener("click", () => {
  try {
    applyBodyStarConfig(JSON.parse(starConfigJsonEl.value));
    syncStarEditor();
    starConfigJsonEl.classList.remove("is-error");
  } catch {
    starConfigJsonEl.classList.add("is-error");
  }
});

syncStarEditor();

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
