/* ════════════════════════════════════════════════════════════════════════
   settings.js  —  the Settings overlay (gear cell in the HUD)
   ════════════════════════════════════════════════════════════════════════

   Sound toggle lives in audio.js (it's the only thing that owns the mute
   flag); this file owns the overlay itself and the parent controls: an
   optional daily play-time limit protected by a 4-digit PIN. */
import { renderSoundToggle } from "./audio.js";
import { updateStatsUI, loadTodayMs, loadNum, saveNum } from "./stats.js";

const settingsBtn = document.getElementById("settings-btn");
const settingsOverlayEl = document.getElementById("settings-overlay");
const settingsCloseEl = document.getElementById("settings-close");

// Parent control: a daily play-time limit, protected by an optional 4-digit PIN.
const LIMIT_ON_KEY = "pm_limit_on";
const LIMIT_MIN_KEY = "pm_limit_min";
const PIN_KEY = "pm_parent_pin";
let limitOn = (() => {
  try {
    return localStorage.getItem(LIMIT_ON_KEY) === "1";
  } catch {
    return false;
  }
})();
let limitMin = loadNum(LIMIT_MIN_KEY) || 30;
let parentPin = (() => {
  try {
    return localStorage.getItem(PIN_KEY) || "";
  } catch {
    return "";
  }
})();
let parentUnlocked = !parentPin; // no PIN means the controls are open

const limitToggle = document.getElementById("limit-toggle");
const limitMinutes = document.getElementById("limit-minutes");
const pinStatus = document.getElementById("pin-status");
const pinBtn = document.getElementById("pin-btn");

function renderParentControls() {
  if (limitToggle) {
    limitToggle.classList.toggle("is-on", limitOn);
    limitToggle.setAttribute("aria-checked", String(limitOn));
    limitToggle.disabled = !parentUnlocked;
  }
  if (limitMinutes) {
    limitMinutes.value = String(limitMin);
    limitMinutes.disabled = !parentUnlocked;
  }
  if (pinStatus) pinStatus.textContent = parentPin ? "Parent PIN set" : "No parent PIN set";
  if (pinBtn) pinBtn.textContent = !parentPin ? "Set PIN" : parentUnlocked ? "Lock" : "Unlock";
}

// Demand the PIN before changing anything, if one is set.
function ensureUnlocked() {
  if (parentUnlocked) return true;
  const entry = prompt("Enter the 4-digit parent PIN");
  if (entry === parentPin) {
    parentUnlocked = true;
    renderParentControls();
    return true;
  }
  if (entry !== null) alert("Wrong PIN.");
  return false;
}

limitToggle?.addEventListener("click", () => {
  if (!ensureUnlocked()) return;
  limitOn = !limitOn;
  try {
    localStorage.setItem(LIMIT_ON_KEY, limitOn ? "1" : "0");
  } catch {}
  renderParentControls();
});
limitMinutes?.addEventListener("change", () => {
  if (!parentUnlocked) {
    renderParentControls();
    return;
  }
  limitMin = Math.min(600, Math.max(5, parseInt(limitMinutes.value, 10) || 30));
  saveNum(LIMIT_MIN_KEY, limitMin);
  renderParentControls();
});
pinBtn?.addEventListener("click", () => {
  if (!parentPin) {
    const p = prompt("Set a 4-digit parent PIN");
    if (p && /^\d{4}$/.test(p)) {
      parentPin = p;
      parentUnlocked = true;
      try {
        localStorage.setItem(PIN_KEY, p);
      } catch {}
    } else if (p !== null) {
      alert("PIN must be exactly 4 digits.");
    }
  } else if (parentUnlocked) {
    parentUnlocked = false; // lock again
  } else {
    ensureUnlocked();
  }
  renderParentControls();
});

// Daily-limit enforcement: blocks STARTING a new round once today's play time is
// up (an in-progress round is never cut off). Checked by game.js's startGame().
const limitMsgEl = document.getElementById("limit-msg");
export function dailyLimitReached() {
  return limitOn && limitMin > 0 && loadTodayMs() >= limitMin * 60000;
}
export function showLimitMsg(show) {
  if (limitMsgEl) limitMsgEl.hidden = !show;
}

settingsBtn?.addEventListener("click", () => {
  updateStatsUI();
  renderSoundToggle();
  renderParentControls();
  settingsOverlayEl?.classList.add("visible");
});
settingsCloseEl?.addEventListener("click", () =>
  settingsOverlayEl?.classList.remove("visible"),
);
