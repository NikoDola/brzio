/* ════════════════════════════════════════════════════════════════════════
   game.js  —  game loop, state, merge/vanish logic, input, restart
   Entry point: loaded as <script type="module"> in index.html
   ════════════════════════════════════════════════════════════════════════ */

import { LAYOUT, SHAPES, r, rndLvl }              from './config.js';
import { engine, world, bodyLvl, bodyBorn, active,
         spawn, despawn, loadOutlines,
         wakeAllShapes, separateOverlapping } from './physics.js';
import { drawProcedural, drawBody, drawNext, drawPreview,
         drawFlashes, drawPopups, onAssetLoad,
         setDebugColliders }                        from './renderer.js';

const { Engine, Body, World, Events, Composite, Sleeping, Query } = Matter;   // CDN global
const { W, H, WALL, DROP_Y, DANGER_Y } = LAYOUT;


/* ── CANVAS ──────────────────────────────────────────────────────────── */
const canvas = document.getElementById('game-canvas');
canvas.width  = W;
canvas.height = H;
const ctx = canvas.getContext('2d');

const nxtCanvas = document.getElementById('next-canvas');
const nxtCtx    = nxtCanvas.getContext('2d');


/* ── GAME STATE ──────────────────────────────────────────────────────── */
const mergeQ    = [];          // { a, b, level } — bodies queued to merge
const vanishQ   = [];          // { a, b }        — max-level bodies queued to vanish
const mergeSeen = new Set();   // bodyIds already in a queue (prevents duplicates)

const flashes   = [];          // visual fx: { x, y, t, big }
const popups    = [];          // score fx:  { x, y, t, text, big }

/* Drop mode for dev panel:
 *   'weighted'  → default rndLvl() (droppables only, weighted)
 *   'random'    → uniform random across ALL 12 planets
 *   <number>    → specific level index, always drops that planet
 */
let dropMode = 'weighted';
function pickLvl() {
    if (dropMode === 'weighted') return rndLvl();
    if (dropMode === 'random')   return Math.floor(Math.random() * SHAPES.length);
    return dropMode;
}

// First drop of each game is always a Star or Moon — eases the player in
// instead of opening with a Mercury that's hard to merge from cold.
// Honour the dev-panel drop-mode override when it's set to a specific planet.
const firstDrop = () => dropMode === 'weighted' ? (Math.random() < 0.5 ? 0 : 1) : pickLvl();

let score     = 0;
let curLvl    = firstDrop();   // shape currently waiting to drop
let nxtLvl    = pickLvl();     // shape shown in the NEXT preview
let dropX     = W / 2;         // x position of the drop crosshair
let canDrop   = true;

/* ── PER-DROP CHAIN + SUPER-POWERS ──────────────────────────────────────
   `chainCount` counts merges that come from ONE drop's cascade. It resets
   at the start of every drop — there's no time window, no slow accumulation
   across drops. Big chains are pure skill rewards.
     - CHOOSE_UNLOCK merges in one chain → 1 "pick your next planet" charge
       (consumed on the next drop)
     - DESTROY_UNLOCK merges in one chain → 1 "wipe a planet type" charge
       (consumed when the player clicks a target on the board)
   Earned charges persist across drops until spent. */
const CHOOSE_UNLOCK  = 3;
const DESTROY_UNLOCK = 5;

let chainCount     = 0;
let powerCharges   = 0;
let destroyCharges = 0;

const droppableLvls = SHAPES.map((s, i) => s.droppable ? i : -1).filter(i => i >= 0);
let cooldown  = 0;             // ms remaining before next drop is allowed
let totalMs   = 0;             // total elapsed ms (frozen when game is over)
let gameOver  = false;
let lastTs    = 0;

/* ── DEV / AUTO-DROP STATE ──────────────────────────────────────────────── */
let autoDropOn = false;
let autoDropX  = 0.5;   // 0-1 fraction of playfield width
let simSpeed   = 1;     // physics time multiplier (1× = normal, 10× = turbo)

let devDrops  = 0;
let devGames  = 0;
const devScores = [];


/* ── DOM ─────────────────────────────────────────────────────────────── */
const scoreEl   = document.getElementById('score');
const finalEl   = document.getElementById('final-score');
const overlayEl = document.getElementById('game-over-overlay');
const restartEl = document.getElementById('restart-btn');
const nextPanel = document.getElementById('next-panel');
const nextLabel = document.getElementById('next-label');
const nextPrev  = document.getElementById('next-prev');
const nextNext  = document.getElementById('next-next');

