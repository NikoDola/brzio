/* ════════════════════════════════════════════════════════════════════════
   config.js  —  THE ONLY FILE YOU NEED TO EDIT
   Change shapes, sizes, colours, drop chances here.
   Everything else reads from this file automatically.
   ════════════════════════════════════════════════════════════════════════ */


/* ── LAYOUT ──────────────────────────────────────────────────────────────
   Canvas size and wall dimensions.                                        */
export const LAYOUT = {
    W:            840,    // canvas width  (px)  — 2× original
    H:            927,    // canvas height (px)  — +30% from original, then +15%
    WALL:         20,     // wall thickness (px) — +40%
    DROP_Y:       81,     // y-centre of the shape sitting at the top, ready to drop (+40%)
    DANGER_Y:     133,    // red line — any settled shape above this ends the game (+40%)
    BASE_R:       216,    // pixel radius of a shape whose size is 100 (the Sun) — +20% from 180
    VANISH_BONUS: 200,    // bonus score when two Suns touch and vanish
};


/* ════════════════════════════════════════════════════════════════════════
   PLANETS (ordered smallest → largest)
   Two identical planets touching → merge into the next one up.
   Two SUNS touching → both vanish for VANISH_BONUS score.

   ┌─────────────┬────────────────────────────────────────────────────────┐
   │ name        │ cosmetic label                                         │
   │ size        │ radius as % of LAYOUT.BASE_R (Sun = 100)                │
   │ sides       │ 0 = circle (all planets are circles)                   │
   │ color       │ fill hex (fallback when SVG can't load)                │
   │ glow        │ stroke / outline hex                                   │
   │ pts         │ score awarded when this planet is CREATED by merging   │
   │ droppable   │ true → can fall from the top as a random drop          │
   │ dropRate    │ relative drop frequency (ignored when droppable:false) │
   │ asset       │ filename inside assets/images/                         │
   └─────────────┴────────────────────────────────────────────────────────┘
   ════════════════════════════════════════════════════════════════════════ */
