// A DOM-free game session. Time advances in fixed steps, without animation,
// audio, storage, or waiting for real time. The bot only sees current + NEXT.
import { SHAPES, LAYOUT, BALANCE, r } from './config.js';
import { MODES } from './level-config.js';
import { TUNING } from './tuning.js';
import { createPlanetBody, createContainerBodies, createShieldSegments, limitSpin,
  wakeAllShapes, separateOverlapping, separatePenetrations } from './physics.js';
import { PHYS_STEP, DESTROY_DROP_GRACE, floorYFor, dropBounds, dropYFor, dropBlockedAt,
  guardContainer, fallenPlanet, advanceRoomCheck, applyImpactKick, nudgePerches,
  popPlanets, shakeIncrement } from './game-rules.js';
import { planMove, planQuickMove } from './bot-planner.js';
import { seededRandom } from './simulation-results.js';

const { Engine, Composite, Events, Body, Sleeping } = Matter;
export const SIMULATION_VERSION = 1;

export function createSimulation(config) {
  const mode = MODES[config.level - 1];
  if (!mode) throw new Error('Choose Level 1, 2 or 3.');
  Object.assign(TUNING, structuredClone(config.tuning || TUNING));
  const random = seededRandom(config.seed + '/physics');
  const dropsRandom = seededRandom(config.seed + '/drops');
  const settings = config.physics || {};
  const engine = Engine.create({ gravity: { y: 1.8 }, enableSleeping: true,
    positionIterations: settings.positionIterations || 14, velocityIterations: settings.velocityIterations || 8 });
  const world = engine.world, levels = new Map(), born = new Map(), escaped = new Set();
  const mergeQueue = [], vanishQueue = [], queued = new Set();
  const sequence = [], actions = [];
  let now = 0, score = 0, drops = 0, mergeCount = 0, highestLvl = 0;
  let chain = 0, chainBase = 0, chainScore = 0, cooldown = 0;
  let choose = false, chooseReady = 0, chooseRotate = 0, destroy = 0;
  let shakePct = 0, shakeArmed = false, protectUntil = 0, shield = [];
  let room = { noRoomMs: 0, checkMs: 0 }, outcome = null, reason = '';
  const weights = config.dropRates || SHAPES.map(s => s.dropRate);
  const pick = () => {
    let target = dropsRandom() * mode.drops.reduce((sum, lvl) => sum + weights[lvl], 0);
    let lvl = mode.drops.at(-1);
    for (const candidate of mode.drops) {
      target -= weights[candidate];
      if (target <= 0) { lvl = candidate; break; }
    }
    sequence.push(lvl); return lvl;
  };
  let curLvl = mode.drops[dropsRandom() < .5 ? 0 : 1];
  sequence.push(curLvl);
  let nxtLvl = pick();
  Composite.add(world, createContainerBodies());
  const shapes = () => world.bodies.filter(b => levels.has(b.id)).map(body => ({ body, lvl: levels.get(body.id), rad: r(levels.get(body.id)) }));
  const protectedNow = () => now < protectUntil;
  const add = (x, y, lvl) => {
    const body = createPlanetBody(x, y, lvl, 0, settings.circleSides || 64);
    Composite.add(world, body); levels.set(body.id, lvl); born.set(body.id, now);
    highestLvl = Math.max(highestLvl, lvl); return body;
  };
  const remove = body => {
    Composite.remove(world, body); levels.delete(body.id); born.delete(body.id);
    escaped.delete(body.id); queued.delete(body.id);
  };
  const clearChoose = () => { choose = false; chooseReady = 0; chooseRotate = 0; };
  function registerMerge(lvl) {
    chain++; mergeCount++;
    shakePct = Math.min(100, shakePct + shakeIncrement(chain));
    if (shakePct >= 100) shakeArmed = true;
    chainBase += SHAPES[lvl].pts;
    const contribution = chainBase * chain;
    score += Math.round((contribution - chainScore) * mode.scoreMult);
    chainScore = contribution;
    if (mode.choose && chain === BALANCE.CHOOSE_UNLOCK) {
      if (!choose) { chooseReady = BALANCE.CHOOSE_READY_MS; chooseRotate = 0; }
      choose = true;
    }
    if (mode.eliminate && chain === BALANCE.DESTROY_UNLOCK) {
      destroy = DESTROY_DROP_GRACE; clearChoose();
    }
  }
  Events.on(engine, 'afterUpdate', () => limitSpin(world.bodies));
  Events.on(engine, 'collisionActive', ({ pairs }) => nudgePerches(pairs, levels, random));
  Events.on(engine, 'collisionStart', ({ pairs }) => {
    const kicked = new Set();
    for (const pair of pairs) {
      const a = pair.bodyA.parent, b = pair.bodyB.parent;
      if (!levels.has(a.id) || !levels.has(b.id)) continue;
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      if (!kicked.has(key)) {
        kicked.add(key);
        applyImpactKick(a, b, pair.collision.normal, Math.hypot(b.velocity.x - a.velocity.x, b.velocity.y - a.velocity.y));
      }
      const lvl = levels.get(a.id);
      if (lvl !== levels.get(b.id) || queued.has(a.id) || queued.has(b.id)) continue;
      queued.add(a.id); queued.add(b.id);
      (lvl === SHAPES.length - 1 ? vanishQueue : mergeQueue).push({ a, b, lvl });
    }
  });

  function step() {
    if (outcome) return;
    if (choose && !destroy && cooldown <= 0) {
      if (chooseReady > 0) { chooseReady = Math.max(0, chooseReady - PHYS_STEP); chooseRotate = 0; }
      else {
        chooseRotate += PHYS_STEP;
        if (chooseRotate >= BALANCE.CHOOSE_ROTATE_MS) {
          chooseRotate -= BALANCE.CHOOSE_ROTATE_MS;
          curLvl = mode.drops[(mode.drops.indexOf(curLvl) + 1) % mode.drops.length];
        }
      }
    } else chooseRotate = 0;
    if (!protectedNow() && shield.length) { Composite.remove(world, shield); shield = []; }
    Engine.update(engine, PHYS_STEP); now += PHYS_STEP;
    cooldown = Math.max(0, cooldown - PHYS_STEP);
    for (const { a, b, lvl } of mergeQueue.splice(0)) {
      if (!levels.has(a.id) || !levels.has(b.id)) continue;
      const x = (a.position.x + b.position.x) / 2, y = (a.position.y + b.position.y) / 2;
      remove(a); remove(b); wakeAllShapes(world);
      const merged = add(x, Math.min(Math.max(r(lvl + 1), y), floorYFor(lvl + 1)), lvl + 1);
      Body.setVelocity(merged, { x: 0, y: -3 });
      separateOverlapping(merged, world, levels); registerMerge(lvl);
    }
    for (const { a, b } of vanishQueue.splice(0)) {
      if (!levels.has(a.id) || !levels.has(b.id)) continue;
      remove(a); remove(b); wakeAllShapes(world);
      score += Math.round(LAYOUT.VANISH_BONUS * mode.scoreMult); mergeCount++;
      outcome = 'win'; reason = 'Two Suns merged';
    }
    if (outcome) return;
    const current = shapes();
    guardContainer(current, escaped); separatePenetrations(current);
    if (fallenPlanet(current, now, born, escaped, protectedNow())) { outcome = 'loss'; reason = 'planet-out'; return; }
    room = advanceRoomCheck(PHYS_STEP, current, { ...room, now, born, escapedIds: escaped,
      canDrop: cooldown <= 0, protectedNow: protectedNow(), choosing: choose && chooseReady > 0,
      dropLvls: choose ? mode.drops : [curLvl] });
    if (room.lost) { outcome = 'loss'; reason = 'no-room'; }
  }

  function drop(x) {
    if (outcome || cooldown > 0 || protectedNow() || (choose && chooseReady > 0)) return false;
    const { minX, maxX } = dropBounds(curLvl);
    x = Math.max(minX, Math.min(maxX, x));
    if (dropBlockedAt(x, curLvl, shapes())) return false;
    chain = 0; chainBase = 0; chainScore = 0;
    add(x, dropYFor(curLvl), curLvl);
    actions.push({ type: 'drop', at: now, lvl: curLvl, x }); drops++;
    curLvl = nxtLvl; nxtLvl = pick(); cooldown = BALANCE.DROP_COOLDOWN_MS;
    clearChoose(); if (destroy) destroy--; return true;
  }
  function eliminate(lvl) {
    if (!destroy || !mode.drops.includes(lvl) || outcome) return false;
    const victims = shapes().filter(s => s.lvl === lvl);
    if (!victims.length) return false;
    victims.forEach(s => remove(s.body)); wakeAllShapes(world); destroy = 0;
    actions.push({ type: 'destroy', lvl, at: now }); return true;
  }
  function shake() {
    if (!mode.rainbow || !shakeArmed || shakePct <= 0 || outcome) return false;
    popPlanets(world, levels, 1, random);
    protectUntil = now + BALANCE.PROTECT_MS;
    if (!shield.length) { shield = createShieldSegments(); Composite.add(world, shield); }
    shakePct = Math.max(0, shakePct - BALANCE.SHAKE_COST);
    if (!shakePct) shakeArmed = false;
    actions.push({ type: 'shake', at: now }); return true;
  }
  function snapshot() {
    return { curLvl, nxtLvl, destroyCharges: destroy, droppableLvls: mode.drops,
      settings, tuning: structuredClone(TUNING), bodies: shapes().map(({ body, lvl }) => ({ lvl,
        x: body.position.x, y: body.position.y, vx: body.velocity.x, vy: body.velocity.y,
        angle: body.angle, av: body.angularVelocity, sleeping: body.isSleeping })) };
  }
  function state() {
    const current = shapes();
    return { now, score, drops, mergeCount, highestLvl, outcome, reason, curLvl, nxtLvl,
      ready: !outcome && cooldown <= 0 && !protectedNow() && !(choose && chooseReady > 0),
      maxSpeed: current.reduce((max, { body }) => Math.max(max, body.isSleeping ? 0 : body.speed), 0),
      needsRescue: room.noRoomMs > 0 || current.some(({ body, rad }) => now - born.get(body.id) > 1800 && body.position.y - rad < LAYOUT.WALL_TOP + 90) };
  }
  // Fixtures can exercise real collision and loss events without a full run.
  if (config.initialBodies) for (const b of config.initialBodies) {
    const body = add(b.x, b.y, b.lvl);
    if (b.sleeping) Sleeping.set(body, true);
    if (b.vx || b.vy) Body.setVelocity(body, { x: b.vx || 0, y: b.vy || 0 });
    if (b.escaped) escaped.add(body.id);
    if (b.born !== undefined) born.set(body.id, b.born);
  }
  return { step, drop, eliminate, shake, snapshot, state, sequence, actions,
    dispose() { Composite.clear(world, false); Engine.clear(engine); Events.off(engine); } };
}

