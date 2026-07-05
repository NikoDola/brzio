/* ════════════════════════════════════════════════════════════════════════
   game.js  —  game loop, state, merge/vanish logic, input, restart
   Entry point: loaded as <script type="module"> in play.html
   ════════════════════════════════════════════════════════════════════════ */

import { LAYOUT, SHAPES, r, BALANCE } from "./config.js";
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
  getOutlineSets,
} from "./physics.js";
import { TUNING } from "./tuning.js";
import {
  drawBody,
  drawNext,
  drawPreview,
  drawScoreShadow,
  drawFlashes,
  drawPopups,
  drawUnlockGlows,
  drawPlayerMarker,
  onAssetLoad,
} from "./renderer.js";
import {
  initAnalytics,
  reportOpen,
  reportGameStart,
  reportGameEnd,
} from "./analytics.js";
import "./background.js";
import { playPop, playGroundHit, playPlanetHit, playLaser, playTargetLock, playSelect, playPerk } from "./audio.js";
import { round } from "./state.js";
import { applyLegendMode, showLegend, hideLegend, casualFaceSrc } from "./planet-icons.js";
import { earnPerk, perkCardEl, perksOverlayEl, openToLastEarnedTab, renderPerksGrid, perksOpen } from "./perks.js";
import { recordHigh, recordBestChain, recordGamePlayed, startPlayClock, bankPlayTime, updateStatsUI } from "./stats.js";
import { dailyLimitReached, showLimitMsg } from "./settings.js";
import {
  curLevel,
  getLevel,
  droppableLvls,
  pickLvl,
  firstDrop,
  resetLevel,
  restoreLevel,
  checkLevelUp,
  levelInfoOpen,
} from "./levels.js";
import { addShake, resetShake, maybeAutoShake, isProtected, tickShield, drawShield } from "./shakes.js";
import {
  isAutoDropOn,
  getAutoDropX,
  getSimSpeed,
  getForceChoose,
  getForceDestroy,
  onDropModeChange,
  recordDevDrop,
  resetDevDrops,
  recordDevGame,
} from "./dev-panel.js";
import { snapshotBodies, writeSave, loadSave, clearSave, resumeOverlayEl, checkResume } from "./save-storage.js";

const { Engine, Body, World, Events, Composite, Sleeping, Query } = Matter; // CDN global
const { W, H, WALL, DROP_GAP, PLAYER_MARKER_H, SCORE_Y, WALL_TOP, VANISH_BONUS } = LAYOUT;

/* ── CANVAS ──────────────────────────────────────────────────────────── */
const canvas = document.getElementById("game-canvas");
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext("2d");

// Reused offscreen band for the big sky score + its masked shadow (drawScoreShadow).
const scoreFx = document.createElement("canvas");
scoreFx.width = W;
scoreFx.height = 200; // covers the sky band (score + silhouette live around y=81)

const nxtCanvas = document.getElementById("next-canvas");
const nxtCtx = nxtCanvas.getContext("2d");

// Cached playfield background gradient. Same radial palette as the start
// screen (style.css #start-overlay) so the canvas reads as the same space,
// just with the planets dropped in.
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

/* ── GAME STATE ──────────────────────────────────────────────────────── */
const mergeQ = []; // { a, b, level } — bodies queued to merge
const vanishQ = []; // { a, b }        — max-level bodies queued to vanish
const mergeSeen = new Set(); // bodyIds already in a queue (prevents duplicates)

const flashes = []; // visual fx: { x, y, t, big }
const popups = []; // score fx:  { x, y, t, text, big }
const unlockGlows = []; // light-blue edge glow on first-creation: { bodyId, t }
const seenLevels = new Set(); // planet levels already created this run (unlock detection)

/* ── ROUND STATE ─────────────────────────────────────────────────────────
   `round.playing` (state.js) is the single "a round is active" flag (false
   while the start screen is up, keeping physics paused). There are no more
   easy/normal/hard modes: one endless mode whose difficulty ramps by
   score-based LEVELS (see levels.js for the ladder itself). */
let score = 0;
let mergeCount = 0; // number of merges this run (score is now points, not merges)
let curLvl = firstDrop(); // shape currently waiting to drop
let nxtLvl = pickLvl(); // shape shown in the NEXT preview
let dropX = W / 2; // x position of the drop crosshair
let canDrop = true;

