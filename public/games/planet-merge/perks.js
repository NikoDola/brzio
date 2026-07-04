/* ════════════════════════════════════════════════════════════════════════
   perks.js  —  collectible achievements
   ════════════════════════════════════════════════════════════════════════

   Everything is keyed off the PERKS list below (tabs: wins / merges / losing),
   so adding a perk is just a new entry here plus a call to earnPerk(id) at
   the moment it should unlock. Earned perks persist in localStorage;
   unlocking one pops a card in the centre that flies into the collection
   card under the merges panel. */
import { SHAPES } from "./config.js";
import { casualFaceSrc } from "./planet-icons.js";
import { playPerk, makeExplainClip } from "./audio.js";

const PERK_KEY = "pm_earned_perks";

const PERKS = [
  { id: "win-200",        tab: "wins",   emoji: "🏆", title: "Double Century", goal: "Reach 200 merges in one run" },
  { id: "lose-under-100", tab: "losing", emoji: "💥", title: "Quick Exit",     goal: "Lose with under 100 merges" },
  { id: "lose-under-150", tab: "losing", emoji: "⏳", title: "Cut Short",      goal: "Lose with under 150 merges" },
];
// Optional explanation/voice-over clip per planet (file in assets/sounds).
// Earned perks with one show a play/pause button that plays the clip.
const PERK_AUDIO = {
  Moon: "moon-explaing.mp3",
  Venus: "venus-explain.mp3",
  Earth: "earth-explain.mp3",
};

// One "merge up to this planet" perk for every planet that CAN be made by
// merging — i.e. everything except the smallest (Stars), which is the base
// drop. Earned ONLY when the planet is born from a merge (see flushMerges in
// game.js), never from dropping one: dropping a Mercury gives nothing, but
// merging two Plutos into a Mercury unlocks it.
SHAPES.forEach((s, i) => {
  if (i === 0) return; // Stars are the base planet; can't be merge-created
  const srcName = SHAPES[i - 1].name;
  const srcPlural = srcName.endsWith("s") ? srcName : `${srcName}s`;
  PERKS.push({
    id: `merge-${i}`,
    tab: "merges",
    img: `assets/images/${s.asset}`,
    title: s.name,
    goal: `Merge two ${srcPlural} into a ${s.name}`,
    audio: PERK_AUDIO[s.name],
    level: i, // drives the merge animation in the unlock toast
  });
});

function loadEarnedPerks() {
  const set = new Set();
  try {
    const raw = localStorage.getItem(PERK_KEY);
    if (raw) JSON.parse(raw).forEach((id) => set.add(id));
  } catch (_) {}
  return set;
}
let earnedPerks = loadEarnedPerks();
function saveEarnedPerks() {
  try {
    localStorage.setItem(PERK_KEY, JSON.stringify([...earnedPerks]));
  } catch (_) {}
}

export const perkCardEl = document.getElementById("perk-card");
const perkCountEl = document.getElementById("perk-count");
const perkTotalEl = document.getElementById("perk-total");
export const perksOverlayEl = document.getElementById("perks-overlay");
const perksGridEl = document.getElementById("perks-grid");
export const perksCloseEl = document.getElementById("perks-close");
let perksActiveTab = "wins";
let lastEarnedTab = null; // tab of the most recently earned perk; opens the card straight to it

export const perksOpen = () => !!perksOverlayEl?.classList.contains("visible");

function perkIconHTML(perk) {
  if (!perk.img) return `<span class="perk-emoji">${perk.emoji || "✦"}</span>`;
  // Merge perks (those with a `level`) are planets, so overlay the casual face
  // on the bare body, same as the legend and the live canvas.
  const faceSrc = Number.isInteger(perk.level) ? casualFaceSrc(perk.level) : null;
  const face = faceSrc ? `<img class="planet-face" src="${faceSrc}" alt="">` : "";
  return `<span class="planet-icon"><img src="${perk.img}" alt="">${face}</span>`;
}

export function updatePerkCardUI() {
  if (perkCountEl) perkCountEl.textContent = earnedPerks.size;
  if (perkTotalEl) perkTotalEl.textContent = PERKS.length;
}

// Explanation-clip playback. One clip plays at a time; clicking an audio
// perk (or its button) toggles play/pause.
let perkExplainAudio = null;
let playingPerkId = null;

export function stopPerkAudio() {
  if (perkExplainAudio) {
    perkExplainAudio.pause();
    perkExplainAudio = null;
  }
  playingPerkId = null;
}

function togglePerkAudio(perk) {
  if (!perk.audio) return;
  if (playingPerkId === perk.id) {
    stopPerkAudio();
    if (perksOpen()) renderPerksGrid();
    return;
  }
  stopPerkAudio();
  const a = makeExplainClip(perk.audio);
  a.addEventListener("ended", () => {
    if (playingPerkId === perk.id) stopPerkAudio();
    if (perksOpen()) renderPerksGrid();
  });
  perkExplainAudio = a;
  playingPerkId = perk.id;
  a.play().catch(() => {});
  if (perksOpen()) renderPerksGrid();
}

