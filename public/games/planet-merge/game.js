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
  separatePenetrations,
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
  setPlayerMarkerAsset,
} from "./renderer.js";
import {
  initAnalytics,
  reportOpen,
  reportGameStart,
  reportGameEnd,
} from "./analytics.js";
import "./background.js";
import {
  playPop,
  playGroundHit,
  playPlanetHit,
  playLaser,
  playTargetLockThenConstant,
  playSelect,
  playPerk,
  startTargetLockConstant,
  stopTargetLockConstant,
} from "./audio.js";
import { round } from "./state.js";
import { applyLegendMode, showLegend, hideLegend, planetIconHTML } from "./planet-icons.js";
import { earnPerk, perkCardEl, perksOverlayEl, openToLastEarnedTab, renderPerksGrid, perksOpen } from "./perks.js";
import { recordHigh, recordBestChain, recordGamePlayed, startPlayClock, bankPlayTime, updateStatsUI, addPoints, getPoints } from "./stats.js";
import { dailyLimitReached, showLimitMsg } from "./settings.js";
import {
  curLevel,
  getLevel,
  droppableLvls,
  pickLvl,
  firstDrop,
  resetLevel,
  restoreLevel,
  levelInfoOpen,
  MODES,
  setMode,
  modeScoreMult,
  isModeUnlocked,
  isModeWon,
  markModeWon,
  openModeInfo,
  onModeWinsChange,
} from "./levels.js";
import { addShake, resetShake, maybeAutoShake, isProtected, tickShield, drawShield } from "./shakes.js";
import {
  isAutoDropOn,
  getAutoDropX,
  getSimSpeed,
  getForceChoose,
  getForceDestroy,
  onDropModeChange,
  onForcePowerChange,
  onScenarioCapture,
  onScenarioPlay,
  recordDevDrop,
  resetDevDrops,
  recordDevGame,
  recordPhysMs,
} from "./dev-panel.js";
import { snapshotBodies, writeSave, loadSave, clearSave } from "./save-storage.js";

const { Engine, Body, World, Events, Composite, Sleeping, Query } = Matter; // CDN global
const {
  W,
  H,
  WALL,
  WALL_X,
  DROP_GAP,
  PLAYER_MARKER_W,
  PLAYER_MARKER_H,
  PLAYER_MARKER_NEXT_SLOT_SCALE,
  PLAYER_MARKER_PLANET_BOTTOM_PAD,
  PLAYER_CONTAINER_Y,
  SCORE_Y,
  WALL_TOP,
  VANISH_BONUS,
} = LAYOUT;

/* ── CANVAS ──────────────────────────────────────────────────────────── */
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const MOBILE_RENDER_SCALE = 0.7;
const mobilePerfQuery = window.matchMedia?.("(max-width: 700px), (pointer: coarse)");
let renderScale = 1;
let playfieldGradient = null;

function mobilePerfMode() {
  return Boolean(mobilePerfQuery?.matches || window.innerWidth <= 700);
}

function createPlayfieldGradient() {
  const gradient = ctx.createRadialGradient(
    W / 2,
    H * 0.35,
    0,
    W / 2,
    H * 0.35,
    Math.max(W, H),
  );
  gradient.addColorStop(0, "#3a5680");
  gradient.addColorStop(0.65, "#1a2540");
  gradient.addColorStop(1, "#0a1020");
  return gradient;
}

function resizeGameCanvas() {
  const nextScale = mobilePerfMode() ? MOBILE_RENDER_SCALE : 1;
  const pixelW = Math.round(W * nextScale);
  const pixelH = Math.round(H * nextScale);
  if (canvas.width !== pixelW || canvas.height !== pixelH) {
    canvas.width = pixelW;
    canvas.height = pixelH;
  }
  renderScale = nextScale;
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  playfieldGradient = createPlayfieldGradient();
}

resizeGameCanvas();

// Reused offscreen band for the big sky score + its masked shadow (drawScoreShadow).
const scoreFx = document.createElement("canvas");
scoreFx.width = W;
scoreFx.height = Math.ceil(Math.max(WALL_TOP, PLAYER_CONTAINER_Y) + PLAYER_MARKER_H + 40);
const mobileScoreFx = document.createElement("canvas");
mobileScoreFx.width = W;
mobileScoreFx.height = scoreFx.height;
let mobileScoreCacheText = "";

const nxtCanvas = document.getElementById("next-canvas");
const nxtCtx = nxtCanvas.getContext("2d");

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

const PLAYER_TILT_MAX = 0.18; // ~10 degrees
const PLAYER_TILT_PER_PX = 0.018;
const PLAYER_TILT_EASE = 0.22;
let playerMarkerPrevX = W / 2;
let playerMarkerTilt = 0;

const NEXT_HANDOFF_MS = BALANCE.DROP_COOLDOWN_MS;
let nextHandoff = null;

const AUTO_PILOT_BASE_SWEEP = 0.28; // canvas px per real ms at base pace
const AUTO_PILOT_FAST_SPEED = 4;
const MOBILE_AUTO_FAST_MOTION = 2.6;
const MOBILE_AUTO_FAST_MIN_DROP_MS = 260;
const MOBILE_AUTO_FAST_BUSY_DROP_MS = 330;
const MOBILE_AUTO_FAST_BUSY_BODY_COUNT = 18;
const MOBILE_AUTO_FAST_STAR_COUNT = 36;
let autoPilotActive = false;
let autoPilotDir = 1;
let autoPilotSpeed = 1;

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
let destroyDropsRemaining = 0;
let chooseReadyMs = 0;
let chooseRotateMs = 0;

let cooldown = 0; // ms remaining before next drop is allowed
let totalMs = 0; // total elapsed ms (frozen when game is over)
let lastTs = 0;

const DEATH_REPLAY_HISTORY_MS = 2400;
const DEATH_REPLAY_SAMPLE_MS = 80;
const DEATH_REPLAY_DURATION_MS = 2900;
const DEATH_REPLAY_ARM_FROM_BOTTOM_RATIO = 0.8;
const BOARD_FULL_CHECK_MS = 96;
const BOARD_FULL_ARM_FROM_BOTTOM_RATIO = 0.8;
const BOARD_FULL_ARM_MIN_AGE_MS = 1600;
const DANGER_DASH_OFFSET_Y = 50;
const SIDE_WALL_ESCAPE_SLACK = 4;
const DESTROY_DROP_GRACE = 3;
// The no-room probe. Venus, not Earth: the probe's radius blocks spots from
// well below the drop row (reach = probe radius + planet radius), so an
// Earth-sized probe ended runs while the stack still looked mid-height.
const VENUS_LVL = SHAPES.findIndex((shape) => shape.name === "Venus");
const BOARD_ROOM_TEST_LVL = VENUS_LVL >= 0 ? VENUS_LVL : Math.min(5, SHAPES.length - 1);
const deathReplayHistory = new Map();
const rimEscapedIds = new Set();
let deathReplay = null;
let nextDeathReplaySampleMs = 0;

function formatScore(value) {
  const n = Math.max(0, Math.floor(value || 0));
  const units = [
    { min: 1_000_000, suffix: "m" },
    { min: 1_000, suffix: "k" },
  ];
  for (const { min, suffix } of units) {
    if (n < min) continue;
    const scaled = n / min;
    const trimmed =
      scaled < 10
        ? Math.floor(scaled * 10) / 10
        : Math.floor(scaled);
    return String(trimmed).replace(/\.0$/, "") + suffix;
  }
  return String(n);
}

function drawMobileScoreText(ctx, scoreText) {
  if (scoreText !== mobileScoreCacheText) {
    mobileScoreCacheText = scoreText;
    const f = mobileScoreFx.getContext("2d");
    f.clearRect(0, 0, mobileScoreFx.width, mobileScoreFx.height);
    f.save();
    f.font = "900 112px 'Fredoka', 'Segoe UI', Arial, sans-serif";
    f.textAlign = "center";
    f.textBaseline = "middle";
    f.fillStyle = "rgba(255,255,255,0.22)";
    f.fillText(scoreText, W / 2, SCORE_Y);
    f.restore();
  }
  ctx.drawImage(mobileScoreFx, 0, 0);
}

