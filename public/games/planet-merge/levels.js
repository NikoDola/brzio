/* ════════════════════════════════════════════════════════════════════════
   levels.js: the difficulty ladder, the droppable roster, and the
   level-up toast
   ════════════════════════════════════════════════════════════════════════

   One endless mode. Difficulty steps up by score. Each LEVELS entry:
     from      → score needed to ENTER this level
     drops     → droppable planet levels while at this level
     eliminate → can the chain still grant the Eliminate (destroy) power
     choose    → can the chain still grant the Choose-your-next-planet power
     rainbow   → do shakes raise the rainbow shield (and suspend game-over)?
                 defaults to true; set false to make shaking risky (Level 6+)
     autoShake → do shakes fire on their own on random drops, with the manual
                 shake button locked out? defaults to false (Level 7+ earthquake)
     title/now/next → level-up toast copy (what changed, what's coming next)
     card      → optional visual on the level-up toast (see levelCardHTML):
                   { type: "planet", lvl }            a plain planet icon
                   { type: "icon", icon: "shake" }    a power icon, no cross-out
                   { type: "ban", planet: lvl }       a planet, crossed out
                   { type: "ban", icon: "eliminate" } the destroy power, crossed out
                   { type: "ban", icon: "choose" }    the choose power, crossed out
                   { type: "ban", icon: "rainbow" }   the rainbow shield, crossed out
   `level` is 1-based (LEVELS[level - 1] is the current row). Append rows to
   extend the ramp, nothing else needs to change. Level 1's card never shows
   (the game starts there, so no entry toast fires for it). */
import { SHAPES } from "./config.js";
import { planetIconHTML, applyLegendMode } from "./planet-icons.js";
import { playPerk } from "./audio.js";

const LEVELS = [
  {
    from: 0,
    drops: [1, 2, 3, 4, 5], // Moon, Pluto, Mercury, Mars, Venus (no Stars yet)
    eliminate: true,
    choose: true,
    title: "Level 1",
    now: "",
    next: "Next: Stars start dropping",
    card: null,
  },
  {
    from: 3000,
    drops: [0, 1, 2, 3, 4, 5], // Stars join the pool (Venus still drops)
    eliminate: true,
    choose: true,
    title: "Level 2",
    now: "Stars now drop too!",
    next: "Next: Venus stops dropping",
    card: { type: "planet", lvl: 0 }, // Stars
  },
  {
    from: 7000,
    drops: [0, 1, 2, 3, 4], // Venus removed from the pool
    eliminate: true,
    choose: true,
    title: "Level 3",
    now: "Venus stops dropping",
    next: "Next: Eliminate power turns off",
    card: { type: "ban", planet: 5 }, // Venus, crossed out
  },
  {
    from: 12000,
    drops: [0, 1, 2, 3, 4],
    eliminate: false, // no more Eliminate power
    choose: true,
    title: "Level 4",
    now: "Eliminate power disabled",
    next: "Next: Choose power turns off",
    card: { type: "ban", icon: "eliminate" },
  },
  {
    from: 15000,
    drops: [0, 1, 2, 3, 4],
    eliminate: false,
    choose: false, // no more Choose power
    title: "Level 5",
    now: "Choose power disabled",
    next: "Next: no rainbow shield on shakes",
    card: { type: "ban", icon: "choose" },
  },
  {
    from: 20000,
    drops: [0, 1, 2, 3, 4],
    eliminate: false,
    choose: false,
    rainbow: false, // shakes stop raising the rainbow shield: shaking can now cost you the game
    title: "Level 6",
    now: "No rainbow shield on shakes",
    next: "Next: shakes go automatic",
    card: { type: "ban", icon: "rainbow" },
  },
  {
    from: 250000,
    drops: [0, 1, 2, 3, 4],
    eliminate: false,
    choose: false,
    rainbow: false,
    autoShake: true, // random earthquakes fire by themselves; the manual shake button is locked out
    title: "Level 7",
    now: "Auto earthquake! Shakes fire on their own",
    next: "Final level!",
    card: { type: "icon", icon: "shake" },
  },
];
let level = 1;
export const getLevel = () => level;
export const curLevel = () => LEVELS[level - 1];
// Shakes raise the rainbow shield (and suspend game-over) unless a level turns
// it off. Auto-shake levels fire shake bursts on their own AND lock out the
// manual shake button. Both default on/off when a level row omits the field.
export const rainbowEnabled = () => curLevel().rainbow !== false;
export const autoShakeEnabled = () => curLevel().autoShake === true;

export let droppableLvls = [];
let dropTable = [];
let dropTotal = 0;

