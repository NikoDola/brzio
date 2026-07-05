/* ════════════════════════════════════════════════════════════════════════
   shakes.js  —  the SHAKES meter, the pop physics, and the rainbow shield
   ════════════════════════════════════════════════════════════════════════

   A bar that fills on merges. +1% per merge; once a per-drop combo reaches 3
   in a row each merge gives +5%, the 5th gives +10%, and every merge after
   the 5th gives +5%. It rises like a slow water fill and recolours red →
   orange → yellow → green as it climbs. Resets each new game.

   While shaking, a rainbow arch shields the top: planets bounce off it and
   the danger-line check is suspended, so a shake can never cost you the
   game... unless Level 6+ turns the shield off (see levels.js's `rainbow`
   flag). Level 7+ also fires shake bursts on their own (the earthquake). */
import { LAYOUT, r, BALANCE } from "./config.js";
import { world, bodyLvl, wakeAllShapes, setShieldArch, archPoint } from "./physics.js";
import { TUNING } from "./tuning.js";
import { round } from "./state.js";
import { getLevel, rainbowEnabled, autoShakeEnabled } from "./levels.js";

const { Body, Composite } = Matter; // CDN global
const { H, WALL } = LAYOUT;

const shakesFillEl = document.getElementById("shakes-fill");
const shakesLabelEl = document.getElementById("shakes-label");
const shakesValueEl = document.getElementById("shakes-value");
const shakesPanelEl = document.getElementById("shakes-panel");
let shakePct = 0;
let shakeArmed = false; // usable once the meter has filled to 100%
let shakeStreak = 1; // multiplier; clicking again ramps it 1.3x (capped)
let lastShakeAt = 0;

// While shaking, a rainbow arch shields the top: planets bounce off it and the
// game-over danger check is suspended (see isProtected()).
let protectUntil = 0;
let protectActive = false;

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
  // Arm at full; stay armed until spent to empty, then it must refill.
  if (shakePct >= 100) shakeArmed = true;
  else if (shakePct <= 0) shakeArmed = false;
  if (shakesPanelEl) shakesPanelEl.classList.toggle("armed", shakeArmed);
  // Armed: a "Time for / Shake" call-to-action. Otherwise the SHAKES % meter.
  if (shakeArmed) {
    if (shakesLabelEl) shakesLabelEl.textContent = "Time for";
    if (shakesValueEl) shakesValueEl.textContent = "Shake";
  } else {
    if (shakesLabelEl) shakesLabelEl.textContent = "SHAKES";
    if (shakesValueEl) shakesValueEl.textContent = `${Math.round(shakePct)}%`;
  }
  if (shakesFillEl) {
    shakesFillEl.style.height = `${shakePct}%`;
    shakesFillEl.style.backgroundColor = shakeColor(shakePct);
  }
}

// Called from registerChain (game.js) on every merge in the current chain.
export function addShake(chainCount) {
  if (shakePct >= 100) return;
  shakePct = Math.min(100, shakePct + shakeIncrement(chainCount));
  updateShakeUI();
}

export function resetShake() {
  shakePct = 0;
  shakeArmed = false;
  shakeStreak = 1;
  protectUntil = 0;
  protectActive = false;
  setShieldArch(false);
  updateShakeUI();
}

// Dev "fill shakes" button: arm the meter instantly for testing.
export function armFull() {
  shakePct = 100;
  updateShakeUI();
}

// Escape-proofing: keep every planet's speed inside the playfield. Upward is
// capped hard (no ceiling); horizontal is capped to contain + avoid tunneling.
function clampShakeVelocity(body, maxUp = BALANCE.SHAKE_MAX_UP, maxSide = BALANCE.SHAKE_MAX_SIDE) {
  let { x: vx, y: vy } = body.velocity;
  if (vx > maxSide) vx = maxSide;
  else if (vx < -maxSide) vx = -maxSide;
  if (vy < -maxUp) vy = -maxUp; // limit how fast they rise
  Body.setVelocity(body, { x: vx, y: vy });
}

