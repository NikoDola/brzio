// Dev bot: compare physical forecasts, then look one visible planet ahead.
// Forecasts are an approximation, never a promise of an optimal move. They
// use only the current board and NEXT, and never change the live world.
import { LAYOUT, SHAPES, BALANCE, r } from './config.js';
import { TUNING } from './tuning.js';
import { createPlanetBody, separatePenetrations } from './physics.js';

const { Engine, Bodies, Body, Composite, Events, Sleeping } = Matter;
const { W, H, WALL, WALL_X, WALL_TOP } = LAYOUT;
const FLOOR = H - WALL;
const STEP = 8;
const DROP_Y = LAYOUT.PLAYER_CONTAINER_Y + LAYOUT.PLAYER_MARKER_H / 2 + LAYOUT.DROP_GAP;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function legalDrop(bodies, lvl, x) {
  const rad = r(lvl), y = DROP_Y + rad;
  return x >= WALL_X + rad + 2 && x <= W - WALL_X - rad - 2 &&
    bodies.every(b => Math.hypot(b.x - x, b.y - y) >= r(b.lvl) + rad - 2);
}

function landing(bodies, lvl, x) {
  const rad = r(lvl);
  let y = FLOOR - rad, hit = null;
  for (const b of bodies) {
    const reach = rad + r(b.lvl), dx = x - b.x;
    if (Math.abs(dx) >= reach) continue;
    const contactY = b.y - Math.sqrt(reach * reach - dx * dx);
    if (contactY < y) { y = contactY; hit = b; }
  }
  return { y, hit };
}

function candidates(bodies, lvl, limit) {
  const lo = WALL_X + r(lvl) + 2, hi = W - WALL_X - r(lvl) - 2;
  const xs = Array.from({ length: 13 }, (_, i) => lo + (hi - lo) * i / 12);
  for (const b of bodies) if (b.lvl === lvl) {
    xs.push(clamp(b.x, lo, hi), clamp(b.x - r(lvl) * .4, lo, hi), clamp(b.x + r(lvl) * .4, lo, hi));
  }
  // A coarse grid can miss the last narrow opening and leave the bot waiting
  // forever. Include the midpoint of every actually open interval at spawn.
  let gaps = [[lo, hi]];
  const spawnY = DROP_Y + r(lvl);
  for (const b of bodies) {
    const reach = r(lvl) + r(b.lvl) - 2, dy = b.y - spawnY;
    if (Math.abs(dy) >= reach) continue;
    const dx = Math.sqrt(reach * reach - dy * dy), left = b.x - dx, right = b.x + dx;
    gaps = gaps.flatMap(([a, z]) => right <= a || left >= z ? [[a, z]]
      : [...(left > a ? [[a, left]] : []), ...(right < z ? [[right, z]] : [])]);
  }
  const unique = [...new Set([...xs.map(x => clamp(Math.round(x), lo, hi)),
    ...gaps.map(([a, z]) => (a + z) / 2)])].filter(x => legalDrop(bodies, lvl, x));
  return unique.map(x => {
    const { y, hit } = landing(bodies, lvl, x);
    return { x, priority: y + (hit?.lvl === lvl ? 450 : 0) };
  }).sort((a, b) => b.priority - a.priority || a.x - b.x).slice(0, limit).map(p => p.x);
}

export function evaluateBoard(bodies) {
  if (!bodies.length) return 0;
  let area = 0, progress = 0, pairing = 0, peak = 0, danger = 0;
  for (const b of bodies) {
    const rad = r(b.lvl);
    area += rad * rad;
    progress += 2 ** b.lvl * b.lvl;
    const height = FLOOR - (b.y - rad);
    peak = Math.max(peak, height);
    if (b.x < WALL_X + rad - 5 || b.x > W - WALL_X - rad + 5) danger += 3000;
    if (b.y - rad > H) return -1e9;
    if (b.y - rad < WALL_TOP + 80) danger += (WALL_TOP + 80 - b.y + rad) * 3;
    let nearest = Infinity;
    for (const other of bodies) if (other !== b && other.lvl === b.lvl) {
      nearest = Math.min(nearest, Math.hypot(b.x - other.x, b.y - other.y) - 2 * rad);
    }
    if (Number.isFinite(nearest)) pairing += (b.lvl + 1) * 12 / (1 + Math.max(0, nearest) / 100);
  }
  // Reward compact boards, reachable pairs and progress up the merge chain.
  // The steep height penalty makes late-game survival outrank a tiny merge.
  return progress * .045 + pairing - area / 110 - 700 * (peak / (FLOOR - WALL_TOP)) ** 5 - danger;
}

