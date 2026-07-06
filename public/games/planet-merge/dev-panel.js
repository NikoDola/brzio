/* ════════════════════════════════════════════════════════════════════════
   dev-panel.js  —  the admin-only dev tools (?dev=1)
   ════════════════════════════════════════════════════════════════════════

   Auto-drop stress testing, the collider debug overlay, the live physics
   mass/impact editor, and the "clear all local storage" button. None of this
   ships to a real player; see ../CLAUDE.md for how ?dev=1 is gated. */
import { SHAPES } from "./config.js";
import { setDebugColliders } from "./renderer.js";
import { applyTuningToBodies, wakeAllShapes } from "./physics.js";
import { TUNING } from "./tuning.js";
import { setDropMode } from "./levels.js";
import { clearEarnedPerks } from "./perks.js";
import { clearStats } from "./stats.js";
import { clearSave, checkResume } from "./save-storage.js";
import { armFull as armShakesFull } from "./shakes.js";

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

/* ── Auto-drop, sim speed, drop mode ─────────────────────────────────────── */
let autoDropOn = false;
let autoDropX = 0.5; // 0-1 fraction of playfield width
let simSpeed = 1; // physics time multiplier (1× = normal, 10× = turbo)

// Dev "always armed" toggles. When on, the corresponding power re-arms itself
// after every consumption so the UI stays in its active state and can be
// visually tweaked without grinding chains.
let forceChoose = false;
let forceDestroy = false;

export const isAutoDropOn = () => autoDropOn;
export const getAutoDropX = () => autoDropX;
export const getSimSpeed = () => simSpeed;
export const getForceChoose = () => forceChoose;
export const getForceDestroy = () => forceDestroy;

let onForcePowerChanged = () => {};
export function onForcePowerChange(callback) {
  onForcePowerChanged = callback;
}

function syncForcePowerButtons() {
  forceChooseBtn.textContent = forceChoose ? "ON" : "OFF";
  forceChooseBtn.classList.toggle("active", forceChoose);
  forceDestroyBtn.textContent = forceDestroy ? "ON" : "OFF";
  forceDestroyBtn.classList.toggle("active", forceDestroy);
}

function notifyForcePowerChange() {
  onForcePowerChanged({ forceChoose, forceDestroy });
}

// game.js registers this to snap the held/next planet immediately when the
// dev panel picks a specific planet to always drop (kept as a callback,
// rather than dev-panel.js importing game.js, so the two files don't need to
// know about each other in both directions).
let onSpecificPlanetChosen = () => {};
export function onDropModeChange(callback) {
  onSpecificPlanetChosen = callback;
}

autoDropBtn.addEventListener("click", () => {
  autoDropOn = !autoDropOn;
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

/* Populate Drop selector with all 12 planets */
SHAPES.forEach((s, i) => {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = `${i + 1}. ${s.name}`;
  dropModeEl.appendChild(opt);
});

dropModeEl.addEventListener("change", () => {
  const v = dropModeEl.value;
  const mode = v === "weighted" || v === "random" ? v : Number(v);
  setDropMode(mode);
  // Specific-planet mode: snap current + next previews immediately.
  if (typeof mode === "number") onSpecificPlanetChosen(mode);
});

/* ── Dev stat counters (drops / games / avg score this session) ─────────── */
let devDrops = 0;
let devGames = 0;
const devScores = [];

export function recordDevDrop() {
  devDrops++;
  statDropsEl.textContent = devDrops;
}
export function resetDevDrops() {
  devDrops = 0;
  statDropsEl.textContent = "0";
}
export function recordDevGame(score) {
  devGames++;
  devScores.push(score);
  statGamesEl.textContent = devGames;
  statAvgEl.textContent = Math.round(
    devScores.reduce((a, b) => a + b, 0) / devScores.length,
  );
}

/* ── Collider debug overlay ──────────────────────────────────────────────── */
let debugColliders = false;
colliderBtn.addEventListener("click", () => {
  debugColliders = !debugColliders;
  setDebugColliders(debugColliders);
  colliderBtn.textContent = debugColliders ? "ON" : "OFF";
  colliderBtn.classList.toggle("active", debugColliders);
});

forceChooseBtn.addEventListener("click", () => {
  forceChoose = !forceChoose;
  syncForcePowerButtons();
  notifyForcePowerChange();
});

forceDestroyBtn.addEventListener("click", () => {
  forceDestroy = !forceDestroy;
  syncForcePowerButtons();
  notifyForcePowerChange();
});

syncForcePowerButtons();

/* ── Dev panel open/close + drag ─────────────────────────────────────────── */
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

/* ── Clear Save (dev) ────────────────────────────────────────────────────
   Wipe earned perks + stats + the saved game so perks and the first-unlock
   glow can be retested from scratch without hand-clearing browser storage. */
clearSaveBtn?.addEventListener("click", () => {
  clearEarnedPerks();
  clearStats();
  clearSave();
  checkResume();
  if (clearSaveMsg) {
    clearSaveMsg.textContent = "cleared!";
    setTimeout(() => {
      clearSaveMsg.textContent = "";
    }, 1500);
  }
});

/* ── Physics editor (mass + impact + shake) ───────────────────────────────
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
  armShakesFull();
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