/* ── PER-DROP CHAIN + SUPER-POWERS ──────────────────────────────────────
   `chainCount` counts merges that come from ONE drop's cascade. It resets
   at the start of every drop — there's no time window, no slow accumulation
   across drops. Big chains are pure skill rewards.
     - BALANCE.CHOOSE_UNLOCK merges in one chain → 1 "pick your next planet"
       charge (consumed on the next drop)
     - BALANCE.DESTROY_UNLOCK merges in one chain → 1 "wipe a planet type"
       charge (consumed when the player clicks a target on the board)
   Earned charges persist across drops until spent.

   Chain SCORING: a chain's whole base sum is multiplied by the chain length,
   so 5 merges worth 10 base score 10 x 5 = 50. `chainBase` accumulates the
   base points this chain; `chainScorePrev` is the contribution already banked,
   so each merge adds the delta (chainBase * chainCount) - chainScorePrev. */
let chainCount = 0;
let chainBase = 0;
let chainScorePrev = 0;
let powerCharges = 0;
let destroyCharges = 0;

let cooldown = 0; // ms remaining before next drop is allowed
let totalMs = 0; // total elapsed ms (frozen when game is over)
let lastTs = 0;

/* ── DOM ─────────────────────────────────────────────────────────────── */
// The live score now shows on the canvas (drawScoreShadow); the HUD chip was
// removed. Keep a stub so the existing score-write calls stay harmless no-ops.
const scoreEl = document.getElementById("score") || {};
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

/* ── COLLISION → MERGE / VANISH ──────────────────────────────────────── */
/* IMPACT_KICK shoves both bodies a bit harder along the contact normal when
   they collide fast. Game-feel hack: real momentum transfer from a tiny
   Star onto a heavy Mercury is almost zero, so a stack of planets barely
   reacts to drops. Adding a velocity-scaled kick gives the impact "weight"
   and lets the energy propagate down through stacked planets.
   Strength is live-tunable via the dev "Planet Physics" Impact slider
   (TUNING.impactStrength): 1 = shipping, 0 = vanilla physics, 2 = very arcadey. */
