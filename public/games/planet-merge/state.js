/* ════════════════════════════════════════════════════════════════════════
   state.js  —  the couple of flags every module needs to agree on
   ════════════════════════════════════════════════════════════════════════

   Most game state stays local to whichever file owns it (the shake meter's
   percent lives in shakes.js, earned perks live in perks.js, and so on).
   `round` exists only because a few independent modules (shakes.js's click
   handler, for one) need to know "is a round actually live right now?"
   without importing game.js itself, which would create a circular import.

   game.js is the only writer. Everyone else only reads. */
export const round = {
  playing: false,
  gameOver: false,
};