// Reused scratch list. collectLiveShapes runs every 8ms physics substep and
// again for every paint, so allocating a fresh array + one object per body each
// call fed the garbage collector for nothing. All callers consume the list
// immediately (within the same substep or frame) and never retain it, so a
// single module-level buffer with pooled entries is safe. Do NOT stash the
// returned array anywhere that outlives the frame; take a copy instead.
const _shapesScratch = [];
function collectLiveShapes() {
  let n = 0;
  for (const body of Composite.allBodies(world)) {
    if (body.label !== "shape") continue;
    const lvl = bodyLvl.get(body.id);
    if (lvl === undefined) continue;
    let entry = _shapesScratch[n];
    if (!entry) {
      entry = { body: null, lvl: 0, rad: 0 };
      _shapesScratch[n] = entry;
    }
    entry.body = body;
    entry.lvl = lvl;
    entry.rad = r(lvl);
    n++;
  }
  _shapesScratch.length = n;
  return _shapesScratch;
}

function recordDeathReplayHistory(shapes = collectLiveShapes()) {
  if (totalMs < nextDeathReplaySampleMs) return;
  nextDeathReplaySampleMs = totalMs + DEATH_REPLAY_SAMPLE_MS;

  const liveIds = new Set();
  const armY = H - (H - WALL_TOP) * DEATH_REPLAY_ARM_FROM_BOTTOM_RATIO;
  let shouldRecord = false;
  for (const { body, lvl, rad } of shapes) {
    liveIds.add(body.id);
    if (body.position.y - rad <= armY || rimEscapedIds.has(body.id)) {
      shouldRecord = true;
    }
  }

  for (const id of rimEscapedIds) {
    if (!liveIds.has(id)) rimEscapedIds.delete(id);
  }

  if (!shouldRecord) {
    deathReplayHistory.clear();
    return;
  }

  for (const { body, lvl } of shapes) {
    let samples = deathReplayHistory.get(body.id);
    if (!samples) {
      samples = [];
      deathReplayHistory.set(body.id, samples);
    }
    const last = samples[samples.length - 1];
    if (!last || totalMs - last.t >= DEATH_REPLAY_SAMPLE_MS) {
      samples.push({
        t: totalMs,
        x: body.position.x,
        y: body.position.y,
        a: body.angle,
        lvl,
      });
    }
    while (samples.length && totalMs - samples[0].t > DEATH_REPLAY_HISTORY_MS) {
      samples.shift();
    }
  }
  for (const id of deathReplayHistory.keys()) {
    if (!liveIds.has(id) && deathReplay?.culpritId !== id) deathReplayHistory.delete(id);
  }
}

function deathReplaySamplesFor(body, lvl) {
  const samples = (deathReplayHistory.get(body.id) || []).slice();
  const last = samples[samples.length - 1];
  if (!last || last.x !== body.position.x || last.y !== body.position.y) {
    samples.push({
      t: totalMs,
      x: body.position.x,
      y: body.position.y,
      a: body.angle,
      lvl,
    });
  }
  return samples.length ? samples : [{ t: totalMs, x: body.position.x, y: body.position.y, a: body.angle, lvl }];
}

function startDeathReplay(body, lvl) {
  const samples = deathReplaySamplesFor(body, lvl);
  if (!samples.length) return false;
  deathReplay = {
    culpritId: body.id,
    lvl,
    samples,
    elapsedMs: 0,
    durationMs: DEATH_REPLAY_DURATION_MS,
  };
  overlayEl.classList.remove("visible");
  return true;
}

function finishDeathReplay() {
  deathReplay = null;
  overlayEl.classList.add("visible");
}

function tickDeathReplay(dt) {
  if (!deathReplay) return;
  deathReplay.elapsedMs += dt;
  if (deathReplay.elapsedMs >= deathReplay.durationMs) finishDeathReplay();
}

function deathReplayProgress() {
  if (!deathReplay) return 0;
  return Math.max(0, Math.min(1, deathReplay.elapsedMs / deathReplay.durationMs));
}

function interpolateDeathReplaySample(progress = deathReplayProgress()) {
  if (!deathReplay) return null;
  const samples = deathReplay.samples;
  if (samples.length === 1) return samples[0];
  const start = samples[0].t;
  const end = samples[samples.length - 1].t;
  const target = start + (end - start) * progress;
  let i = 1;
  while (i < samples.length && samples[i].t < target) i++;
  const prev = samples[Math.max(0, i - 1)];
  const next = samples[Math.min(samples.length - 1, i)];
  const span = Math.max(1, next.t - prev.t);
  const t = Math.max(0, Math.min(1, (target - prev.t) / span));
  return {
    t: target,
    x: lerp(prev.x, next.x, t),
    y: lerp(prev.y, next.y, t),
    a: lerp(prev.a || 0, next.a || 0, t),
    lvl: deathReplay.lvl,
  };
}

function currentDeathReplayCamera() {
  if (!deathReplay) return null;
  const sample = interpolateDeathReplaySample();
  if (!sample) return null;
  const zoomIn = Math.min(1, deathReplay.elapsedMs / 650);
  return {
    sample,
    zoom: lerp(1.08, 2.65, easeOutCubic(zoomIn)),
    progress: deathReplayProgress(),
  };
}

function applyDeathReplayCamera(ctx, camera) {
  ctx.translate(W / 2, H / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.sample.x, -camera.sample.y);
}

function replayBodyFor(body, sample) {
  const replayBody = Object.create(body);
  replayBody.position = { x: sample.x, y: sample.y };
  replayBody.angle = sample.a || 0;
  replayBody.id = body.id;
  return replayBody;
}

function drawDeathReplayTrail(ctx, camera) {
  if (!deathReplay || deathReplay.samples.length < 2) return;
  const currentT = deathReplay.samples[0].t + (deathReplay.samples[deathReplay.samples.length - 1].t - deathReplay.samples[0].t) * camera.progress;
  ctx.save();
  ctx.strokeStyle = "rgba(125, 223, 255, 0.58)";
  ctx.lineWidth = 5 / camera.zoom;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  let started = false;
  for (const sample of deathReplay.samples) {
    if (sample.t > currentT) break;
    if (!started) {
      ctx.moveTo(sample.x, sample.y);
      started = true;
    } else {
      ctx.lineTo(sample.x, sample.y);
    }
  }
  if (started) ctx.lineTo(camera.sample.x, camera.sample.y);
  ctx.stroke();
  ctx.restore();
}

