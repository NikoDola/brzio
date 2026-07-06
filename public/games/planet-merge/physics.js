/* ════════════════════════════════════════════════════════════════════════
   physics.js  —  Matter.js engine, walls, and body lifecycle
   Owns the physics engine and all body-tracking state.
   ════════════════════════════════════════════════════════════════════════ */

import { LAYOUT, SHAPES, r, polyCorr } from './config.js';
import { densityFor } from './tuning.js';

const { Engine, Bodies, Body, World, Common, Vertices, Sleeping, Query } = Matter;   // Matter loaded via CDN <script>
const { W, H, WALL, WALL_X, WALL_TOP } = LAYOUT;

// Tell Matter where the poly-decomp library is (needed for concave bodies)
if (typeof window !== 'undefined' && window.decomp && Common.setDecomp) {
    Common.setDecomp(window.decomp);
}


/* ── ENGINE ──────────────────────────────────────────────────────────── */
// `enableSleeping` lets bodies freeze when they come to rest. Without this,
// the contact solver keeps applying tiny competing impulses to the Moon's
// decomposed sub-parts, which manifests as a non-stop micro-shake.
export const engine = Engine.create({ gravity: { y: 1.8 }, enableSleeping: true });
export const world  = engine.world;

// The container is a "U" with a cut-down rim: the side walls only start at
// WALL_TOP, so an overfull stack can push planets over the edge. The floor
// spans just the inner width; a planet that goes over a wall has nothing to
// land on and falls out of the world (game.js's checkOver ends the run).
const wallOpts = { isStatic: true, label: 'wall', friction: 0.6, restitution: 0.1 };
const SIDE_H = H - WALL_TOP;
World.add(world, [
    Bodies.rectangle(W / 2,          H - WALL / 2,        W - 2 * WALL_X, WALL,   { ...wallOpts, label: 'floor' }),  // floor (inner width only)
    Bodies.rectangle(WALL_X - WALL/2, WALL_TOP + SIDE_H/2, WALL,         SIDE_H, wallOpts),  // left
    Bodies.rectangle(W - WALL_X + WALL/2, WALL_TOP + SIDE_H/2, WALL,         SIDE_H, wallOpts),  // right
]);


/* ── SHAKE SHIELD ARCH ───────────────────────────────────────────────────
   A temporary, bouncy ceiling arching from wall to wall, switched on while the
   player is shaking. Planets flung upward bounce off it instead of escaping the
   open top, and game.js suspends the danger check while it's up. It sits ABOVE
   the drop row so it never interferes with normal play. Drawn (game.js) as a
   rainbow along this same curve. */
const ARCH_END_Y = 72;  // y at the side walls
const ARCH_PEAK_Y = 26; // y at the centre (lower y = higher)
export function archPoint(t) {
    const x = WALL_X + (W - 2 * WALL_X) * t;
    const u = t * 2 - 1;                                  // -1..1 across the span
    const y = ARCH_PEAK_Y + (ARCH_END_Y - ARCH_PEAK_Y) * (u * u); // parabola
    return { x, y };
}

let shieldSegs = [];
export function setShieldArch(on) {
    if (on) {
        if (shieldSegs.length) return;
        const N = 16, opts = { isStatic: true, label: 'shield', friction: 0.2, restitution: 0.5 };
        for (let i = 0; i < N; i++) {
            const a = archPoint(i / N), b = archPoint((i + 1) / N);
            const seg = Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2,
                Math.hypot(b.x - a.x, b.y - a.y) + 4, 8, opts);
            Body.setAngle(seg, Math.atan2(b.y - a.y, b.x - a.x));
            shieldSegs.push(seg);
        }
        World.add(world, shieldSegs);
    } else if (shieldSegs.length) {
        World.remove(world, shieldSegs);
        shieldSegs = [];
    }
}


/* ── BODY-TRACKING STATE ─────────────────────────────────────────────────
   Exported so game.js and renderer.js can read them, but only mutated
   via spawn() / despawn() below.                                          */
export const bodyLvl  = new Map();   // bodyId → level index
export const bodyBorn = new Map();   // bodyId → totalMs when spawned
export const active   = new Set();   // bodyIds currently in world