export function runSimulation(config, onProgress = () => {}) {
  const started = performance.now();
  const sim = createSimulation(config);
  const maxGameMs = config.maxGameMs || 900000, maxDrops = config.maxDrops || 1000;
  let lastDrop = -10000, lastShake = -10000, nextDecision = 0, lastProgress = -Infinity;
  try {
    while (true) {
      const state = sim.state();
      if (state.outcome || state.now >= maxGameMs || state.drops >= maxDrops) {
        return { seed: config.seed, outcome: state.outcome || 'timeout', reason: state.reason || 'Test limit reached',
          elapsedMs: state.now, computeMs: performance.now() - started, drops: state.drops,
          score: state.score, merges: state.mergeCount, highestLvl: state.highestLvl,
          sequence: [...sim.sequence], actions: [...sim.actions] };
      }
      if (state.ready && state.now >= nextDecision) {
        nextDecision = state.now + 16;
        if (state.needsRescue && state.now - lastShake > 8000 && sim.shake()) lastShake = state.now;
        else if (state.now - lastDrop >= 650 && (state.maxSpeed <= 1.2 || state.now - lastDrop >= 2200)) {
          const move = (config.strategy === 'smart' ? planMove : planQuickMove)(sim.snapshot());
          if (move.type === 'drop' && sim.drop(move.x)) lastDrop = state.now;
          else if (move.type === 'destroy' && sim.eliminate(move.lvl)) lastDrop = state.now;
          else nextDecision = state.now + 200;
        }
      }
      sim.step();
      if (state.now % 200 === 0 && performance.now() - lastProgress > 250) {
        lastProgress = performance.now();
        onProgress({ elapsedMs: state.now, drops: state.drops, computeMs: lastProgress - started });
      }
    }
  } finally { sim.dispose(); }
}