export const SHAPES = [

    {   /* ── 1  Stars ─────────────────────────────────────────────────── */
        name:      'Stars',
        size:      8,
        sides:     0,
        color:     '#FFFACD',
        glow:      '#f6e58d',
        pts:       1,
        droppable: true,
        dropRate:  5,
        asset:     'planet_star.svg',
    },

    {   /* ── 2  Moon ──────────────────────────────────────────────────── */
        name:      'Moon',
        size:      12,
        sides:     0,
        color:     '#dfe6e9',
        glow:      '#b2bec3',
        pts:       3,
        droppable: true,
        dropRate:  4,
        asset:     'planet_moon.svg',
        outline:   true,    // use SVG silhouette for collision (concave crescent)
    },

    {   /* ── 3  Pluto ─────────────────────────────────────────────────── */
        name:      'Pluto',
        size:      18,
        sides:     0,
        color:     '#a29278',
        glow:      '#6e5b3a',
        pts:       6,
        droppable: true,
        dropRate:  3,
        asset:     'planet_pluto.svg',
    },

    {   /* ── 4  Mercury ───────────────────────────────────────────────── */
        name:      'Mercury',
        size:      22,
        sides:     0,
        color:     '#9c9189',
        glow:      '#5d524a',
        pts:       10,
        droppable: true,
        dropRate:  2,
        asset:     'planet_mercury.svg',
    },

    {   /* ── 5  Mars ──────────────────────────────────────────────────── */
        name:      'Mars',
        size:      25,
        sides:     0,
        color:     '#c1440e',
        glow:      '#7a2a08',
        pts:       15,
        droppable: true,
        dropRate:  3,
        asset:     'planet_mars.svg',
    },

    {   /* ── 6  Venus ─────────────────────────────────────────────────── */
        name:      'Venus',
        size:      31,
        sides:     0,
        color:     '#e6c07a',
        glow:      '#9c7a2e',
        pts:       21,
        droppable: false,
        dropRate:  0,
        asset:     'planet_venus_body.svg',
        expressions: true,  // bare body + separate face overlays (casual/hurt/sad)
    },

    {   /* ── 7  Earth ─────────────────────────────────────────────────── */
        name:      'Earth',
        size:      38,
        sides:     0,
        color:     '#3a8fb7',
        glow:      '#1d4a66',
        pts:       28,
        droppable: false,
        dropRate:  0,
        asset:     'planet_earth_body.svg',
        expressions: true,  // bare body + separate face overlays (casual/hurt/sad)
    },

    {   /* ── 8  Uranus ────────────────────────────────────────────────── */
        name:      'Uranus',
        size:      43,
        sides:     0,
        color:     '#a6e3e9',
        glow:      '#4a8a92',
        pts:       36,
        droppable: false,
        dropRate:  0,
        asset:     'planet_uranus.svg',
    },

    {   /* ── 9  Neptune ───────────────────────────────────────────────── */
        name:      'Neptune',
        size:      50,
        sides:     0,
        color:     '#3a64a8',
        glow:      '#1c3a73',
        pts:       45,
        droppable: false,
        dropRate:  0,
        asset:     'planet_neptune.svg',
    },

    {   /* ── 10  Saturn ───────────────────────────────────────────────── */
        name:      'Saturn',
        size:      72,
        sides:     0,
        color:     '#d4b676',
        glow:      '#8a7038',
        pts:       55,
        droppable: false,
        dropRate:  0,
        asset:     'planet_saturn.svg',
        outline:   true,    // body + rings as separate collider pieces
    },

    {   /* ── 11  Jupiter ──────────────────────────────────────────────── */
        name:      'Jupiter',
        size:      76,
        sides:     0,
        color:     '#c9a979',
        glow:      '#7a5a2c',
        pts:       70,
        droppable: false,
        dropRate:  0,
        asset:     'planet_jupiter.svg',
    },

    {   /* ── 12  Sun — MAX (two Suns touching → both vanish!) ─────────── */
        name:      'Sun',
        size:      95,
        sides:     0,
        color:     '#F8EFBA',
        glow:      '#f9ca24',
        pts:       90,
        droppable: false,
        dropRate:  0,
        asset:     'planet_sun.svg',
        outline:   true,    // disc + rays caught as collider silhouette
    },

];


/* ════════════════════════════════════════════════════════════════════════
   DERIVED HELPERS
   Computed from the config above — no need to edit these.
   ════════════════════════════════════════════════════════════════════════ */

/** Pixel radius for a given level index */
export const r = (lvl) => Math.round(SHAPES[lvl].size / 100 * LAYOUT.BASE_R);

/**
 * Angle correction that aligns drawProcedural's vertex convention
 * with Matter.js Bodies.polygon's internal offset (π/sides).
 *
 * All planets are circles (sides:0) so this returns 0 for every level —
 * branches are kept in case future shapes are added.
 */
export const polyCorr = (lvl) => {
    const s = SHAPES[lvl].sides;
    if (s === 0 || s === 'rect') return 0;
    if (s === 'plus')            return Math.PI / 4 + Math.PI / 2;  // 4-gon proxy
    if (s === 'star')            return Math.PI / 5 + Math.PI / 2;  // 5-gon proxy
    return Math.PI / s + Math.PI / 2;
};

/** Weighted-random drop level — built automatically from droppable + dropRate */
const _table = [];
let   _total = 0;
SHAPES.forEach((s, i) => {
    if (s.droppable && s.dropRate > 0) {
        _table.push({ lvl: i, w: s.dropRate });
        _total += s.dropRate;
    }
});

export function rndLvl() {
    let rand = Math.random() * _total;
    for (const entry of _table) {
        rand -= entry.w;
        if (rand <= 0) return entry.lvl;
    }
    return _table[_table.length - 1].lvl;
}