function drawDeathReplayFocus(ctx, camera) {
  const rad = r(deathReplay.lvl);
  const pulse = 0.75 + 0.25 * Math.sin(deathReplay.elapsedMs * 0.012);
  ctx.save();
  ctx.strokeStyle = `rgba(125, 223, 255, ${pulse})`;
  ctx.lineWidth = 5 / camera.zoom;
  ctx.beginPath();
  ctx.arc(camera.sample.x, camera.sample.y, rad * 1.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawDeathReplayCaption(ctx) {
  if (!deathReplay) return;
  const name = SHAPES[deathReplay.lvl]?.name || "Planet";
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = "rgba(6, 12, 22, 0.62)";
  ctx.strokeStyle = "rgba(125, 223, 255, 0.58)";
  ctx.lineWidth = 1.5;
  const label = `Replay: ${name} fell out`;
  ctx.font = "800 24px 'Fredoka', 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const labelW = Math.min(W - 64, Math.max(270, ctx.measureText(label).width + 48));
  const x = W / 2 - labelW / 2;
  const y = 24;
  ctx.fillRect(x, y, labelW, 50);
  ctx.strokeRect(x, y, labelW, 50);
  ctx.fillStyle = "#e3f5ff";
  ctx.shadowColor = "rgba(125, 223, 255, 0.7)";
  ctx.shadowBlur = 12;
  ctx.fillText(label, W / 2, y + 25);
  ctx.restore();
}

function drawDangerDashes(ctx, progress = 0) {
  const y = PLAYER_CONTAINER_Y + PLAYER_MARKER_H / 2 + DANGER_DASH_OFFSET_Y;
  const pulse = 0.5 + 0.5 * Math.sin(totalMs * 0.012);
  const alpha = Math.min(0.96, 0.54 + pulse * 0.22 + progress * 0.2);
  ctx.save();
  ctx.strokeStyle = `rgba(255, 70, 70, ${alpha})`;
  ctx.lineWidth = 4 + progress * 2;
  ctx.lineCap = "round";
  ctx.setLineDash([18, 14]);
  ctx.lineDashOffset = -totalMs * 0.04;
  ctx.shadowColor = "rgba(255, 70, 70, 0.55)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(WALL_X + 12, y);
  ctx.lineTo(W - WALL_X - 12, y);
  ctx.stroke();
  ctx.restore();
}

/* ── DOM ─────────────────────────────────────────────────────────────── */
// The live score now shows on the canvas (drawScoreShadow); the HUD chip was
// removed. Keep a stub so the existing score-write calls stay harmless no-ops.
const scoreEl = document.getElementById("score") || {};
const finalEl = document.getElementById("final-score");
const lossReasonEl = document.getElementById("loss-reason");
const overlayEl = document.getElementById("game-over-overlay");
const restartEl = document.getElementById("restart-btn");
const canvasWrapper = document.getElementById("canvas-wrapper");
const autoPilotPanel = document.getElementById("autopilot-panel");
const autoPilotStartBtn = document.getElementById("autopilot-start");
const autoPilotCrazyBtn = document.getElementById("autopilot-crazy");
const chooseLabel = document.getElementById("choose-label");
const destroyOverlay = document.getElementById("destroy-overlay");
const destroyTextEl = document.getElementById("destroy-text");
const destroyCopyEl = document.getElementById("destroy-copy");
const DESTROY_HELP_KEY = "planet-merge-destroy-help-seen";
let destroyHelpSeenThisSession = false;

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
   happily lets it sit there forever. So when a planet is perched on the apex
   of ONE other planet, push it a hair toward whichever side it's leaning.

   Critically, only a *solo* perch is nudged. A planet nestled in a pocket
   between several neighbours is laterally supported and physically stable —
   nudging it every tick just makes it fight its neighbours forever, which is
   the "settled pile keeps jittering / can't sit still" bug. So we first count
   each planet's planet-on-planet contacts this tick and skip anything with
   more than one (or that has already gone to sleep). */
Events.on(engine, "collisionActive", ({ pairs }) => {
  // Pass 1: count planet-planet contacts per body, and collect the near-vertical
  // (stacked) pairs. Walls/floor have no bodyLvl, so they don't count as support.
  const contactCount = new Map();
  const stacked = [];
  for (const pair of pairs) {
    const bA = pair.bodyA.parent;
    const bB = pair.bodyB.parent;
    if (!bodyLvl.has(bA.id) || !bodyLvl.has(bB.id)) continue;
    contactCount.set(bA.id, (contactCount.get(bA.id) || 0) + 1);
    contactCount.set(bB.id, (contactCount.get(bB.id) || 0) + 1);
    if (Math.abs(pair.collision.normal.x) <= 0.08) stacked.push({ bA, bB });
  }

  // Pass 2: topple only the lone, awake, slow perches.
  for (const { bA, bB } of stacked) {
    const top = bA.position.y < bB.position.y ? bA : bB;
    const bot = top === bA ? bB : bA;

    if (top.isSleeping) continue;                       // settled — leave it be
    if ((contactCount.get(top.id) || 0) > 1) continue;  // supported by neighbours
    if (Math.abs(top.velocity.x) > 0.25) continue;      // already sliding off

    const dx = top.position.x - bot.position.x;
    const dir =
      Math.abs(dx) < 0.3
        ? Math.random() < 0.5
          ? -1
          : 1 // dead-centre → random side
        : Math.sign(dx); // off-centre → fall toward that side
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
  // Chain bookkeeping stays in raw units; the mode's score multiplier is
  // applied only to what actually lands on the score (Level 1 x1.2, etc).
  score += Math.round((contribution - chainScorePrev) * modeScoreMult());
  chainScorePrev = contribution;

  if (chainCount < 2) return;

  // Choose is always earnable; Eliminate (destroy) only while the current level
  // still allows it. Unlock messages fire when a threshold is first crossed;
  // otherwise the running chain number is shown, scaled up.
  const canEliminate = curLevel().eliminate;
  const canChoose = choosePowerAllowed();
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
    armDestroyPower({ lockSound: true });
    // Destroy supersedes Choose Planet; having both prompts active at once is
    // confusing. Drop any pending choose charge when destroy unlocks.
    if (powerCharges > 0) {
      powerCharges = 0;
      updatePowerUI();
    }
  }
}

function resetChain() {
  chainCount = 0;
  chainBase = 0;
  chainScorePrev = 0;
}

function chooseReadyDuration() {
  return Math.max(0, BALANCE.CHOOSE_READY_MS ?? 3000);
}

function choosePowerAllowed() {
  return curLevel().choose && !autoPilotActive;
}

function chooseCountdownActive() {
  return choosePowerAllowed() && powerCharges > 0 && chooseReadyMs > 0;
}

function syncChooseReadyUI() {
  const ready = chooseCountdownActive();
  canvasWrapper.classList.toggle("choose-ready", ready);
  if (chooseLabel) chooseLabel.textContent = ready ? "Get ready to choose a planet" : "Drop Planet!";
}

function updatePowerUI() {
  if (!choosePowerAllowed() && powerCharges > 0) {
    powerCharges = 0;
  }
  const active = choosePowerAllowed() && powerCharges > 0;
  const wasActive = canvasWrapper.classList.contains("power-active");
  canvasWrapper.classList.toggle("power-active", active);
  if (active && !wasActive) {
    chooseReadyMs = chooseReadyDuration();
    chooseRotateMs = 0;
  } else if (!active) {
    chooseReadyMs = 0;
    chooseRotateMs = 0;
  }
  syncChooseReadyUI();
}

function clearChoosePower() {
  if (powerCharges === 0 && chooseReadyMs === 0 && chooseRotateMs === 0) return;
  powerCharges = 0;
  chooseReadyMs = 0;
  chooseRotateMs = 0;
  updatePowerUI();
}

// Auto-cycles the planet currently waiting to drop while Choose Planet is
// armed. The player times the normal drop tap instead of pressing arrows.
function advanceChoosePlanet() {
  if (powerCharges <= 0 || droppableLvls.length === 0) return;
  const i = droppableLvls.indexOf(curLvl);
  const j = i < 0 ? 0 : (i + 1) % droppableLvls.length;
  curLvl = droppableLvls[j];
}

function tickChooseRotation(dt) {
  if (autoPilotActive) {
    clearChoosePower();
    return;
  }
  if (powerCharges <= 0 || !round.playing || round.gameOver || destroyCharges > 0) {
    chooseReadyMs = 0;
    chooseRotateMs = 0;
    syncChooseReadyUI();
    return;
  }
  if (!canDrop) {
    chooseRotateMs = 0;
    syncChooseReadyUI();
    return;
  }
  if (chooseReadyMs > 0) {
    chooseReadyMs = Math.max(0, chooseReadyMs - dt);
    chooseRotateMs = 0;
    syncChooseReadyUI();
    return;
  }
  syncChooseReadyUI();
  const rotateMs = Math.max(1, BALANCE.CHOOSE_ROTATE_MS || 500);
  chooseRotateMs += dt;
  while (chooseRotateMs >= rotateMs) {
    chooseRotateMs -= rotateMs;
    advanceChoosePlanet();
  }
}

/* ── DESTROY POWER ──────────────────────────────────────────────────────
   Unlocked at BALANCE.DESTROY_UNLOCK merges in a streak. Paints a pulsing red
   target on every planet on the board; the next canvas click picks a
   planet, and every body of that same level is destroyed. */

function updateDestroyUI() {
  const active = destroyCharges > 0;
  canvas.classList.toggle("destroy-armed", active);
  if (!destroyOverlay) return;
  const showHelp = active && !destroyHelpSeen();
  // The explanation is shown once. Later charges only show target crosshairs.
  destroyOverlay.style.display = showHelp ? "flex" : "none";
  destroyOverlay.classList.toggle("has-help", showHelp);
  destroyOverlay.classList.remove("compact");
  if (destroyCopyEl) destroyCopyEl.hidden = !showHelp;
  if (showHelp) markDestroyHelpSeen();
}

function armDestroyPower({ lockSound = true } = {}) {
  const wasActive = destroyCharges > 0;
  destroyCharges = 1;
  destroyDropsRemaining = DESTROY_DROP_GRACE;
  updateDestroyUI();
  if (!wasActive) {
    if (lockSound) playTargetLockThenConstant();
    else startTargetLockConstant();
  }
}

function clearDestroyPower() {
  destroyCharges = 0;
  destroyDropsRemaining = 0;
  stopTargetLockConstant();
  updateDestroyUI();
}

function tickDestroyDropExpiry() {
  if (destroyCharges <= 0 || getForceDestroy()) return;
  destroyDropsRemaining = Math.max(0, destroyDropsRemaining - 1);
  if (destroyDropsRemaining <= 0) clearDestroyPower();
}

function syncForcedPowersFromDev() {
  if (getForceDestroy()) {
    armDestroyPower();
    if (powerCharges > 0) {
      powerCharges = 0;
      updatePowerUI();
    }
  } else {
    clearDestroyPower();
  }

  if (autoPilotActive) {
    powerCharges = 0;
  } else if (getForceChoose() && destroyCharges === 0) {
    powerCharges = 1;
  } else if (!getForceChoose()) {
    powerCharges = 0;
  }
  updatePowerUI();
}

function destroyHelpSeen() {
  try {
    return localStorage.getItem(DESTROY_HELP_KEY) === "1";
  } catch (_) {
    return destroyHelpSeenThisSession;
  }
}

function markDestroyHelpSeen() {
  destroyHelpSeenThisSession = true;
  try {
    localStorage.setItem(DESTROY_HELP_KEY, "1");
  } catch (_) {}
}

/** Pulsing red crosshair overlay on every destroyable body. Mirrors the
 *  filter in useDestroyPower so the highlighted set matches what's actually
 *  hittable: untargetable big planets get no crosshair. */
function drawDestroyTargets(shapes = collectLiveShapes()) {
  const pulse = 0.55 + 0.45 * Math.sin(totalMs * 0.008);
  ctx.save();
  ctx.strokeStyle = `rgba(237, 10, 237, ${pulse})`; // pink
  ctx.lineWidth = 9;
  for (const { body, lvl } of shapes) {
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
  const { minX, maxX } = dropBounds(lvl);
  return Math.max(minX, Math.min(maxX, dropX));
}

function dropBounds(lvl = curLvl) {
  const rad = r(lvl);
  const markerHalf = PLAYER_MARKER_W / 2;
  const minX = Math.max(WALL_X + rad + 2, markerHalf);
  const maxX = Math.min(W - WALL_X - rad - 2, W - markerHalf);
  return { minX, maxX };
}

function dropYFor(lvl = curLvl) {
  return PLAYER_CONTAINER_Y + PLAYER_MARKER_H / 2 + DROP_GAP + r(lvl);
}

function chooseCountdownNumber() {
  return Math.max(1, Math.ceil(chooseReadyMs / 1000));
}

function drawChooseCountdown(ctx, x, y, rad) {
  const circleRad = Math.max(rad, 40);
  ctx.save();
  ctx.globalAlpha = 0.96;
  ctx.fillStyle = "rgba(8, 12, 22, 0.9)";
  ctx.beginPath();
  ctx.arc(x, y, circleRad, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(125, 223, 255, 0.55)";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#e3f5ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(circleRad * 1.08)}px 'Fredoka', 'Segoe UI', Arial, sans-serif`;
  ctx.shadowColor = "rgba(125, 223, 255, 0.75)";
  ctx.shadowBlur = 14;
  ctx.fillText(String(chooseCountdownNumber()), x, y + 1);

  ctx.restore();
}

function floorYFor(lvl) {
  return H - WALL - r(lvl) - 3;
}

function bodyOutsideContainerX(body, lvl) {
  const rad = r(lvl);
  return (
    body.position.x < WALL_X + rad - SIDE_WALL_ESCAPE_SLACK ||
    body.position.x > W - WALL_X - rad + SIDE_WALL_ESCAPE_SLACK
  );
}

function bodyNoLongerVisible(body, lvl) {
  return body.position.y - r(lvl) > H;
}

function bodyReachedOpenRim(body, lvl) {
  const rad = r(lvl);
  return body.position.y <= WALL_TOP + rad * 0.42;
}

function keepBodyInsideSideWalls(body, lvl) {
  const rad = r(lvl);
  const minX = WALL_X + rad + 2;
  const maxX = W - WALL_X - rad - 2;
  const x = Math.max(minX, Math.min(maxX, body.position.x));
  if (Math.abs(x - body.position.x) < 0.01) return;
  Body.setPosition(body, { x, y: body.position.y });
  Body.setVelocity(body, { x: 0, y: body.velocity.y });
  Body.setAngularVelocity(body, body.angularVelocity * 0.35);
  Sleeping.set(body, false);
}

function recoverBodyAboveFloor(body, lvl) {
  const rad = r(lvl);
  Body.setPosition(body, {
    x: Math.max(WALL_X + rad + 2, Math.min(W - WALL_X - rad - 2, body.position.x)),
    y: floorYFor(lvl),
  });
  Body.setVelocity(body, { x: 0, y: 0 });
  Body.setAngularVelocity(body, 0);
  Sleeping.set(body, false);
}

function keepBodyAboveFloor(body, lvl) {
  const maxContactY = H - WALL - r(lvl) + 2;
  if (body.position.y <= maxContactY) return;
  const y = floorYFor(lvl);
  Body.setPosition(body, { x: body.position.x, y });
  Body.setVelocity(body, {
    x: body.velocity.x * 0.92,
    y: Math.min(0, body.velocity.y),
  });
  Body.setAngularVelocity(body, body.angularVelocity * 0.65);
  Sleeping.set(body, false);
}

function preventIllegalContainerEscapes(shapes = collectLiveShapes()) {
  for (const { body, lvl } of shapes) {
    if (rimEscapedIds.has(body.id)) continue;

    const outside = bodyOutsideContainerX(body, lvl);
    if (outside) {
      if (bodyReachedOpenRim(body, lvl)) continue;
      keepBodyInsideSideWalls(body, lvl);
    }
    keepBodyAboveFloor(body, lvl);
  }
}

function updatePlayerTilt(markerX) {
  const dx = markerX - playerMarkerPrevX;
  const target = Math.max(-PLAYER_TILT_MAX, Math.min(PLAYER_TILT_MAX, dx * PLAYER_TILT_PER_PX));
  playerMarkerTilt += (target - playerMarkerTilt) * PLAYER_TILT_EASE;
  if (Math.abs(dx) < 0.01 && Math.abs(playerMarkerTilt) < 0.001) playerMarkerTilt = 0;
  playerMarkerPrevX = markerX;
  return playerMarkerTilt;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function markerNextSlotRadius() {
  return (PLAYER_MARKER_H * PLAYER_MARKER_NEXT_SLOT_SCALE) / 2;
}

function markerNextSlotY(rad = markerNextSlotRadius()) {
  return PLAYER_MARKER_H / 2 - PLAYER_MARKER_H * PLAYER_MARKER_PLANET_BOTTOM_PAD - rad;
}

function startNextHandoff(lvl) {
  const fromRad = markerNextSlotRadius();
  const localY = markerNextSlotY(fromRad);
  nextHandoff = {
    lvl,
    startMs: totalMs,
    fromLocalY: localY,
    fromRad,
    toRad: r(lvl),
  };
}

function currentNextHandoff() {
  if (!nextHandoff) return null;
  const raw = Math.max(0, Math.min(1, (totalMs - nextHandoff.startMs) / NEXT_HANDOFF_MS));
  if (raw >= 1) {
    nextHandoff = null;
    return null;
  }
  return { anim: nextHandoff, raw, eased: easeOutCubic(raw) };
}

function autoPilotAvailable() {
  return !mobilePerfMode();
}

function autoPilotFastActive() {
  return autoPilotActive && autoPilotSpeed === AUTO_PILOT_FAST_SPEED;
}

function autoPilotMotionSpeed() {
  return autoPilotFastActive() && mobilePerfMode() ? MOBILE_AUTO_FAST_MOTION : autoPilotSpeed;
}

function renderLiteMode() {
  return autoPilotFastActive() && mobilePerfMode();
}

function syncAutoPilotUI() {
  if (autoPilotActive && !autoPilotAvailable()) {
    autoPilotActive = false;
    autoPilotSpeed = 1;
  }
  const canShow = autoPilotAvailable() && round.playing && !round.gameOver;
  if (autoPilotPanel) {
    autoPilotPanel.hidden = !canShow;
    autoPilotPanel.classList.toggle("auto-active", autoPilotActive);
  }
  if (autoPilotStartBtn) {
    autoPilotStartBtn.setAttribute("aria-pressed", String(autoPilotActive));
    autoPilotStartBtn.setAttribute("aria-label", autoPilotActive ? "Stop Auto Pilot" : "Start Auto Pilot");
  }
  canvasWrapper?.classList.toggle("auto-pilot-active", autoPilotActive);
  if (autoPilotCrazyBtn) {
    const crazy = autoPilotSpeed === AUTO_PILOT_FAST_SPEED;
    autoPilotCrazyBtn.hidden = !canShow || !autoPilotActive;
    autoPilotCrazyBtn.textContent = crazy ? "Slow" : "Fast";
    autoPilotCrazyBtn.setAttribute("aria-pressed", String(crazy));
  }
}

function startAutoPilot() {
  if (!autoPilotAvailable() || !round.playing || round.gameOver) return;
  autoPilotActive = true;
  autoPilotDir = dropX < W / 2 ? 1 : -1;
  clearChoosePower();
  syncAutoPilotUI();
}

function stopAutoPilot() {
  autoPilotActive = false;
  autoPilotSpeed = 1;
  syncAutoPilotUI();
}

function toggleAutoPilot() {
  if (autoPilotActive) {
    stopAutoPilot();
  } else {
    startAutoPilot();
  }
}

function toggleAutoPilotCrazy() {
  autoPilotSpeed = autoPilotSpeed === AUTO_PILOT_FAST_SPEED ? 1 : AUTO_PILOT_FAST_SPEED;
  syncAutoPilotUI();
}

function dropCooldownMs() {
  if (!autoPilotActive) return BALANCE.DROP_COOLDOWN_MS;
  const base = BALANCE.DROP_COOLDOWN_MS / autoPilotSpeed;
  if (!autoPilotFastActive() || !mobilePerfMode()) return base;
  const mobileFloor =
    active.size >= MOBILE_AUTO_FAST_BUSY_BODY_COUNT
      ? MOBILE_AUTO_FAST_BUSY_DROP_MS
      : MOBILE_AUTO_FAST_MIN_DROP_MS;
  return Math.max(base, mobileFloor);
}

function tickAutoPilot(dt) {
  if (!autoPilotActive || !round.playing || round.gameOver) return;
  if (!autoPilotAvailable()) {
    stopAutoPilot();
    return;
  }
  if (powerCharges > 0 || chooseReadyMs > 0 || chooseRotateMs > 0) clearChoosePower();
  const { minX, maxX } = dropBounds(curLvl);
  const motionSpeed = autoPilotMotionSpeed();
  let nextX = dropX + autoPilotDir * AUTO_PILOT_BASE_SWEEP * motionSpeed * dt;
  if (nextX > maxX) {
    nextX = maxX - (nextX - maxX);
    autoPilotDir = -1;
  } else if (nextX < minX) {
    nextX = minX + (minX - nextX);
    autoPilotDir = 1;
  }
  dropX = Math.max(minX, Math.min(maxX, nextX));
  if (canDrop && !chooseCountdownActive()) {
    const sx = clampedDropX();
    if (!dropBlockedAt(sx, curLvl)) drop({ skipBlockedCheck: true });
  }
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
  clearDestroyPower();
  if (getForceDestroy()) {
    armDestroyPower();
  }
  return true;
}

// A mode that bans a power drops any charge still in the player's hand. All
// three current modes allow both powers, so today this only matters for the
// dev force-toggles and for future modes that reintroduce bans.
function revokeBannedCharges() {
  if (!curLevel().eliminate && !getForceDestroy() && destroyCharges > 0) {
    clearDestroyPower();
  }
  if (!curLevel().choose && !getForceChoose() && powerCharges > 0) {
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
    const sy = Math.min(Math.max(WALL_TOP + newR + 6, my), floorYFor(newLvl));
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
    scoreEl.textContent = formatScore(score);
    recordHigh(score);
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
    // Two Suns pay a big bonus and the run keeps going. Touching them is also
    // how a mode is WON: record it (first time shows the unlock banner).
    const bonus = Math.round(VANISH_BONUS * modeScoreMult());
    score += bonus;
    mergeCount++;
    scoreEl.textContent = formatScore(score);
    recordHigh(score);
    revokeBannedCharges();
    markModeWon(getLevel());
    playPop();
    flashes.push({ x: mx, y: my, t: totalMs, big: true });
    popups.push({ x: mx, y: my, t: totalMs, text: "+" + bonus, big: true });
  }
}

/* ── DROP ────────────────────────────────────────────────────────────── */
function drop({ skipBlockedCheck = false } = {}) {
  if (!canDrop || round.gameOver || perksOpen() || levelInfoOpen() || isProtected()) return false;
  if (chooseCountdownActive()) return false;
  const { minX, maxX } = dropBounds(curLvl);
  const sx = Math.max(minX, Math.min(maxX, dropX));
  // A planet in the way at this spot: refuse (the preview shows the red cross).
  // Refusing must NOT reset the chain, only a real drop starts a fresh one.
  if (!skipBlockedCheck && dropBlockedAt(sx, curLvl)) return false;
  const destroyWasActive = destroyCharges > 0;
  // Every drop starts a fresh chain — powers are earned by chains spawned
  // from ONE drop's cascade, never by accumulation across drops.
  resetChain();
  spawn(sx, dropYFor(curLvl), curLvl, totalMs);
  // Note: dropping a planet does NOT earn its perk — only merging UP to it
  // does (handled in flushMerges). So a chosen/dropped Mercury grants nothing.
  const incomingLvl = nxtLvl;
  startNextHandoff(incomingLvl);
  curLvl = incomingLvl;
  nxtLvl = pickLvl();
  canDrop = false;
  cooldown = dropCooldownMs();
  if (powerCharges > 0) {
    powerCharges--;
    if (powerCharges === 0) updatePowerUI();
  }
  if (!autoPilotActive && getForceChoose() && powerCharges === 0) {
    powerCharges = 1;
    updatePowerUI();
  }
  if (destroyWasActive) tickDestroyDropExpiry();
  drawNext(nxtCtx, nxtCanvas, nxtLvl);
  maybeAutoShake(); // Level 7+: a drop may kick off a random earthquake burst
  return true;
}

/* ── GAME OVER ───────────────────────────────────────────────────────── */
// The red dashed line is only a warning. Falling out still ends only after a
// planet has escaped through the open top and fallen out of the visible canvas.
// If physics nudges a planet through a side wall or floor while it is still
// inside the board, push it back instead.
function checkOver(shapes = collectLiveShapes()) {
  if (isProtected()) return; // shielded while shaking: no game over
  for (const { body, lvl } of shapes) {
    const id = body.id;
    if (totalMs - (bodyBorn.get(id) || 0) < 1600) continue; // grace period

    const outside = bodyOutsideContainerX(body, lvl);
    if (outside) {
      if (bodyReachedOpenRim(body, lvl)) {
        rimEscapedIds.add(id);
      } else if (!rimEscapedIds.has(id)) {
        keepBodyInsideSideWalls(body, lvl);
        continue;
      }
    } else if (rimEscapedIds.has(id) && body.position.y > WALL_TOP + r(lvl)) {
      rimEscapedIds.delete(id);
    }

    if (!rimEscapedIds.has(id) && !outside && body.position.y > floorYFor(lvl) + r(lvl) * 0.55) {
      recoverBodyAboveFloor(body, lvl);
      continue;
    }

    if (bodyNoLongerVisible(body, lvl)) {
      endGame("planet-out", { body, lvl });
      return;
    }

    if (body.position.y > H + 40 && !outside) {
      recoverBodyAboveFloor(body, lvl);
    }
  }
}

/* ── DROP ROOM ───────────────────────────────────────────────────────────
   dropBlockedAt: a planet on the board overlaps the drop spot, so dropping
   there would spawn inside it. drop() refuses and the preview shows the
   blocked look (dimmed, red cross, hurt face). Board planets are treated as
   circles; close enough for a hint and a refusal.

   checkBoardFull: the second lose condition. When EVERY sampled spot across
   the width is blocked for a Venus-sized drop (BOARD_ROOM_TEST_LVL), the run
   ends after NO_ROOM_MS.
   The dwell time rides out a chain mid-cascade, where planets fly everywhere
   for a moment but the board still has room once it settles. */
function dropBlockedAt(sx, lvl, shapes = collectLiveShapes()) {
  const rad = r(lvl);
  for (const { body, rad: otherRad } of shapes) {
    const dx = body.position.x - sx;
    const dy = body.position.y - dropYFor(lvl);
    const reach = rad + otherRad - 2; // small slack so a graze doesn't block
    if (dx * dx + dy * dy < reach * reach) return true;
  }
  return false;
}

function boardFull(shapes = collectLiveShapes()) {
  const { minX, maxX } = dropBounds(BOARD_ROOM_TEST_LVL);
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    if (!dropBlockedAt(minX + ((maxX - minX) * i) / steps, BOARD_ROOM_TEST_LVL, shapes)) return false;
  }
  return true;
}

let noRoomMs = 0;
let boardFullCheckMs = 0;
function boardFullArmed(shapes = collectLiveShapes()) {
  const armY = H - (H - WALL_TOP) * BOARD_FULL_ARM_FROM_BOTTOM_RATIO;
  return shapes.some(({ body, rad }) => {
    if (totalMs - (bodyBorn.get(body.id) || 0) < BOARD_FULL_ARM_MIN_AGE_MS) return false;
    return body.position.y - rad <= armY;
  });
}

function checkBoardFull(dt, shapes = collectLiveShapes()) {
  // Only while the player could actually drop: cooldown chaos doesn't count,
  // the shake shield suspends losing just like it does for checkOver, and an
  // active falling escape gets priority so the death replay can show it.
  if (!canDrop || isProtected() || chooseCountdownActive() || rimEscapedIds.size > 0 || !boardFullArmed(shapes)) {
    noRoomMs = 0;
    boardFullCheckMs = 0;
    return;
  }
  boardFullCheckMs += dt;
  if (boardFullCheckMs < BOARD_FULL_CHECK_MS) return;
  const elapsed = boardFullCheckMs;
  boardFullCheckMs = 0;
  if (!boardFull(shapes)) {
    noRoomMs = 0;
    return;
  }
  noRoomMs += elapsed;
  if (noRoomMs >= BALANCE.NO_ROOM_MS) endGame("no-room");
}

function endGame(reason = "unknown", detail = {}) {
  if (round.gameOver) return;
  round.gameOver = true;
  stopAutoPilot();
  clearDestroyPower();
  finalEl.textContent = formatScore(score);
  const culpritName = detail.lvl !== undefined ? SHAPES[detail.lvl]?.name : "";
  if (lossReasonEl) {
    lossReasonEl.textContent =
      reason === "planet-out"
        ? `Lost because ${culpritName || "a planet"} fell out of the board.`
        : reason === "no-room"
          ? `Lost because there was no room for a ${SHAPES[BOARD_ROOM_TEST_LVL].name}-sized drop.`
          : "Lost because the run ended.";
  }
  reportGameEnd("lost", score, getLevel());
  clearSave(); // a finished game shouldn't offer a resume
  bankPlayTime();
  addPoints(score); // the run's score joins the lifetime points balance
  syncPointsUI();
  if (mergeCount < 100) earnPerk("lose-under-100"); // play the game in reverse
  if (mergeCount < 150) earnPerk("lose-under-150");
  const replayStarted =
    reason === "planet-out" &&
    detail.body &&
    detail.lvl !== undefined &&
    startDeathReplay(detail.body, detail.lvl);
  if (!replayStarted) overlayEl.classList.add("visible");

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
  tickDeathReplay(dt);

  // Shake shield: raise the rainbow arch (and suspend the danger check) while a
  // shake is in progress; drop it once the window passes or the game ends.
  tickShield();
  tickChooseRotation(dt);
  tickAutoPilot(dt);

  if (!round.gameOver && round.playing) {
    // Dev-panel Phys readout: time the whole physics drain (engine steps plus
    // the per-step passes below). Two performance.now() calls per frame; the
    // readout itself only touches the DOM twice a second in dev-panel.js.
    const physStart = performance.now();
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
      const tickShapes = collectLiveShapes();
      preventIllegalContainerEscapes(tickShapes);
      separatePenetrations(tickShapes);
      recordDeathReplayHistory(tickShapes);
      checkOver(tickShapes);
      checkBoardFull(PHYS_STEP, tickShapes);
      if (round.gameOver) break;

      if (!autoPilotActive && isAutoDropOn() && canDrop) {
        const { minX, maxX } = dropBounds(curLvl);
        dropX = minX + getAutoDropX() * (maxX - minX);
        drop();
        recordDevDrop();
      }
    }
    recordPhysMs(performance.now() - physStart);
  }

  /* Background: wipe to fully transparent first. The open area above the
     container (the drop chute, and the corners where the walls are cut
     away) is left untouched after this, on purpose, so the page's own
     starfield canvas shows straight through with no seam, no border, no
     tint. Only the container itself (from WALL_TOP down) gets painted. */
  ctx.clearRect(0, 0, W, H);
  const deathCamera = currentDeathReplayCamera();
  if (deathCamera) {
    ctx.fillStyle = "#08101d";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    applyDeathReplayCamera(ctx, deathCamera);
  }
  ctx.fillStyle = playfieldGradient;
  ctx.fillRect(WALL_X, WALL_TOP, W - 2 * WALL_X, H - WALL_TOP);

  /* Twinkling stars (behind everything else, in front of the gradient).
     Spans the full canvas, including the open area above the container, so
     it layers a second, faster-twinkling star field over the page's own
     backdrop there. */
  ctx.fillStyle = "#fff6d6";
  const starCount = renderLiteMode() ? MOBILE_AUTO_FAST_STAR_COUNT : stars.length;
  for (let i = 0; i < starCount; i++) {
    const s = stars[i];
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
  ctx.fillRect(WALL_X - WALL, WALL_TOP, WALL, H - WALL_TOP);
  ctx.fillRect(W - WALL_X, WALL_TOP, WALL, H - WALL_TOP);
  ctx.fillRect(WALL_X, H - WALL, W - 2 * WALL_X, WALL);

  /* A thin border tracing ONLY the container's real outline (flat top at
     WALL_TOP, since the rim is cut there, not the whole canvas). This used
     to come from a CSS box-shadow on the canvas wrapper, but that box
     covered the full canvas rectangle, including the open top, and drew a
     border there too. Keeping it in the draw call ties it to the actual
     container shape. */
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(WALL_X - WALL + 1, WALL_TOP, W - 2 * (WALL_X - WALL) - 2, H - WALL_TOP - 1);


  /* Rainbow shield arch, only while a shake has it raised. */
  drawShield(ctx);

  /* Effects → bodies → score popups (draw order matters). Bodies render in three
     global passes so decorative accessories are layered against EVERY planet, not
     just their own: all back accessories (Saturn's ring, the Sun's corona) go
     behind every body, then all bodies + faces, then front accessories (the Sun's
     sunglasses) on top. That way an accessory can never cover a neighbouring
     planet. */
  const renderShapes = collectLiveShapes();
  drawFlashes(ctx, flashes, totalMs);
  if (deathCamera) drawDeathReplayTrail(ctx, deathCamera);
  const bodyToDraw = (body) =>
    deathCamera && deathReplay && body.id === deathReplay.culpritId
      ? replayBodyFor(body, deathCamera.sample)
      : body;
  for (const { body } of renderShapes) drawBody(ctx, bodyToDraw(body), bodyLvl, totalMs, "back");
  for (const { body } of renderShapes) drawBody(ctx, bodyToDraw(body), bodyLvl, totalMs, "body");
  for (const { body } of renderShapes) drawBody(ctx, bodyToDraw(body), bodyLvl, totalMs, "front");
  drawUnlockGlows(
    ctx,
    unlockGlows,
    (id) => Composite.get(world, id, "body"),
    getOutlineSets,
    bodyLvl,
    totalMs,
  );
  if (destroyCharges > 0) drawDestroyTargets(renderShapes);
  if (round.playing && !round.gameOver && !deathCamera && !isProtected() && boardFullArmed(renderShapes)) {
    drawDangerDashes(ctx, Math.min(1, noRoomMs / BALANCE.NO_ROOM_MS));
  }
  drawPopups(ctx, popups, totalMs);

  applyPendingTouchAim();
  const markerX = clampedDropX();
  const markerTilt = updatePlayerTilt(markerX);
  const skipShipBeam = mobilePerfMode();
  const showingWaiting = canDrop && !round.gameOver;
  const showingChooseCountdown = showingWaiting && chooseCountdownActive();
  const waitingBlocked = showingWaiting && !showingChooseCountdown && dropBlockedAt(markerX, curLvl, renderShapes);
  const handoff = currentNextHandoff();
  const nextSlotScale = handoff ? handoff.eased : 1;

  /* Big total score in the sky, always visible during a round. The player
     marker skin casts the moving shadow on the digits. */
  if (!round.gameOver && round.playing) {
    const scoreText = formatScore(score);
    if (mobilePerfMode()) {
      drawMobileScoreText(ctx, scoreText);
    } else {
      drawScoreShadow(ctx, scoreFx, scoreText, markerX, SCORE_Y, PLAYER_CONTAINER_Y, markerTilt, W / 2);
    }
  }

  // SVG-backed player marker/skin, centered on the live aim point. It carries
  // the NEXT planet while the current planet waits below it.
  if (!round.gameOver && round.playing) {
    drawPlayerMarker(ctx, markerX, PLAYER_CONTAINER_Y, markerTilt, nxtLvl, false, nextSlotScale, {
      skipBeam: skipShipBeam,
    });
  }

  if (handoff) {
    const { anim, eased: t } = handoff;
    const fromLocalY = anim.fromLocalY ?? markerNextSlotY(anim.fromRad);
    const fromX = markerX - Math.sin(markerTilt) * fromLocalY;
    const fromY = PLAYER_CONTAINER_Y + Math.cos(markerTilt) * fromLocalY;
    const toX = clampedDropX(anim.lvl);
    const toY = dropYFor(anim.lvl);
    drawPreview(
      ctx,
      anim.lvl,
      lerp(fromX, toX, t),
      lerp(fromY, toY, t),
      0,
      lerp(anim.fromRad, anim.toRad, t),
      false,
    );
  }

  /* Drop guide + current planet waiting to fall (hidden while aiming the destroy power). */
  if (showingWaiting) {
    const rad = r(curLvl);
    const sx = markerX;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.11)";
    ctx.setLineDash([4, 7]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, PLAYER_CONTAINER_Y + PLAYER_MARKER_H / 2 + 2);
    ctx.lineTo(sx, H - WALL);
    ctx.stroke();
    ctx.setLineDash([]);
    if (showingChooseCountdown) {
      drawChooseCountdown(ctx, sx, dropYFor(curLvl), rad);
    } else {
      ctx.globalAlpha = waitingBlocked ? 0.7 : 0.88;
      drawPreview(ctx, curLvl, sx, dropYFor(curLvl), 0, rad, waitingBlocked);
    }
    ctx.restore();
  }

  if (deathCamera) {
    drawDeathReplayFocus(ctx, deathCamera);
    ctx.restore();
    drawDeathReplayCaption(ctx);
  }

  requestAnimationFrame(frame);
}

/* ── INPUT ───────────────────────────────────────────────────────────── */
let touchAimRect = null;
let pendingTouchClientX = null;

function cacheTouchAimRect() {
  touchAimRect = canvas.getBoundingClientRect();
  return touchAimRect;
}

function queueTouchAim(clientX) {
  pendingTouchClientX = clientX;
}

function applyPendingTouchAim() {
  if (pendingTouchClientX === null || autoPilotActive) return;
  const rect = touchAimRect || cacheTouchAimRect();
  if (rect.width > 0) dropX = (pendingTouchClientX - rect.left) * (W / rect.width);
  pendingTouchClientX = null;
}

function clearTouchAimCache() {
  touchAimRect = null;
  pendingTouchClientX = null;
}

canvas.addEventListener("mousemove", (e) => {
  if (autoPilotActive) return;
  const rect = canvas.getBoundingClientRect();
  dropX = (e.clientX - rect.left) * (W / rect.width);
});

canvas.addEventListener("click", (e) => {
  // When destroy power is armed, the click selects a target instead of
  // dropping only if it actually hits a target. Empty-space clicks still throw.
  if (destroyCharges > 0 && useDestroyPower(e.clientX, e.clientY)) {
    return;
  }
  if (autoPilotActive) return;
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
    if (autoPilotActive) {
      clearTouchAimCache();
      return;
    }
    const t = e.touches[0];
    if (!t) return;
    cacheTouchAimRect();
    queueTouchAim(t.clientX);
    applyPendingTouchAim();
  },
  { passive: false },
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    if (autoPilotActive) {
      clearTouchAimCache();
      return;
    }
    const t = e.touches[0];
    if (t) queueTouchAim(t.clientX);
  },
  { passive: false },
);

canvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (destroyCharges > 0 && t && useDestroyPower(t.clientX, t.clientY)) {
      clearTouchAimCache();
      return;
    }
    if (autoPilotActive) {
      clearTouchAimCache();
      return;
    }
    if (t) queueTouchAim(t.clientX);
    applyPendingTouchAim();
    clearTouchAimCache();
    drop();
  },
  { passive: false },
);

canvas.addEventListener(
  "touchcancel",
  () => {
    clearTouchAimCache();
  },
  { passive: true },
);

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (autoPilotActive) return;
    drop();
  }
});