// Velocity thresholds for impact SFX. Resting contacts and tiny jitters
// would otherwise spam noise. Tuned by feel against the existing kick min.
const PLANET_HIT_MIN_SPEED = BALANCE.IMPACT_KICK_MIN_SPEED;

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
          Math.abs(planet.velocity.y) > BALANCE.GROUND_HIT_MIN_SPEED
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
      if (speed > BALANCE.IMPACT_KICK_MIN_SPEED) {
        const n = pair.collision.normal; // points from B → A
        const k = Math.min(speed, BALANCE.IMPACT_KICK_SPEED_CAP) * TUNING.impactStrength;
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
 * chain crosses BALANCE.CHOOSE_UNLOCK / BALANCE.DESTROY_UNLOCK. Counter
 * resets on every drop.
 */
function registerChain(x, y, base) {
  chainCount++;
  recordBestChain(chainCount);
  addShake(chainCount);

  // Chain scoring: the chain's whole base sum multiplied by its length, applied
  // as a delta each merge so the score climbs live (5 merges worth 10 → 50).
  chainBase += base;
  const contribution = chainBase * chainCount;
  score += contribution - chainScorePrev;
  chainScorePrev = contribution;

  if (chainCount < 2) return;

  // Choose is always earnable; Eliminate (destroy) only while the current level
  // still allows it. Unlock messages fire when a threshold is first crossed;
  // otherwise the running chain number is shown, scaled up.
  const canEliminate = curLevel().eliminate;
  const canChoose = curLevel().choose;
  let text, fontSize, color, dur;
  if (canEliminate && chainCount === BALANCE.DESTROY_UNLOCK) {
    text = "Destroy Power Unlocked!";
    fontSize = 30;
    color = "#ff6e6e";
    dur = 2400;
  } else if (canChoose && chainCount === BALANCE.CHOOSE_UNLOCK) {
    text = "Choose Planet Unlocked!";
    fontSize = 28;
    color = "#7ddfff";
    dur = 1700;
  } else {
    text = String(chainCount);
    // Text swells AND lingers longer with the streak so bigger combos feel
    // bigger. Both peak at 5 in a row; 6, 7, ... hold at that biggest/longest.
    const step = Math.min(chainCount, 5); // 2..5 grow, then hold
    fontSize = [0, 0, 34, 44, 54, 64][step];
    dur = [0, 0, 1150, 1500, 1850, 2400][step];
    color = "#FFFFFF";
  }

  popups.push({
    x,
    y: y - 24,
    t: totalMs,
    text,
    fontSize,
    color,
    dur,
    shadowColor: "rgba(0, 80, 140, 0.85)",
    big: false,
  });

  if (canChoose && chainCount === BALANCE.CHOOSE_UNLOCK) {
    powerCharges = 1;
    updatePowerUI();
    playSelect();
  }
  if (canEliminate && chainCount === BALANCE.DESTROY_UNLOCK) {
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
  chainBase = 0;
  chainScorePrev = 0;
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
   Unlocked at BALANCE.DESTROY_UNLOCK merges in a streak. Paints a pulsing red
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

function clampedDropX(lvl = curLvl) {
  const rad = r(lvl);
  const minX = WALL + rad + 2;
  const maxX = W - WALL - rad - 2;
  return Math.max(minX, Math.min(maxX, dropX));
}

function dropYFor(lvl = curLvl) {
  return WALL_TOP + PLAYER_MARKER_H / 2 + DROP_GAP + r(lvl);
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
  if (getForceDestroy()) {
    destroyCharges = 1;
    updateDestroyUI();
  }
  return true;
}

// A level that just banned a power drops any charge still in the player's
// hand. Called right after checkLevelUp(score), which owns the level itself
// but not these gameplay charges.
function revokeBannedCharges() {
  if (!curLevel().eliminate && destroyCharges > 0) {
    destroyCharges = 0;
    updateDestroyUI();
  }
  if (!curLevel().choose && powerCharges > 0) {
    powerCharges = 0;
    updatePowerUI();
  }
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
    const sy = Math.max(WALL_TOP + newR + 6, my);
    const merged = spawn(mx, sy, newLvl, totalMs);
    Body.setVelocity(merged, { x: 0, y: -3 });
    // Bigger body at the midpoint may intersect a neighbour — push them apart.
    separateOverlapping(merged);
    // Score: the SOURCE planet's base points (2^level), fed through the chain
    // multiplier. `gained` is what this merge actually added (base x chain).
    const before = score;
    registerChain(mx, my, SHAPES[level].pts);
    const gained = score - before;
    mergeCount++;
    scoreEl.textContent = score;
    recordHigh(score);
    checkLevelUp(score);
    revokeBannedCharges();
    earnPerk(`merge-${newLvl}`); // first time this planet is created
    if (mergeCount >= 200) earnPerk("win-200");
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
      text: "+" + gained,
      big: false,
    });
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
    // Endless mode: two Suns pay a big bonus and the run keeps going.
    score += VANISH_BONUS;
    mergeCount++;
    scoreEl.textContent = score;
    recordHigh(score);
    checkLevelUp(score);
    revokeBannedCharges();
    playPop();
    flashes.push({ x: mx, y: my, t: totalMs, big: true });
    popups.push({ x: mx, y: my, t: totalMs, text: "+" + VANISH_BONUS, big: true });
  }
}

/* ── DROP ────────────────────────────────────────────────────────────── */
function drop() {
  if (!canDrop || round.gameOver || perksOpen() || levelInfoOpen() || isProtected()) return;
  const rad = r(curLvl);
  const minX = WALL + rad + 2;
  const maxX = W - WALL - rad - 2;
  const sx = Math.max(minX, Math.min(maxX, dropX));
  // A planet in the way at this spot: refuse (the preview shows the red cross).
  // Refusing must NOT reset the chain, only a real drop starts a fresh one.
  if (dropBlockedAt(sx, curLvl)) return;
  // Every drop starts a fresh chain — powers are earned by chains spawned
  // from ONE drop's cascade, never by accumulation across drops.
  resetChain();
  spawn(sx, dropYFor(curLvl), curLvl, totalMs);
  // Note: dropping a planet does NOT earn its perk — only merging UP to it
  // does (handled in flushMerges). So a chosen/dropped Mercury grants nothing.
  curLvl = nxtLvl;
  nxtLvl = pickLvl();
  canDrop = false;
  cooldown = BALANCE.DROP_COOLDOWN_MS;
  if (powerCharges > 0) {
    powerCharges--;
    if (powerCharges === 0) updatePowerUI();
  }
  if (getForceChoose() && powerCharges === 0) {
    powerCharges = 1;
    updatePowerUI();
  }
  drawNext(nxtCtx, nxtCanvas, nxtLvl);
  maybeAutoShake(); // Level 7+: a drop may kick off a random earthquake burst
}