export function renderPerksGrid() {
  if (!perksGridEl) return;
  perksGridEl.innerHTML = "";
  PERKS.filter((p) => p.tab === perksActiveTab).forEach((perk) => {
    const earned = earnedPerks.has(perk.id);
    const hasAudio = earned && !!perk.audio;
    const tile = document.createElement("div");
    tile.className =
      "perk-tile " + (earned ? "earned" : "locked") + (hasAudio ? " has-audio" : "");
    tile.innerHTML = earned
      ? `<div class="perk-tile-icon">${perkIconHTML(perk)}</div>
         <div class="perk-tile-title">${perk.title}</div>
         <div class="perk-tile-goal">${perk.goal}</div>`
      : `<div class="perk-tile-icon perk-tile-q">?</div>
         <div class="perk-tile-title">???</div>
         <div class="perk-tile-goal">${perk.goal}</div>`;

    if (hasAudio) {
      const playing = playingPerkId === perk.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "perk-audio-btn" + (playing ? " playing" : "");
      btn.setAttribute("aria-label", playing ? "Pause explanation" : "Play explanation");
      btn.textContent = playing ? "⏸" : "▶";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePerkAudio(perk);
      });
      tile.appendChild(btn);
      tile.addEventListener("click", () => togglePerkAudio(perk));
    }

    perksGridEl.appendChild(tile);
  });
}

export function setPerksTab(tab) {
  perksActiveTab = tab;
  document
    .querySelectorAll(".perks-tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  renderPerksGrid();
}

// Jump the grid to the tab of the most recently earned perk (or stay put if
// none earned yet). Used when the in-game perk card is clicked.
export function openToLastEarnedTab() {
  setPerksTab(lastEarnedTab || perksActiveTab);
}

document.querySelectorAll(".perks-tab").forEach((t) =>
  t.addEventListener("click", () => {
    stopPerkAudio();
    setPerksTab(t.dataset.tab);
  }),
);

perksCloseEl?.addEventListener("click", () => {
  perksOverlayEl.classList.remove("visible");
  stopPerkAudio(); // don't keep a clip playing once the overlay is closed
});

/* Earn + the "card flies into the collection" toast (queued so simultaneous
   unlocks play one after another instead of stacking). */
const perkToastQueue = [];
let perkToastPlaying = false;

export function earnPerk(id) {
  if (earnedPerks.has(id)) return;
  const perk = PERKS.find((p) => p.id === id);
  if (!perk) return; // ignore ids that aren't real perks (e.g. droppable planets)
  earnedPerks.add(id);
  lastEarnedTab = perk.tab; // so opening the card lands on this perk's tab
  saveEarnedPerks();
  updatePerkCardUI();
  if (perksOpen()) setPerksTab(perk.tab); // already open → jump to the new perk
  playPerk();
  perkToastQueue.push(perk);
  if (!perkToastPlaying) playNextPerkToast();
}

function playNextPerkToast() {
  if (!perkToastQueue.length) {
    perkToastPlaying = false;
    return;
  }
  perkToastPlaying = true;
  animatePerkEarn(perkToastQueue.shift(), playNextPerkToast);
}

function animatePerkEarn(perk, done) {
  if (!perkCardEl) {
    done();
    return;
  }
  const toast = document.createElement("div");
  // Merge perks (those with a `level`) play a mini "two planets merge → result"
  // clip so a kid sees exactly how the planet was made. ~1s: ~0.5s the two
  // smaller planets fly together and pop, ~0.5s the merged planet rises up.
  const isMerge = Number.isInteger(perk.level) && perk.level > 0;
  if (isMerge) {
    const srcImg = `assets/images/${SHAPES[perk.level - 1].asset}`;
    // Casual faces ride on top of each body, sharing the same animation class
    // so they fly and pop in lock-step with the planet underneath them.
    const srcFace = casualFaceSrc(perk.level - 1);
    const resFace = casualFaceSrc(perk.level);
    const faceImg = (cls, src) =>
      src ? `<img class="${cls}" src="${src}" alt="">` : "";
    toast.className = "perk-toast merge";
    toast.innerHTML = `
      <div class="perk-toast-badge">Perk unlocked!</div>
      <div class="perk-merge-stage">
        <img class="pm-src pm-src-l" src="${srcImg}" alt="">
        ${faceImg("pm-src pm-src-l", srcFace)}
        <img class="pm-src pm-src-r" src="${srcImg}" alt="">
        ${faceImg("pm-src pm-src-r", srcFace)}
        <img class="pm-result" src="${perk.img}" alt="">
        ${faceImg("pm-result", resFace)}
      </div>
      <div class="perk-toast-title">${perk.title}</div>`;
  } else {
    toast.className = "perk-toast";
    toast.innerHTML = `
      <div class="perk-toast-badge">Perk unlocked!</div>
      <div class="perk-toast-icon">${perkIconHTML(perk)}</div>
      <div class="perk-toast-title">${perk.title}</div>`;
  }
  document.body.appendChild(toast);

  // Pop in at centre.
  requestAnimationFrame(() => toast.classList.add("show"));

  // Hold long enough for the merge clip to finish, then fly into the
  // collection card under the merges panel.
  const flyDelay = isMerge ? 1450 : 1050;
  setTimeout(() => {
    const card = perkCardEl.getBoundingClientRect();
    const dx = card.left + card.width / 2 - window.innerWidth / 2;
    const dy = card.top + card.height / 2 - window.innerHeight / 2;
    toast.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.12)`;
    toast.style.opacity = "0";
    toast.classList.add("fly");
  }, flyDelay);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    toast.remove();
    perkCardEl.classList.remove("pulse");
    void perkCardEl.offsetWidth; // restart the pulse animation
    perkCardEl.classList.add("pulse");
    done();
  };
  toast.addEventListener("transitionend", (e) => {
    if (e.propertyName === "transform" && toast.classList.contains("fly")) {
      finish();
    }
  });
  setTimeout(finish, 2400); // safety net if transitionend never fires
}

// Dev "Local Storage CLEAR": wipe earned perks so unlocks (and the first-time
// glow) can be retested from scratch without hand-clearing browser storage.
export function clearEarnedPerks() {
  try {
    localStorage.removeItem(PERK_KEY);
  } catch {}
  earnedPerks = new Set();
  updatePerkCardUI();
  if (perksOpen()) renderPerksGrid();
}
