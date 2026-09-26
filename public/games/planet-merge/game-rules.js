// Gameplay rules shared by the visible game and background simulations.
import { LAYOUT, SHAPES, BALANCE, r } from './config.js';
import { TUNING } from './tuning.js';
import { wakeAllShapes } from './physics.js';
const { Body, Sleeping, Composite } = Matter;
const { W, H, WALL, WALL_X, WALL_TOP, PLAYER_CONTAINER_Y, PLAYER_MARKER_H, DROP_GAP } = LAYOUT;
const SIDE_WALL_ESCAPE_SLACK = 4;
const BOARD_FULL_ARM_FROM_BOTTOM_RATIO = .75;
const BOARD_FULL_ARM_MIN_AGE_MS = 1600;
const BOARD_FULL_CHECK_MS = 96;
export const PHYS_STEP = 8;
export const DESTROY_DROP_GRACE = 3;
function dropBoundsForRadius(rad) {
  return { minX: WALL_X + rad + 2, maxX: W - WALL_X - rad - 2 };
}
export function dropBounds(lvl) {
  return dropBoundsForRadius(r(lvl));
}
function dropYForRadius(rad) {
  return PLAYER_CONTAINER_Y + PLAYER_MARKER_H / 2 + DROP_GAP + rad;
}
export function dropYFor(lvl) {
  return dropYForRadius(r(lvl));
}
export function applyImpactKick(a, b, normal, speed) {
  if (speed <= BALANCE.IMPACT_KICK_MIN_SPEED) return;
  const kick = Math.min(speed, BALANCE.IMPACT_KICK_SPEED_CAP) * TUNING.impactStrength;
  for (const [body, direction] of [[a, 1], [b, -1]]) Body.setVelocity(body, {
    x: body.velocity.x + direction * normal.x * kick / Math.sqrt(body.mass),
    y: body.velocity.y + direction * normal.y * kick / Math.sqrt(body.mass),
  });
}
export function advanceRoomCheck(dt, shapes, state) {
  const { canDrop, protectedNow, choosing, escapedIds, now, born, dropLvls } = state;
  let { noRoomMs, checkMs } = state;
  if (!canDrop || protectedNow || choosing || escapedIds.size || !boardFullArmed(shapes, now, born)) {
    return { noRoomMs: 0, checkMs: 0, lost: false };
  }
  checkMs += dt;
  if (checkMs < BOARD_FULL_CHECK_MS) return { noRoomMs, checkMs, lost: false };
  noRoomMs = dropLvls.every(lvl => boardFull(shapes, lvl)) ? noRoomMs + checkMs : 0;
  return { noRoomMs, checkMs: 0, lost: noRoomMs >= BALANCE.NO_ROOM_MS };
}

export function floorYFor(lvl) {
  return H - WALL - r(lvl) - 3;
}

export function bodyOutsideContainerX(body, lvl) {
  const rad = r(lvl);
  return (
    body.position.x < WALL_X + rad - SIDE_WALL_ESCAPE_SLACK ||
    body.position.x > W - WALL_X - rad + SIDE_WALL_ESCAPE_SLACK
  );
}

export function bodyNoLongerVisible(body, lvl) {
  return body.position.y - r(lvl) > H;
}

export function bodyReachedOpenRim(body, lvl) {
  const rad = r(lvl);
  return body.position.y <= WALL_TOP + rad * 0.42;
}

export function keepBodyInsideSideWalls(body, lvl) {
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

export function recoverBodyAboveFloor(body, lvl) {
  const rad = r(lvl);
  Body.setPosition(body, {
    x: Math.max(WALL_X + rad + 2, Math.min(W - WALL_X - rad - 2, body.position.x)),
    y: floorYFor(lvl),
  });
  Body.setVelocity(body, { x: 0, y: 0 });
  Body.setAngularVelocity(body, 0);
  Sleeping.set(body, false);
}

export function keepBodyAboveFloor(body, lvl) {
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

export function guardContainer(shapes, rimEscapedIds) {
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


export function nudgePerches(pairs, bodyLvl, random = Math.random) {
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

    if (top.isSleeping) continue;                       // settled; leave it be
    if ((contactCount.get(top.id) || 0) > 1) continue;  // supported by neighbours
    if (Math.abs(top.velocity.x) > 0.25) continue;      // already sliding off

    const dx = top.position.x - bot.position.x;
    const dir =
      Math.abs(dx) < 0.3
        ? random() < 0.5
          ? -1
          : 1 // dead-centre → random side
        : Math.sign(dx); // off-centre → fall toward that side
    Body.setVelocity(top, {
      x: top.velocity.x + dir * 0.15,
      y: top.velocity.y,
    });
  }
}

export function fallenPlanet(shapes, totalMs, bodyBorn, rimEscapedIds, protectedNow) {
  if (protectedNow) return; // shielded while shaking: no game over
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
      return { body, lvl };
    }

    if (body.position.y > H + 40 && !outside) {
      recoverBodyAboveFloor(body, lvl);
    }
  }
}

function dropBlockedAtRadius(sx, rad, shapes) {
  const dropY = dropYForRadius(rad);
  for (const { body, rad: otherRad } of shapes) {
    const dx = body.position.x - sx;
    const dy = body.position.y - dropY;
    const reach = rad + otherRad - 2; // small slack so a graze doesn't block
    if (dx * dx + dy * dy < reach * reach) return true;
  }
  return false;
}
export function dropBlockedAt(sx, lvl, shapes) {
  return dropBlockedAtRadius(sx, r(lvl), shapes);
}

export function boardFull(shapes, lvl) {
  const probeRad = r(lvl) * BALANCE.NO_ROOM_PROBE_SCALE;
  const { minX, maxX } = dropBoundsForRadius(probeRad);
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    if (!dropBlockedAtRadius(minX + ((maxX - minX) * i) / steps, probeRad, shapes)) return false;
  }
  return true;
}

export function boardFullArmed(shapes, totalMs, bodyBorn) {
  const armY = H - (H - WALL_TOP) * BOARD_FULL_ARM_FROM_BOTTOM_RATIO;
  return shapes.some(({ body, rad }) => {
    if (totalMs - (bodyBorn.get(body.id) || 0) < BOARD_FULL_ARM_MIN_AGE_MS) return false;
    return body.position.y - rad <= armY;
  });
}

export function shakeIncrement(chain) {
  if (chain >= 6) return 5;
  if (chain === 5) return 10;
  if (chain >= 3) return 5; // 3 or 4 in a row
  return 1; // 1 or 2
}

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
export function popPlanets(world, bodyLvl, intensity, random = Math.random) {
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
    Body.setVelocity(body, { x: (random() * 2 - 1) * up * 0.3, y: -up });
    Body.setAngularVelocity(body, (random() - 0.5) * 0.08);
    clampShakeVelocity(body, BALANCE.POP_MAX_UP, BALANCE.POP_MAX_SIDE);
  }
  wakeAllShapes(world);
}