/* ── GAME OVER ───────────────────────────────────────────────────────── */
// No danger line any more: the container is open at the top and the run ends
// when a planet is pushed over a wall and falls OUT of the container (past the
// bottom of the canvas). The second lose condition, a board so crowded there is
// nowhere left to drop, lives in checkBoardFull() below.
function checkOver() {
  if (isProtected()) return; // shielded while shaking: no game over
  for (const body of Composite.allBodies(world)) {
    if (body.label !== "shape") continue;
    const id = body.id;
    const lvl = bodyLvl.get(id);
    if (lvl === undefined) continue;
    if (totalMs - (bodyBorn.get(id) || 0) < 1600) continue; // grace period
    if (body.position.y > H + 40) {
      endGame();
      return;
    }
  }
}

/* ── DROP ROOM ───────────────────────────────────────────────────────────
   dropBlockedAt: a planet on the board overlaps the drop spot, so dropping
   there would spawn inside it. drop() refuses and the preview shows the
   blocked look (dimmed, red cross, hurt face). Board planets are treated as
   circles; close enough for a hint and a refusal.

   checkBoardFull: the second lose condition. When EVERY spot across the width
   is blocked, there is nowhere left to drop; if that holds for NO_ROOM_MS the
   run ends. The dwell time rides out a chain mid-cascade, where planets fly
   everywhere for a moment but the board still has room once it settles. */
function dropBlockedAt(sx, lvl) {
  const rad = r(lvl);
  for (const body of Composite.allBodies(world)) {
    if (body.label !== "shape") continue;
    const otherLvl = bodyLvl.get(body.id);
    if (otherLvl === undefined) continue;
    const dx = body.position.x - sx;
    const dy = body.position.y - dropYFor(lvl);
    const reach = rad + r(otherLvl) - 2; // small slack so a graze doesn't block
    if (dx * dx + dy * dy < reach * reach) return true;
  }
  return false;
}

function boardFull() {
  const rad = r(curLvl);
  const minX = WALL + rad + 2;
  const maxX = W - WALL - rad - 2;
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    if (!dropBlockedAt(minX + ((maxX - minX) * i) / steps, curLvl)) return false;
  }
  return true;
}

let noRoomMs = 0;
function checkBoardFull(dt) {
  // Only while the player could actually drop: cooldown chaos doesn't count,
  // and the shake shield suspends losing just like it does for checkOver.
  if (!canDrop || isProtected()) {
    noRoomMs = 0;
    return;
  }
  if (!boardFull()) {
    noRoomMs = 0;
    return;
  }
  noRoomMs += dt;
  if (noRoomMs >= BALANCE.NO_ROOM_MS) endGame();
}

function endGame() {
  round.gameOver = true;
  finalEl.textContent = score;
  reportGameEnd("lost", score, getLevel());
  clearSave(); // a finished game shouldn't offer a resume
  bankPlayTime();
  if (mergeCount < 100) earnPerk("lose-under-100"); // play the game in reverse
  if (mergeCount < 150) earnPerk("lose-under-150");
  overlayEl.classList.add("visible");

  recordDevGame(score);
}

/* ── GAME LOOP ───────────────────────────────────────────────────────── */
// Fixed-timestep physics. Real elapsed time goes into an accumulator and is
// drained in 8ms substeps, so the sim runs at the same speed on a 60Hz and a
// 144Hz display (the rAF rate no longer sets game speed), and a heavy frame
// drops sim time instead of piling up more physics work. The small 8ms step
// itself keeps fast bodies (a falling Star) from tunneling through concave
// polygon planets (the Moon).
const PHYS_STEP = 8; // ms per physics substep
let physAcc = 0; // real ms waiting to be simulated