export function forecast(bodies, action, settings = {}) {
  const engine = Engine.create({ gravity: { y: 1.8 }, enableSleeping: true,
    positionIterations: settings.positionIterations || 14, velocityIterations: settings.velocityIterations || 8 });
  const world = engine.world, tracked = new Map(), pending = [], queued = new Set();
  const wallOpts = { isStatic: true, friction: .6, restitution: .1 };
  Composite.add(world, [
    Bodies.rectangle(W / 2, H - WALL / 2, W - 2 * WALL_X, WALL, wallOpts),
    Bodies.rectangle(WALL_X - WALL / 2, (WALL_TOP + H) / 2, WALL, H - WALL_TOP, wallOpts),
    Bodies.rectangle(W - WALL_X + WALL / 2, (WALL_TOP + H) / 2, WALL, H - WALL_TOP, wallOpts),
  ]);
  let merges = 0, won = false;
  const add = b => {
    const body = createPlanetBody(b.x, b.y, b.lvl, 0, settings.circleSides || 64);
    Body.setAngle(body, b.angle || 0);
    Body.setVelocity(body, { x: b.vx || 0, y: b.vy || 0 });
    Body.setAngularVelocity(body, b.av || 0);
    if (b.sleeping) Sleeping.set(body, true);
    tracked.set(body.id, { body, lvl: b.lvl, rad: r(b.lvl) });
    Composite.add(world, body);
  };
  for (const b of bodies) if (action.type !== 'destroy' || b.lvl !== action.lvl) add(b);
  if (action.type === 'drop') add({ lvl: action.lvl, x: action.x, y: DROP_Y + r(action.lvl) });
  if (action.type === 'destroy') for (const { body } of tracked.values()) Sleeping.set(body, false);
  Events.on(engine, 'collisionStart', ({ pairs }) => {
    for (const pair of pairs) {
      const a = tracked.get(pair.bodyA.parent.id), b = tracked.get(pair.bodyB.parent.id);
      if (!a || !b) continue;
      const speed = Math.hypot(b.body.velocity.x - a.body.velocity.x, b.body.velocity.y - a.body.velocity.y);
      if (speed > BALANCE.IMPACT_KICK_MIN_SPEED) {
        const n = pair.collision.normal, kick = Math.min(speed, BALANCE.IMPACT_KICK_SPEED_CAP) * TUNING.impactStrength;
        for (const [entry, dir] of [[a, 1], [b, -1]]) Body.setVelocity(entry.body, {
          x: entry.body.velocity.x + dir * n.x * kick / Math.sqrt(entry.body.mass),
          y: entry.body.velocity.y + dir * n.y * kick / Math.sqrt(entry.body.mass),
        });
      }
      if (a.lvl !== b.lvl || queued.has(a.body.id) || queued.has(b.body.id)) continue;
      queued.add(a.body.id); queued.add(b.body.id); pending.push([a, b]);
    }
  });
  for (let ms = 0; ms < 1600; ms += STEP) {
    Engine.update(engine, STEP);
    for (const [a, b] of pending.splice(0)) {
      if (!tracked.has(a.body.id) || !tracked.has(b.body.id)) continue;
      const x = (a.body.position.x + b.body.position.x) / 2, y = (a.body.position.y + b.body.position.y) / 2;
      for (const entry of [a, b]) { tracked.delete(entry.body.id); Composite.remove(world, entry.body); }
      merges++;
      if (a.lvl === SHAPES.length - 1) won = true;
      else add({ lvl: a.lvl + 1, x, y: Math.min(Math.max(r(a.lvl + 1), y), FLOOR - r(a.lvl + 1) - 3), vy: -3 });
      for (const { body } of tracked.values()) Sleeping.set(body, false);
    }
    const shapes = [...tracked.values()];
    separatePenetrations(shapes);
    for (const { body } of shapes) if (!body.isSleeping) Body.setAngularVelocity(body, clamp(body.angularVelocity * .985, -.05, .05));
    if (ms > 800 && shapes.every(({ body }) => body.speed < .15)) break;
  }
  const result = [...tracked.values()].map(({ body, lvl }) => ({ lvl, x: body.position.x, y: body.position.y,
    angle: body.angle, vx: body.velocity.x, vy: body.velocity.y, av: body.angularVelocity, sleeping: body.isSleeping }));
  Engine.clear(engine);
  return { bodies: result, merges, won, score: won ? 1e9 : evaluateBoard(result) + merges * 80 };
}

