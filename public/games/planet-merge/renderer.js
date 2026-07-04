/* ════════════════════════════════════════════════════════════════════════
   renderer.js  —  all canvas drawing
   Pure functions: take data in, draw to a canvas context, return nothing.
   ════════════════════════════════════════════════════════════════════════ */

import { SHAPES, r, polyCorr } from './config.js';


/* ── ASSET IMAGES ────────────────────────────────────────────────────────
   Each SHAPES entry can declare an `asset` filename in assets/images/.
   Requires a local HTTP server (file:// blocks image loading).
   If an asset is missing or fails to load, drawProcedural is used.

   PERFORMANCE: SVG Images are never drawn in per-frame paths. Browsers
   re-rasterize vector images on nearly every drawImage call, which was the
   game's biggest frame cost (every body + face overlay, every frame). Each
   SVG is instead baked ONCE on load into an offscreen canvas and the hot
   paths blit that bitmap. Baked at max(2*r(lvl), BAKE_MIN) px so small
   planets stay crisp when a preview draws them bigger than their in-game
   size (the NEXT thumbnail renders up to ~59px).                          */
const BAKE_MIN = 64;
const bakeSize = (lvl) => Math.max(r(lvl) * 2, BAKE_MIN);

/** Rasterize a loaded SVG Image into an offscreen canvas. Scaling this
 *  bitmap to the target rect per frame is cheap; rasterizing the SVG
 *  itself per frame is not. */
function bakeBitmap(img, lvl) {
    const s = bakeSize(lvl);
    const c = document.createElement('canvas');
    c.width = c.height = s;
    c.getContext('2d').drawImage(img, 0, 0, s, s);
    return c;
}

/** Solid-black copy of a baked bitmap (alpha preserved). Lets the score
 *  shadow skip ctx.filter entirely: canvas filters force an intermediate
 *  surface plus a pixel pass on every draw, far too slow for a per-frame
 *  path. */
function bakeSilhouette(bmp) {
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#000';
    g.fillRect(0, 0, c.width, c.height);
    return c;
}

const _assetLoadCbs = [];
/** Register a callback fired each time a planet SVG finishes loading.
 *  Used so static previews (e.g. the NEXT thumbnail) can redraw once their
 *  artwork is available (the main game loop redraws every frame anyway). */
export function onAssetLoad(cb) { _assetLoadCbs.push(cb); }

const bodyBmps   = SHAPES.map(() => null);  // lvl → baked body bitmap
const shadowBmps = SHAPES.map(() => null);  // lvl → baked black silhouette
SHAPES.forEach((s, i) => {
    if (!s.asset) return;
    const img = new Image();
    img.src = `assets/images/${s.asset}`;
    img.onload = () => {
        bodyBmps[i] = bakeBitmap(img, i);
        shadowBmps[i] = bakeSilhouette(bodyBmps[i]);
        _assetLoadCbs.forEach((cb) => cb(i));
    };
    img.onerror = () => console.warn(`[renderer] failed to load assets/images/${s.asset}`);
});
const hasImg = (lvl) => !!bodyBmps[lvl];


/* ── FACE EXPRESSIONS ─────────────────────────────────────────────────────
   Planets flagged `expressions:true` in config draw a face OVERLAY on top of
   their (now faceless) body image. The overlay SVG must share the body's
   viewBox so it aligns when drawn at the same rect + rotation.
   File convention: body `planet_earth_body.svg` → `planet_earth_casual.svg`,
   `planet_earth_hurt.svg`, `planet_earth_sad.svg` (the `_body` suffix is
   dropped to get the shared face stem). Missing files fail silently (planet
   just shows the bare body) so art can be added incrementally.

   Mood sequence when a planet is hit (game.js stamps body.expr.hitAt):
     0–HURT_MS:           hurt
     HURT_MS–+SAD_MS:     sad
     after:               casual (resting face)                              */
const EXPR_HURT_MS = 1000;  // flinch for a second the instant it's struck
const EXPR_SAD_MS  = 2000;  // then sulks for two seconds, then back to casual

