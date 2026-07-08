/* ════════════════════════════════════════════════════════════════════════
   planet-icons.js  —  shared "draw a planet as a small DOM icon" helpers
   ════════════════════════════════════════════════════════════════════════

   Used by the merge-order legend (this file), the perk tiles (perks.js), and
   the level-up toast cards (levels.js), so they all render the exact same
   body + casual-face combo instead of three slightly different versions. */
import { SHAPES, r } from "./config.js";

/* Casual-face overlay path for a planet that has expressions, or null. Mirrors
   the renderer's filename derivation: drop `.svg` and the `_body` suffix from
   the body asset, then append `_casual.svg`. Used by the static DOM displays
   (legend, perk icons, level toasts) so they show the same face the canvas draws. */
export function casualFaceSrc(lvl) {
  const s = SHAPES[lvl];
  if (!s || !s.expressions || !s.asset) return null;
  const stem = s.asset.replace(/\.svg$/i, "").replace(/_body$/, "");
  return `assets/images/${stem}_casual.svg`;
}

/* A planet's decorative accessories for the DOM icons (Saturn's ring, the Sun's
   corona + sunglasses), or []. Each carries its image src, whether it sits
   behind or in front of the body, and an inline style (size + offset) derived
   from the same ratios the canvas renderer uses, so the icon matches the game.
   'wrap' accessories (the ring) are drawn fully behind here so the face stays
   clear while their tips poke out the sides. */
export function accessoryList(lvl) {
  const s = SHAPES[lvl];
  if (!s?.accessories) return [];
  return s.accessories.map((acc) => ({
    src: `assets/images/${acc.asset}`,
    inFront: acc.layer === "front",
    style: accessoryStyle(lvl, acc),
  }));
}

/* Size (% of the icon box) + centred offset for one accessory, mirroring
   renderer.js accessoryRect: inflatePx grows a square outset, otherwise
   wRatio/hRatio set the box; xRatio/yRatio shift the centre. */
function accessoryStyle(lvl, acc) {
  const diameter = r(lvl) * 2;
  const wFrac = acc.inflatePx != null ? (diameter + 2 * acc.inflatePx) / diameter : acc.wRatio ?? 1;
  const hFrac = acc.inflatePx != null ? (diameter + 2 * acc.inflatePx) / diameter : acc.hRatio ?? 1;
  const leftPct = (0.5 + (acc.xRatio || 0)) * 100;
  const topPct = (0.5 + (acc.yRatio || 0)) * 100;
  return `width:${(wFrac * 100).toFixed(2)}%;height:${(hFrac * 100).toFixed(2)}%;left:${leftPct.toFixed(2)}%;top:${topPct.toFixed(2)}%;transform:translate(-50%,-50%);`;
}

/* A planet's body+face icon markup: bare body with the casual face overlaid,
   plus any decorative accessories layered behind or in front (Saturn, Sun). */
export function planetIconHTML(lvl) {
  const s = SHAPES[lvl];
  const face = casualFaceSrc(lvl);
  const accs = accessoryList(lvl);
  const back = accs.filter((a) => !a.inFront);
  const front = accs.filter((a) => a.inFront);
  const accHTML = (a) =>
    `<img class="planet-accessory${a.inFront ? "" : " is-back"}" src="${a.src}" style="${a.style}" alt="">`;
  return `<span class="planet-icon">${back.map(accHTML).join("")}<img src="assets/images/${s.asset}" alt="">${
    face ? `<img class="planet-face" src="${face}" alt="">` : ""
  }${front.map(accHTML).join("")}</span>`;
}

/* ── Merge-order legend ──────────────────────────────────────────────────
   Built from SHAPES: smallest → largest, each icon 5% bigger than the last.
   Generated (not hardcoded) so it always matches the real planet chain.

   Smaller on mobile (matches the stacked-controls breakpoint in style.css)
   so the legend takes less vertical room and the how-to-play button below
   it stays on screen without needing a scroll, which the page disables. */
const planetLegendEl = document.getElementById("planet-legend");
const mobileLegendQuery = window.matchMedia("(max-width: 700px)");
let lastDroppableLvls = []; // reapplied after a resize-triggered rebuild

function buildPlanetLegend() {
  if (!planetLegendEl) return;
  planetLegendEl.innerHTML = "";
  const BASE = mobileLegendQuery.matches ? 15 : 22; // px, the smallest planet (first in SHAPES)
  const STEP = 1.05; // each planet 5% larger than the one before it
  SHAPES.forEach((s, i) => {
    const px = Math.round(BASE * Math.pow(STEP, i));
    const item = document.createElement("div");
    item.className = "legend-item";
    item.dataset.lvl = i;

    const icon = document.createElement("div");
    icon.className = "planet-icon";
    icon.style.width = `${px}px`;
    icon.style.height = `${px}px`;

    const accs = accessoryList(i);
    const appendAccessory = (a) => {
      const el = document.createElement("img");
      el.className = a.inFront ? "planet-accessory" : "planet-accessory is-back";
      el.src = a.src;
      el.alt = "";
      el.setAttribute("style", a.style);
      icon.appendChild(el);
    };
    accs.filter((a) => !a.inFront).forEach(appendAccessory);

    const img = document.createElement("img");
    img.src = `assets/images/${s.asset}`;
    img.alt = s.name;
    icon.appendChild(img);

    const faceSrc = casualFaceSrc(i);
    if (faceSrc) {
      const face = document.createElement("img");
      face.className = "planet-face";
      face.src = faceSrc;
      face.alt = "";
      icon.appendChild(face);
    }

    accs.filter((a) => a.inFront).forEach(appendAccessory);

    item.appendChild(icon);
    planetLegendEl.appendChild(item);
  });
  applyLegendMode(lastDroppableLvls);
}
buildPlanetLegend();

// Rebuild at the mobile/desktop size boundary (a rotated phone or a resized
// desktop window can cross it mid-session); rebuilding clears the DOM, so
// buildPlanetLegend reapplies the last known droppable roster afterward.
mobileLegendQuery.addEventListener("change", buildPlanetLegend);

// Hidden until the round starts (the start screen is the first screen).
planetLegendEl?.classList.add("hidden");

export function showLegend() {
  planetLegendEl?.classList.remove("hidden");
}
export function hideLegend() {
  planetLegendEl?.classList.add("hidden");
}

/* Level 1 never drops Stars, so the chain effectively starts at the Moon —
   hide the Star from the legend until Stars join the roster (Level 2). */
export function applyLegendMode(droppableLvls) {
  if (!planetLegendEl) return;
  lastDroppableLvls = droppableLvls;
  const starsDrop = droppableLvls.includes(0);
  planetLegendEl.querySelectorAll(".legend-item").forEach((item) => {
    const lvl = Number(item.dataset.lvl);
    item.classList.toggle("legend-hidden", lvl === 0 && !starsDrop);
  });
}