autoPilotStartBtn?.addEventListener("click", toggleAutoPilot);
autoPilotCrazyBtn?.addEventListener("click", toggleAutoPilotCrazy);
mobilePerfQuery?.addEventListener?.("change", () => {
  resizeGameCanvas();
  syncAutoPilotUI();
});
window.addEventListener("resize", () => {
  clearTouchAimCache();
  resizeGameCanvas();
  if (!autoPilotAvailable()) syncAutoPilotUI();
});
window.addEventListener("orientationchange", () => {
  clearTouchAimCache();
  resizeGameCanvas();
});

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
  deathReplay = null;
  deathReplayHistory.clear();
  rimEscapedIds.clear();
  nextDeathReplaySampleMs = 0;

  score = 0;
  mergeCount = 0;
  resetLevel();
  scoreEl.textContent = formatScore(0);
  resetShake();
  curLvl = firstDrop();
  nxtLvl = pickLvl();
  dropX = W / 2;
  playerMarkerPrevX = dropX;
  playerMarkerTilt = 0;
  nextHandoff = null;
  canDrop = true;
  cooldown = 0;
  totalMs = 0;
  physAcc = 0;
  noRoomMs = 0;
  boardFullCheckMs = 0;
  autoPilotActive = false;
  autoPilotSpeed = 1;
  round.gameOver = false;
  resetDevDrops();
  syncAutoPilotUI();

  resetChain();
  // Choose is always available; Eliminate only while the level allows it. The
  // dev-panel force-on toggles keep a charge primed for testing.
  powerCharges = getForceChoose() ? 1 : 0;
  if (getForceDestroy()) armDestroyPower();
  else clearDestroyPower();
  updatePowerUI();

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
  deathReplay = null;
  deathReplayHistory.clear();
  rimEscapedIds.clear();
  nextDeathReplaySampleMs = 0;
  noRoomMs = 0;
  boardFullCheckMs = 0;

  round.playing = false;
  round.gameOver = false;
  autoPilotActive = false;
  autoPilotSpeed = 1;
  syncAutoPilotUI();
  syncStartResumeUI();
  hideLegend();
  hideModeChooser();
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
const playLabelEl = playBtnEl?.querySelector(".play-label");
const resumeContinueBtn = document.getElementById("resume-continue");
const newGameConfirmEl = document.getElementById("new-game-confirm");
const cancelNewGameBtn = document.getElementById("cancel-new-game");
const confirmNewGameBtn = document.getElementById("confirm-new-game");