/* ── SVG SILHOUETTE COLLISION ─────────────────────────────────────────────
   For planets flagged `outline:true`, the SVG must contain one or more
   <path id="silhouette*"> elements (Adobe Illustrator appends a random
   suffix to the id, so we match by prefix). Each silhouette path is then
   split on `M`/`m` so every SVG subpath becomes its own vertex set; the
   sets are combined into a single compound body.

   The split matters: Illustrator routinely packs the main outline plus
   small decorative interior shapes into one <path>. Sampling that path
   as a single polyline produced phantom-bridge vertices linking the
   outline to the artifacts, which broke poly-decomp and warped the
   collider. Per-subpath sampling + an area-based artifact filter keeps
   only the real silhouette pieces (e.g. body + rings).

   Vertices are normalised relative to the *SVG viewBox centre*, not the
   silhouette's own bbox, so the collider and the rendered image share
   exactly the same coordinate frame and the image always sits on top of
   its collider regardless of how off-centre the silhouette is.          */
const outlineUnitVerts = new Map();   // lvl → [ [{x,y}...], ... ] sets in unit space (1 = viewBox half-span)

/**
 * Fetch every `outline:true` SVG, extract its silhouette path(s), sample
 * them into vertices, and cache. Call once at boot before the first spawn().
 */
export async function loadOutlines() {
    const decompAvailable = !!(window.decomp || window.PolyDecomp);
    console.info(`[physics] poly-decomp library: ${decompAvailable ? 'LOADED ✓' : 'MISSING ✗ — concave shapes will fail'}`);
    for (let lvl = 0; lvl < SHAPES.length; lvl++) {
        const def = SHAPES[lvl];
        if (!def.outline || !def.asset) continue;
        try {
            const sets = await loadOutlineFor(def.asset);
            if (sets && sets.length > 0) {
                outlineUnitVerts.set(lvl, sets);
                const total = sets.reduce((n, s) => n + s.length, 0);
                console.info(`[physics] silhouette ready for ${def.name}: ${sets.length} piece(s), ${total} verts total`);
            } else {
                console.warn(`[physics] silhouette for ${def.name} produced no usable vertices`);
            }
        } catch (e) {
            console.warn(`[physics] silhouette load failed for ${def.name}:`, e);
        }
    }
}

async function loadOutlineFor(assetFile) {
    const xml = await fetch(`assets/images/${assetFile}`).then(r => r.text());
    const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');

    // Anchor everything to the SVG viewBox so collider and image align
    const vb = (doc.documentElement.getAttribute('viewBox') || '0 0 500 500')
        .split(/[\s,]+/).map(Number);
    const [vbX, vbY, vbW, vbH] = vb;
    const cx = vbX + vbW / 2;
    const cy = vbY + vbH / 2;
    const halfSpan = Math.max(vbW, vbH) / 2;

    // Match by id prefix. Illustrator mangles ids like silhouette_0000…_
    const rawPaths = [...doc.querySelectorAll('path[id^="silhouette"]')];
    if (rawPaths.length === 0) throw new Error('no <path id="silhouette*"> in SVG');

    // Flatten every <path id="silhouette*"> into one entry per subpath. See
    // the block comment above for why this matters.
    const subpathDs = rawPaths.flatMap(p => splitSubpaths(p.getAttribute('d') || ''));

    // getTotalLength / getPointAtLength need elements attached to the live DOM
    const NS = 'http://www.w3.org/2000/svg';
    const host = document.createElementNS(NS, 'svg');
    Object.assign(host.style, { position: 'absolute', visibility: 'hidden', width: '0', height: '0' });
    document.body.appendChild(host);

    try {
        const sampled = subpathDs
            .map(d => {
                const el = document.createElementNS(NS, 'path');
                el.setAttribute('d', d);
                host.appendChild(el);
                return samplePath(el, 12).map(v => ({
                    x: (v.x - cx) / halfSpan,
                    y: (v.y - cy) / halfSpan,
                }));
            })
            .filter(set => set.length >= 3);

        // Reject tiny subpaths whose bbox area is below ARTIFACT_THRESHOLD of
        // the largest. Filters out interior detail shapes that Illustrator
        // sometimes lumps into the silhouette path (small highlights, holes)
        // while keeping real secondary pieces like rings.
        const ARTIFACT_THRESHOLD = 0.05;
        const maxA = Math.max(0, ...sampled.map(bboxArea));
        const kept = maxA > 0
            ? sampled.filter(set => bboxArea(set) >= maxA * ARTIFACT_THRESHOLD)
            : sampled;
        if (kept.length < sampled.length) {
            console.info(`[physics] ${assetFile}: dropped ${sampled.length - kept.length} artifact subpath(s) below ${ARTIFACT_THRESHOLD * 100}% of largest`);
        }
        return kept;
    } finally {
        document.body.removeChild(host);
    }
}

/** Split an SVG `d` attribute into one string per subpath. In SVG path data,
 *  every `M` or `m` command starts a fresh subpath; everything between two
 *  M/m commands belongs to the first one. A leading `m` is interpreted as
 *  absolute by the SVG renderer (per spec), so each chunk can stand alone. */