function rebuildDropTable() {
  dropTable.length = 0;
  dropTotal = 0;
  droppableLvls = curLevel().drops.slice();
  for (const lvl of droppableLvls) {
    const w = SHAPES[lvl].dropRate || 1;
    dropTable.push({ lvl, w });
    dropTotal += w;
  }
}
rebuildDropTable();

// Dev panel "Drop" selector: 'weighted' (default), 'random' (uniform across
// all 12), or a specific level index that always drops that planet.
let dropMode = "weighted";
export function setDropMode(mode) {
  dropMode = mode;
}

export function pickLvl() {
  if (dropMode === "weighted") {
    let rand = Math.random() * dropTotal;
    for (const e of dropTable) {
      rand -= e.w;
      if (rand <= 0) return e.lvl;
    }
    return dropTable[dropTable.length - 1].lvl;
  }
  if (dropMode === "random") return Math.floor(Math.random() * SHAPES.length);
  return dropMode;
}

// First drop of each game opens with one of the two smallest planets in the
// current roster, so the player isn't handed a big planet from cold.
export function firstDrop() {
  if (dropMode !== "weighted") return pickLvl();
  const small = droppableLvls.slice().sort((a, b) => a - b);
  return Math.random() < 0.5 ? small[0] : small[Math.min(1, small.length - 1)];
}

// Reset to Level 1 (new game) or jump straight to a saved level (resume).
// Both rebuild the roster; resetGameState/restoreGame in game.js call these
// instead of touching `level` directly.
export function resetLevel() {
  level = 1;
  rebuildDropTable();
  updateLevelHud();
}
export function restoreLevel(savedLevel) {
  level = savedLevel || 1;
  rebuildDropTable();
  updateLevelHud();
}

/* ── LEVEL-UP TOAST ──────────────────────────────────────────────────────
   When the score crosses a LEVELS threshold the level steps up: the roster and
   power rules change and a banner slides in from the top for ~2.6s announcing
   what changed plus a preview of the next level. It never pauses the game; a
   chain that crosses two thresholds queues both banners.

   Charge revocation (dropping a held Choose/Eliminate charge the moment a
   level bans it) stays in game.js: it owns powerCharges/destroyCharges, so it
   calls checkLevelUp(score) and then checks curLevel().eliminate/.choose
   itself right after. */
const levelToastQueue = [];
let levelToastPlaying = false;

export function checkLevelUp(score) {
  let leveled = false;
  while (level < LEVELS.length && score >= LEVELS[level].from) {
    level++;
    leveled = true;
    rebuildDropTable();
    applyLegendMode(droppableLvls);
    levelToastQueue.push(curLevel());
  }
  if (leveled) {
    updateLevelHud();
    if (levelInfoOpen()) renderLevelCard(); // card is live, keep it honest
  }
  if (leveled && !levelToastPlaying) playNextLevelToast();
}

function playNextLevelToast() {
  if (!levelToastQueue.length) {
    levelToastPlaying = false;
    return;
  }
  levelToastPlaying = true;
  showLevelToast(levelToastQueue.shift(), playNextLevelToast);
}

/* Inline SVG for the two powers, used by the crossed-out level cards. Eliminate
   is the pink target crosshair (matches drawDestroyTargets); Choose is the cyan
   cycle arrows (matches the ‹ › planet-swap arrows). */
const POWER_SVG = {
  eliminate: `<svg class="level-toast-svg eliminate" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7"></circle>
      <line x1="12" y1="1" x2="12" y2="5"></line>
      <line x1="12" y1="19" x2="12" y2="23"></line>
      <line x1="1" y1="12" x2="5" y2="12"></line>
      <line x1="19" y1="12" x2="23" y2="12"></line>
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"></circle>
    </svg>`,
  choose: `<svg class="level-toast-svg choose" viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="9 5 3 12 9 19"></polyline>
      <polyline points="15 5 21 12 15 19"></polyline>
    </svg>`,
  // Rainbow arch (the shake shield). Each band carries its own colour inline, so
  // it stays a rainbow even under the crossed-out level card.
  rainbow: `<svg class="level-toast-svg rainbow" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M3 18a9 9 0 0 1 18 0" stroke="#ff3b3b"></path>
      <path d="M6 18a6 6 0 0 1 12 0" stroke="#ffd23f"></path>
      <path d="M9 18a3 3 0 0 1 6 0" stroke="#3bd16f"></path>
    </svg>`,
  // Seismograph-style bars for the auto-shake / earthquake level.
  shake: `<svg class="level-toast-svg shake" viewBox="0 0 24 24" aria-hidden="true">
      <line x1="4" y1="9" x2="4" y2="15"></line>
      <line x1="8" y1="5" x2="8" y2="19"></line>
      <line x1="12" y1="8" x2="12" y2="16"></line>
      <line x1="16" y1="4" x2="16" y2="20"></line>
      <line x1="20" y1="9" x2="20" y2="15"></line>
    </svg>`,
};