function hideNewGameConfirm() {
  newGameConfirmEl?.classList.remove("visible");
}

function showNewGameConfirm() {
  newGameConfirmEl?.classList.add("visible");
  cancelNewGameBtn?.focus();
}

function syncStartResumeUI() {
  const hasSave = !!loadSave();
  if (playLabelEl) playLabelEl.textContent = hasSave ? "New Game" : "Play";
  if (resumeContinueBtn) resumeContinueBtn.hidden = !hasSave;
  if (!hasSave) hideNewGameConfirm();
  syncPointsUI();
}

window.addEventListener("planet-merge-save-change", syncStartResumeUI);

/* ── MODE CHOOSER (New Game → pick a Level) ───────────────────────────────
   Rows are rebuilt on every open so lock/WON states are always current. A
   row: [planet icon] Level N + subline, and an ⓘ button opening the same
   info card the in-run LEVEL cell uses (levels.js renders it). Locked rows
   say what unlocks them and don't start a game. */
const modeOverlayEl = document.getElementById("mode-overlay");
const modeListEl = document.getElementById("mode-list");
const modeCloseEl = document.getElementById("mode-close");
const pointsBalanceEl = document.getElementById("points-balance");

// Lifetime points balance on the start screen (banked at each game over;
// later this becomes the currency for buying ship skins).
function syncPointsUI() {
  if (pointsBalanceEl) pointsBalanceEl.textContent = formatScore(getPoints());
}