function splitSubpaths(d) {
    return (d.match(/[Mm][^Mm]*/g) || []).map(s => s.trim()).filter(Boolean);
}

/** Axis-aligned bounding-box area of a vertex array, used to size-filter
 *  collider pieces. Cheap proxy for "is this subpath substantial". */
function bboxArea(verts) {
    if (verts.length === 0) return 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of verts) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
    }
    return (maxX - minX) * (maxY - minY);
}

/** Walk an SVG <path> at `sampleLength` pixel intervals → [{x,y}, ...].
 *  Uses standard SVG DOM (getTotalLength/getPointAtLength) — no SVGPathSeg
 *  polyfill needed, unlike Matter.Svg.pathToVertices. */
function samplePath(pathEl, sampleLength) {
    const total = pathEl.getTotalLength();
    if (!total) return [];
    const verts = [];
    for (let s = 0; s < total; s += sampleLength) {
        const p = pathEl.getPointAtLength(s);
        verts.push({ x: p.x, y: p.y });
    }
    return verts;
}


/* ── BODY LIFECYCLE ──────────────────────────────────────────────────── */

/**
 * Create a physics body, register it in tracking state, and add to world.
 * @param {number} x        world-space x centre
 * @param {number} y        world-space y centre
 * @param {number} lvl      index into SHAPES
 * @param {number} totalMs  current game time (for born-timestamp)
 * @param {number} [angle]  visual rotation in radians (default 0)
 */
export function spawn(x, y, lvl, totalMs, angle = 0) {
    const def  = SHAPES[lvl];
    const rad  = r(lvl);
    const opts = {
        restitution:    0.42,   // higher = more bounce on planet–planet impact
        friction:       0.18,   // lower  = planets slide further when shoved
        frictionStatic: 0.06,   // lower  = a planet perched on a curved planet rolls off instead of balancing
        frictionAir:    0.005,  // lower  = motion persists longer after a nudge
        density:        densityFor(lvl),  // live-tunable (dev "Planet Physics"); default = flat 0.002
        label:          'shape',
    };

    let body;
    if (def.sides === 0) {
        const unitSets = outlineUnitVerts.get(lvl);
        if (unitSets) {
            // Each silhouette piece (body, rings, rays, etc.) becomes one
            // vertex set; Matter combines them into one compound body.
            const scaledSets = unitSets.map(set =>
                set.map(v => ({ x: v.x * rad, y: v.y * rad })));
            body = Bodies.fromVertices(x, y, scaledSets, opts, true);
            if (body) {
                // Bodies.fromVertices translates every vertex so the body's
                // centre of mass lands at (x, y). The SVG viewBox centre —
                // which is where the rendered image expects the body to sit —
                // is offset from that by the area-weighted centroid of the
                // silhouette in local coords. Stash that offset so the
                // renderer can compensate (otherwise asymmetric silhouettes
                // like Saturn float above their actual collider).
                let ox = 0, oy = 0, totalA = 0;
                for (const set of scaledSets) {
                    const c = Vertices.centre(set);
                    const a = Math.abs(Vertices.area(set, true));
                    ox += c.x * a;
                    oy += c.y * a;
                    totalA += a;
                }
                body.renderOffset = totalA > 0
                    ? { x: -ox / totalA, y: -oy / totalA }
                    : { x: 0, y: 0 };
            } else {
                console.warn(`[physics] fromVertices failed for ${def.name} — falling back to circle. Likely cause: silhouette malformed or poly-decomp missing.`);
                body = Bodies.circle(x, y, rad, opts);
            }
        } else {
            // 64-sided polygon. Matter.js approximates circles as polygons
            // (default 14–26 sides depending on radius), and the flat edges
            // cause deterministic lateral drift after bouncing on the floor.
            // A finer polygon shrinks the per-edge tilt below the friction
            // threshold so the planet bounces straight up.
            body = Bodies.circle(x, y, rad, opts, 64);
        }
    } else if (def.sides === 'plus') {
        body = Bodies.polygon(x, y, 4, rad, opts);      // square proxy
    } else if (def.sides === 'star') {
        body = Bodies.polygon(x, y, 5, rad, opts);      // pentagon proxy
    } else if (def.sides === 'rect') {
        body = Bodies.rectangle(x, y, rad * 2.0, rad * 0.85, opts);
    } else {
        body = Bodies.polygon(x, y, def.sides, rad, opts);
    }

    // Apply the visual angle, compensating for Matter.js vertex offset
    Body.setAngle(body, angle - polyCorr(lvl));
    Body.setAngularVelocity(body, 0);

    World.add(world, body);
    bodyLvl.set(body.id, lvl);
    bodyBorn.set(body.id, totalMs);
    active.add(body.id);
    return body;
}