/* dev panel elements */
const devToggleEl   = document.getElementById('dev-toggle');
const devBodyEl     = document.getElementById('dev-body');
const autoDropBtn   = document.getElementById('auto-drop-btn');
const autoSpeedEl   = document.getElementById('auto-speed');
const autoSpeedVal  = document.getElementById('auto-speed-val');
const autoXEl       = document.getElementById('auto-x');
const autoXVal      = document.getElementById('auto-x-val');
const dropModeEl    = document.getElementById('drop-mode');
const colliderBtn   = document.getElementById('collider-btn');
const statDropsEl   = document.getElementById('stat-drops');
const statGamesEl   = document.getElementById('stat-games');
const statAvgEl     = document.getElementById('stat-avg');


/* ── COLLISION → MERGE / VANISH ──────────────────────────────────────── */
/* IMPACT_KICK shoves both bodies a bit harder along the contact normal when
   they collide fast. Game-feel hack: real momentum transfer from a tiny
   Star onto a heavy Mercury is almost zero, so a stack of planets barely
   reacts to drops. Adding a velocity-scaled kick gives the impact "weight"
   and lets the energy propagate down through stacked planets. */
const IMPACT_KICK_STRENGTH = 1;    // 0 = vanilla physics, 1.0 = very arcadey
const IMPACT_KICK_MIN_SPEED = 4;     // px/tick — ignore gentle resting contacts
const IMPACT_KICK_SPEED_CAP = 20;    // px/tick — clamp so terminal-velocity drops don't explode the stack

