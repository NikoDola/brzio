/* ════════════════════════════════════════════════════════════════════════
   audio.js  —  sound effects + the mute toggle
   ════════════════════════════════════════════════════════════════════════

   Small pools of Audio clones for the pop so cascading merges can overlap
   without each new pop cutting off the previous one (single Audio.play()
   restarts mid-clip). Laser and target-lock fire one at a time, so a single
   Audio instance each is enough.

   Also owns the Settings sound toggle: it's the only thing that touches
   the mute flag, so the click handler lives here instead of in settings.js. */
const SOUNDS_DIR = "assets/sounds";

const SOUND_KEY = "pm_sound";
let soundOn = (() => {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
})();

function makePool(file, size, volume) {
  const pool = Array.from({ length: size }, () => {
    const a = new Audio(`${SOUNDS_DIR}/${file}`);
    a.preload = "auto";
    a.volume = volume;
    return a;
  });
  let idx = 0;
  return () => {
    if (!soundOn) return;
    const a = pool[idx];
    idx = (idx + 1) % size;
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  };
}
export const playPop = makePool("pop-effect.mp3", 6, 0.55);
export const playGroundHit = makePool("ground-hit.mp3", 3, 0.45);
export const playPlanetHit = makePool("planet-hit.mp3", 4, 0.35);

function makeSfx(file, volume) {
  const a = new Audio(`${SOUNDS_DIR}/${file}`);
  a.preload = "auto";
  a.volume = volume;
  return a;
}
const laserSfx = makeSfx("laser.mp3", 0.55);
const targetLockSfx = makeSfx("target-lock.mp3", 0.6);
const selectSfx = makeSfx("select-sound.mp3", 0.6);
const perkSfx = makeSfx("peark.mp3", 0.7);
function playOnce(sfx) {
  if (!soundOn) return;
  try {
    sfx.currentTime = 0;
    sfx.play().catch(() => {});
  } catch {}
}
export const playLaser = () => playOnce(laserSfx);
export const playTargetLock = () => playOnce(targetLockSfx);
export const playSelect = () => playOnce(selectSfx);
export const playPerk = () => playOnce(perkSfx);

/* Explanation-clip playback for perks with an `audio` field. Exported so
   perks.js doesn't need its own file-loading logic for a single feature. */
export function makeExplainClip(file, volume = 0.9) {
  const a = new Audio(`${SOUNDS_DIR}/${file}`);
  a.volume = volume;
  return a;
}

/* ── Settings: sound on/off toggle ──────────────────────────────────────── */
const soundToggle = document.getElementById("sound-toggle");

export function renderSoundToggle() {
  if (!soundToggle) return;
  soundToggle.classList.toggle("is-on", soundOn);
  soundToggle.setAttribute("aria-checked", String(soundOn));
}

soundToggle?.addEventListener("click", () => {
  soundOn = !soundOn;
  try {
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  } catch {}
  renderSoundToggle();
  if (soundOn) playSelect(); // tiny confirmation blip
});