export function planMove(snapshot) {
  Object.assign(TUNING, snapshot.tuning);
  const options = candidates(snapshot.bodies, snapshot.curLvl, 10);
  let evaluated = 0;
  const ranked = options.map(x => {
    const action = { type: 'drop', x, lvl: snapshot.curLvl };
    const result = forecast(snapshot.bodies, action, snapshot.settings); evaluated++;
    return { action, result, score: result.score };
  }).sort((a, b) => b.score - a.score);
  if (ranked[0]?.result.won) return { ...ranked[0].action, evaluated };
  for (const candidate of ranked.slice(0, 3)) {
    let future = -1e8;
    for (const x of candidates(candidate.result.bodies, snapshot.nxtLvl, 4)) {
      const next = forecast(candidate.result.bodies, { type: 'drop', x, lvl: snapshot.nxtLvl }, snapshot.settings);
      evaluated++; future = Math.max(future, next.score);
    }
    candidate.score = candidate.result.score * .25 + future * .75 + candidate.result.merges * 60;
  }
  const best = ranked.slice(0, 3).sort((a, b) => b.score - a.score)[0];
  // Use earned Eliminate only under pressure and when its forecast improves
  // the board more than a normal drop. Never grant the bot extra charges.
  let rescue = null;
  if (snapshot.destroyCharges && snapshot.bodies.some(b => b.y - r(b.lvl) < WALL_TOP + 230)) {
    for (const lvl of snapshot.droppableLvls) {
      if (!snapshot.bodies.some(b => b.lvl === lvl)) continue;
      const result = forecast(snapshot.bodies, { type: 'destroy', lvl }, snapshot.settings); evaluated++;
      if (!rescue || result.score > rescue.score) rescue = { type: 'destroy', lvl, score: result.score };
    }
  }
  if (rescue && (!best || rescue.score > best.score + 100)) return { type: 'destroy', lvl: rescue.lvl, evaluated };
  return best ? { ...best.action, evaluated } : { type: 'wait', evaluated };
}

// Fast batch strategy: rank landing positions and one visible NEXT move.
// Actual outcomes still use full physics; only this move search is simpler.
export function planQuickMove(snapshot) {
  const project = (bodies, lvl, x) => {
    const { y, hit } = landing(bodies, lvl, x);
    const next = bodies.map(b => ({ ...b }));
    let merged = 0, placed = { x, y, lvl };
    if (hit?.lvl === lvl) {
      next.splice(bodies.indexOf(hit), 1); merged++;
      placed = { x: (x + hit.x) / 2, y: Math.min((y + hit.y) / 2, FLOOR - r(lvl + 1)), lvl: lvl + 1 };
    }
    next.push(placed);
    return { bodies: next, score: evaluateBoard(next) + merged * 140 };
  };
  const options = candidates(snapshot.bodies, snapshot.curLvl, 16).map(x => {
    const first = project(snapshot.bodies, snapshot.curLvl, x);
    const next = candidates(first.bodies, snapshot.nxtLvl, 4).map(nx => project(first.bodies, snapshot.nxtLvl, nx).score);
    return { type: 'drop', x, lvl: snapshot.curLvl, score: first.score + .4 * (next.length ? Math.max(...next) : -10000) };
  }).sort((a, b) => b.score - a.score);
  const best = options[0];
  if (snapshot.destroyCharges && snapshot.bodies.some(b => b.y - r(b.lvl) < WALL_TOP + 230)) {
    const rescues = snapshot.droppableLvls.filter(lvl => snapshot.bodies.some(b => b.lvl === lvl)).map(lvl => ({
      type: 'destroy', lvl, score: evaluateBoard(snapshot.bodies.filter(b => b.lvl !== lvl)) * 1.4,
    })).sort((a, b) => b.score - a.score);
    if (rescues[0] && (!best || rescues[0].score > best.score + 100)) return rescues[0];
  }
  return best || { type: 'wait' };
}