/**
 * Silhouette vertex sets for an `outline:true` planet, in unit space
 * (1 = viewBox half-span), or null. These are the *original* SVG outline
 * polylines (body, rings, etc.), NOT the convex collision decomposition, so
 * the renderer can trace a planet's true edges cleanly (used by the
 * new-planet unlock glow). Multiply by the body radius and apply the body's
 * angle + renderOffset to align with the drawn sprite.
 */
export function getOutlineSets(lvl) {
    return outlineUnitVerts.get(lvl) || null;
}

/**
 * Wake every sleeping shape in the world. Matter.js doesn't propagate wake
 * events up through chains, so a body 3 layers up a stack stays frozen when
 * the bottom merges. With ~30 bodies max in this game, scanning them all is
 * trivial. Anything truly settled falls right back asleep within a few ticks.
 *
 * Why the negative sleepCounter: a freshly-woken body has zero velocity, and
 * gravity only adds ~0.014 px/tick of velocity, so motion (velocity squared)
 * stays well below Matter's sleep threshold. Default sleepThreshold is 60
 * ticks, so the body re-sleeps in ~0.5s before gravity has visibly moved it.
 * Pushing sleepCounter into negative territory buys ~3 seconds of guaranteed
 * wake time, long enough for any unsupported body to actually start falling.
 */
const WAKE_WINDOW_TICKS = -180; // ~1.4s extra on top of the default 60-tick threshold
export function wakeAllShapes() {
    for (const body of world.bodies) {
        if (body.label !== 'shape') continue;
        if (body.isSleeping) Sleeping.set(body, false);
        body.sleepCounter = WAKE_WINDOW_TICKS;
    }
}

/**
 * Re-apply current TUNING (mass curve + per-planet multipliers) to every live
 * body, so changing the dev "Planet Physics" sliders is felt immediately
 * without waiting for new spawns. Wakes each body so the new mass takes effect.
 */
export function applyTuningToBodies() {
    for (const body of world.bodies) {
        if (body.label !== 'shape') continue;
        const lvl = bodyLvl.get(body.id);
        if (lvl === undefined) continue;
        Body.setDensity(body, densityFor(lvl));
        if (body.isSleeping) Sleeping.set(body, false);
    }
}

/**
 * After a merge spawns a larger body at the midpoint of two smaller ones,
 * any neighbour that was touching either original may now be deeply
 * intersecting the new body's collider. The contact solver eventually
 * separates them, but with sleeping enabled it can leave them stuck —
 * visible as e.g. a freshly-merged Mercury wedged inside an adjacent Mars.
 * Translate any overlapping neighbour out along the contact normal so the
 * new body starts clear.
 */
export function separateOverlapping(newBody) {
    const lvl = bodyLvl.get(newBody.id);
    if (lvl === undefined) return;
    const newR = r(lvl);
    const region = {
        min: { x: newBody.position.x - newR * 2, y: newBody.position.y - newR * 2 },
        max: { x: newBody.position.x + newR * 2, y: newBody.position.y + newR * 2 },
    };
    for (const other of Query.region(world.bodies, region)) {
        if (other === newBody || other.label !== 'shape' || other.isStatic) continue;
        const otherLvl = bodyLvl.get(other.id);
        if (otherLvl === undefined) continue;
        const otherR = r(otherLvl);
        const dx = other.position.x - newBody.position.x;
        const dy = other.position.y - newBody.position.y;
        const dist = Math.hypot(dx, dy);
        const minDist = newR + otherR;
        if (dist < minDist - 0.5) {
            const overlap = minDist - dist + 1;
            const nx = dist > 0.01 ? dx / dist : 0;
            const ny = dist > 0.01 ? dy / dist : -1;   // straight up if perfectly coincident
            if (other.isSleeping) Sleeping.set(other, false);
            // Compute the translated position, then clamp inside the walls so
            // we never teleport a body through the playfield boundary.
            let tx = other.position.x + nx * overlap;
            let ty = other.position.y + ny * overlap;
            const minX = WALL_X + otherR;
            const maxX = W - WALL_X - otherR;
            const maxY = H - WALL - otherR;
            if (tx < minX) tx = minX;
            else if (tx > maxX) tx = maxX;
            if (ty > maxY) ty = maxY;
            Body.setPosition(other, { x: tx, y: ty });
        }
    }
}

/**
 * Remove a body from the world and clean up tracking state.
 */
export function despawn(body) {
    World.remove(world, body);
    bodyLvl.delete(body.id);
    bodyBorn.delete(body.id);
    active.delete(body.id);
}