const exprBmps = SHAPES.map((s, i) => {
    if (!s.asset || !s.expressions) return null;
    const base = s.asset.replace(/\.svg$/i, '').replace(/_body$/, '');
    // Slots fill in as each face SVG loads and bakes; a missing file just
    // leaves its slot null (planet shows the bare body until art exists).
    const slot = { casual: null, hurt: null, sad: null };
    for (const mood of ['casual', 'hurt', 'sad']) {
        const img = new Image();
        img.src = `assets/images/${base}_${mood}.svg`;
        img.onload  = () => {
            slot[mood] = bakeBitmap(img, i);
            _assetLoadCbs.forEach((cb) => cb(i));
        };
        img.onerror = () => {};  // art may not exist yet: fall back to bare body
    }
    return slot;
});

/** Which face a planet should show right now, from its hit timestamp. Pure
 *  read of body.expr + the clock — no state mutation (that lives in game.js). */
function currentExpr(body, totalMs) {
    const e = body.expr;
    if (!e) return 'casual';
    const dt = totalMs - e.hitAt;
    if (dt < EXPR_HURT_MS) return 'hurt';
    if (dt < EXPR_HURT_MS + EXPR_SAD_MS) return 'sad';
    return 'casual';
}

/* ── COLOUR UTIL ─────────────────────────────────────────────────────── */
function lighten(hex, amt) {
    const ri = parseInt(hex.slice(1, 3), 16);
    const gi = parseInt(hex.slice(3, 5), 16);
    const bi = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255,ri+amt)},${Math.min(255,gi+amt)},${Math.min(255,bi+amt)})`;
}


/* ── PROCEDURAL SHAPE ────────────────────────────────────────────────── */
/**
 * Draw one shape procedurally onto any canvas context.
 * Works for both the drop preview and live physics bodies.
 * Pass an explicit radius to override the default world-scale r(lvl).
 */
export function drawProcedural(c, lvl, cx, cy, angle, radOverride) {
    const def = SHAPES[lvl];
    const rad = radOverride ?? r(lvl);

    c.save();
    c.translate(cx, cy);
    c.rotate(angle);

    c.beginPath();
    if (def.sides === 0) {
        c.arc(0, 0, rad, 0, Math.PI * 2);
    } else if (def.sides === 'plus') {
        const arm = rad * 0.38;
        c.moveTo(-arm, -rad); c.lineTo( arm, -rad);
        c.lineTo( arm, -arm); c.lineTo( rad, -arm);
        c.lineTo( rad,  arm); c.lineTo( arm,  arm);
        c.lineTo( arm,  rad); c.lineTo(-arm,  rad);
        c.lineTo(-arm,  arm); c.lineTo(-rad,  arm);
        c.lineTo(-rad, -arm); c.lineTo(-arm, -arm);
        c.closePath();
    } else if (def.sides === 'star') {
        const inner = rad * 0.42;
        for (let i = 0; i < 10; i++) {
            const a  = (Math.PI * i / 5) - Math.PI / 2;
            const sr = i % 2 === 0 ? rad : inner;
            const px = sr * Math.cos(a);
            const py = sr * Math.sin(a);
            i ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath();
    } else if (def.sides === 'rect') {
        c.rect(-rad, -rad * 0.425, rad * 2, rad * 0.85);
    } else {
        for (let i = 0; i < def.sides; i++) {
            const a  = (2 * Math.PI * i / def.sides) - Math.PI / 2;
            const px = rad * Math.cos(a);
            const py = rad * Math.sin(a);
            i ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath();
    }

    const gr = c.createRadialGradient(-rad * 0.32, -rad * 0.32, 0, 0, 0, rad * 1.05);
    gr.addColorStop(0, lighten(def.color, 60));
    gr.addColorStop(1, def.color);
    c.fillStyle = gr;
    c.fill();
    c.strokeStyle = def.glow;
    c.lineWidth = 2.5;
    c.stroke();

    const fs = Math.max(10, rad * 0.42);
    c.font = `bold ${fs}px 'Fredoka', 'Segoe UI', Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,0.7)';
    c.shadowBlur  = 5;
    c.fillStyle   = '#fff';
    c.fillText(lvl + 1, 0, 0);
    c.shadowBlur  = 0;
    c.restore();
}