function hideModeChooser() {
  modeOverlayEl?.classList.remove("visible");
}

function renderModeChooser() {
  if (!modeListEl) return;
  modeListEl.innerHTML = "";
  for (const m of MODES) {
    const unlocked = isModeUnlocked(m.num);
    const row = document.createElement("div");
    row.className = `mode-row${unlocked ? "" : " locked"}`;

    const icon = document.createElement("span");
    icon.className = "mode-row-icon";
    icon.innerHTML = planetIconHTML(m.iconLvl);

    const text = document.createElement("span");
    text.className = "mode-row-text";
    const sub = unlocked
      ? `x${m.scoreMult} points${isModeWon(m.num) ? ' · <span class="mode-won-badge">WON</span>' : ""}`
      : `Win ${MODES[m.num - 2]?.name || "the previous level"} to unlock`;
    text.innerHTML = `<span class="mode-row-name">${m.name}${unlocked ? "" : " 🔒"}</span>
      <span class="mode-row-sub">${sub}</span>`;

    const info = document.createElement("button");
    info.type = "button";
    info.className = "mode-row-info";
    info.setAttribute("aria-label", `About ${m.name}`);
    info.textContent = "ⓘ";
    info.addEventListener("click", (e) => {
      e.stopPropagation();
      openModeInfo(m.num);
    });

    row.append(icon, text, info);
    if (unlocked) {
      row.addEventListener("click", () => {
        playPop();
        hideModeChooser();
        setMode(m.num);
        startGame();
      });
    }
    modeListEl.appendChild(row);
  }
}

