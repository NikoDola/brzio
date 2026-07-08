/* ════════════════════════════════════════════════════════════════════════
   renderer.js  —  all canvas drawing
   Pure functions: take data in, draw to a canvas context, return nothing.
   ════════════════════════════════════════════════════════════════════════ */

import { LAYOUT, SHAPES, r, polyCorr } from './config.js';


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

const MOODS = ['casual', 'hurt', 'sad'];

const bodyBmps   = SHAPES.map(() => null);  // lvl → baked body bitmap
const combinedBmps = SHAPES.map(() => ({ casual: null, hurt: null, sad: null }));
const accessoryBmps = SHAPES.map(() => []);  // lvl → array of baked accessory bitmaps (index matches SHAPES[lvl].accessories)

// The source Images are retained after baking so every bitmap can be re-baked:
// a GPU process reset (driver crash, laptop sleep, memory pressure) silently
// wipes the contents of offscreen canvases, and without the originals every
// sprite would stay invisible for the rest of the session. See the
// context-loss self-heal block below.
const bodyImgs = SHAPES.map(() => null);   // lvl → loaded body Image
const faceImgs = SHAPES.map(() => null);   // lvl → { casual, hurt, sad } loaded Images
const accImgs  = SHAPES.map(() => []);     // lvl → array of loaded accessory Images

function bakeCombinedSprite(lvl, faceBmp) {
    const body = bodyBmps[lvl];
    if (!body) return null;
    const c = document.createElement('canvas');
    c.width = body.width;
    c.height = body.height;
    const g = c.getContext('2d');
    g.drawImage(body, 0, 0);
    if (faceBmp) g.drawImage(faceBmp, 0, 0, c.width, c.height);
    return c;
}

function rebuildCombinedSprites(lvl) {
    const faces = exprBmps[lvl];
    if (!bodyBmps[lvl] || !faces) return;
    for (const mood of MOODS) {
        if (faces[mood]) combinedBmps[lvl][mood] = bakeCombinedSprite(lvl, faces[mood]);
    }
}

function spriteForMood(lvl, mood = 'casual') {
    const combined = combinedBmps[lvl];
    return combined?.[mood] || combined?.casual || bodyBmps[lvl];
}

SHAPES.forEach((s, i) => {
    if (!s.asset) return;
    const img = new Image();
    img.src = `assets/images/${s.asset}`;
    img.onload = () => {
        bodyImgs[i] = img;
        bodyBmps[i] = bakeBitmap(img, i);
        rebuildCombinedSprites(i);
        _assetLoadCbs.forEach((cb) => cb(i));
    };
    img.onerror = () => console.warn(`[renderer] failed to load assets/images/${s.asset}`);
});
const hasImg = (lvl) => !!bodyBmps[lvl];

/** Bake one decorative accessory (Saturn's ring, the Sun's corona/sunglasses)
 *  at the planet's bake resolution, preserving the drawn aspect. Accessories are
 *  pure paint in drawBody and never contribute to the collider. Sized either by
 *  `inflatePx` (body diameter + a pixel outset, square) or by `wRatio`/`hRatio`
 *  (fractions of the body diameter). */
function bakeAccessory(img, lvl, acc) {
    const bake  = bakeSize(lvl);            // px the body diameter bakes to
    const scale = bake / (r(lvl) * 2);      // bake px per world px
    let w, h;
    if (acc.inflatePx != null) {
        const drawn = r(lvl) * 2 + 2 * acc.inflatePx;   // world px, square
        w = h = Math.max(1, Math.round(drawn * scale));
    } else {
        w = Math.max(1, Math.round(bake * (acc.wRatio ?? 1)));
        h = Math.max(1, Math.round(bake * (acc.hRatio ?? 1)));
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c;
}

SHAPES.forEach((s, i) => {
    if (!s.accessories) return;
    s.accessories.forEach((acc, ai) => {
        if (!acc.asset) return;
        const img = new Image();
        img.src = `assets/images/${acc.asset}`;
        img.onload = () => {
            accImgs[i][ai] = img;
            accessoryBmps[i][ai] = bakeAccessory(img, i, acc);
            _assetLoadCbs.forEach((cb) => cb(i));
        };
        img.onerror = () => console.warn(`[renderer] failed to load assets/images/${acc.asset}`);
    });
});

let playerMarkerBmp = null;
let playerMarkerShadowBmp = null;
let playerMarkerAsset = "";
let playerMarkerImg = null;   // retained for context-loss re-baking

function bakePlayerMarker(img) {
    const c = document.createElement('canvas');
    c.width = LAYOUT.PLAYER_MARKER_W;
    c.height = LAYOUT.PLAYER_MARKER_H;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
}

export function setPlayerMarkerAsset(asset) {
    if (!asset || asset === playerMarkerAsset) return;
    playerMarkerAsset = asset;
    const img = new Image();
    img.src = `assets/images/${asset}`;
    img.onload = () => {
        if (asset !== playerMarkerAsset) return;
        playerMarkerImg = img;
        playerMarkerBmp = bakePlayerMarker(img);
        playerMarkerShadowBmp = bakeSilhouette(playerMarkerBmp);
    };
    img.onerror = () => console.warn(`[renderer] failed to load assets/images/${asset}`);
}

if (LAYOUT.PLAYER_MARKER_ASSET) {
    setPlayerMarkerAsset(LAYOUT.PLAYER_MARKER_ASSET);
}


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
            if (!faceImgs[i]) faceImgs[i] = {};
            faceImgs[i][mood] = img;
            slot[mood] = bakeBitmap(img, i);
            rebuildCombinedSprites(i);
            _assetLoadCbs.forEach((cb) => cb(i));
        };
        img.onerror = () => {};  // art may not exist yet: fall back to bare body
    }
    return slot;
});

