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
    DROP_GAP:     20,      // gap between the red player marker bottom and the top of the waiting planet
    PLAYER_MARKER_W: 170, // 15% smaller than the original 200px placeholder
    PLAYER_MARKER_H: 119, // keeps the same 10:7 ratio
    SCORE_Y:      81,     // y-centre of the big faded score painted in the open sky above the container, independent from each planet's dynamic drop row
    WALL_TOP:     133,    // y where the side walls begin; above is open air, so an overfull stack can push planets over the edge and out (falling out ends the game)
    BASE_R:       216,    // pixel radius of a shape whose size is 100 (the Sun) — +20% from 180
    VANISH_BONUS: 4096,   // bonus score when two Suns touch and vanish (2x a Sun)
};


/* ── BALANCE ─────────────────────────────────────────────────────────────
   Gameplay tuning numbers that used to be scattered across game.js. Chain
   thresholds, shake costs, and impact-speed cutoffs all live here so tweaking
   the game's feel means editing this one file.                             */
export const BALANCE = {
    DROP_COOLDOWN_MS:      560,   // time between drops
    CHOOSE_UNLOCK:         3,     // merges in one chain to earn "pick your next planet"
    DESTROY_UNLOCK:        5,     // merges in one chain to earn the Eliminate power

    NO_ROOM_MS:            900,   // full board must persist this long before it ends the run (rides out mid-chain crowding)

    // Shakes meter (see shakes.js)
    SHAKE_COST:            10,    // % of the meter spent per shake click (10 clicks per full bar)
    SHAKE_WINDOW_MS:       700,   // "still shaking" window that ramps the streak
    SHAKE_MAX_STREAK:      3,     // streak multiplier cap so mashing can't run away
    SHAKE_MAX_UP:          5,     // velocity clamp, upward (px/tick)
    SHAKE_MAX_SIDE:        12,    // velocity clamp, sideways (px/tick)
    POP_MAX_UP:            12,    // pop height ceiling (keeps planets in view)
    POP_MAX_SIDE:          6,
    POP_LOAD:              0.05,  // how much mass stacked on top dampens the pop height
    SETTLE_SPEED:          3,     // a planet moving faster than this counts as airborne
    PROTECT_MS:            4000,  // rainbow shield duration, refreshed on each shake
    AUTO_SHAKE_CHANCE:     0.5,   // odds a Level 7+ drop triggers an earthquake burst

    // Collision impact feel
    IMPACT_KICK_MIN_SPEED: 4,     // px/tick — ignore gentle resting contacts
    IMPACT_KICK_SPEED_CAP: 20,    // px/tick — clamp so terminal-velocity drops don't explode the stack
    GROUND_HIT_MIN_SPEED:  5,     // px/tick — floor-impact SFX threshold
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
   │ pts         │ base score for MERGING two of this planet (2^level)    │
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
        pts:       2,
        droppable: true,
        dropRate:  4,
        asset:     'planet_moon_body.svg',
        expressions: true,  // bare body + separate face overlays (casual/hurt/sad)
    },

    {   /* ── 3  Pluto ─────────────────────────────────────────────────── */
        name:      'Pluto',
        size:      18,
        sides:     0,
        color:     '#a29278',
        glow:      '#6e5b3a',
        pts:       4,
        droppable: true,
        dropRate:  3,
        asset:     'planet_pluto_body.svg',
        expressions: true,  // bare body + separate face overlays (casual/hurt/sad)
    },

    {   /* ── 4  Mercury ───────────────────────────────────────────────── */
        name:      'Mercury',
        size:      22,
        sides:     0,
        color:     '#9c9189',
        glow:      '#5d524a',
        pts:       8,
        droppable: true,
        dropRate:  2,
        asset:     'planet_mercury_body.svg',
        expressions: true,  // bare body + separate face overlays (casual/hurt/sad)
    },

    {   /* ── 5  Mars ──────────────────────────────────────────────────── */
        name:      'Mars',
        size:      25,
        sides:     0,
        color:     '#c1440e',
        glow:      '#7a2a08',
        pts:       16,
        droppable: true,
        dropRate:  3,
        asset:     'planet_mars_body.svg',
        expressions: true,  // bare body + separate face overlays (casual/hurt/sad)
    },

    {   /* ── 6  Venus ─────────────────────────────────────────────────── */
        name:      'Venus',
        size:      31,
        sides:     0,
        color:     '#e6c07a',
        glow:      '#9c7a2e',
        pts:       32,
        droppable: true,   // drops in early levels only (see LEVELS in game.js)
        dropRate:  1,      // rare: it's a big planet
        asset:     'planet_venus_body.svg',
        expressions: true,  // bare body + separate face overlays (casual/hurt/sad)
    },

    {   /* ── 7  Earth ─────────────────────────────────────────────────── */
        name:      'Earth',
        size:      38,
        sides:     0,
        color:     '#3a8fb7',
        glow:      '#1d4a66',
        pts:       64,
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
        pts:       128,
        droppable: false,
        dropRate:  0,
        asset:     'planet_uranus_body.svg',
        expressions: true,  // bare body + separate face overlays (casual/hurt/sad)
    },

    {   /* ── 9  Neptune ───────────────────────────────────────────────── */
        name:      'Neptune',
        size:      50,
        sides:     0,
        color:     '#3a64a8',
        glow:      '#1c3a73',
        pts:       256,
        droppable: false,
        dropRate:  0,
        asset:     'planet_neptune_body.svg',
        expressions: true,  // bare body + separate face overlays (casual/hurt/sad)
    },

    {   /* ── 10  Saturn ───────────────────────────────────────────────── */
        name:      'Saturn',
        size:      72,
        sides:     0,
        color:     '#d4b676',
        glow:      '#8a7038',
        pts:       512,
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
        pts:       1024,
        droppable: false,
        dropRate:  0,
        asset:     'planet_jupiter_body.svg',
        expressions: true,  // bare body + separate face overlays (casual/hurt/sad)
    },

    {   /* ── 12  Sun — MAX (two Suns touching → both vanish!) ─────────── */
        name:      'Sun',
        size:      95,
        sides:     0,
        color:     '#F8EFBA',
        glow:      '#f9ca24',
        pts:       2048,
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
