/* ════════════════════════════════════════════════════════════════════════
   save-storage.js  —  the localStorage plumbing behind Save / Continue
   ════════════════════════════════════════════════════════════════════════

   This file only knows how to read, write, and validate the saved-game blob.
   It does NOT know what a "round" is: deciding which fields to save and how
   to rebuild a live game from them is game.js's job (saveGame/restoreGame),
   since that needs deep access to score, level, chain state, and the physics
   world. Splitting it further would just move the coupling around. */
import { world, bodyLvl } from "./physics.js";

const { Composite } = Matter; // CDN global

const SAVE_KEY = "pm_saved_game";

export function snapshotBodies() {
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

export function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (_) {}
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    // v3 = the selectable-modes format (`level` = mode number); older saves
    // from the score-ladder era are silently dropped.
    if (!d || d.v !== 3 || !Array.isArray(d.bodies)) return null;
    return d;
  } catch (_) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (_) {}
}

export function checkResume() {
  try {
    window.dispatchEvent(new Event("planet-merge-save-change"));
  } catch (_) {}
}