function showModeChooser() {
  renderModeChooser();
  modeOverlayEl?.classList.add("visible");
}

modeCloseEl?.addEventListener("click", () => {
  playSelect();
  hideModeChooser();
});

// A win landing mid-run keeps the chooser honest if it's somehow open, and
// the dev Unlock Modes button refreshes it the same way.
onModeWinsChange(() => {
  if (modeOverlayEl?.classList.contains("visible")) renderModeChooser();
});

playBtnEl?.addEventListener("mouseenter", () => playPlanetHit());
playBtnEl?.addEventListener("click", () => {
  playPop();
  if (dailyLimitReached()) {
    startGame(); // blocked inside startGame, which shows the limit message
    return;
  }
  if (loadSave()) {
    showNewGameConfirm();
    return;
  }
  showModeChooser();
});

cancelNewGameBtn?.addEventListener("click", () => {
  playSelect();
  hideNewGameConfirm();
});

confirmNewGameBtn?.addEventListener("click", () => {
  playPop();
  clearSave();
  syncStartResumeUI();
  hideNewGameConfirm();
  showModeChooser();
});

resumeContinueBtn?.addEventListener("click", () => {
  const saved = loadSave();
  if (!saved) {
    syncStartResumeUI();
    return;
  }
  playPop();
  restoreGame(saved);
  // One-time resume: consume the save so the player can't keep rewinding to the
  // same point. Leaving again mid-game writes a fresh save.
  clearSave();
  syncStartResumeUI();
});