Events.on(engine, 'collisionStart', ({ pairs }) => {
    // Compound concave planets (Moon, Saturn, Sun) decompose into many convex
    // sub-parts; each sub-part registers its own pair, so the same logical
    // planet-vs-planet collision fires N times in one tick. Track which
    // parent-pairs we've already kicked this event to apply the impulse once.
    const kickedThisTick = new Set();

    for (const pair of pairs) {
        // Compound bodies (from Bodies.fromVertices with concave decomp) report
        // their *sub-parts* in collision events. Walk up to the parent so the
        // bodyLvl lookup hits, otherwise concave planets never merge.
        const bodyA = pair.bodyA.parent;
        const bodyB = pair.bodyB.parent;

        /* --- impact kick (planet-on-planet only, once per parent-pair) --- */
        const pairKey = bodyA.id < bodyB.id
            ? `${bodyA.id}|${bodyB.id}`
            : `${bodyB.id}|${bodyA.id}`;
        if (!kickedThisTick.has(pairKey)
            && !bodyA.isStatic && !bodyB.isStatic
            && bodyLvl.has(bodyA.id) && bodyLvl.has(bodyB.id)) {
            kickedThisTick.add(pairKey);
            const rvx = bodyB.velocity.x - bodyA.velocity.x;
            const rvy = bodyB.velocity.y - bodyA.velocity.y;
            const speed = Math.hypot(rvx, rvy);
            if (speed > IMPACT_KICK_MIN_SPEED) {
                const n = pair.collision.normal;            // points from B → A
                const k = Math.min(speed, IMPACT_KICK_SPEED_CAP) * IMPACT_KICK_STRENGTH;
                // Push A along the normal, B opposite — preserves the
                // direction of the original impact, just amplified.
                // sqrt(mass) instead of mass so heavy targets (Mars, Saturn)
                // still feel a real shove when hit by a light Star, without
                // sending the Star itself off the screen.
                const mA = Math.sqrt(bodyA.mass);
                const mB = Math.sqrt(bodyB.mass);
                Body.setVelocity(bodyA, {
                    x: bodyA.velocity.x + n.x * k / mA,
                    y: bodyA.velocity.y + n.y * k / mA,
                });
                Body.setVelocity(bodyB, {
                    x: bodyB.velocity.x - n.x * k / mB,
                    y: bodyB.velocity.y - n.y * k / mB,
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
            vanishQ.push({ a: bodyA, b: bodyB });            // max level → vanish
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
Events.on(engine, 'collisionActive', ({ pairs }) => {
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

        const dx  = top.position.x - bot.position.x;
        const dir = Math.abs(dx) < 0.3
            ? (Math.random() < 0.5 ? -1 : 1)            // dead-centre → random side
            : Math.sign(dx);                            // off-centre → fall toward that side
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
    // just show the running chain number scaled up.
    let text, fontSize, color;
    if (chainCount === DESTROY_UNLOCK) {
        text = 'Destroy Power Unlocked!';
        fontSize = 30;
        color = '#ff6e6e';
    } else if (chainCount === CHOOSE_UNLOCK) {
        text = 'Choose Next Unlocked!';
        fontSize = 28;
        color = '#7ddfff';
    } else {
        text = String(chainCount);
        fontSize = Math.min(8 + chainCount * 8, 56);
        color = '#FFFFFF';
    }

    popups.push({
        x, y: y - 24, t: totalMs,
        text, fontSize, color,
        shadowColor: 'rgba(0, 80, 140, 0.85)',
        big: false,
    });

    if (chainCount === CHOOSE_UNLOCK) {
        powerCharges = 1;
        updatePowerUI();
    }
    if (chainCount === DESTROY_UNLOCK) {
        destroyCharges = 1;
        updateDestroyUI();
    }
}

function resetChain() {
    chainCount = 0;
}

function updatePowerUI() {
    const active = powerCharges > 0;
    nextPanel.classList.toggle('power-active', active);
    nextLabel.textContent = active ? 'Choose which one you like to be next' : 'NEXT';
}

function cycleNext(dir) {
    if (powerCharges <= 0) return;
    const i  = droppableLvls.indexOf(nxtLvl);
    const j  = i < 0
        ? 0
        : (i + dir + droppableLvls.length) % droppableLvls.length;
    nxtLvl = droppableLvls[j];
    drawNext(nxtCtx, nxtCanvas, nxtLvl);
}

nextPrev.addEventListener('click', () => cycleNext(-1));
nextNext.addEventListener('click', () => cycleNext(+1));


/* ── DESTROY POWER ──────────────────────────────────────────────────────
   Unlocked at DESTROY_UNLOCK merges in a streak. Paints a pulsing red
   target on every planet on the board; the next canvas click picks a
   planet, and every body of that same level is destroyed. */

function updateDestroyUI() {
    canvas.classList.toggle('destroy-armed', destroyCharges > 0);
}

/** Pulsing red crosshair overlay on every shape body — called from frame(). */
function drawDestroyTargets() {
    const pulse = 0.55 + 0.45 * Math.sin(totalMs * 0.008);
    ctx.save();
    ctx.strokeStyle = `rgba(255, 60, 60, ${pulse})`;
    ctx.lineWidth = 3;
    for (const body of Composite.allBodies(world)) {
        if (body.label !== 'shape') continue;
        const lvl = bodyLvl.get(body.id);
        if (lvl === undefined) continue;
        const rad = r(lvl);
        const x = body.position.x;
        const y = body.position.y;
        ctx.beginPath();
        ctx.arc(x, y, rad * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - rad * 0.75, y); ctx.lineTo(x - rad * 0.25, y);
        ctx.moveTo(x + rad * 0.25, y); ctx.lineTo(x + rad * 0.75, y);
        ctx.moveTo(x, y - rad * 0.75); ctx.lineTo(x, y - rad * 0.25);
        ctx.moveTo(x, y + rad * 0.25); ctx.lineTo(x, y + rad * 0.75);
        ctx.stroke();
    }
    ctx.restore();
}

/** Convert a pointer event to canvas-internal coords. */
function canvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left) * (W / rect.width),
        y: (clientY - rect.top)  * (H / rect.height),
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
        if (parent.label === 'shape' && bodyLvl.has(parent.id)) {
            target = parent;
            break;
        }
    }
    if (!target) return false;

    const lvl = bodyLvl.get(target.id);
    // Snapshot the body list because despawn() mutates `active` during the loop.
    const victims = Composite.allBodies(world)
        .filter(b => b.label === 'shape' && bodyLvl.get(b.id) === lvl);
    for (const b of victims) {
        flashes.push({ x: b.position.x, y: b.position.y, t: totalMs, big: false });
        despawn(b);
    }
    // Wake the whole field so planets stacked above the destroyed ones fall.
    wakeAllShapes();
    destroyCharges = 0;
    updateDestroyUI();
    return true;
}


function flushMerges() {
    if (!mergeQ.length) return;
    const batch = mergeQ.splice(0);
    for (const { a, b, level } of batch) {
        if (!active.has(a.id) || !active.has(b.id)) continue;
        const mx     = (a.position.x + b.position.x) / 2;
        const my     = (a.position.y + b.position.y) / 2;
        mergeSeen.delete(a.id);
        mergeSeen.delete(b.id);
        despawn(a);
        despawn(b);
        const newLvl = level + 1;
        const newR   = r(newLvl);
        // Wake the whole field so bodies stacked above the merge — even 3+
        // layers up, beyond any local radius — fall when their support goes.
        wakeAllShapes();
        const sy     = Math.max(DANGER_Y + newR + 6, my);
        const merged = spawn(mx, sy, newLvl, totalMs);
        Body.setVelocity(merged, { x: 0, y: -3 });
        // Bigger body at the midpoint may intersect a neighbour — push them apart.
        separateOverlapping(merged);
        score += SHAPES[newLvl].pts;
        scoreEl.textContent = score;
        flashes.push({ x: mx, y: my, t: totalMs, big: false });
        popups.push({ x: mx, y: my, t: totalMs, text: `+${SHAPES[newLvl].pts}`, big: false });
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
        const bonus = LAYOUT.VANISH_BONUS;
        score += bonus;
        scoreEl.textContent = score;
        flashes.push({ x: mx, y: my, t: totalMs, big: true });
        popups.push({ x: mx, y: my, t: totalMs, text: `+${bonus}`, big: true });
        registerChain(mx, my);
    }
}


/* ── DROP ────────────────────────────────────────────────────────────── */
function drop() {
    if (!canDrop || gameOver) return;
    // Every drop starts a fresh chain — powers are earned by chains spawned
    // from ONE drop's cascade, never by accumulation across drops.
    resetChain();
    const rad  = r(curLvl);
    const minX = WALL + rad + 2;
    const maxX = W - WALL - rad - 2;
    const sx   = Math.max(minX, Math.min(maxX, dropX));
    spawn(sx, DROP_Y, curLvl, totalMs);
    curLvl    = nxtLvl;
    nxtLvl    = pickLvl();
    canDrop   = false;
    cooldown  = 560;
    if (powerCharges > 0) {
        powerCharges--;
        if (powerCharges === 0) updatePowerUI();
    }
    drawNext(nxtCtx, nxtCanvas, nxtLvl);
}


/* ── GAME OVER ───────────────────────────────────────────────────────── */
function checkOver() {
    for (const body of Composite.allBodies(world)) {
        if (body.label !== 'shape') continue;
        const id  = body.id;
        const lvl = bodyLvl.get(id);
        if (lvl === undefined) continue;
        if (totalMs - (bodyBorn.get(id) || 0) < 1600) continue;  // grace period
        if (body.position.y < DANGER_Y) { endGame(); return; }
    }
}

function endGame() {
    gameOver = true;
    finalEl.textContent = score;
    overlayEl.classList.add('visible');

    devGames++;
    devScores.push(score);
    statGamesEl.textContent = devGames;
    statAvgEl.textContent   = Math.round(devScores.reduce((a, b) => a + b, 0) / devScores.length);
}


/* ── GAME LOOP ───────────────────────────────────────────────────────── */
function frame(ts) {
    const dt = Math.min(ts - lastTs, 32);
    lastTs = ts;

    if (!gameOver) {
        // 2 physics substeps per game tick (8ms each) instead of 1×16ms.
        // The smaller dt keeps fast-moving small bodies (e.g. a falling Star)
        // from tunneling through concave polygon planets (e.g. the Moon).
        for (let s = 0; s < simSpeed * 2; s++) {
            Engine.update(engine, 8);
            totalMs += 8;
            if (cooldown > 0) { cooldown -= 8; if (cooldown <= 0) canDrop = true; }
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
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, W, H);

    /* Walls */
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(0,        0,        WALL, H);
    ctx.fillRect(W - WALL, 0,        WALL, H);
    ctx.fillRect(0,        H - WALL, W,    WALL);

    /* Wall edge highlights */
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(WALL - 2, 0, 2, H - WALL);
    ctx.fillRect(W - WALL, 0, 2, H - WALL);

    /* Danger line */
    ctx.save();
    ctx.strokeStyle = 'rgba(255,80,80,0.5)';
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
        if (body.label === 'shape') drawBody(ctx, body, bodyLvl);
    }
    if (destroyCharges > 0) drawDestroyTargets();
    drawPopups(ctx, popups, totalMs);

    /* Drop guide + shape waiting to fall (hidden while aiming the destroy power) */
    if (canDrop && !gameOver && destroyCharges === 0) {
        const rad  = r(curLvl);
        const minX = WALL + rad + 2;
        const maxX = W - WALL - rad - 2;
        const sx   = Math.max(minX, Math.min(maxX, dropX));

        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.11)';
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

    requestAnimationFrame(frame);
}


/* ── INPUT ───────────────────────────────────────────────────────────── */
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    dropX = (e.clientX - rect.left) * (W / rect.width);
});

canvas.addEventListener('click', (e) => {
    // When destroy power is armed, the click selects a target instead of
    // dropping. A missed click is a no-op (don't burn the charge or drop).
    if (destroyCharges > 0) { useDestroyPower(e.clientX, e.clientY); return; }
    drop();
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    dropX = (e.touches[0].clientX - rect.left) * (W / rect.width);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (destroyCharges > 0) {
        const t = e.changedTouches[0];
        if (t) useDestroyPower(t.clientX, t.clientY);
        return;
    }
    drop();
}, { passive: false });

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); drop(); }
});