// POP: only planets that are settled (slow + supported from below) jump. The
// height is divided down by the mass stacked on top, so an exposed top planet
// flies high while a buried one barely lifts. Supported means resting on the
// floor OR on another planet. Only a planet in the air with nothing under it is
// skipped, so it can't be re-popped (and can't pile up + escape).
function applyPop(intensity) {
  const base = TUNING.shakeStrength * intensity;
  const floorY = H - WALL; // top surface of the floor
  for (const body of Composite.allBodies(world)) {
    if (body.label !== "shape") continue;
    if (Math.hypot(body.velocity.x, body.velocity.y) > BALANCE.SETTLE_SPEED) continue; // airborne
    const lvl = bodyLvl.get(body.id);
    const rB = lvl !== undefined ? r(lvl) : 20;
    let supported = body.position.y + rB >= floorY - 6; // sitting on the ground
    let massAbove = 0;
    for (const other of Composite.allBodies(world)) {
      if (other === body || other.label !== "shape") continue;
      const dx = Math.abs(other.position.x - body.position.x);
      const lo = bodyLvl.get(other.id);
      const rO = lo !== undefined ? r(lo) : 20;
      if (dx > rB + rO) continue; // not in this column
      const dy = other.position.y - body.position.y;
      if (dy < 0) massAbove += other.mass; // above → weighs it down
      else if (dy < rB + rO + 4) supported = true; // just below → holds it up
    }
    if (!supported) continue; // floating with nothing under it: can't pop
    const up = base / (1 + massAbove * BALANCE.POP_LOAD); // less on top → higher
    Body.setVelocity(body, { x: (Math.random() * 2 - 1) * up * 0.3, y: -up });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);
    clampShakeVelocity(body, BALANCE.POP_MAX_UP, BALANCE.POP_MAX_SIDE);
  }
  wakeAllShapes();
}

// Brief centred notice, e.g. explaining that manual shaking is off at Level 7.
// Throttled so mashing the panel doesn't stack duplicates.
let shakeNoticeAt = 0;
function flashShakeNotice(text) {
  const now = performance.now();
  if (now - shakeNoticeAt < 1200) return;
  shakeNoticeAt = now;
  const el = document.createElement("div");
  el.className = "shake-notice";
  el.textContent = text;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 1600);
}

shakesPanelEl?.addEventListener("click", () => {
  if (!round.playing || round.gameOver) return;
  // Auto-shake levels take the button away: the earthquake fires on its own now.
  if (autoShakeEnabled()) {
    flashShakeNotice(`Level ${getLevel()}: the shakes are automatic now`);
    return;
  }
  // Any leftover below SHAKE_COST is still a valid (last) click: it spends the
  // remainder and lands the meter on exactly 0. Without this, mid-shake merges
  // topping the meter up by odd amounts could strand it at, say, 3%: armed,
  // inviting a click, but doing nothing.
  if (!shakeArmed || shakePct <= 0) return;
  const now = performance.now();
  // Click again while it's still shaking → 1.3x stronger, capped so it can't run away.
  shakeStreak =
    now - lastShakeAt < BALANCE.SHAKE_WINDOW_MS
      ? Math.min(shakeStreak * 1.3, BALANCE.SHAKE_MAX_STREAK)
      : 1;
  lastShakeAt = now;
  applyPop(shakeStreak);
  // Rainbow shield only from levels that still allow it (off at Level 6+), so a
  // late-game shake no longer buys immunity from the danger line.
  if (rainbowEnabled()) protectUntil = now + BALANCE.PROTECT_MS;
  shakePct = Math.max(0, shakePct - BALANCE.SHAKE_COST);
  updateShakeUI();
});

/* Level 7+ earthquake. On a random subset of drops the shake fires by itself,
   1..6 times in a row (like rapid button presses). Deliberately erratic: most
   drops stay calm, some erupt. No rainbow shield backs it (off since Level 6),
   so an unlucky burst can genuinely topple your stack. Bypasses the meter, since
   this is now an environmental hazard, not a resource the player spends. */
export function maybeAutoShake() {
  if (!autoShakeEnabled()) return;
  if (Math.random() >= BALANCE.AUTO_SHAKE_CHANCE) return; // this drop stays quiet
  const bursts = 1 + Math.floor(Math.random() * 6); // 1..6 "clicks"
  for (let i = 0; i < bursts; i++) {
    setTimeout(() => {
      if (!round.playing || round.gameOver) return;
      applyPop(1 + Math.random() * 0.8); // vary the jolt so the quake feels alive
    }, i * 140);
  }
}

// True while the rainbow shield is up: game.js uses this to suspend the
// danger-line check (checkOver) and to block new drops (drop()).
export function isProtected() {
  return protectActive;
}

// Call once per frame. Raises/drops the shield (and its physics arch) as
// protectUntil passes, mirroring the old inline check in game.js's frame().
export function tickShield() {
  const wantProtect = performance.now() < protectUntil && !round.gameOver && round.playing;
  if (wantProtect !== protectActive) {
    protectActive = wantProtect;
    setShieldArch(protectActive);
  }
}

// Draws the rainbow shield arch while a shake has it raised. Nothing is drawn
// otherwise (the old red danger line is gone: losing is about falling out of
// the container, not crossing a height). Called every frame from game.js.
export function drawShield(ctx) {
  if (!protectActive) return;
  ctx.save();
  const rainbow = ["#ff3b3b", "#ff9f1c", "#ffd23f", "#3bd16f", "#3b9bff", "#9b5cff"];
  const STEPS = 48;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (let i = 0; i < STEPS; i++) {
    const a = archPoint(i / STEPS);
    const b = archPoint((i + 1) / STEPS);
    ctx.strokeStyle = rainbow[Math.floor((i / STEPS) * rainbow.length) % rainbow.length];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

updateShakeUI();