// left→right and loops. The set is duplicated so the CSS marquee is seamless.
const SHIP_SKINS = [
  { name: "alien", asset: "ship-container_alien.svg" },
  { name: "baby", asset: "ship-container_baby.svg" },
  { name: "car", asset: "ship-container_car.svg" },
  { name: "native-indian", asset: "ship-container_native-indian.svg" },
];
const SHIP_SKIN_KEY = "planet-merge-ship-skin";
const shipPreviewEl = document.getElementById("ship-preview");
const shipNameEl = document.getElementById("ship-name");
const shipPrevBtn = document.getElementById("ship-prev");
const shipNextBtn = document.getElementById("ship-next");
let shipSkinIndex = Math.max(
  0,
  SHIP_SKINS.findIndex((skin) => skin.asset === localStorage.getItem(SHIP_SKIN_KEY)),
);

function syncShipSkin() {
  const skin = SHIP_SKINS[shipSkinIndex] || SHIP_SKINS[0];
  if (shipPreviewEl) {
    shipPreviewEl.src = `assets/images/${skin.asset}`;
    shipPreviewEl.alt = `${skin.name} ship`;
  }
  if (shipNameEl) shipNameEl.textContent = skin.name;
  setPlayerMarkerAsset(skin.asset);
  localStorage.setItem(SHIP_SKIN_KEY, skin.asset);
}

function cycleShipSkin(dir) {
  shipSkinIndex = (shipSkinIndex + dir + SHIP_SKINS.length) % SHIP_SKINS.length;
  playSelect();
  syncShipSkin();
}
shipPrevBtn?.addEventListener("click", () => cycleShipSkin(-1));
shipNextBtn?.addEventListener("click", () => cycleShipSkin(1));
syncShipSkin();

/* ── SAVE / CONTINUE ─────────────────────────────────────────────────────
   Snapshot the live game (level, score, powers, the current/next planet,
   and every body's level + position + angle + velocity) into localStorage so
   the player can close the tab and resume later. The Save Progress button
   writes; the start screen's Continue button reads. Saving is non-destructive:
   the snapshot stays until the player saves again or clears storage, so they
   can keep playing after a save and still resume that point later.

   The localStorage plumbing (snapshotBodies, writeSave, loadSave, clearSave)
   lives in save-storage.js; this file only decides WHAT to save
   and how to rebuild a live round from it, since that needs deep access to
   score/level/chain state. */
// Silent auto-save. Called when the player leaves mid-game; there is no manual
// save button. Skips when there's nothing meaningful to save (no round active
// or after a loss).
// Build the v3 round blob (mode + score + charges + every body's transform).
// Shared by the silent auto-save and the dev "save scenario" tool, both of
// which rebuild a live round through restoreGame(). `level` holds the MODE
// number now; v2 ladder-era saves are dropped by loadSave.
function buildRoundSnapshot() {
  return {
    v: 3,
    level: getLevel(),
    score,
    mergeCount,
    curLvl,
    nxtLvl,
    powerCharges,
    destroyCharges,
    destroyDropsRemaining,
    seenLevels: [...seenLevels],
    bodies: snapshotBodies(),
  };
}

function saveGame() {
  if (!round.playing || round.gameOver) return;
  writeSave(buildRoundSnapshot());
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
  deathReplay = null;
  deathReplayHistory.clear();
  rimEscapedIds.clear();
  nextDeathReplaySampleMs = 0;

  score = data.score || 0;
  mergeCount = data.mergeCount || 0;
  scoreEl.textContent = formatScore(score);
  resetShake();
  curLvl = data.curLvl ?? firstDrop();
  nxtLvl = data.nxtLvl ?? pickLvl();
  dropX = W / 2;
  playerMarkerPrevX = dropX;
  playerMarkerTilt = 0;
  nextHandoff = null;
  canDrop = true;
  cooldown = 0;
  totalMs = 0;
  noRoomMs = 0;
  boardFullCheckMs = 0;
  autoPilotActive = false;
  autoPilotSpeed = 1;
  round.gameOver = false;
  resetDevDrops();
  syncAutoPilotUI();
  resetChain();
  (data.seenLevels || []).forEach((l) => seenLevels.add(l));

  // Re-create each saved planet with its exact position, facing, and motion.
  // spawn() sets a default angle/velocity, so override both afterwards. Born
  // at totalMs 0 → every restored body gets the normal 1.6s grace before the
  // lose checks can fire, so resuming never instantly ends the game.
  for (const b of data.bodies) {
    const body = spawn(b.x, b.y, b.lvl, 0);
    Body.setAngle(body, b.angle || 0);
    Body.setVelocity(body, { x: b.vx || 0, y: b.vy || 0 });
    Body.setAngularVelocity(body, b.av || 0);
  }
  wakeAllShapes();

  // Restore the saved charges; drop a charge if this level bans that power.
  powerCharges = getForceChoose() ? 1 : curLevel().choose ? data.powerCharges || 0 : 0;
  if (getForceDestroy()) {
    armDestroyPower();
  } else if (curLevel().eliminate && data.destroyCharges > 0) {
    destroyCharges = data.destroyCharges;
    destroyDropsRemaining = Math.max(1, data.destroyDropsRemaining ?? DESTROY_DROP_GRACE);
    updateDestroyUI();
    startTargetLockConstant();
  } else {
    clearDestroyPower();
  }
  updatePowerUI();

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

syncStartResumeUI();

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
  nextHandoff = null;
  drawNext(nxtCtx, nxtCanvas, nxtLvl);
});

onForcePowerChange(syncForcedPowersFromDev);

// Dev "Scenarios": capture the live board so a bug arrangement can be replayed
// later, and load a saved one back in. Play reuses restoreGame (the Continue
// path), so a scenario drops straight into a live, playable round.
onScenarioCapture(() => (round.playing && !round.gameOver ? buildRoundSnapshot() : null));
onScenarioPlay((data) => {
  if (data && Array.isArray(data.bodies)) restoreGame(data);
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