/* ── CONTEXT-LOSS SELF-HEAL ──────────────────────────────────────────────
   Every sprite is pre-baked into an offscreen canvas (see the performance
   notes in CLAUDE.md). The catch: when the browser's GPU process resets
   (driver crash, laptop sleep, memory pressure), the contents of EVERY canvas
   backing store are wiped. The visible game canvas repaints each frame so
   procedural drawing (walls, stars, beam) keeps working, but the baked
   bitmaps are drawn once and never again, so the ship and all planets turn
   permanently invisible until the page is reloaded.

   The heal: planets are opaque at their centre, so if a baked body bitmap's
   centre pixel reads fully transparent, its backing store was lost. Re-bake
   everything from the retained Images (a few ms of work). Checked on a slow
   timer and whenever the tab becomes visible again, which is when losses
   typically surface. */
function rebakeAll() {
    SHAPES.forEach((s, i) => {
        if (bodyImgs[i]) bodyBmps[i] = bakeBitmap(bodyImgs[i], i);
        const faces = faceImgs[i];
        if (faces && exprBmps[i]) {
            for (const mood of MOODS) {
                if (faces[mood]) exprBmps[i][mood] = bakeBitmap(faces[mood], i);
            }
        }
        rebuildCombinedSprites(i);
        (s.accessories || []).forEach((acc, ai) => {
            if (accImgs[i][ai]) accessoryBmps[i][ai] = bakeAccessory(accImgs[i][ai], i, acc);
        });
        if (bodyImgs[i]) _assetLoadCbs.forEach((cb) => cb(i));
    });
    if (playerMarkerImg) {
        playerMarkerBmp = bakePlayerMarker(playerMarkerImg);
        playerMarkerShadowBmp = bakeSilhouette(playerMarkerBmp);
    }
}

function bakedBitmapsWiped() {
    const lvl = bodyBmps.findIndex(Boolean);
    if (lvl < 0) return false;   // nothing baked yet: nothing to heal
    const bmp = bodyBmps[lvl];
    try {
        const px = bmp
            .getContext('2d')
            .getImageData(Math.floor(bmp.width / 2), Math.floor(bmp.height / 2), 1, 1).data;
        return px[3] === 0;
    } catch (_) {
        return false;
    }
}

function healBakedBitmaps(trigger) {
    if (!bakedBitmapsWiped()) return;
    console.warn(`[renderer] baked sprites lost their contents (${trigger}); re-baking from retained images`);
    rebakeAll();
}

setInterval(() => healBakedBitmaps('periodic check'), 4000);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') healBakedBitmaps('tab became visible');
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

/** Drawn size + centre offset of an accessory in world px (relative to the body
 *  centre). Sized by `inflatePx` (square: body + a pixel outset) or by
 *  `wRatio`/`hRatio`; positioned by `xRatio`/`yRatio`. */
function accessoryRect(rad, acc) {
    const diameter = rad * 2;
    const w = acc.inflatePx != null ? diameter + 2 * acc.inflatePx : diameter * (acc.wRatio ?? 1);
    const h = acc.inflatePx != null ? diameter + 2 * acc.inflatePx : diameter * (acc.hRatio ?? 1);
    return { w, h, cx: diameter * (acc.xRatio || 0), cy: diameter * (acc.yRatio || 0) };
}

/** Blit an accessory centred at its offset. Call inside the body's
 *  translate+rotate frame. */
function drawAccessory(ctx, bmp, rad, acc) {
    if (!bmp) return;
    const { w, h, cx, cy } = accessoryRect(rad, acc);
    ctx.drawImage(bmp, cx - w / 2, cy - h / 2, w, h);
}