/* ── RESTART ─────────────────────────────────────────────────────────── */
restartEl.addEventListener('click', () => {
    Composite.allBodies(world)
        .filter(b => b.label === 'shape')
        .forEach(b => World.remove(world, b));

    bodyLvl.clear(); bodyBorn.clear(); active.clear();
    mergeQ.length = 0; vanishQ.length = 0; mergeSeen.clear();
    flashes.length = 0; popups.length = 0;

    score     = 0;  scoreEl.textContent = '0';
    curLvl    = firstDrop();  nxtLvl = pickLvl();
    dropX     = W / 2;
    canDrop   = true;  cooldown = 0;
    totalMs   = 0;  gameOver = false;
    devDrops  = 0;  statDropsEl.textContent = '0';

    resetChain();
    powerCharges = 0;
    destroyCharges = 0;
    updatePowerUI();
    updateDestroyUI();

    overlayEl.classList.remove('visible');
    drawNext(nxtCtx, nxtCanvas, nxtLvl);
});


/* ── DEV PANEL CONTROLS ──────────────────────────────────────────────── */
devToggleEl.addEventListener('click', () => {
    const open = devBodyEl.classList.toggle('open');
    devToggleEl.classList.toggle('open', open);
});

autoDropBtn.addEventListener('click', () => {
    autoDropOn = !autoDropOn;
    autoDropTimer = 0;
    autoDropBtn.textContent = autoDropOn ? 'ON' : 'OFF';
    autoDropBtn.classList.toggle('active', autoDropOn);
});