/* ── PHYSICS BODY ────────────────────────────────────────────────────── */
/** When true, draws the actual collision outline on top of every body. */
export let DEBUG_COLLIDERS = false;
export function setDebugColliders(v) { DEBUG_COLLIDERS = !!v; }

/**
 * Draw one live physics body.
 * Uses the asset image if available, otherwise drawProcedural.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Matter.Body} body
 * @param {Map} bodyLvl   bodyId → level index (from physics.js)
 */
export function drawBody(ctx, body, bodyLvl, totalMs = 0) {
    const lvl = bodyLvl.get(body.id);
    if (lvl === undefined) return;

    // Convert physics angle back to visual angle (undoes the spawn correction)
    const vAngle = body.angle + polyCorr(lvl);

    if (hasImg(lvl)) {
        const rad = r(lvl);
        const ro  = body.renderOffset;        // set by physics.js for silhouette bodies
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(vAngle);
        if (ro) ctx.translate(ro.x, ro.y);    // align image w/ collider when silhouette is off-centre
        ctx.drawImage(bodyBmps[lvl], -rad, -rad, rad * 2, rad * 2);
        // Face overlay on top of the body, same rect so it tracks position
        // and rotation. Drawn after the body, inside the same transform.
        const faces = exprBmps[lvl];
        if (faces) {
            const face = faces[currentExpr(body, totalMs)];
            if (face) ctx.drawImage(face, -rad, -rad, rad * 2, rad * 2);
        }
        ctx.restore();
    } else {
        drawProcedural(ctx, lvl, body.position.x, body.position.y, vAngle);
    }

    if (DEBUG_COLLIDERS) drawColliderOverlay(ctx, body);
}

/**
 * Visual debug: trace every part's actual collision vertices in lime green.
 * Compound (decomposed) bodies live in body.parts[1..]; simple bodies in body itself.
 */
function drawColliderOverlay(ctx, body) {
    const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,140,0.85)';
    ctx.lineWidth = 1.8;
    for (const part of parts) {
        if (!part.vertices || part.vertices.length < 2) continue;
        ctx.beginPath();
        part.vertices.forEach((v, i) => {
            i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y);
        });
        ctx.closePath();
        ctx.stroke();
    }
    ctx.restore();
}


/* ── ASSET-AWARE PREVIEW ─────────────────────────────────────────────── */
/**
 * Draw a planet at an arbitrary radius (used by the drop-preview at the
 * top of the canvas and the NEXT thumbnail). Falls back to drawProcedural
 * when the SVG asset hasn't loaded yet.
 */
export function drawPreview(ctx, lvl, cx, cy, angle, rad) {
    if (hasImg(lvl)) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.drawImage(bodyBmps[lvl], -rad, -rad, rad * 2, rad * 2);
        // A planet waiting to drop (or in the NEXT panel) has no hit state,
        // so it always wears its casual face, same overlay as a live body.
        const faces = exprBmps[lvl];
        if (faces && faces.casual) {
            ctx.drawImage(faces.casual, -rad, -rad, rad * 2, rad * 2);
        }
        ctx.restore();
        return;
    }
    drawProcedural(ctx, lvl, cx, cy, angle, rad);
}


/* ── SCORE BEHIND THE DROP ───────────────────────────────────────────── */
/**
 * Big total score painted in the sky, with the dropping planet's shadow falling
 * ONLY on the digits (masked by the score text), never on the container.
 * `fx` is a reused offscreen canvas; the mask needs an isolated buffer so
 * `source-atop` clips the shadow to the text alone. Drawn behind the real planet.
 */
