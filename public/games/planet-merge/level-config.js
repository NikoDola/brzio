// Shared level definitions for the game and simulations.
export const MODES = [
  {
    num: 1,
    name: "Level 1",
    iconLvl: 0, // the Star icon fronts the no-Stars mode; deliberate for now
    drops: [1, 2, 3, 4, 5], // Moon, Pluto, Mercury, Mars, Venus
    eliminate: true,
    choose: true,
    rainbow: true,
    scoreMult: 1.2,
    blurb: "The opening run. Moon through Venus drop, no Stars yet, and the rainbow shield keeps your shakes safe.",
  },
  {
    num: 2,
    name: "Level 2",
    iconLvl: 1, // Moon
    drops: [0, 1, 2, 3, 4, 5], // Stars join the pool
    eliminate: true,
    choose: true,
    rainbow: true,
    scoreMult: 1.4,
    blurb: "Stars join the drop pool and crowd the board faster. The rainbow shield still protects your shakes.",
  },
  {
    num: 3,
    name: "Level 3",
    iconLvl: 2, // Pluto
    drops: [0, 1, 2, 3, 4, 5],
    eliminate: true,
    choose: true,
    rainbow: false, // shaking can now throw a planet out and end the run
    scoreMult: 1.5,
    blurb: "No rainbow shield. A careless shake can throw a planet over the rim and end the run.",
  },
];