function frame(ts) {
  // Cap at 32ms so a hitch or a backgrounded tab can't queue a physics
  // avalanche; the game briefly slows down instead. This also caps the
  // substeps per frame at 4 x simSpeed.
  const dt = Math.min(ts - lastTs, 32);
  lastTs = ts;

  // Shake shield: raise the rainbow arch (and suspend the danger check) while a
  // shake is in progress; drop it once the window passes or the game ends.
  tickShield();

  if (!round.gameOver && round.playing) {
    physAcc += dt * getSimSpeed();
    while (physAcc >= PHYS_STEP) {
      physAcc -= PHYS_STEP;
      Engine.update(engine, PHYS_STEP);
      totalMs += PHYS_STEP;
      if (cooldown > 0) {
        cooldown -= PHYS_STEP;
        if (cooldown <= 0) canDrop = true;
      }
      flushMerges();
      flushVanishes();
      checkOver();
      checkBoardFull(PHYS_STEP);
      if (round.gameOver) break;

      if (isAutoDropOn() && canDrop) {
        const minX = WALL + r(curLvl) + 2;
        const maxX = W - WALL - r(curLvl) - 2;
        dropX = minX + getAutoDropX() * (maxX - minX);
        drop();
        recordDevDrop();
      }
    }
  }

  /* Background: wipe to fully transparent first. The open area above the
     container (the drop chute, and the corners where the walls are cut
     away) is left untouched after this, on purpose, so the page's own
     starfield canvas shows straight through with no seam, no border, no
     tint. Only the container itself (from WALL_TOP down) gets painted. */
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = playfieldGradient;
  ctx.fillRect(WALL, WALL_TOP, W - 2 * WALL, H - WALL_TOP);

  /* Twinkling stars (behind everything else, in front of the gradient).
     Spans the full canvas, including the open area above the container, so
     it layers a second, faster-twinkling star field over the page's own
     backdrop there. */
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

  /* Walls: a "U" with a cut-down rim. The sides only start at WALL_TOP
     (matching the physics bodies), so the space above reads as open air a
     planet can be pushed over. */
  ctx.fillStyle = "#1a2a4a";
  ctx.fillRect(0, WALL_TOP, WALL, H - WALL_TOP);
  ctx.fillRect(W - WALL, WALL_TOP, WALL, H - WALL_TOP);
  ctx.fillRect(WALL, H - WALL, W - 2 * WALL, WALL);

  /* A thin border tracing ONLY the container's real outline (flat top at
     WALL_TOP, since the rim is cut there, not the whole canvas). This used
     to come from a CSS box-shadow on the canvas wrapper, but that box
     covered the full canvas rectangle, including the open top, and drew a
     border there too. Keeping it in the draw call ties it to the actual
     container shape. */
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, WALL_TOP, W - 2, H - WALL_TOP - 1);


  /* Rainbow shield arch, only while a shake has it raised. (The red danger
     line is gone: losing is about falling out of the container now.) */
  drawShield(ctx);

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

  /* Big total score in the sky, always visible during a round. A waiting planet
     casts its shadow on it; while a planet is mid-drop the number stays, shadow-free. */
  if (!round.gameOver && round.playing) {
    const rad = r(curLvl);
    const minX = WALL + rad + 2;
    const maxX = W - WALL - rad - 2;
    const sx = Math.max(minX, Math.min(maxX, dropX));
    const hasWaiting = canDrop && destroyCharges === 0;
    drawScoreShadow(ctx, scoreFx, String(score), hasWaiting ? curLvl : -1, sx, SCORE_Y, rad);
  }

  // Placeholder for a future "player character" sprite that will look like
  // it's holding and dropping planets. Just a red block for now, centered on
  // the live aim point and sitting on the container's top edge. Drawn for the
  // whole round so it keeps following during the drop cooldown.
  if (!round.gameOver && round.playing) {
    drawPlayerMarker(ctx, clampedDropX(), WALL_TOP);
  }

  /* Drop guide + shape waiting to fall (hidden while aiming the destroy power) */
  if (canDrop && !round.gameOver && destroyCharges === 0) {
    const rad = r(curLvl);
    const minX = WALL + rad + 2;
    const maxX = W - WALL - rad - 2;
    const sx = Math.max(minX, Math.min(maxX, dropX));

    const blocked = dropBlockedAt(sx, curLvl);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.11)";
    ctx.setLineDash([4, 7]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, WALL_TOP + 2);
    ctx.lineTo(sx, H - WALL);
    ctx.stroke();
    ctx.setLineDash([]);
    // Blocked spot: the waiting planet dims to 0.7, wears its hurt face, and a
    // red cross covers it (drawPreview). Clicking here is refused by drop().
    ctx.globalAlpha = blocked ? 0.7 : 0.88;
    drawPreview(ctx, curLvl, sx, dropYFor(curLvl), 0, rad, blocked);
    ctx.restore();
  }

  requestAnimationFrame(frame);
}