autoSpeedEl.addEventListener('input', () => {
    simSpeed = Number(autoSpeedEl.value);
    autoSpeedVal.textContent = simSpeed + '×';
});

autoXEl.addEventListener('input', () => {
    autoDropX = Number(autoXEl.value) / 100;
    const pct = Number(autoXEl.value);
    autoXVal.textContent = pct === 50 ? 'center' : pct + '%';
});

/* Populate Drop selector with all 12 planets */
SHAPES.forEach((s, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i + 1}. ${s.name}`;
    dropModeEl.appendChild(opt);
});

let debugColliders = false;
colliderBtn.addEventListener('click', () => {
    debugColliders = !debugColliders;
    setDebugColliders(debugColliders);
    colliderBtn.textContent = debugColliders ? 'ON' : 'OFF';
    colliderBtn.classList.toggle('active', debugColliders);
});

dropModeEl.addEventListener('change', () => {
    const v = dropModeEl.value;
    dropMode = (v === 'weighted' || v === 'random') ? v : Number(v);
    // Specific-planet mode: snap current + next previews immediately
    if (typeof dropMode === 'number') {
        curLvl = dropMode;
        nxtLvl = dropMode;
        drawNext(nxtCtx, nxtCanvas, nxtLvl);
    }
});


/* ── BOOT ────────────────────────────────────────────────────────────── */
drawNext(nxtCtx, nxtCanvas, nxtLvl);
// Re-draw NEXT once the currently-pending asset actually loads (SVGs are async)
onAssetLoad((lvl) => { if (lvl === nxtLvl) drawNext(nxtCtx, nxtCanvas, nxtLvl); });

// Wait for any SVG-outline collision shapes to load before starting the loop,
// so the first dropped Moon already has its polygon body.
loadOutlines().then(() => {
    requestAnimationFrame((ts) => { lastTs = ts; requestAnimationFrame(frame); });
});