/**
 * Draw one live physics body, in a given render `phase`:
 *   'back'  — only the accessories that sit BEHIND planets (everything except
 *             those flagged layer:'front').
 *   'body'  — only the planet body + face.
 *   'front' — only layer:'front' accessories (the Sun's sunglasses).
 *   'all'   — everything, in one pass (default; used by non-layered callers).
 *
 * The game loop calls it once per phase across ALL planets, so back accessories
 * land behind every body and front ones in front of every body — an accessory
 * can never cover a neighbouring planet (only the sunglasses ride on top).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Matter.Body} body
 * @param {Map} bodyLvl   bodyId → level index (from physics.js)
 */
export function drawBody(ctx, body, bodyLvl, totalMs = 0, phase = 'all') {
    const lvl = bodyLvl.get(body.id);
    if (lvl === undefined) return;

    // Convert physics angle back to visual angle (undoes the spawn correction)
    const vAngle = body.angle + polyCorr(lvl);
    const wantBack  = phase === 'all' || phase === 'back';
    const wantBody  = phase === 'all' || phase === 'body';
    const wantFront = phase === 'all' || phase === 'front';

    if (hasImg(lvl)) {
        const rad = r(lvl);
        const ro  = body.renderOffset;        // set by physics.js for silhouette bodies
        const sprite = spriteForMood(lvl, currentExpr(body, totalMs));
        const accs  = SHAPES[lvl].accessories;
        const bmps  = accessoryBmps[lvl];
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(vAngle);
        // Accessories are pure paint (the collider is a plain circle). Anything
        // not flagged 'front' is drawn behind, so it never covers a planet.
        if (accs && wantBack) {
            for (let i = 0; i < accs.length; i++) {
                if (accs[i].layer !== 'front') drawAccessory(ctx, bmps[i], rad, accs[i]);
            }
        }
        if (wantBody) {
            ctx.save();
            if (ro) ctx.translate(ro.x, ro.y);   // align image w/ collider when silhouette is off-centre
            ctx.drawImage(sprite, -rad, -rad, rad * 2, rad * 2);
            ctx.restore();
        }
        if (accs && wantFront) {
            for (let i = 0; i < accs.length; i++) {
                if (accs[i].layer === 'front') drawAccessory(ctx, bmps[i], rad, accs[i]);
            }
        }
        ctx.restore();
    } else if (wantBody) {
        drawProcedural(ctx, lvl, body.position.x, body.position.y, vAngle);
    }

    if (DEBUG_COLLIDERS && wantBody) drawColliderOverlay(ctx, body);
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
export function drawPreview(ctx, lvl, cx, cy, angle, rad, blocked = false) {
    if (hasImg(lvl)) {
        const sprite = spriteForMood(lvl, blocked ? 'hurt' : 'casual');
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.drawImage(sprite, -rad, -rad, rad * 2, rad * 2);
        if (blocked) drawBlockedCross(ctx, rad);
        ctx.restore();
        return;
    }
    drawProcedural(ctx, lvl, cx, cy, angle, rad);
    if (blocked) {
        ctx.save();
        ctx.translate(cx, cy);
        drawBlockedCross(ctx, rad);
        ctx.restore();
    }
}

/* Red ✗ over a blocked drop preview ("you can't drop here"). Drawn at full
   alpha so it reads clearly on top of the dimmed planet. */
function drawBlockedCross(ctx, rad) {
    const a = rad * 0.5;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = Math.max(5, rad * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-a, -a);
    ctx.lineTo(a, a);
    ctx.moveTo(a, -a);
    ctx.lineTo(-a, a);
    ctx.stroke();
}


/* ── PLAYER CHARACTER (placeholder) ───────────────────────────────────────
 * Draws the 10:7 SVG holder skin. If the asset is missing or still loading,
 * it falls back to the old red rectangle.
 */
export function drawPlayerMarker(ctx, cx, edgeY, angle = 0, heldLvl = -1, heldBlocked = false, heldScale = 1, opts = {}) {
    const w = LAYOUT.PLAYER_MARKER_W, h = LAYOUT.PLAYER_MARKER_H;
    ctx.save();
    ctx.translate(cx, edgeY);
    ctx.rotate(angle);
    if (!opts.skipBeam) drawAlienBeam(ctx, w, h);
    if (playerMarkerBmp) {
        ctx.drawImage(playerMarkerBmp, -w / 2, -h / 2, w, h);
    } else {
        ctx.fillStyle = '#e63946';
        ctx.fillRect(-w / 2, -h / 2, w, h);
    }

    if (heldLvl >= 0 && heldScale > 0.001) {
        const heldRad = ((h * LAYOUT.PLAYER_MARKER_NEXT_SLOT_SCALE) / 2) * heldScale;
        const heldY = h / 2 - h * LAYOUT.PLAYER_MARKER_PLANET_BOTTOM_PAD - heldRad;
        ctx.save();
        ctx.globalAlpha = heldBlocked ? 0.7 : 1;
        drawPreview(ctx, heldLvl, 0, heldY, 0, heldRad, heldBlocked);
        ctx.restore();
    }

    ctx.restore();
}

function drawAlienBeam(ctx, w, h) {
    const alpha = (v) => v * 0.6;
    const sourceY = h * 0.34;
    const bottomY = sourceY + h * 1.15;
    const topW = w * 0.26;
    const bottomW = w * 0.72;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    let beam = ctx.createLinearGradient(0, sourceY, 0, bottomY);
    beam.addColorStop(0, `rgba(220,255,245,${alpha(0.42)})`);
    beam.addColorStop(0.16, `rgba(83,255,203,${alpha(0.34)})`);
    beam.addColorStop(0.62, `rgba(0,218,184,${alpha(0.18)})`);
    beam.addColorStop(1, 'rgba(0,168,166,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-topW / 2, sourceY);
    ctx.lineTo(topW / 2, sourceY);
    ctx.lineTo(bottomW / 2, bottomY);
    ctx.lineTo(-bottomW / 2, bottomY);
    ctx.closePath();
    ctx.fill();

    const core = ctx.createLinearGradient(0, sourceY, 0, bottomY);
    core.addColorStop(0, `rgba(255,255,255,${alpha(0.55)})`);
    core.addColorStop(0.18, `rgba(118,255,220,${alpha(0.42)})`);
    core.addColorStop(0.68, `rgba(0,238,198,${alpha(0.16)})`);
    core.addColorStop(1, 'rgba(0,238,198,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(-topW * 0.34, sourceY + 2);
    ctx.lineTo(topW * 0.34, sourceY + 2);
    ctx.lineTo(bottomW * 0.22, bottomY * 0.88);
    ctx.lineTo(-bottomW * 0.22, bottomY * 0.88);
    ctx.closePath();
    ctx.fill();

    const sourceGlow = ctx.createRadialGradient(0, sourceY, 0, 0, sourceY, topW * 0.72);
    sourceGlow.addColorStop(0, `rgba(255,255,255,${alpha(0.78)})`);
    sourceGlow.addColorStop(0.24, `rgba(127,255,219,${alpha(0.52)})`);
    sourceGlow.addColorStop(1, 'rgba(0,235,190,0)');
    ctx.fillStyle = sourceGlow;
    ctx.beginPath();
    ctx.ellipse(0, sourceY, topW * 0.7, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    const floorGlow = ctx.createRadialGradient(0, bottomY * 0.9, 0, 0, bottomY * 0.9, bottomW * 0.52);
    floorGlow.addColorStop(0, `rgba(118,255,225,${alpha(0.2)})`);
    floorGlow.addColorStop(0.5, `rgba(0,222,196,${alpha(0.12)})`);
    floorGlow.addColorStop(1, 'rgba(0,222,196,0)');
    ctx.fillStyle = floorGlow;
    ctx.beginPath();
    ctx.ellipse(0, bottomY * 0.9, bottomW * 0.5, h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}


/* ── SCORE BEHIND THE DROP ───────────────────────────────────────────── */
/**
 * Big total score painted in the sky, with the player marker's shadow falling
 * only on the digits. `fx` is a reused offscreen canvas; the mask needs an
 * isolated buffer so `source-atop` clips the shadow to the text alone.
 */
export function drawScoreShadow(ctx, fx, scoreText, markerX, scoreY, markerEdgeY, markerAngle = 0, scoreX = fx.width / 2) {
    const f = fx.getContext('2d');
    f.clearRect(0, 0, fx.width, fx.height);

    // The score, big and faded, fixed in the centre of the sky band.
    f.save();
    f.font = `900 112px 'Fredoka', 'Segoe UI', Arial, sans-serif`;
    f.textAlign = 'center';
    f.textBaseline = 'middle';
    f.fillStyle = 'rgba(255,255,255,0.22)';
    f.fillText(scoreText, scoreX, scoreY);
    f.restore();

    const w = LAYOUT.PLAYER_MARKER_W;
    const h = LAYOUT.PLAYER_MARKER_H;
    f.save();
    f.globalCompositeOperation = 'source-atop';
    f.globalAlpha = 0.3;
    f.translate(markerX, markerEdgeY);
    f.rotate(markerAngle);
    if (playerMarkerShadowBmp) {
        f.drawImage(playerMarkerShadowBmp, -w / 2, -h / 2, w, h);
    } else {
        f.fillStyle = '#000';
        f.fillRect(-w / 2, -h / 2, w, h);
    }
    f.restore();

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