/* ── INPUT ───────────────────────────────────────────────────────────── */
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  dropX = (e.clientX - rect.left) * (W / rect.width);
});

canvas.addEventListener("click", (e) => {
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
    if (getForceDestroy()) {
      destroyCharges = 1;
      updateDestroyUI();
    }
  });
}

/* ── DIFFICULTY / RESTART ───────────────────────────────────────────────
   `resetGameState` is shared between Play Again and the first start.
   `startGame()` flips `playing` on, rebuilds the drop table, then resets state.
   `showStartScreen` wipes the board and reopens the start overlay. */
const startOverlayEl = document.getElementById("start-overlay");

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
  mergeCount = 0;
  resetLevel();
  scoreEl.textContent = "0";
  resetShake();
  curLvl = firstDrop();
  nxtLvl = pickLvl();
  dropX = W / 2;
  canDrop = true;
  cooldown = 0;
  totalMs = 0;
  physAcc = 0;
  noRoomMs = 0;
  round.gameOver = false;
  resetDevDrops();

  resetChain();
  // Choose is always available; Eliminate only while the level allows it. The
  // dev-panel force-on toggles keep a charge primed for testing.
  powerCharges = getForceChoose() && curLevel().choose ? 1 : 0;
  destroyCharges = getForceDestroy() && curLevel().eliminate ? 1 : 0;
  updatePowerUI();
  updateDestroyUI();

  overlayEl.classList.remove("visible");
  drawNext(nxtCtx, nxtCanvas, nxtLvl);
}

function startGame() {
  if (dailyLimitReached()) {
    showLimitMsg(true);
    return;
  }
  showLimitMsg(false);
  round.playing = true;
  resetLevel();
  reportGameStart(getLevel());
  recordGamePlayed();
  startPlayClock();
  resetGameState();
  applyLegendMode(droppableLvls);
  showLegend();
  startOverlayEl.classList.remove("visible");
}

// Anonymous play analytics (see analytics.js). reportOpen counts loads; the
// visibility handler records the score a player leaves off at if they quit
// mid-round. Reads live game state so the snapshot is always current.
reportOpen();
initAnalytics(() => ({
  active: round.playing && !round.gameOver,
  score,
  mode: getLevel(),
}));

// Coordinates the shared "Game Statistic" / "Perks" overlay: two independent
// subsystems (stats.js, perks.js) that happen to share one set of tabs.
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
perkCardEl?.addEventListener("click", () => {
  // The in-game perk card jumps straight to the Perks tab, on the sub-tab of
  // the most recently earned perk so a fresh unlock isn't buried.
  setMainTab("perks");
  openToLastEarnedTab();
  perksOverlayEl.classList.add("visible");
});

// Lobby "Game Statistic" button opens the overlay on the stats tab.
const gameStatBtn = document.getElementById("game-stat-btn");
gameStatBtn?.addEventListener("click", () => {
  setMainTab("stats");
  perksOverlayEl.classList.add("visible");
});

function showStartScreen() {
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

  round.playing = false;
  round.gameOver = false;
  checkResume();
  hideLegend();
  overlayEl.classList.remove("visible");
  startOverlayEl.classList.add("visible");
}

restartEl.addEventListener("click", () => {
  if (!round.playing) {
    // Edge case: Play Again before ever starting a round just reopens the
    // start screen rather than launching an unprimed round.
    showStartScreen();
    return;
  }
  resetGameState();
});

const playBtnEl = document.getElementById("play-btn");
playBtnEl?.addEventListener("mouseenter", () => playPlanetHit());
playBtnEl?.addEventListener("click", () => {
  playPop();
  startGame();
});