export function drawScoreShadow(ctx, fx, scoreText, lvl, planetX, dropY, rad) {
    const f = fx.getContext('2d');
    f.clearRect(0, 0, fx.width, fx.height);
    const cx = fx.width / 2; // score is pinned to the centre and never moves

    // The score, big and faded, fixed in the centre of the sky band.
    f.save();
    f.font = `900 128px 'Fredoka', 'Segoe UI', Arial, sans-serif`;
    f.textAlign = 'center';
    f.textBaseline = 'middle';
    f.fillStyle = 'rgba(255,255,255,0.22)';
    f.fillText(scoreText, cx, dropY);
    f.restore();

    // The +10% black silhouette follows the live planet, drawn source-atop so it
    // lands ONLY where the score text is (the text is the mask). As the planet
    // slides across, its shadow sweeps over the fixed number. The silhouette is
    // pre-baked at load (bakeSilhouette); per-frame ctx.filter is a known slow
    // path and must not come back here. Skipped (lvl < 0) while no planet is
    // waiting, so the number stays put with no shadow.
    if (lvl >= 0 && shadowBmps[lvl]) {
        const sr = rad * 1.1;
        f.save();
        f.globalCompositeOperation = 'source-atop';
        f.globalAlpha = 0.3;
        f.drawImage(shadowBmps[lvl], planetX - sr, dropY - sr, sr * 2, sr * 2);
        f.restore();
    }

    ctx.drawImage(fx, 0, 0);
}


/* ── NEXT-SHAPE PREVIEW ──────────────────────────────────────────────── */
export function drawNext(nxtCtx, nxtCanvas, nxtLvl) {
    nxtCtx.clearRect(0, 0, nxtCanvas.width, nxtCanvas.height);
    // Fit the planet inside the thumbnail with a bit of padding
    const fitRad = Math.min(nxtCanvas.width, nxtCanvas.height) * 0.42;
    drawPreview(nxtCtx, nxtLvl, nxtCanvas.width / 2, nxtCanvas.height / 2, 0, fitRad);
}


/* ── MERGE / VANISH FLASHES ──────────────────────────────────────────── */
/**
 * Draw and age all pending flash effects.
 * Mutates the flashes array (removes expired entries).
 */
