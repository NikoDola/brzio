// Opening stages of an endless run, shared by the game and simulations.
import { SHAPES } from './config.js';

// Weights follow the SHAPES order: Stars, Moon, Pluto, Mercury, Mars, Venus.
// Keep the second level's mix for later stages so losing the shield is its
// own difficulty step. Each profile totals 100 for easy percentage tuning.
const OPENING_DROP_WEIGHTS = [0, 10, 10, 10, 30, 40];
const STANDARD_DROP_WEIGHTS = [10, 15, 15, 10, 25, 25];

export const MODES = [
  {
    num: 1,
    name: "Level 1",
    iconLvl: 0, // the Star icon fronts the no-Stars mode; deliberate for now
    drops: [1, 2, 3, 4, 5], // Moon, Pluto, Mercury, Mars, Venus
    dropWeights: OPENING_DROP_WEIGHTS,
    eliminate: true,
    choose: true,
    rainbow: true,
    scoreMult: 1.2,
    blurb: "A gentler start. Frequent Mars and Venus drops help you build your first Suns. No Stars yet, and the rainbow shield keeps your shakes safe.",
  },
  {
    num: 2,
    name: "Level 2",
    iconLvl: 1, // Moon
    drops: [0, 1, 2, 3, 4, 5], // Stars join the pool
    dropWeights: STANDARD_DROP_WEIGHTS,
    eliminate: true,
    choose: true,
    rainbow: true,
    scoreMult: 1.4,
    blurb: "Stars join the mix, and smaller planets drop more often. Build more small matches on the way to your next Suns. The rainbow shield still protects your shakes.",
  },
  {
    num: 3,
    name: "Level 3",
    iconLvl: 2, // Pluto
    drops: [0, 1, 2, 3, 4, 5],
    dropWeights: STANDARD_DROP_WEIGHTS,
    eliminate: true,
    choose: true,
    rainbow: false, // shaking can now throw a planet out and end the run
    scoreMult: 1.5,
    blurb: "No rainbow shield. A careless shake can throw a planet over the rim and end the run.",
  },
];

export function levelFor(value) {
  const num = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
  if (num <= MODES.length) return MODES[num - 1];
  const base = MODES[MODES.length - 1];
  return {
    ...base,
    num,
    name: `Level ${num}`,
    scoreMult: Math.round((base.scoreMult + (num - base.num) * 0.1) * 10) / 10,
    blurb: "Keep the run alive. Every Sun pair advances another level and raises your points multiplier. Shakes have no rainbow shield.",
  };
}

/** Normal weights for this level, including zeroes for merge-only planets. */
export function dropRatesFor(value) {
  const mode = levelFor(value);
  return SHAPES.map((shape, lvl) => mode.drops.includes(lvl)
    ? (mode.dropWeights[lvl] ?? shape.dropRate) : 0);
}

/** Shared selection for live play and seeded simulations. */
export function createDropPicker(value, random = Math.random, rates = dropRatesFor(value)) {
  const table = levelFor(value).drops
    .map(lvl => ({ lvl, weight: rates[lvl] }))
    .filter(entry => entry.weight > 0);
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  return () => {
    let target = random() * total;
    for (const { lvl, weight } of table) {
      if (target < weight) return lvl;
      target -= weight;
    }
    return table.at(-1).lvl;
  };
}

/** The opening drop stays a 50/50 choice between the two smallest planets. */
export function firstDropFor(value, random = Math.random) {
  const small = levelFor(value).drops.slice().sort((a, b) => a - b);
  return small[random() < 0.5 ? 0 : Math.min(1, small.length - 1)];
}