// Decorative start-screen band: every planet (body + its casual face) scrolls
// left→right and loops. The set is duplicated so the CSS marquee is seamless.
const startPlanetsTrackEl = document.getElementById("start-planets-track");
if (startPlanetsTrackEl) {
  const planetHTML = (lvl) => {
    const body = `<img src="assets/images/${SHAPES[lvl].asset}" alt="">`;
    const face = casualFaceSrc(lvl);
    return `<div class="start-planet">${body}${face ? `<img src="${face}" alt="">` : ""}</div>`;
  };
  const oneSet = SHAPES.map((_, i) => planetHTML(i)).join("");
  startPlanetsTrackEl.innerHTML = oneSet + oneSet;
}

/* ── SAVE / CONTINUE ─────────────────────────────────────────────────────
   Snapshot the live game (level, score, powers, the current/next planet,
   and every body's level + position + angle + velocity) into localStorage so
   the player can close the tab and resume later. The Save Progress button
   writes; the start screen's Continue button reads. Saving is non-destructive:
   the snapshot stays until the player saves again or clears storage, so they
   can keep playing after a save and still resume that point later.

   The localStorage plumbing (snapshotBodies, writeSave, loadSave, clearSave,
   checkResume) lives in save-storage.js; this file only decides WHAT to save
   and how to rebuild a live round from it, since that needs deep access to
   score/level/chain state. */
const resumeContinueBtn = document.getElementById("resume-continue");
const resumeNewBtn = document.getElementById("resume-new");

// Silent auto-save. Called when the player leaves mid-game; there is no manual
// save button. Skips when there's nothing meaningful to save (no round active
// or after a loss).
function saveGame() {
  if (!round.playing || round.gameOver) return;
  writeSave({
    v: 2,
    level: getLevel(),
    score,
    mergeCount,
    curLvl,
    nxtLvl,
    powerCharges,
    destroyCharges,
    seenLevels: [...seenLevels],
    bodies: snapshotBodies(),
  });
}

function restoreGame(data) {
  round.playing = true;
  restoreLevel(data.level);

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
  mergeCount = data.mergeCount || 0;
  scoreEl.textContent = score;
  resetShake();
  curLvl = data.curLvl ?? firstDrop();
  nxtLvl = data.nxtLvl ?? pickLvl();
  dropX = W / 2;
  canDrop = true;
  cooldown = 0;
  totalMs = 0;
  noRoomMs = 0;
  round.gameOver = false;
  resetDevDrops();
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

  // Restore the saved charges; drop a charge if this level bans that power.
  powerCharges = curLevel().choose ? data.powerCharges || 0 : 0;
  destroyCharges = curLevel().eliminate ? data.destroyCharges || 0 : 0;
  updatePowerUI();
  updateDestroyUI();

  applyLegendMode(droppableLvls);
  showLegend();
  overlayEl.classList.remove("visible");
  startOverlayEl.classList.remove("visible");
  drawNext(nxtCtx, nxtCanvas, nxtLvl);
  startPlayClock();
}

// Auto-save + bank play time when the player leaves mid-game (tab close, app
// switch, screen lock); resume the clock when the tab returns to an active game.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    bankPlayTime();
    saveGame();
  } else if (round.playing && !round.gameOver) {
    startPlayClock();
  }
});

resumeContinueBtn?.addEventListener("click", () => {
  const saved = loadSave();
  resumeOverlayEl?.classList.remove("visible");
  if (!saved) return;
  playPop();
  restoreGame(saved);
  // One-time resume: consume the save so the player can't keep rewinding to the
  // same point. Leaving again mid-game writes a fresh save.
  clearSave();
});

resumeNewBtn?.addEventListener("click", () => {
  // Discard the saved game and reveal the picker that's already behind the popup.
  playPop();
  resumeOverlayEl?.classList.remove("visible");
  clearSave();
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

/* ── BOOT ────────────────────────────────────────────────────────────── */
// Dev panel "Drop" selector, specific-planet mode: snap current + next
// previews immediately instead of waiting for the next natural pick.
onDropModeChange((lvl) => {
  curLvl = lvl;
  nxtLvl = lvl;
  drawNext(nxtCtx, nxtCanvas, nxtLvl);
});

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