export function drawFlashes(ctx, flashes, totalMs) {
    for (let i = flashes.length - 1; i >= 0; i--) {
        const f   = flashes[i];
        const dur = f.big ? 700 : 380;
        const age = totalMs - f.t;
        if (age > dur) { flashes.splice(i, 1); continue; }
        const p = age / dur;

        if (f.big) {
            // Gold vanish: three concentric expanding rings
            for (const [rScale, aScale] of [[1, 0.55], [0.65, 0.35], [0.35, 0.20]]) {
                ctx.beginPath();
                ctx.arc(f.x, f.y, p * 140 * rScale, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,215,0,${(1 - p) * aScale})`;
                ctx.fill();
            }
        } else {
            // Normal merge: single white ring
            ctx.beginPath();
            ctx.arc(f.x, f.y, p * 72, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,215,${(1 - p) * 0.42})`;
            ctx.fill();
        }
    }
}


/* ── NEW-PLANET UNLOCK GLOW ──────────────────────────────────────────────
   A light-blue outline that traces a planet's edges when its kind is first
   created in a run. Round planets get a circle; silhouette planets (Moon,
   Saturn, Sun) trace their real SVG outline (rings included) via the
   un-decomposed silhouette vertices from physics.js, NOT the convex collider
   decomposition (which would show internal seams).                         */
const UNLOCK_GLOW_MS = 1500;
const UNLOCK_RGB = '112, 224, 249'; // #70E0F9

/** Build (only) the edge path for a body at the given outward scale.
 *  `getOutlineSets(lvl)` returns silhouette unit-vertex sets or null. */
function pathBodyEdge(ctx, body, lvl, getOutlineSets, scale) {
    const sets = getOutlineSets(lvl);
    const pos  = body.position;
    ctx.beginPath();
    if (sets) {
        // Match the sprite transform from drawBody so the outline lands on the
        // drawn image: translate → rotate(visual angle) → renderOffset, then
        // verts in unit space scaled by the body radius.
        const rad    = r(lvl);
        const vAngle = body.angle + polyCorr(lvl);
        const ro     = body.renderOffset || { x: 0, y: 0 };
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(vAngle);
        ctx.translate(ro.x, ro.y);
        for (const set of sets) {
            set.forEach((v, i) => {
                const x = v.x * rad * scale;
                const y = v.y * rad * scale;
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            });
            ctx.closePath();
        }
        ctx.restore();   // points are already placed; path survives the restore
    } else {
        ctx.arc(pos.x, pos.y, r(lvl) * scale, 0, Math.PI * 2);
    }
}

/**
 * Draw and age all pending unlock glows. Mutates `glows` (drops expired ones
 * and any whose body has merged away).
 * @param getBody        (id) => Matter.Body | null
 * @param getOutlineSets (lvl) => silhouette sets | null  (from physics.js)
 */
export function drawUnlockGlows(ctx, glows, getBody, getOutlineSets, bodyLvl, totalMs) {
    for (let i = glows.length - 1; i >= 0; i--) {
        const g = glows[i];
        const age = totalMs - g.t;
        if (age > UNLOCK_GLOW_MS) { glows.splice(i, 1); continue; }
        const body = getBody(g.bodyId);
        const lvl  = body ? bodyLvl.get(body.id) : undefined;
        if (!body || lvl === undefined) { glows.splice(i, 1); continue; }

        const p    = age / UNLOCK_GLOW_MS;                 // 0 → 1
        const fade = 1 - p;                                // overall fade-out
        const pulse = 0.55 + 0.45 * Math.sin(age / 1000 * Math.PI * 4); // ~2 pulses

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap  = 'round';

        // Steady edge outline hugging just outside the planet, alpha pulsing.
        pathBodyEdge(ctx, body, lvl, getOutlineSets, 1.03);
        ctx.strokeStyle = `rgba(${UNLOCK_RGB}, ${fade * pulse})`;
        ctx.lineWidth   = 3.5;
        ctx.shadowColor = `rgba(${UNLOCK_RGB}, ${fade})`;
        ctx.shadowBlur  = 14;
        ctx.stroke();

        // Expanding ripple following the same edges, growing as it fades.
        pathBodyEdge(ctx, body, lvl, getOutlineSets, 1.03 + p * 0.45);
        ctx.strokeStyle = `rgba(${UNLOCK_RGB}, ${fade * 0.5})`;
        ctx.lineWidth   = 2;
        ctx.shadowBlur  = 0;
        ctx.stroke();

        ctx.restore();
    }
}


/* ── SCORE POPUPS ────────────────────────────────────────────────────── */
/**
 * Draw and age all pending score popup effects.
 * Mutates the popups array (removes expired entries).
 */
export function drawPopups(ctx, popups, totalMs) {
    for (let i = popups.length - 1; i >= 0; i--) {
        const p   = popups[i];
        const dur = p.dur ?? (p.big ? 1200 : 850);
        const age = totalMs - p.t;
        if (age > dur) { popups.splice(i, 1); continue; }

        const alpha = 1 - age / dur;
        const yOff  = -(age / dur) * (p.big ? 80 : 52);

        const fontSize = p.fontSize ?? (p.big ? 28 : 16);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font        = `bold ${fontSize}px 'Fredoka', 'Segoe UI', Arial, sans-serif`;
        ctx.fillStyle   = p.color || (p.big ? '#FFD700' : '#FECA57');
        ctx.textAlign   = 'center';
        ctx.shadowColor = p.shadowColor || (p.big ? 'rgba(200,100,0,0.8)' : 'rgba(0,0,0,0.6)');
        ctx.shadowBlur  = p.big ? 10 : 4;
        ctx.fillText(p.text, p.x, p.y + yOff);
        ctx.restore();
    }
}