/* Build the optional visual for a level-up toast from its `card` descriptor.
   A "ban" card lays a no-smoking-style red ring + slash over the icon behind. */
function levelCardHTML(card) {
  if (!card) return "";
  if (card.type === "planet") {
    return `<div class="level-toast-visual">${planetIconHTML(card.lvl)}</div>`;
  }
  if (card.type === "icon") {
    return `<div class="level-toast-visual">${POWER_SVG[card.icon] || ""}</div>`;
  }
  if (card.type === "ban") {
    const icon =
      card.planet !== undefined ? planetIconHTML(card.planet) : POWER_SVG[card.icon] || "";
    return `<div class="level-toast-visual banned">
        <div class="level-toast-behind">${icon}</div>
        <div class="level-toast-ban" aria-hidden="true"></div>
      </div>`;
  }
  return "";
}

function showLevelToast(lv, done) {
  const toast = document.createElement("div");
  toast.className = "level-toast";
  toast.innerHTML = `
    ${levelCardHTML(lv.card)}
    <div class="level-toast-title">${lv.title}</div>
    ${lv.now ? `<div class="level-toast-now">${lv.now}</div>` : ""}
    ${lv.next ? `<div class="level-toast-next">${lv.next}</div>` : ""}`;
  document.body.appendChild(toast);
  playPerk();
  requestAnimationFrame(() => toast.classList.add("show"));

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    toast.remove();
    done();
  };
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(finish, 500);
  }, 2600);
}

/* ── LEVEL HUD CELL + CURRENT-LEVEL CARD ─────────────────────────────────
   The LEVEL cell sits between Settings and SHAKES in the HUD and shows the
   current level number. Clicking it opens #level-overlay: a card that spells
   out the live LEVELS row as bullets (what drops, which powers still work,
   rainbow shield, manual vs automatic shakes) plus the next threshold.
   game.js checks levelInfoOpen() in drop() so the spacebar can't fire a
   planet under the card. */
const levelPanelEl = document.getElementById("level-panel");
const levelValueEl = document.getElementById("level-value");
const levelOverlayEl = document.getElementById("level-overlay");
const levelTitleEl = document.getElementById("level-title");
const levelBodyEl = document.getElementById("level-body");
const levelCloseEl = document.getElementById("level-close");

export const levelInfoOpen = () => !!levelOverlayEl?.classList.contains("visible");

function updateLevelHud() {
  if (levelValueEl) levelValueEl.textContent = String(level);
}

/* One card bullet: green check when a mechanic is on, red cross when the
   level has taken it away. */
function ruleHTML(on, onText, offText) {
  return `<li class="level-rule ${on ? "on" : "off"}">
      <span class="level-rule-mark" aria-hidden="true">${on ? "✓" : "✗"}</span>
      <span>${on ? onText : offText}</span>
    </li>`;
}

function renderLevelCard() {
  if (!levelBodyEl) return;
  const lv = curLevel();
  if (levelTitleEl) levelTitleEl.textContent = `Level ${level}`;
  const icons = lv.drops
    .map((l) => `<span class="level-drop-icon" title="${SHAPES[l].name}">${planetIconHTML(l)}</span>`)
    .join("");
  const nextRow = LEVELS[level]; // undefined on the final level
  const nextLine = nextRow
    ? `${lv.next} (at ${nextRow.from.toLocaleString()} points)`
    : lv.next;
  levelBodyEl.innerHTML = `
    <div class="level-drops-label">Dropping now</div>
    <div class="level-drops-icons">${icons}</div>
    <ul class="level-rules">
      ${ruleHTML(
        lv.choose !== false,
        "Choose power: a 3 merge chain lets you pick your next planet",
        "Choose power: turned off at this level",
      )}
      ${ruleHTML(
        lv.eliminate !== false,
        "Eliminate power: a 5 merge chain lets you wipe out one planet type",
        "Eliminate power: turned off at this level",
      )}
      ${ruleHTML(
        lv.rainbow !== false,
        "Rainbow shield: shaking is safe, the run can't end mid-shake",
        "Rainbow shield: gone, a careless shake can end the run",
      )}
      ${ruleHTML(
        lv.autoShake !== true,
        "Shake button: merges fill the meter, tap SHAKES to fire one",
        "Shake button: locked, earthquakes fire on their own after drops",
      )}
    </ul>
    <div class="level-next">${nextLine}</div>`;
}

levelPanelEl?.addEventListener("click", () => {
  renderLevelCard();
  levelOverlayEl?.classList.add("visible");
});
levelCloseEl?.addEventListener("click", () =>
  levelOverlayEl?.classList.remove("visible"),
);
updateLevelHud();
